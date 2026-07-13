"use server";

import { createClient } from "@/shared/config/supabase/server";
import { getCurrentUser } from "@/features/auth/service";
import type { ChatMessage } from "@/features/chat/types";

// Loads the persisted history for one thread (scope). `documentId === null` is the
// "all documents" thread; a value is that document's thread. RLS keeps it to the
// signed-in user; the explicit user_id filter also keeps the query on its index.
export async function getChatMessages(documentId: string | null): Promise<ChatMessage[]> {
	const supabase = await createClient();
	const user = await getCurrentUser();
	if (!user) return [];

	let query = supabase
		.from("chat_messages")
		.select("id, role, parts")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	query = documentId ? query.eq("document_id", documentId) : query.is("document_id", null);

	const { data, error } = await query;
	if (error || !data) return [];

	return data.map((row) => ({
		id: row.id,
		role: row.role,
		parts: row.parts,
	})) as ChatMessage[];
}
