import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/useMediaQuery";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Baris kedua yang lebih kecil (mis. kode & jumlah tersedia). */
  hint?: string;
  /** Kata kunci tambahan untuk pencarian lokal. */
  keywords?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Bila diisi, pencarian dilakukan di server (parent yang men-debounce).
   * Bila kosong, daftar difilter di sisi klien.
   */
  onSearchChange?: (query: string) => void;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Searchable single-select.
 * - Mobile (< sm): panel pencarian tampil inline di bawah trigger (tanpa portal),
 *   sehingga aman dipakai di dalam Dialog.
 * - Desktop: Popover.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  onSearchChange,
  onOpenChange,
  placeholder = "Pilih…",
  searchPlaceholder = "Cari…",
  emptyText = "Tidak ada hasil.",
  loading = false,
  disabled = false,
  className,
  id,
}: ComboboxProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const setOpenState = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
      if (!next) setQuery("");
    },
    [onOpenChange],
  );

  const selected = options.find((option) => option.value === value);

  const visibleOptions = React.useMemo(() => {
    if (onSearchChange) return options;
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.hint ?? ""} ${option.value} ${option.keywords ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [onSearchChange, options, query]);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    onSearchChange?.(next);
  };

  const handleSelect = (next: string) => {
    onValueChange(next);
    setOpenState(false);
  };

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={isMobile ? () => setOpenState(!open) : undefined}
      className={cn(
        "w-full justify-between gap-2 font-normal",
        !selected && "text-muted-foreground",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-left">
        {selected ? selected.label : placeholder}
      </span>
      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
    </Button>
  );

  const panel = (
    <Command shouldFilter={false} className="flex flex-col bg-popover">
      <div className="relative shrink-0 border-b">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Command.Input
          value={query}
          onValueChange={handleQueryChange}
          placeholder={searchPlaceholder}
          autoFocus={!isMobile}
          className="h-11 w-full bg-transparent pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground sm:h-10 sm:text-sm"
        />
      </div>
      <Command.List className="max-h-64 overflow-y-auto overscroll-contain p-1 sm:max-h-72">
        {visibleOptions.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {loading ? "Memuat…" : emptyText}
          </div>
        ) : (
          <>
            {/* Saat pencarian server berjalan, daftar lama tetap tampil agar tidak berkedip. */}
            {loading && (
              <div className="px-3 pb-1 pt-2 text-[11px] text-muted-foreground">Memuat…</div>
            )}
            {visibleOptions.map((option) => {
              const active = option.value === value;
              return (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2.5 text-sm outline-none data-[selected=true]:bg-muted",
                    active && "font-medium",
                  )}
                >
                  <Check
                    className={cn("mt-0.5 size-4 shrink-0", active ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {option.hint}
                      </span>
                    )}
                  </span>
                </Command.Item>
              );
            })}
          </>
        )}
      </Command.List>
    </Command>
  );

  if (isMobile) {
    return (
      <div className="space-y-2">
        {trigger}
        {open && (
          <div className="overflow-hidden rounded-md border border-input bg-popover shadow-sm">
            {panel}
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpenState}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[60] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover p-0 shadow-md outline-none"
        >
          {panel}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
