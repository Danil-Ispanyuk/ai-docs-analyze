import { ForgotPasswordForm } from "@/containers";

export default async function ForgotPassword({
	searchParams,
}: {
	searchParams: Promise<{ expired?: string }>;
}) {
	const { expired } = await searchParams;
	return <ForgotPasswordForm expired={Boolean(expired)} />;
}
