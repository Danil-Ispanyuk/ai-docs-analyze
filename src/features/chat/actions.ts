"use server";

import { createClient } from "@/shared/config/supabase/server";
import { getCurrentUser } from "@/features/auth/service";
import type { ChatMessage, ChatScope } from "@/features/chat/types";

// Loads the persisted history for one thread (scope). Scope is orthogonal (RM-7):
// both null = the "all documents" thread; documentId set = that document's thread;
// folderId set = that folder's thread. RLS keeps it to the signed-in user; the
// explicit user_id filter also keeps the query on its index.
export async function getChatMessages(scope: ChatScope): Promise<ChatMessage[]> {
	const supabase = await createClient();
	const user = await getCurrentUser();
	if (!user) return [];

	let query = supabase
		.from("chat_messages")
		.select("id, role, parts")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	if (scope.folderId) {
		query = query.eq("folder_id", scope.folderId).is("document_id", null);
	} else if (scope.documentId) {
		query = query.eq("document_id", scope.documentId).is("folder_id", null);
	} else {
		query = query.is("document_id", null).is("folder_id", null);
	}

	const { data, error } = await query;
	if (error || !data) return [];

	return data.map((row) => ({
		id: row.id,
		role: row.role,
		parts: row.parts,
	})) as ChatMessage[];
}

// Deletes every message in one thread (scope) for the signed-in user. RLS + the
// explicit user_id filter keep it to their own rows.
export async function clearChatMessages(scope: ChatScope): Promise<{ error?: string }> {
	const supabase = await createClient();
	const user = await getCurrentUser();
	if (!user) return { error: "Unauthorized" };

	let query = supabase.from("chat_messages").delete().eq("user_id", user.id);

	if (scope.folderId) {
		query = query.eq("folder_id", scope.folderId).is("document_id", null);
	} else if (scope.documentId) {
		query = query.eq("document_id", scope.documentId).is("folder_id", null);
	} else {
		query = query.is("document_id", null).is("folder_id", null);
	}

	const { error } = await query;
	if (error) return { error: error.message };
	return {};
}
