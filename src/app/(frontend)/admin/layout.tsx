import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminNavbar from "@/components/AdminNavbar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try { await requireAdmin(); }
  catch { redirect('/staff/sign-in?redirect_url=/admin'); }

  return (
    <div className="min-h-screen bg-dark">
      <AdminNavbar />
      <main className="pt-20">
        {children}
      </main>
    </div>
  );
}
