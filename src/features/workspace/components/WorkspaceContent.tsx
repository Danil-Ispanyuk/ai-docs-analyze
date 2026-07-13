import { createClient } from "@/shared/config/supabase/server";
import { LandingContent } from "@/features/landing/components/LandingContent";
import { PreviewContainer } from "./PreviewContainer";
import { getCurrentUser } from "@/features/auth/service";
import { getChatMessages } from "@/features/chat/actions";
import { PLAN_TYPES } from "@/shared/constants/general";
import { WorkspaceLayout } from "@/layouts";

export async function WorkspaceContent() {
	const supabase = await createClient();
	const user = await getCurrentUser();

	if (!user) {
		return <LandingContent />;
	}

	const { data } = await supabase
		.from("documents")
		.select("id, name, status, created_at, size, folder_id")
		.order("created_at", { ascending: false });

	const { data: folders } = await supabase
		.from("folders")
		.select("id, name, created_at")
		.order("created_at", { ascending: true });

	const { data: profile } = await supabase
		.from("profiles")
		.select("plan")
		.eq("id", user.id)
		.single();

	const plan = profile?.plan ?? PLAN_TYPES.GUEST;

	const { data: usageRows } = await supabase.rpc("get_usage");
	const usageRow = usageRows?.[0] ?? { tokens_used: 0, requests_used: 0 };
	const usage = { tokensUsed: usageRow.tokens_used, requestsUsed: usageRow.requests_used };
	const isGuest = user.is_anonymous ?? false;

	const initialMessages = await getChatMessages({ documentId: null, folderId: null });

	return (
		<WorkspaceLayout isGuest={isGuest} email={user.email ?? ""} plan={plan}>
			<PreviewContainer
				documents={data || []}
				folders={folders || []}
				userId={user.id}
				plan={plan}
				usage={usage}
				initialMessages={initialMessages}
			/>
		</WorkspaceLayout>
	);
}
