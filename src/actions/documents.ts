"use server";

import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_STATUSES } from "@/constants/documents";
import { DOCUMENTS_BUCKET } from "@/lib/documents";
import extractPdfPages from "@/lib/pdf";
import { chunkPages } from "@/lib/chunk";
import { embedChunks } from "@/lib/embedding";

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
}): Promise<{ error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	const { error, data } = await supabase
		.from("documents")
		.insert({
			user_id: user.id,
			name: input.name,
			storage_path: input.storagePath,
		})
		.select("id")
		.single();

	if (error) {
		return { error: error.message };
	}

	const ingest = await ingestDocument(data.id);
	if (ingest?.error) return { error: ingest.error };

	return {};
}

export async function removeDocument(id: string): Promise<{ error?: string }> {
	const supabase = await createClient();

	const { data: doc, error: fetchError } = await supabase
		.from("documents")
		.select("storage_path")
		.eq("id", id)
		.single();

	if (fetchError || !doc) {
		return {
			error: fetchError?.message || "Not Found",
		};
	}

	const { error: errorDocumentDelete } = await supabase.from("documents").delete().eq("id", id);
	if (errorDocumentDelete) return { error: errorDocumentDelete.message };

	const { error: storageError } = await supabase.storage
		.from(DOCUMENTS_BUCKET)
		.remove([doc.storage_path]);
	if (storageError) console.error("orphan file:", storageError.message);

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
