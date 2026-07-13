import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/service";
import { getBillingOverview } from "@/features/profile/service";
import { ProfileContent } from "@/features/profile/components";
import { ProfileLayout } from "@/layouts";

export default async function ProfilePage() {
	const user = await getCurrentUser();

	if (!user) redirect("/sign-in");
	if (user.is_anonymous) redirect("/save-account");

	const overview = await getBillingOverview(user.id);
	const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;

	return (
		<ProfileLayout
			isGuest={false}
			email={user.email ?? ""}
			fullName={fullName}
			plan={overview.plan}
		>
			<ProfileContent overview={overview} email={user.email ?? ""} fullName={fullName} />
		</ProfileLayout>
	);
}
