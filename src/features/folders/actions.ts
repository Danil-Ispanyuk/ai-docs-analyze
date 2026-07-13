"use server";

import { createClient } from "@/shared/config/supabase/server";
import { getCurrentUser } from "@/features/auth/service";
import { folderNameSchema } from "@/features/folders/validators";

export type FolderResult = { error?: string };

export async function createFolder(name: string): Promise<{ folderId?: string; error?: string }> {
	const parsed = folderNameSchema.safeParse({ name });
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	}

	const supabase = await createClient();
	const user = await getCurrentUser();
	if (!user) return { error: "Not authenticated" };

	const { data, error } = await supabase
		.from("folders")
		.insert({ user_id: user.id, name: parsed.data.name })
		.select("id")
		.single();

	if (error) return { error: error.message };
	return { folderId: data.id };
}

export async function renameFolder(id: string, name: string): Promise<FolderResult> {
	const parsed = folderNameSchema.safeParse({ name });
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
	}

	const supabase = await createClient();
	// RLS scopes the update to the caller's own folder.
	const { error } = await supabase.from("folders").update({ name: parsed.data.name }).eq("id", id);
	if (error) return { error: error.message };
	return {};
}

export async function deleteFolder(id: string): Promise<FolderResult> {
	const supabase = await createClient();
	// Deleting the folder unfiles its documents (documents.folder_id SET NULL) and
	// cascades its chat thread (chat_messages.folder_id CASCADE). RLS scopes it.
	const { error } = await supabase.from("folders").delete().eq("id", id);
	if (error) return { error: error.message };
	return {};
}

export async function moveDocumentToFolder(
	documentId: string,
	folderId: string | null,
): Promise<FolderResult> {
	const supabase = await createClient();

	// When filing into a folder, confirm the folder belongs to the caller (RLS
	// returns it only if owned) so a document can't be attached to someone else's
	// folder id.
	if (folderId) {
		const { data: folder } = await supabase
			.from("folders")
			.select("id")
			.eq("id", folderId)
			.maybeSingle();
		if (!folder) return { error: "Folder not found" };
	}

	// RLS scopes the update to the caller's own document.
	const { error } = await supabase
		.from("documents")
		.update({ folder_id: folderId })
		.eq("id", documentId);
	if (error) return { error: error.message };
	return {};
}
