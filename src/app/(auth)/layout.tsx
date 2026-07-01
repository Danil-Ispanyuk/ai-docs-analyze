import type { ReactNode } from "react";

import { AuthLayout } from "@/layouts";

export default function Layout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
