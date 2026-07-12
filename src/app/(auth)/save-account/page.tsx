import { redirect } from "next/navigation";
import { SaveAccountForm } from "@/features/auth/components/SaveAccountForm";
import { getCurrentUser } from "@/features/auth/service";

export default async function SaveAccount() {
	const user = await getCurrentUser();

	if (!user) redirect("/sign-in");
	// Only guests convert; a registered user has nothing to do here.
	if (!user.is_anonymous) redirect("/");

	return <SaveAccountForm />;
}
