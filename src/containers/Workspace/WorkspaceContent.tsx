import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceLayout } from "@/layouts";
import { PreviewContainer } from "./Container";

export async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data } = await supabase
    .from("documents")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <WorkspaceLayout email={user.email ?? ""}>
      <PreviewContainer documents={data || []} userId={user.id} />
    </WorkspaceLayout>
  );
}
