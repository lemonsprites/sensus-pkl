import { Menu } from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { NAV_ITEMS, type NavItemConfig } from "@/components/nav-items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function BottomTab({ item }: { item: NavItemConfig }) {
  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) =>
        cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none transition-colors",
          isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      <item.icon className="size-5" />
      <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
    </NavLink>
  );
}

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const primary = items.filter((item) => item.primary);
  const secondary = items.filter((item) => !item.primary);
  const moreActive = secondary.some((item) => pathname.startsWith(item.to));

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-safe md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {primary.map((item) => (
            <BottomTab key={item.to} item={item} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none transition-colors",
              moreActive
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu className="size-5" />
            <span>Lainnya</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Menu lainnya</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2">
            {secondary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-12 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                    isActive ? "bg-muted font-medium" : "hover:bg-muted/60",
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
