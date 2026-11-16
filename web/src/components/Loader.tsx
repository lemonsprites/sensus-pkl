import { Loader2 } from "lucide-react";

export function Loader({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader label="Memuat sesi…" />
    </div>
  );
}
