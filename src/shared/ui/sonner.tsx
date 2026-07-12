"use client";

import { Toaster as SonnerToaster } from "sonner";

// App-wide toast host. Rendered once in the root layout. Theme follows the OS
// (the app has no theme toggle — it styles via prefers-color-scheme), so
// theme="system" keeps toasts light/dark-aware without next-themes.
export function Toaster() {
	return <SonnerToaster theme="system" position="top-right" richColors closeButton />;
}
