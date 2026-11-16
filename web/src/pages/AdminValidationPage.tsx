import { useCallback, useEffect, useState } from "react";
import { CheckCheck, CheckCircle2, Eye, RefreshCw, XCircle } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type {
  AdminGroupItem, AdminGroupResponse, DokumenListResponse, LogListResponse,
  SensusStatus,
} from "@/lib/types";

const STATUS_LABEL: Record<SensusStatus, string> = {
  DRAFT: "Draft", ASSESSED: "Diperiksa", DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi", TIDAK_DITEMUKAN: "Tidak ditemukan",
};
const STATUS_TABS: SensusStatus[] = ["DOCS_COMPLETE", "ASSESSED", "VALIDATED", "TIDAK_DITEMUKAN"];
const KONDISI_LABEL = { BAIK: "Baik", RUSAK_RINGAN: "Rusak ringan", RUSAK_BERAT: "Rusak berat" };

function formatDate(value: string): string {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ status }: { status: SensusStatus }) {
  return (
    <Badge variant={status === "VALIDATED" ? "default" : status === "TIDAK_DITEMUKAN" ? "destructive" : "secondary"}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export default function AdminValidationPage() {
  const [data, setData] = useState<AdminGroupResponse | null>(null);
  const [status, setStatus] = useState<SensusStatus>("DOCS_COMPLETE");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [detail, setDetail] = useState<AdminGroupItem | null>(null);
  const [docs, setDocs] = useState<DokumenListResponse | null>(null);
  const [logs, setLogs] = useState<LogListResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25", status });
      if (q) params.set("q", q);
      const result = await api<AdminGroupResponse>(`/admin/grup?${params.toString()}`);
      setData(result);
      setSelectedIds([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat antrean validasi");
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openDetail = async (group: AdminGroupItem) => {
    setDetail(group);
    setDocs(null);
    setLogs(null);
    setDetailLoading(true);
    try {
      const [docData, logData] = await Promise.all([
        api<DokumenListResponse>(`/sensus-grup/${group.id}/dokumen`),
        api<LogListResponse>(`/logs?entityType=SENSUS_GRUP&entityId=${group.id}&limit=30`),
      ]);
      setDocs(docData);
      setLogs(logData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat detail grup");
    } finally {
      setDetailLoading(false);
    }
  };

  const verify = async (group: AdminGroupItem) => {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/sensus-grup/${group.id}/verify`, { method: "POST" });
      setNotice(`Grup ${group.namaBarang} divalidasi.`);
      setDetail(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal validasi");
    } finally {
      setActionBusy(false);
    }
  };

  const reject = async () => {
    if (!detail || !rejectNote.trim()) return;
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/sensus-grup/${detail.id}/reject`, {
        method: "POST", body: { catatan: rejectNote.trim() },
      });
      setNotice(`Grup ${detail.namaBarang} ditolak dan dikembalikan untuk diperbaiki.`);
      setRejectOpen(false);
      setRejectNote("");
      setDetail(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menolak grup");
    } finally {
      setActionBusy(false);
    }
  };

  const bulkVerify = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Validasi ${selectedIds.length} grup terpilih?`)) return;
    setBulkBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ verified: number; skipped: number }>("/admin/grup/bulk-verify", {
        method: "POST", body: { ids: selectedIds },
      });
      setNotice(`${result.verified} grup divalidasi${result.skipped ? `, ${result.skipped} dilewati` : ""}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal validasi massal");
    } finally {
      setBulkBusy(false);
    }
  };

  const columns: DataTableColumn<AdminGroupItem>[] = [
    {
      key: "aset",
      header: "Aset",
      sortValue: (row) => row.namaBarang,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.namaBarang}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.kodeBarang}</div>
        </div>
      ),
    },
    {
      key: "ruang",
      header: "Ruang",
      sortValue: (row) => `${row.ruang.bangunanAset.nama} ${row.ruang.nama}`,
      cell: (row) => (
        <div className="text-sm">
          <div>{row.ruang.nama}</div>
          <div className="text-xs text-muted-foreground">{row.ruang.bangunanAset.nama}</div>
        </div>
      ),
    },
    {
      key: "kondisi",
      header: "Kondisi",
      sortValue: (row) => row.kondisi,
      cell: (row) => <span className="text-sm">{KONDISI_LABEL[row.kondisi]} · {row.jumlah}</span>,
    },
    { key: "nup", header: "NUP", sortValue: (row) => row.sensus.length, cell: (row) => row.sensus.length },
    { key: "dokumen", header: "Dokumen", sortValue: (row) => row.dokumen.length, cell: (row) => row.dokumen.length },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "penginput",
      header: "Penginput",
      sortValue: (row) => row.createdBy.nama,
      cell: (row) => (
        <div className="text-sm">
          <div>{row.createdBy.nama}</div>
          <div className="text-xs text-muted-foreground">{row.createdBy.nim ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Diperbarui",
      sortValue: (row) => row.updatedAt,
      className: "whitespace-nowrap text-xs",
      cell: (row) => formatDate(row.updatedAt),
    },
    {
      key: "aksi",
      header: "",
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => void openDetail(row)}>
          <Eye /> Detail
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Validasi Sensus</h1>
          <p className="text-sm text-muted-foreground">
            Antrean verifikasi admin: cek NUP, dokumen, koreksi, lalu validasi atau tolak.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Muat ulang
          </Button>
          <Button onClick={() => void bulkVerify()} disabled={bulkBusy || selectedIds.length === 0}>
            <CheckCheck /> Validasi terpilih ({selectedIds.length})
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUS_TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => { setStatus(value); setPage(1); }}
            className={`rounded-lg border px-3 py-3 text-left text-sm ${status === value ? "border-primary bg-primary/5" : "bg-background"}`}
          >
            <div className="text-muted-foreground">{STATUS_LABEL[value]}</div>
            <div className="mt-1 text-xl font-semibold">{data?.statusCounts[value] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Antrean grup</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.id}
            search={search}
            onSearchChange={(value) => { setSearch(value); setQ(value); setPage(1); }}
            searchPlaceholder="Cari barang / ruang / penginput…"
            page={page}
            total={data?.total}
            limit={data?.limit ?? 25}
            onPageChange={setPage}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            loading={loading}
            emptyText="Tidak ada grup pada status ini."
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.namaBarang}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.ruang.bangunanAset.nama} · ${detail.ruang.nama} (${detail.ruang.kode}) · ${detail.createdBy.nama}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-4">
                <div><span className="text-muted-foreground">Status</span><div><StatusBadge status={detail.status} /></div></div>
                <div><span className="text-muted-foreground">Kondisi</span><div>{KONDISI_LABEL[detail.kondisi]} · {detail.jumlah} unit</div></div>
                <div><span className="text-muted-foreground">NUP</span><div>{detail.sensus.length}</div></div>
                <div><span className="text-muted-foreground">Dokumen</span><div>{docs?.items.length ?? detail.dokumen.length} file</div></div>
              </div>
              {detail.catatan && <p className="rounded-md bg-muted p-2 text-xs">Catatan: {detail.catatan}</p>}

              <div>
                <div className="mb-1 font-medium">NUP dalam grup</div>
                <div className="max-h-32 overflow-auto rounded-md border p-2 font-mono text-xs">
                  {detail.sensus.map((row) => (
                    <span key={row.id} className="mr-2 inline-block">{row.masterAset.kodeSiman ?? row.masterAset.kodeRegister ?? row.id.slice(0, 8)}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 font-medium">Dokumen</div>
                {detailLoading ? <p className="text-muted-foreground">Memuat dokumen…</p> : docs && docs.items.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {docs.items.map((doc) => (
                      <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="rounded-md border p-1 text-xs">
                        {doc.jenis === "FOTO" && <img src={doc.thumbUrl ?? doc.url} alt="Foto" className="h-20 w-full rounded object-cover" />}
                        <div className="mt-1 truncate">{doc.jenis} · {doc.uploadedBy.nama}</div>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground">Belum ada dokumen.</p>}
              </div>

              <div>
                <div className="mb-1 font-medium">Riwayat aktivitas grup</div>
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border p-2">
                  {logs && logs.items.length > 0 ? logs.items.map((log) => (
                    <div key={log.id} className="flex justify-between gap-2 text-xs">
                      <span>{log.actorNama} · {log.summary}</span>
                      <span className="shrink-0 text-muted-foreground">{formatDate(log.createdAt)}</span>
                    </div>
                  )) : <p className="text-muted-foreground">Belum ada aktivitas.</p>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {detail?.status === "DOCS_COMPLETE" && (
              <Button onClick={() => detail && void verify(detail)} disabled={actionBusy}>
                <CheckCircle2 /> Validasi
              </Button>
            )}
            {(detail?.status === "DOCS_COMPLETE" || detail?.status === "VALIDATED") && (
              <Button variant="destructive" onClick={() => { setRejectOpen(true); setRejectNote(""); }} disabled={actionBusy}>
                <XCircle /> Tolak
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak grup sensus</DialogTitle>
            <DialogDescription>Alasan akan dicatat di log dan riwayat edit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Alasan penolakan</Label>
            <Textarea id="reject-note" value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={() => void reject()} disabled={!rejectNote.trim() || actionBusy}>Tolak</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
