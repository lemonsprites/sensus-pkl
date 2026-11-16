import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { ActivityLogItem, LogListResponse } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Masuk",
  LOGOUT: "Keluar",
  GROUP_CREATE: "Buat grup",
  GROUP_UPDATE: "Koreksi grup",
  GROUP_DELETE: "Hapus grup",
  DOC_UPLOAD: "Unggah dokumen",
  DOC_DELETE: "Hapus dokumen",
  VERIFY: "Validasi",
  REJECT: "Tolak",
  LABEL_PRINT: "Cetak label",
  LABEL_APPLY: "Tempel label",
  USER_CREATE: "Buat user",
  USER_UPDATE: "Perbarui user",
  USER_RESET_PASSWORD: "Reset password",
  USER_ACTIVATE: "Aktifkan user",
  USER_DEACTIVATE: "Nonaktifkan user",
  IMPORT_COMMIT: "Import SIMAN",
};

const ACTIONS = Object.keys(ACTION_LABEL);

function formatDate(value: string): string {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function LogPage() {
  const [data, setData] = useState<LogListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ActivityLogItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (action) params.set("action", action);
      if (q) params.set("q", q);
      setData(await api<LogListResponse>(`/logs?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat log");
    } finally {
      setLoading(false);
    }
  }, [page, action, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const columns: DataTableColumn<ActivityLogItem>[] = [
    {
      key: "createdAt",
      header: "Waktu",
      sortValue: (row) => row.createdAt,
      className: "whitespace-nowrap text-xs",
      cell: (row) => formatDate(row.createdAt),
    },
    {
      key: "actor",
      header: "Aktor",
      sortValue: (row) => row.actorNama,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.actorNama}</div>
          {row.actor && <div className="text-xs text-muted-foreground">{row.actor.role}</div>}
        </div>
      ),
    },
    {
      key: "action",
      header: "Aksi",
      sortValue: (row) => row.action,
      cell: (row) => <Badge variant="outline">{ACTION_LABEL[row.action] ?? row.action}</Badge>,
    },
    {
      key: "entity",
      header: "Entitas",
      cell: (row) => (
        <div className="text-xs">
          <div>{row.entityType}</div>
          {row.entityId && <div className="font-mono text-muted-foreground">{row.entityId.slice(0, 8)}…</div>}
        </div>
      ),
    },
    {
      key: "summary",
      header: "Ringkasan",
      cell: (row) => <span className="text-sm">{row.summary}</span>,
    },
    {
      key: "detail",
      header: "",
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>Detail</Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Log Aktivitas</h1>
          <p className="text-sm text-muted-foreground">
            Jejak kolaborasi: siapa mengubah apa, kapan, dan pada data mana.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Muat ulang
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat perubahan</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            getRowId={(row) => row.id}
            search={search}
            onSearchChange={(value) => { setSearch(value); setQ(value); setPage(1); }}
            searchPlaceholder="Cari aktor / ringkasan…"
            filters={
              <Select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="w-48">
                <option value="">Semua aksi</option>
                {ACTIONS.map((value) => <option key={value} value={value}>{ACTION_LABEL[value]}</option>)}
              </Select>
            }
            page={page}
            total={data?.total}
            limit={data?.limit ?? 30}
            onPageChange={setPage}
            loading={loading}
            emptyText="Belum ada aktivitas."
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail aktivitas</DialogTitle>
            <DialogDescription>{selected ? formatDate(selected.createdAt) : ""}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Aktor:</span> {selected.actorNama}</div>
                <div><span className="text-muted-foreground">Aksi:</span> {ACTION_LABEL[selected.action] ?? selected.action}</div>
                <div><span className="text-muted-foreground">Entitas:</span> {selected.entityType}</div>
                <div className="font-mono text-xs"><span className="text-muted-foreground">ID:</span> {selected.entityId ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Ringkasan</div>
                <p>{selected.summary}</p>
              </div>
              <div>
                <div className="mb-1 text-muted-foreground">Metadata</div>
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(selected.metadata, null, 2) || "—"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
