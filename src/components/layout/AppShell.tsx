import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import Layout from "./Layout";

export default function AppShell() {
  const { user, loading, signOut } = useAuth();
  if (loading)
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <header className="h-12 flex items-center justify-end border-b px-4 bg-card">
        <span className="text-sm text-muted-foreground mr-3">{user.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </Layout>
  );
}
