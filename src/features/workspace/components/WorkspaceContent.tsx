import { createClient } from "@/shared/config/supabase/server";
import { LandingContent } from "@/features/landing/components/LandingContent";
import { PreviewContainer } from "./Container";
import { getCurrentUser } from "@/features/auth/service";
import { PLAN_TYPES } from "@/shared/constants/general";
import { WorkspaceLayout } from "@/layouts";

export async function HomeContent() {
	const supabase = await createClient();
	const user = await getCurrentUser();

	if (!user) {
		return <LandingContent />;
	}

	const { data } = await supabase
		.from("documents")
		.select("id, name, status, created_at, size")
		.order("created_at", { ascending: false });

	const { data: profile } = await supabase
		.from("profiles")
		.select("plan")
		.eq("id", user.id)
		.single();

	const plan = profile?.plan ?? PLAN_TYPES.GUEST;
	console.log("profile", profile, "plan", plan, "user", user);

	const { data: usageRows } = await supabase.rpc("get_usage");
	const usageRow = usageRows?.[0] ?? { tokens_used: 0, requests_used: 0 };
	const usage = { tokensUsed: usageRow.tokens_used, requestsUsed: usageRow.requests_used };
	const isGuest = user.is_anonymous ?? false;

	return (
		<WorkspaceLayout isGuest={isGuest} email={user.email ?? ""} plan={plan}>
			<PreviewContainer documents={data || []} userId={user.id} plan={plan} usage={usage} />
		</WorkspaceLayout>
	);
}
