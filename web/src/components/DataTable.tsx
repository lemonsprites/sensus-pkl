import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

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

  return (
    <div className="space-y-3">
      {(onSearchChange || filters) && (
        <div className="flex flex-wrap items-end gap-2">
          {onSearchChange && (
            <div className="relative min-w-56 flex-1">
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

      <div className="overflow-x-auto rounded-lg border">
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
              <TableEmpty colSpan={columns.length + (selectable ? 1 : 0)}>Memuat data…</TableEmpty>
            ) : sorted.length === 0 ? (
              <TableEmpty colSpan={columns.length + (selectable ? 1 : 0)}>{emptyText}</TableEmpty>
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

      {onPageChange && total !== undefined && limit !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
