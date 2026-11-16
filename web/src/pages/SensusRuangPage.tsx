import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, Loader2, Pencil, Save, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/Loader";
import { api } from "@/lib/api";
import type {
  AssetWithSensus,
  Kondisi,
  RuangAssetsResponse,
  Sensus,
  SensusStatus,
  StatusMatch,
} from "@/lib/types";

const STATUS_LABEL: Record<SensusStatus, string> = {
  DRAFT: "Draft",
  ASSESSED: "Diperiksa",
  DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi",
  TIDAK_DITEMUKAN: "Tidak ditemukan",
};

const KONDISI_LABEL: Record<Kondisi, string> = {
  BAIK: "Baik",
  RUSAK_RINGAN: "Rusak ringan",
  RUSAK_BERAT: "Rusak berat",
};

const STATUS_MATCH_LABEL: Record<StatusMatch, string> = {
  COCOK: "Cocok dengan SIMAN",
  TIDAK_COCOK: "Tidak cocok",
  TEMUAN_BARU: "Temuan baru",
};

function statusVariant(status: SensusStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "VALIDATED") return "default";
  if (status === "TIDAK_DITEMUKAN") return "destructive";
  if (status === "DRAFT") return "outline";
  return "secondary";
}

function SensusBadge({ sensus }: { sensus: Sensus | null }) {
  if (!sensus) return <Badge variant="outline">Belum</Badge>;
  return <Badge variant={statusVariant(sensus.status)}>{STATUS_LABEL[sensus.status]}</Badge>;
}

function SensusForm({
  asset,
  onSaved,
  onClose,
}: {
  asset: AssetWithSensus;
  onSaved: (assetId: string, sensus: Sensus) => void;
  onClose: () => void;
}) {
  const existing = asset.sensus;
  const [jumlah, setJumlah] = useState(existing?.jumlahFisik?.toString() ?? "");
  const [kondisi, setKondisi] = useState<Kondisi | "">(existing?.kondisi ?? "");
  const [statusMatch, setStatusMatch] = useState<StatusMatch | "">(existing?.statusMatch ?? "");
  const [isTemuanBaru, setIsTemuanBaru] = useState(existing?.isTemuanBaru ?? false);
  const [docsNote, setDocsNote] = useState(existing?.docsNote ?? "");
  const [catatan, setCatatan] = useState(existing?.catatan ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetWarning =
    existing?.status === "VALIDATED" || existing?.status === "DOCS_COMPLETE";

  const submit = async (status: "DRAFT" | "ASSESSED" | "TIDAK_DITEMUKAN") => {
    setError("");

    if (status === "ASSESSED" && (jumlah.trim() === "" || kondisi === "")) {
      setError("Jumlah fisik dan kondisi wajib diisi untuk menandai diperiksa.");
      return;
    }
    if (status === "TIDAK_DITEMUKAN" && docsNote.trim() === "") {
      setError("Catatan dokumen wajib diisi untuk status Tidak Ditemukan.");
      return;
    }

    setSaving(true);
    try {
      const result = await api<{ sensus: Sensus }>(`/sensus/${asset.id}`, {
        method: "PUT",
        body: {
          status,
          jumlahFisik: jumlah.trim() === "" ? null : Number(jumlah),
          kondisi: kondisi === "" ? null : kondisi,
          statusMatch: statusMatch === "" ? null : statusMatch,
          isTemuanBaru,
          docsNote: docsNote.trim() === "" ? null : docsNote,
          catatan: catatan.trim() === "" ? null : catatan,
        },
      });
      onSaved(asset.id, result.sensus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan sensus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base">Sensus: {asset.nama}</CardTitle>
          <CardDescription>
            {asset.kodeRegister ?? "tanpa kode register"} · NUP {asset.kodeSiman ?? "—"} ·{" "}
            {asset.kategori ?? "—"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <SensusBadge sensus={existing} />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {resetWarning && (
          <Alert variant="destructive">
            <AlertDescription>
              Aset ini sudah tervalidasi. Menyimpan perubahan akan mengembalikan status ke
              Diperiksa dan dicatat di EditHistory.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="jumlah">Jumlah fisik</Label>
            <Input
              id="jumlah"
              type="number"
              min={0}
              value={jumlah}
              onChange={(event) => setJumlah(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kondisi">Kondisi</Label>
            <Select
              id="kondisi"
              value={kondisi}
              onChange={(event) => setKondisi(event.target.value as Kondisi | "")}
            >
              <option value="">— pilih —</option>
              {Object.entries(KONDISI_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="statusMatch">Status match</Label>
            <Select
              id="statusMatch"
              value={statusMatch}
              onChange={(event) => setStatusMatch(event.target.value as StatusMatch | "")}
            >
              <option value="">— pilih —</option>
              {Object.entries(STATUS_MATCH_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTemuanBaru}
            onChange={(event) => setIsTemuanBaru(event.target.checked)}
            className="size-4"
          />
          Temuan baru (tidak ada di master SIMAN — tidak akan dilabeli)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="docsNote">Catatan dokumen (wajib jika Tidak Ditemukan)</Label>
            <Textarea
              id="docsNote"
              value={docsNote}
              onChange={(event) => setDocsNote(event.target.value)}
              placeholder="mis. barang tidak ada di ruang, sudah dilaporkan ke admin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan tambahan</Label>
            <Textarea
              id="catatan"
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
              placeholder="kondisi khusus, merk berbeda, dll."
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void submit("DRAFT")} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Simpan Draft
          </Button>
          <Button onClick={() => void submit("ASSESSED")} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Simpan & Tandai Diperiksa
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit("TIDAK_DITEMUKAN")}
            disabled={saving}
          >
            Tidak Ditemukan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SensusRuangPage() {
  const { ruangId } = useParams<{ ruangId: string }>();
  const [data, setData] = useState<RuangAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"SEMUA" | "BELUM" | "SUDAH">("SEMUA");
  const [selected, setSelected] = useState<AssetWithSensus | null>(null);

  const load = useCallback(async () => {
    if (!ruangId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        status: statusFilter,
      });
      if (q) params.set("q", q);
      setData(await api<RuangAssetsResponse>(`/ruang/${ruangId}/aset?${params.toString()}`));
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Gagal memuat aset ruang");
    } finally {
      setLoading(false);
    }
  }, [ruangId, page, q, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleSaved = (assetId: string, sensus: Sensus) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        gedung: current.gedung.id === assetId ? { ...current.gedung, sensus } : current.gedung,
        items: current.items.map((item) => (item.id === assetId ? { ...item, sensus } : item)),
      };
    });
    setSelected((current) => (current && current.id === assetId ? { ...current, sensus } : current));
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  if (!ruangId) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/hierarki" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Kembali ke hierarki
        </Link>
      </div>

      {data && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{data.ruang.nama}</h1>
            <p className="text-sm text-muted-foreground">
              {data.gedung.nama} · {data.ruang.kode} · {data.ruang.tipeRuang ?? "—"}
              {data.ruang.lantai > 0 ? ` · Lantai ${data.ruang.lantai}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{data.total} aset</Badge>
            <Badge variant="secondary">{data.ruang._count.sensus} disensus</Badge>
            {data.ruang.tipeRuang === "TANPA RUANGAN" && (
              <Badge variant="destructive">ruang virtual</Badge>
            )}
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Building2 className="size-4" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Aset gedung</div>
                <div className="text-sm font-medium">{data.gedung.nama}</div>
                <div className="text-xs text-muted-foreground">
                  {data.gedung.kodeRegister ?? "—"} · NUP {data.gedung.kodeSiman ?? "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SensusBadge sensus={data.gedung.sensus} />
              <Button size="sm" variant="outline" onClick={() => setSelected(data.gedung)}>
                Isi Sensus Gedung
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selected && (
        <SensusForm
          key={selected.id}
          asset={selected}
          onSaved={handleSaved}
          onClose={() => setSelected(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Aset</CardTitle>
          <CardDescription>Cari dan isi sensus per baris.</CardDescription>
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
            <div className="min-w-52 flex-1 space-y-2">
              <Label htmlFor="cari-aset">Cari aset</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cari-aset"
                  value={qInput}
                  onChange={(event) => setQInput(event.target.value)}
                  placeholder="nama / kode register / NUP"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-sensus">Status</Label>
              <Select
                id="filter-sensus"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as "SEMUA" | "BELUM" | "SUDAH");
                  setPage(1);
                }}
              >
                <option value="SEMUA">Semua</option>
                <option value="BELUM">Belum disensus</option>
                <option value="SUDAH">Sudah disensus</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              <Search /> Cari
            </Button>
          </form>

          {loading ? (
            <Loader label="Memuat aset…" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aset</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Lokasi SIMAN</TableHead>
                  <TableHead>Sensus</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && data.items.length > 0 ? (
                  data.items.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="max-w-72">
                        <div className="truncate font-medium" title={asset.nama}>
                          {asset.nama}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {asset.kodeRegister ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {asset.kodeBarang ?? "—"} · NUP {asset.kodeSiman ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {asset.kategori ?? "—"}
                        <div className="text-muted-foreground">{asset.kondisiSiman ?? "—"}</div>
                      </TableCell>
                      <TableCell className="max-w-52 truncate text-xs" title={asset.lokasiSiman ?? ""}>
                        {asset.lokasiSiman ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <SensusBadge sensus={asset.sensus} />
                          {asset.sensus && (
                            <span className="text-xs text-muted-foreground">
                              {asset.sensus.jumlahFisik ?? "—"} ·{" "}
                              {asset.sensus.kondisi ? KONDISI_LABEL[asset.sensus.kondisi] : "—"}
                            </span>
                          )}
                          {asset.sensus?.isTemuanBaru && (
                            <Badge variant="destructive">temuan baru</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected(asset)}
                          aria-label={`Isi sensus ${asset.nama}`}
                        >
                          <Pencil /> {asset.sensus ? "Edit" : "Isi"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={5}>Tidak ada aset yang cocok.</TableEmpty>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Halaman {page} dari {totalPages} · {data?.total ?? 0} aset
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
