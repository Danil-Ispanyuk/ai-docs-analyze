import type { ReactNode } from "react";
import { useT } from "@/i18n";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface WorkspaceLayoutProps {
  email: string;
  children: ReactNode;
}

/**
 * Authenticated app shell: header (brand + current user + logout) and a
 * three-column body of panel cards. The panels are passed as children.
 */
export function WorkspaceLayout({ email, children }: WorkspaceLayoutProps) {
  const t = useT();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <span className="font-semibold tracking-tight">{t("General.title")}</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-foreground/60 sm:inline">
            {t("Workspace.signedInAs", { email })}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 bg-muted/30 p-3 md:grid-cols-[20rem_1fr_24rem] md:grid-rows-1 md:gap-4 md:p-4">
        {children}
      </main>
    </div>
  );
}
