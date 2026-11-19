import { LogOut, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { NAV_ITEMS } from "@/components/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  MAHASISWA: "Mahasiswa",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:gap-x-4 sm:py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5" />
            <span className="whitespace-nowrap">Sensus Aset BMN</span>
          </div>

          <nav aria-label="Navigasi utama bagian atas" className="hidden items-center gap-1 text-sm lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-muted",
                    isActive && "bg-muted font-medium",
                  )
                }
              >
                <item.icon className="size-4" /> {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium">{user.nama}</div>
              <div className="text-muted-foreground">@{user.username}</div>
            </div>
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
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-nav pt-5 sm:py-8 lg:pb-8">
        <Outlet />
      </main>

      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
