import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader } from "@/components/Loader";
import { api, apiDownload } from "@/lib/api";
import type { DashboardResponse, DashboardTab } from "@/lib/types";

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard Sensus</h1>
          <p className="text-sm text-muted-foreground">
            Inbox pekerjaan: dokumen, verifikasi, input SIMAN, cetak, dan tempel label.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void handleExport("csv")}
          >
            <Download /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void handleExport("xlsx")}
          >
            <Download /> Export XLSX
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setPage(1);
              setQInput("");
              setQ("");
            }}
            className={`rounded-lg border p-3 text-left transition-colors ${
              tab === value ? "border-primary bg-primary/5" : "hover:bg-muted/40"
            }`}
          >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold">{data?.counts?.[value] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{TABS.find(([value]) => value === tab)?.[1]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setQ(qInput.trim());
              setPage(1);
            }}
          >
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="dash-q">Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="dash-q"
                  value={qInput}
                  onChange={(event) => setQInput(event.target.value)}
                  placeholder="nama / kode register / NUP"
                  className="pl-9"
                />
              </div>
            </div>
            <Button type="submit" variant="secondary">
              <Search /> Cari
            </Button>
          </form>

          {loading ? (
            <Loader label="Memuat inbox…" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aset</TableHead>
                  <TableHead>Ruang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Diinput</TableHead>
                  <TableHead>Update</TableHead>
                  <TableHead className="text-right">Buka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && data.items.length > 0 ? (
                  data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-72">
                        <div className="truncate font-medium">{item.barangLama.nama}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.barangLama.kodeRegister ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.barangLama.kodeBarang ?? "—"} · NUP {item.barangLama.kodeSiman ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.barangLama.ruang ? (
                          <>
                            <div>{item.barangLama.ruang.nama}</div>
                            <div className="text-muted-foreground">
                              {item.barangLama.ruang.bangunanAset.nama}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={item.status === "VALIDATED" ? "default" : "secondary"}>
                            {STATUS_LABEL[item.status] ?? item.status}
                          </Badge>
                          {item.isTemuanBaru && <Badge variant="destructive">temuan baru</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.diinputOleh?.nama ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(item.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.barangLama.ruang ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/sensus/${item.barangLama.ruang.id}`}>
                              <ArrowUpRight /> Buka
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">tanpa ruang</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={6}>Tidak ada item di tab ini.</TableEmpty>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Halaman {page} dari {totalPages} · {data?.total ?? 0} item
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
