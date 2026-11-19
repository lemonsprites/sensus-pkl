import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Sembunyikan kolom ini pada tampilan kartu mobile. */
  mobileHidden?: boolean;
  /** Label khusus pada tampilan kartu mobile (default: header). */
  mobileLabel?: string;
  /**
   * Peran kolom pada kartu mobile:
   * - `title`    → judul kartu
   * - `subtitle` → teks kecil di bawah judul
   * - `primary`  → ditampilkan menonjol sebelum daftar label
   * - `actions`  → deretan aksi di bagian bawah kartu
   * Default: kolom pertama yang tidak disembunyikan menjadi `title`.
   */
  mobilePriority?: "title" | "subtitle" | "primary" | "actions";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  page?: number;
  total?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  emptyText?: string;
  loading?: boolean;
}

export function DataTable<T>({
  columns, data, getRowId, search, onSearchChange, searchPlaceholder = "Cari…",
  filters, page, total, limit, onPageChange, selectable = false,
  selectedIds = [], onSelectionChange, emptyText = "Belum ada data.", loading = false,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortValue) return data;
    return [...data].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "id-ID");
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, data, sort]);

  const toggleSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? current.direction === "asc" ? { key, direction: "desc" } : null
        : { key, direction: "asc" },
    );
  };

  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(getRowId(row)));
  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !data.some((row) => getRowId(row) === id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...data.map(getRowId)])]);
    }
  };
  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  };

  const totalPages = total !== undefined && limit ? Math.max(1, Math.ceil(total / limit)) : 1;
  const currentPage = page ?? 1;

  // Susunan kartu untuk layar mobile.
  const visibleColumns = columns.filter((column) => !column.mobileHidden);
  const titleColumn =
    visibleColumns.find((column) => column.mobilePriority === "title") ?? visibleColumns[0];
  const subtitleColumn = visibleColumns.find((column) => column.mobilePriority === "subtitle");
  const primaryColumns = visibleColumns.filter((column) => column.mobilePriority === "primary");
  const actionColumns = visibleColumns.filter((column) => column.mobilePriority === "actions");
  const fieldColumns = visibleColumns.filter(
    (column) =>
      column !== titleColumn &&
      column !== subtitleColumn &&
      !primaryColumns.includes(column) &&
      !actionColumns.includes(column),
  );
  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-3">
      {(onSearchChange || filters) && (
        <div className="flex flex-wrap items-end gap-2">
          {onSearchChange && (
            <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          )}
          {filters}
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Pilih semua" />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      {sort?.key === column.key
                        ? sort.direction === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                        : <ChevronDown className="size-3 opacity-30" />}
                    </button>
                  ) : column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableEmpty colSpan={colSpan}>Memuat data…</TableEmpty>
            ) : sorted.length === 0 ? (
              <TableEmpty colSpan={colSpan}>{emptyText}</TableEmpty>
            ) : (
              sorted.map((row) => {
                const id = getRowId(row);
                return (
                  <TableRow key={id} className={cn(selectedIds.includes(id) && "bg-muted/50")}>
                    {selectable && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          onChange={() => toggleRow(id)}
                          aria-label={`Pilih ${id}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>{column.cell(row)}</TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: setiap baris menjadi kartu agar tidak perlu scroll horizontal. */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
            Memuat data…
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          sorted.map((row) => {
            const id = getRowId(row);
            const selected = selectedIds.includes(id);
            return (
              <div
                key={id}
                className={cn("rounded-lg border bg-card p-3", selected && "bg-muted/50")}
              >
                <div className="flex items-start gap-2">
                  {selectable && (
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0"
                      checked={selected}
                      onChange={() => toggleRow(id)}
                      aria-label={`Pilih ${id}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {titleColumn && (
                      <div className="truncate font-medium">{titleColumn.cell(row)}</div>
                    )}
                    {subtitleColumn && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {subtitleColumn.cell(row)}
                      </div>
                    )}
                    {primaryColumns.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {primaryColumns.map((column) => (
                          <div key={column.key} className={column.className}>
                            {column.cell(row)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {fieldColumns.length > 0 && (
                  <dl className="mt-2 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-2 gap-y-1 border-t pt-2 text-xs">
                    {fieldColumns.map((column) => (
                      <Fragment key={column.key}>
                        <dt className="text-muted-foreground">
                          {column.mobileLabel ?? column.header}
                        </dt>
                        <dd className={cn("min-w-0 break-words", column.className)}>
                          {column.cell(row)}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                )}
                {actionColumns.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
                    {actionColumns.map((column) => (
                      <div key={column.key} className={cn("min-w-0", column.className)}>
                        {column.cell(row)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {onPageChange && total !== undefined && limit !== undefined && (
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {total.toLocaleString("id-ID")} baris · halaman {currentPage} dari {totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <ChevronLeft /> Sebelumnya
            </Button>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
              Berikutnya <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
