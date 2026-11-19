import { LogOut, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { NAV_ITEMS, type NavItemConfig } from "@/components/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  MAHASISWA: "Mahasiswa",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

function initials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Label tersembunyi saat rail (md) dan saat sidebar diciutkan. */
function labelClass(collapsed: boolean): string {
  return collapsed ? "hidden" : "hidden lg:inline";
}

function SidebarLink({ item, collapsed }: { item: NavItemConfig; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
          collapsed ? "justify-center" : "justify-center lg:justify-start",
          isActive
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )
      }
    >
      <item.icon className="size-5 shrink-0" />
      <span className={cn("truncate", labelClass(collapsed))}>{item.label}</span>
    </NavLink>
  );
}

function GroupLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 px-2">
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
          labelClass(collapsed),
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn("h-px flex-1 bg-border", collapsed ? "block" : "block lg:hidden")}
      />
    </div>
  );
}

export function Sidebar({
  isAdmin,
  collapsed,
  onToggle,
}: {
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const mainItems = NAV_ITEMS.filter((item) => !item.adminOnly);
  const adminItems = NAV_ITEMS.filter((item) => item.adminOnly && isAdmin);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      aria-label="Sidebar navigasi"
      className={cn(
        "no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-background md:flex md:w-16",
        collapsed ? "lg:w-16" : "lg:w-64",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <ShieldCheck className="size-5 shrink-0" />
        <span className={cn("truncate font-semibold", labelClass(collapsed))}>
          Sensus Aset BMN
        </span>
      </div>

      <div className={cn("hidden pt-2 lg:flex", collapsed ? "justify-center" : "justify-end px-2")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-2 py-3"
      >
        <div>
          <GroupLabel collapsed={collapsed}>Utama</GroupLabel>
          <div className="space-y-1">
            {mainItems.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {adminItems.length > 0 && (
          <div>
            <GroupLabel collapsed={collapsed}>Admin</GroupLabel>
            <div className="space-y-1">
              {adminItems.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t p-2">
        <div
          className={cn(
            "mb-2 flex items-center gap-2 rounded-md px-2 py-1.5",
            collapsed ? "justify-center" : "justify-center lg:justify-start",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials(user.nama)}
          </div>
          <div className={cn("min-w-0", collapsed ? "hidden" : "hidden lg:block")}>
            <div className="truncate text-xs font-medium">{user.nama}</div>
            <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
            <Badge
              className="mt-1"
              variant={user.role === "SUPERADMIN" ? "default" : "secondary"}
            >
              {ROLE_LABEL[user.role]}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleLogout()}
          aria-label="Keluar"
          className={cn("w-full", collapsed ? "px-0" : "px-0 lg:px-3")}
        >
          <LogOut />
          <span className={labelClass(collapsed)}>Keluar</span>
        </Button>
      </div>
    </aside>
  );
}
