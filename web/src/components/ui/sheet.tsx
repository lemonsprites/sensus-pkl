import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

type SheetSide = "bottom" | "left";

const SIDE_CLASS: Record<SheetSide, string> = {
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl border-t pb-safe",
  left: "inset-y-0 left-0 h-full w-[85%] max-w-xs border-r",
};

function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: SheetSide }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 overflow-y-auto overscroll-contain border-border bg-background p-4 shadow-xl",
          SIDE_CLASS[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <div aria-hidden className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        )}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition hover:opacity-100 focus:outline-none">
          <X className="size-5" />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 space-y-1 pr-8", className)} {...props} />;
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
