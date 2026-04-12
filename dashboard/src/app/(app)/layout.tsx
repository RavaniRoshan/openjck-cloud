import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.orgId) {
    redirect('/signup');
  }

  // Check if children is a function (Next.js doesn't support passing props like that normally)
  // We'll use a different approach: clone children and add orgId prop if it's a React element.
  // But simpler: we can just pass via context later. But let's not overcomplicate.

  return (
    <div className="layout-shell">
      <Sidebar />
      <Topbar />
      <main className="main-content">{children}</main>
    </div>
  );
}
