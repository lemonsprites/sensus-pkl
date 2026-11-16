import {
  Activity, Building2, CheckCheck, FileSpreadsheet, FileText, History, LayoutDashboard,
  LogOut, Printer, ScanLine, ShieldCheck, UserRound, Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
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

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5" />
            <span>Sensus Aset BMN</span>
          </div>

          <nav className="order-3 flex w-full items-center gap-1 text-sm sm:order-none sm:w-auto">
            <NavLink
              to="/hierarki"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                  isActive && "bg-muted font-medium",
                )
              }
            >
              <Building2 className="size-4" /> Hierarki
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                    isActive && "bg-muted font-medium",
                  )
                }
              >
                <LayoutDashboard className="size-4" /> Dashboard
              </NavLink>
            )}
            <NavLink
              to="/monitoring"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                  isActive && "bg-muted font-medium",
                )
              }
            >
              <Activity className="size-4" /> Monitoring
            </NavLink>
            <NavLink
              to="/log"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                  isActive && "bg-muted font-medium",
                )
              }
            >
              <History className="size-4" /> Log
            </NavLink>
            <NavLink
              to="/laporan"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                  isActive && "bg-muted font-medium",
                )
              }
            >
              <FileText className="size-4" /> Laporan
            </NavLink>
            <NavLink
              to="/profil"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                  isActive && "bg-muted font-medium",
                )
              }
            >
              <UserRound className="size-4" /> Profil
            </NavLink>
            {isAdmin && (
              <>
                <NavLink
                  to="/import"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                      isActive && "bg-muted font-medium",
                    )
                  }
                >
                  <FileSpreadsheet className="size-4" /> Import SIMAN
                </NavLink>
                <NavLink
                  to="/label"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                      isActive && "bg-muted font-medium",
                    )
                  }
                >
                  <Printer className="size-4" /> Label
                </NavLink>
                <NavLink
                  to="/admin/validasi"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                      isActive && "bg-muted font-medium",
                    )
                  }
                >
                  <CheckCheck className="size-4" /> Validasi
                </NavLink>
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                      isActive && "bg-muted font-medium",
                    )
                  }
                >
                  <Users className="size-4" /> Manajemen User
                </NavLink>
              </>
            )}
            <NavLink
              to="/scan"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-muted",
                  isActive && "bg-muted font-medium",
                )
              }
            >
              <ScanLine className="size-4" /> Scan
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium">{user.nama}</div>
              <div className="text-muted-foreground">@{user.username}</div>
            </div>
            <Badge variant={user.role === "SUPERADMIN" ? "default" : "secondary"}>
              {ROLE_LABEL[user.role]}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
              <LogOut /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
