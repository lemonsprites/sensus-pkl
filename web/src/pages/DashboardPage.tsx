import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiDownload } from "@/lib/api";
import type {
  DashboardGroupItem, DashboardNupItem, DashboardResponse, DashboardTab,
} from "@/lib/types";

type DashboardItem = DashboardGroupItem | DashboardNupItem;

const TABS: Array<[DashboardTab, string]> = [
  ["PERLU_DOKUMEN", "Perlu Dokumen"],
  ["PERLU_VERIFIKASI", "Perlu Verifikasi"],
  ["PERLU_CETAK", "Perlu Cetak"],
  ["PERLU_TEMPEL", "Perlu Tempel"],
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ASSESSED: "Diperiksa",
  DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi",
  TIDAK_DITEMUKAN: "Tidak ditemukan",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function DashboardPage() {
  const [tab, setTab] = useState<DashboardTab>("PERLU_DOKUMEN");
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ tab, page: String(page), limit: "20" });
      if (q) params.set("q", q);
      setData(await api<DashboardResponse>(`/dashboard?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  }, [tab, page, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await apiDownload(`/export/sensus?format=${format}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal export");
    } finally {
      setExporting(false);
    }
  };

  const columns: DataTableColumn<DashboardItem>[] = [
    {
      key: "aset",
      header: "Aset",
      mobilePriority: "title",
      sortValue: (item) => (item.kind === "GROUP" ? item.namaBarang : item.masterAset.nama),
      cell: (item) =>
        item.kind === "GROUP" ? (
          <div className="max-w-72">
            <div className="truncate font-medium">{item.namaBarang}</div>
            <div className="font-mono text-xs text-muted-foreground">{item.kodeBarang}</div>
          </div>
        ) : (
          <div className="max-w-72">
            <div className="truncate font-medium">{item.masterAset.nama}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {item.masterAset.kodeRegister ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              NUP {item.masterAset.kodeSiman ?? "—"}
            </div>
          </div>
        ),
    },
    {
      key: "ruang",
      header: "Ruang",
      mobilePriority: "subtitle",
      sortValue: (item) => (item.ruang ? `${item.ruang.bangunanAset.nama} ${item.ruang.nama}` : ""),
      cell: (item) =>
        item.ruang ? (
          <div className="text-xs">
            <div>{item.ruang.nama}</div>
            <div className="text-muted-foreground">{item.ruang.bangunanAset.nama}</div>
          </div>
        ) : (
          <span className="text-xs">—</span>
        ),
    },
    {
      key: "detail",
      header: "Detail",
      cell: (item) => (
        <div className="text-xs">
          {item.kind === "GROUP"
            ? `${item.kondisi} · ${item.jumlah} unit`
            : item.grup
              ? `${item.grup.kondisi} · ${item.grup.jumlah} unit`
              : "—"}
          {item.kind === "GROUP" && item.catatanOtomatis && (
            <div className="text-muted-foreground">{item.catatanOtomatis}</div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobilePriority: "primary",
      sortValue: (item) => item.status,
      cell: (item) => (
        <Badge variant={item.status === "VALIDATED" ? "default" : "secondary"}>
          {STATUS_LABEL[item.status] ?? item.status}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Update",
      mobileLabel: "Diperbarui",
      className: "whitespace-nowrap text-xs text-muted-foreground",
      sortValue: (item) => item.updatedAt,
      cell: (item) => formatDate(item.updatedAt),
    },
    {
      key: "buka",
      header: "",
      mobilePriority: "actions",
      cell: (item) =>
        item.ruang ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/sensus/${item.ruang.id}`}><ArrowUpRight /> Buka</Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Sensus</h1>
          <p className="text-sm text-muted-foreground">
            Inbox pekerjaan: dokumen, verifikasi, cetak, dan tempel label.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex">
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void handleExport("csv")}>
            <Download /> Export CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void handleExport("xlsx")}>
            <Download /> Export XLSX
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => { setTab(value); setPage(1); setQInput(""); setQ(""); }}
            className={`rounded-lg border p-3 text-left transition-colors ${tab === value ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
          >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold">{data?.counts?.[value] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{TABS.find(([value]) => value === tab)?.[1]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-2 sm:flex sm:flex-wrap sm:items-end"
            onSubmit={(event: FormEvent) => { event.preventDefault(); setQ(qInput.trim()); setPage(1); }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="dash-q">Cari</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="dash-q" type="search" value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="nama / kode register / NUP / kode barang" className="pl-9" />
              </div>
            </div>
            <Button type="submit" variant="secondary" className="w-full sm:w-auto"><Search /> Cari</Button>
          </form>

          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(item) => `${item.kind}-${item.id}`}
            page={page}
            total={data?.total}
            limit={data?.limit ?? 20}
            onPageChange={setPage}
            loading={loading}
            emptyText="Tidak ada item di tab ini."
          />
        </CardContent>
      </Card>
    </div>
  );
}
