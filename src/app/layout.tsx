import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { cn } from "@/shared/lib/utils";
import { Toaster } from "@/shared/ui/sonner";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "AI Docs Analyze — chat with your documents",
	description:
		"Upload your PDFs and ask questions in plain language. Every answer cites the exact file and page, and says \"I don't know\" when it's not in your documents.",
};

// maximumScale: 1 stops iOS Safari from auto-zooming when a form field is
// focused (its default behavior for inputs whose font-size is under 16px).
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const locale = await getLocale();

	return (
		<html lang={locale} className={cn("h-full", "antialiased", "font-sans", figtree.variable)}>
			<body className="flex min-h-full flex-col">
				<NextIntlClientProvider>{children}</NextIntlClientProvider>
				<Toaster />
			</body>
		</html>
	);
}
