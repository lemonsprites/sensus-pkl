import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, FileText, RefreshCw, Users, Boxes } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { MonitoringResponse, MonitoringRoom, MonitoringUser, Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  MAHASISWA: "Mahasiswa", ADMIN: "Admin", SUPERADMIN: "Superadmin",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function dateStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function dateEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (applied.from) params.set("from", dateStart(applied.from)!);
      if (applied.to) params.set("to", dateEnd(applied.to)!);
      setData(await api<MonitoringResponse>(`/monitoring/progress?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat monitoring");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const userColumns: DataTableColumn<MonitoringUser>[] = [
    {
      key: "nama",
      header: "Nama / NIM",
      sortValue: (row) => row.nama,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.nama}</div>
          <div className="text-xs text-muted-foreground">{row.nim ?? row.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Peran",
      sortValue: (row) => row.role,
      cell: (row) => <Badge variant="outline">{ROLE_LABEL[row.role]}</Badge>,
    },
    {
      key: "groupsCreated",
      header: "Grup",
      sortValue: (row) => row.groupsCreated,
      cell: (row) => <span className="font-medium">{row.groupsCreated}</span>,
    },
    {
      key: "nupAllocated",
      header: "NUP",
      sortValue: (row) => row.nupAllocated,
      cell: (row) => row.nupAllocated,
    },
    { key: "docs", header: "Dokumen", sortValue: (row) => row.docsUploaded, cell: (row) => row.docsUploaded },
    { key: "corrections", header: "Koreksi", sortValue: (row) => row.corrections, cell: (row) => row.corrections },
    { key: "validated", header: "Tervalidasi", sortValue: (row) => row.validatedGroups, cell: (row) => row.validatedGroups },
    { key: "ruang", header: "Ruang", sortValue: (row) => row.ruangCount, cell: (row) => row.ruangCount },
    {
      key: "lastActivityAt",
      header: "Aktivitas terakhir",
      sortValue: (row) => row.lastActivityAt ?? "",
      className: "whitespace-nowrap text-xs",
      cell: (row) => formatDate(row.lastActivityAt),
    },
    {
      key: "laporan",
      header: "",
      cell: (row) =>
        isAdmin && row.role === "MAHASISWA" ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/laporan?userId=${row.id}`}>Laporan</Link>
          </Button>
        ) : null,
    },
  ];

  const roomColumns: DataTableColumn<MonitoringRoom>[] = [
    {
      key: "ruang",
      header: "Gedung / Ruang",
      sortValue: (row) => `${row.gedung} ${row.nama}`,
      cell: (row) => (
        <div>
          <div className="font-medium">{row.nama}</div>
          <div className="text-xs text-muted-foreground">{row.gedung} · {row.kode}</div>
        </div>
      ),
    },
    { key: "groups", header: "Grup", sortValue: (row) => row.groups, cell: (row) => row.groups },
    { key: "nup", header: "NUP", sortValue: (row) => row.nup, cell: (row) => row.nup },
    { key: "docs", header: "Dokumen", sortValue: (row) => row.docs, cell: (row) => row.docs },
    { key: "contributors", header: "Kontributor", sortValue: (row) => row.contributors, cell: (row) => row.contributors },
    {
      key: "validated",
      header: "Validasi",
      sortValue: (row) => row.status.VALIDATED,
      cell: (row) => `${row.status.VALIDATED} / ${row.groups}`,
    },
    {
      key: "lastActivityAt",
      header: "Aktivitas terakhir",
      sortValue: (row) => row.lastActivityAt,
      className: "whitespace-nowrap text-xs",
      cell: (row) => formatDate(row.lastActivityAt),
    },
  ];

  const totals = data?.summary;
  const topContributors = useMemo(
    () => (data?.mahasiswa ?? []).filter((row) => row.groupsCreated > 0 || row.activityCount > 0).slice(0, 3),
    [data],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monitoring Progres PKL</h1>
          <p className="text-sm text-muted-foreground">
            Kontribusi mahasiswa, progres per ruang, dan aktivitas kolaborasi.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Muat ulang
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-2">
            <Label htmlFor="mon-from">Dari tanggal</Label>
            <Input id="mon-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mon-to">Sampai tanggal</Label>
            <Input id="mon-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <Button onClick={() => setApplied({ from, to })}>Terapkan</Button>
          <Button
            variant="ghost"
            onClick={() => { setFrom(""); setTo(""); setApplied({ from: "", to: "" }); }}
          >
            Reset
          </Button>
          {topContributors.length > 0 && (
            <div className="ml-auto text-right text-xs text-muted-foreground">
              Kontributor teratas: {topContributors.map((row) => row.nama).join(", ")}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">Grup input <Boxes className="size-4" /></div>
            <div className="mt-1 text-2xl font-semibold">{totals?.totalGroups ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">NUP dialokasikan <FileText className="size-4" /></div>
            <div className="mt-1 text-2xl font-semibold">{totals?.totalNup ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">Mahasiswa aktif <Users className="size-4" /></div>
            <div className="mt-1 text-2xl font-semibold">{totals?.totalStudents ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">Kontributor <Activity className="size-4" /></div>
            <div className="mt-1 text-2xl font-semibold">{totals?.activeContributors ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals && ([
          ["ASSESSED", "Diperiksa"], ["DOCS_COMPLETE", "Dokumen lengkap"],
          ["VALIDATED", "Tervalidasi"], ["TIDAK_DITEMUKAN", "Tidak ditemukan"],
        ] as const).map(([status, label]) => (
          <Card key={status}>
            <CardContent className="flex items-center justify-between pt-4 text-sm">
              <span>{label}</span><Badge variant={status === "VALIDATED" ? "default" : "secondary"}>{totals.status[status]}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Progres per mahasiswa / kontributor</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={userColumns}
            data={data?.mahasiswa ?? []}
            getRowId={(row) => row.id}
            loading={loading}
            emptyText="Belum ada kontribusi."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Progres per ruang</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={roomColumns}
            data={data?.ruang ?? []}
            getRowId={(row) => row.id}
            loading={loading}
            emptyText="Belum ada ruang yang dikerjakan."
          />
        </CardContent>
      </Card>
    </div>
  );
}
