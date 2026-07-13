"use server";

import { createClient } from "@/shared/config/supabase/server";
import { DOCUMENT_STATUSES } from "@/shared/constants/general";
import { DOCUMENTS_BUCKET } from "@/features/documents/service";
import { getPlanLimits, formatStorage } from "@/features/billing/service";
import extractPdfPages from "@/features/documents/lib/pdf";
import { chunkPages } from "@/features/documents/lib/chunk";
import { embedChunks } from "@/features/documents/lib/embedding";
import { getCurrentUser } from "@/features/auth/service";

export async function ingestDocument(documentId: string) {
	const supabase = await createClient();
	const { data: doc, error } = await supabase
		.from("documents")
		.select("storage_path, user_id")
		.eq("id", documentId)
		.single();

	if (error || !doc) return { error: error?.message ?? "Document not found" };

	await supabase
		.from("documents")
		.update({ status: DOCUMENT_STATUSES.PROCESSING })
		.eq("id", documentId);
	try {
		const { data: blob, error: dlError } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.download(doc?.storage_path);
		if (dlError || !blob) throw new Error(dlError?.message ?? "Download failed");
		const buffer = new Uint8Array(await blob!.arrayBuffer());

		const pages = await extractPdfPages(buffer);
		const chunks = chunkPages(pages);
		if (!chunks.length) {
			throw new Error("No text found in the PDF");
		}

		const embeddings = await embedChunks(chunks.map((chunk) => chunk.content));

		await supabase.from("chunks").delete().eq("document_id", documentId);
		const { error: insertError } = await supabase.from("chunks").insert(
			chunks.map((c, i) => ({
				document_id: documentId,
				user_id: doc?.user_id,
				content: c.content,
				page: c.page,
				chunk_index: c.chunkIndex,
				embedding: embeddings[i],
			})),
		);
		if (insertError) throw new Error(insertError.message);

		await supabase
			.from("documents")
			.update({ status: DOCUMENT_STATUSES.READY })
			.eq("id", documentId);
		return {};
	} catch (error) {
		console.error("ingestDocument failed:", error);
		await supabase
			.from("documents")
			.update({ status: DOCUMENT_STATUSES.ERROR })
			.eq("id", documentId);

		return { error: error instanceof Error ? error.message : "Ingestion failed" };
	}
}

export async function createDocument(input: {
	name: string;
	storagePath: string;
}): Promise<{ documentId?: string; error?: string }> {
	const supabase = await createClient();
	const user = await getCurrentUser();
	const isGuest = user?.is_anonymous ?? false;

	if (!user) {
		return { error: "Not authenticated" };
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("plan")
		.eq("id", user.id)
		.single();
	const limits = getPlanLimits(profile?.plan);

	if (limits.maxFiles !== null) {
		const { count } = await supabase.from("documents").select("id", { count: "exact", head: true });
		if ((count ?? 0) >= limits.maxFiles) {
			await supabase.storage.from(DOCUMENTS_BUCKET).remove([input.storagePath]);
			return { error: `Your plan allows up to ${limits.maxFiles} document(s).` };
		}
	}

	const folder = input.storagePath.split("/").slice(0, -1).join("/");
	const fileName = input.storagePath.split("/").pop() ?? "";
	const { data: files } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.list(folder, { search: fileName });
	const uploadedSize = files?.find((entry) => entry.name === fileName)?.metadata?.size ?? 0;
	if (isGuest && limits.maxFileSize !== null && uploadedSize > limits.maxFileSize) {
		await supabase.storage.from(DOCUMENTS_BUCKET).remove([input.storagePath]);
		const maxMb = Math.round(limits.maxFileSize / (1024 * 1024));
		return { error: `File is too large (max ${maxMb} MB on your plan).` };
	}

	const { data: sizeRows } = await supabase.from("documents").select("size");
	const usedBytes = (sizeRows ?? []).reduce((sum, row) => sum + (row.size ?? 0), 0);
	if (usedBytes + uploadedSize > limits.storageLimit) {
		await supabase.storage.from(DOCUMENTS_BUCKET).remove([input.storagePath]);
		return {
			error: `Storage limit reached (max ${formatStorage(limits.storageLimit)} on your plan).`,
		};
	}

	const { error, data } = await supabase
		.from("documents")
		.insert({
			user_id: user.id,
			name: input.name,
			storage_path: input.storagePath,
			size: uploadedSize,
		})
		.select("id")
		.single();

	if (error) {
		return { error: error.message };
	}

	return { documentId: data.id };
}

export async function removeDocument(id: string): Promise<{ error?: string }> {
	const supabase = await createClient();

	const { data: doc, error: fetchError } = await supabase
		.from("documents")
		.select("storage_path")
		.eq("id", id)
		.maybeSingle();

	if (fetchError) {
		return { error: fetchError.message };
	}

	// Already gone (e.g. a duplicate click that raced the first delete) — nothing to
	// do. Treat as success so a second confirmation doesn't surface an error toast.
	if (!doc) {
		return {};
	}

	const { error: storageError } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.remove([doc.storage_path]);
	if (storageError) return { error: storageError.message };

	const { error: errorDocumentDelete } = await supabase.from("documents").delete().eq("id", id);
	if (errorDocumentDelete) return { error: errorDocumentDelete.message };

	return {};
}

export async function getDocumentUrl(id: string): Promise<{ url?: string; error?: string }> {
	const supabase = await createClient();

	const { data: doc, error } = await supabase
		.from("documents")
		.select("storage_path")
		.eq("id", id)
		.single();

	if (error || !doc) {
		return { error: error?.message || "Not Found" };
	}

	const { data, error: signError } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.createSignedUrl(doc.storage_path, 60 * 10);

	if (signError || !data) {
		return { error: signError?.message || "Could not create preview URL" };
	}

	return { url: data.signedUrl };
}
