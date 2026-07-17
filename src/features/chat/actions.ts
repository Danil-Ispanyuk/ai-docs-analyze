"use server";

import { createClient } from "@/shared/config/supabase/server";
import { getCurrentUser } from "@/features/auth/service";
import type { ChatMessage, ChatScope } from "@/features/chat/types";

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
