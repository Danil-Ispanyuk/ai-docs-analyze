import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default async function ForgotPassword({
	searchParams,
}: {
	searchParams: Promise<{ expired?: string }>;
}) {
	const { expired } = await searchParams;
	return <ForgotPasswordForm expired={Boolean(expired)} />;
}
