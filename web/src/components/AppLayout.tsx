import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  MAHASISWA: "Mahasiswa",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

const SIDEBAR_STORAGE_KEY = "sensus.sidebarCollapsed";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // localStorage bisa tidak tersedia (mode privat); abaikan.
    }
  }, [sidebarCollapsed]);

  if (!user) return null;

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-muted/30 md:flex">
      <Sidebar
        isAdmin={isAdmin}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-5" />
              <span className="whitespace-nowrap">Sensus Aset BMN</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={user.role === "SUPERADMIN" ? "default" : "secondary"}>
                {ROLE_LABEL[user.role]}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleLogout()}
                aria-label="Keluar"
              >
                <LogOut />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-nav pt-5 sm:py-8 md:max-w-6xl md:px-6 md:pb-8 xl:max-w-7xl">
          <Outlet />
        </main>
      </div>

      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
