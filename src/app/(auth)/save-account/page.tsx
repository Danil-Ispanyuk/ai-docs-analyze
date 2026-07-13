import { redirect } from "next/navigation";
import { SaveAccountForm } from "@/features/auth/components/SaveAccountForm";
import { getCurrentUser } from "@/features/auth/service";

export default async function SaveAccount() {
	const user = await getCurrentUser();

	if (!user) redirect("/sign-in");
	if (!user.is_anonymous) redirect("/");

	return <SaveAccountForm />;
}
