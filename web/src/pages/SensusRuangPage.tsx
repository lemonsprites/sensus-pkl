import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Loader2, Paperclip, Plus, Save,
  Search, Trash2, Upload, XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader } from "@/components/Loader";
import { api } from "@/lib/api";
import type {
  DokumenItem, DokumenListResponse, KandidatItem, KandidatResponse, Kondisi,
  RuangData, SensusGrup, SensusStatus,
} from "@/lib/types";

const STATUS_LABEL: Record<SensusStatus, string> = {
  DRAFT: "Draft", ASSESSED: "Diperiksa", DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi", TIDAK_DITEMUKAN: "Tidak ditemukan",
};
const KONDISI_LABEL: Record<Kondisi, string> = {
  BAIK: "Baik", RUSAK_RINGAN: "Rusak ringan", RUSAK_BERAT: "Rusak berat",
};

interface FormRow {
  key: string;
  kodeBarang: string;
  kondisi: Kondisi;
  jumlah: string;
  catatan: string;
}

const newRow = (): FormRow => ({
  key: crypto.randomUUID(), kodeBarang: "", kondisi: "BAIK", jumlah: "1", catatan: "",
});

function StatusBadge({ status }: { status: SensusStatus }) {
  const variant = status === "VALIDATED" ? "default" : status === "TIDAK_DITEMUKAN" ? "destructive" : "secondary";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

function nupRange(group: SensusGrup): string {
  const values = group.sensus
    .map((row) => row.masterAset.kodeSiman)
    .filter((value): value is string => Boolean(value));
  if (values.length === 0) return "—";
  values.sort((a, b) => Number(b) - Number(a) || b.localeCompare(a));
  return values.length === 1 ? values[0] : `${values[0]}–${values[values.length - 1]}`;
}

export default function SensusRuangPage() {
  const { ruangId } = useParams<{ ruangId: string }>();
  const { user } = useAuth();
  const canVerify = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [data, setData] = useState<RuangData | null>(null);
  const [kandidat, setKandidat] = useState<KandidatItem[]>([]);
  const [kandidatQuery, setKandidatQuery] = useState("");
  const [rows, setRows] = useState<FormRow[]>([newRow()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [docsGroup, setDocsGroup] = useState<SensusGrup | null>(null);
  const [docs, setDocs] = useState<DokumenListResponse | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadJenis, setUploadJenis] = useState<"FOTO" | "DOKUMEN">("FOTO");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!ruangId) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<RuangData>(`/ruang/${ruangId}`));
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Gagal memuat ruang");
    } finally {
      setLoading(false);
    }
  }, [ruangId]);

  const loadKandidat = useCallback(async (q = "") => {
    if (!ruangId) return;
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const result = await api<KandidatResponse>(`/ruang/${ruangId}/kandidat${params}`);
      setKandidat(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat kandidat aset");
    }
  }, [ruangId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadKandidat();
  }, [load, loadKandidat]);

  const updateRow = (key: string, patch: Partial<FormRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submit = async () => {
    if (!ruangId) return;
    const payload = rows
      .filter((row) => row.kodeBarang && Number(row.jumlah) > 0)
      .map((row) => ({
        kodeBarang: row.kodeBarang,
        kondisi: row.kondisi,
        jumlah: Number(row.jumlah),
        ...(row.catatan.trim() ? { catatan: row.catatan.trim() } : {}),
      }));

    if (payload.length === 0) {
      setError("Isi minimal satu baris: pilih aset dan jumlah.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await api(`/ruang/${ruangId}/sensus-grup`, { method: "POST", body: { rows: payload } });
      setNotice(`${payload.length} baris input dialokasikan ke NUP.`);
      setRows([newRow()]);
      await load();
      await loadKandidat(kandidatQuery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal alokasi NUP");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteGroup = async (group: SensusGrup) => {
    if (!window.confirm(`Hapus input ${group.namaBarang} (${group.jumlah} unit)? NUP akan dilepas.`)) return;
    setError("");
    try {
      await api(`/sensus-grup/${group.id}`, { method: "DELETE" });
      setNotice("Grup sensus dihapus.");
      await load();
      await loadKandidat(kandidatQuery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus grup");
    }
  };

  const verifyGroup = async (group: SensusGrup) => {
    setError("");
    try {
      await api(`/sensus-grup/${group.id}/verify`, { method: "POST" });
      setNotice(`Grup ${group.namaBarang} divalidasi.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal verifikasi");
    }
  };

  const rejectGroup = async (group: SensusGrup) => {
    const note = window.prompt("Alasan penolakan?");
    if (!note?.trim()) return;
    setError("");
    try {
      await api(`/sensus-grup/${group.id}/reject`, { method: "POST", body: { catatan: note.trim() } });
      setNotice("Grup ditolak dan dikembalikan ke Diperiksa.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menolak grup");
    }
  };

  const loadDocs = async (group: SensusGrup) => {
    setDocsGroup(group);
    setDocs(null);
    setDocsLoading(true);
    setDocsError("");
    try {
      setDocs(await api<DokumenListResponse>(`/sensus-grup/${group.id}/dokumen`));
    } catch (cause) {
      setDocsError(cause instanceof Error ? cause.message : "Gagal memuat dokumen");
    } finally {
      setDocsLoading(false);
    }
  };

  const uploadDoc = async () => {
    if (!docsGroup || !uploadFile) return;
    setUploading(true);
    setDocsError("");
    try {
      const contentType = uploadFile.type || "application/octet-stream";
      const presign = await api<{ uploadUrl: string; objectKey: string }>(
        `/sensus-grup/${docsGroup.id}/dokumen/presign`,
        { method: "POST", body: { filename: uploadFile.name, contentType, jenis: uploadJenis } },
      );
      const put = await fetch(presign.uploadUrl, {
        method: "PUT", headers: { "Content-Type": contentType }, body: uploadFile,
      });
      if (!put.ok) throw new Error(`Upload ke MinIO gagal (HTTP ${put.status})`);
      await api(`/sensus-grup/${docsGroup.id}/dokumen/confirm`, {
        method: "POST",
        body: { objectKey: presign.objectKey, jenis: uploadJenis, contentType, size: uploadFile.size },
      });
      setUploadFile(null);
      await loadDocs(docsGroup);
      await load();
    } catch (cause) {
      setDocsError(cause instanceof Error ? cause.message : "Gagal upload dokumen");
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (doc: DokumenItem) => {
    if (!docsGroup) return;
    if (!window.confirm("Hapus dokumen ini?")) return;
    try {
      await api(`/sensus-grup/${docsGroup.id}/dokumen/${doc.id}`, { method: "DELETE" });
      await loadDocs(docsGroup);
      await load();
    } catch (cause) {
      setDocsError(cause instanceof Error ? cause.message : "Gagal menghapus dokumen");
    }
  };

  if (!ruangId) return null;

  return (
    <div className="space-y-5">
      <Link to="/hierarki" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke hierarki
      </Link>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><AlertDescription>{notice}</AlertDescription></Alert>}

      {data && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{data.ruang.nama}</h1>
            <p className="text-sm text-muted-foreground">
              {data.gedung.nama} · {data.ruang.kode} · {data.ruang.tipeRuang ?? "—"}
              {data.ruang.lantai > 0 ? ` · Lantai ${data.ruang.lantai}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{data.ruang._count.grup} grup input</Badge>
            <Badge variant="secondary">{data.ruang._count.sensus} NUP disensus</Badge>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tambah hasil sensus</CardTitle>
          <CardDescription>
            Pilih jenis aset, kondisi, dan jumlah. Sistem mengambil NUP terakhir yang belum disensus
            lalu memetakannya ke ruang ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-2">
              <Label htmlFor="cari-kandidat">Cari kandidat aset</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="cari-kandidat" value={kandidatQuery} onChange={(event) => setKandidatQuery(event.target.value)} placeholder="nama / kode barang" className="pl-9" />
              </div>
            </div>
            <Button variant="secondary" onClick={() => void loadKandidat(kandidatQuery)}><Search /> Cari</Button>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
                <div className="space-y-1 sm:col-span-5">
                  <Label>Aset</Label>
                  <Select value={row.kodeBarang} onChange={(event) => updateRow(row.key, { kodeBarang: event.target.value })}>
                    <option value="">— pilih aset —</option>
                    {kandidat.map((item) => (
                      <option key={item.kodeBarang} value={item.kodeBarang}>
                        {item.nama} ({item.kodeBarang}) — {item.tersedia} NUP
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Kondisi</Label>
                  <Select value={row.kondisi} onChange={(event) => updateRow(row.key, { kondisi: event.target.value as Kondisi })}>
                    {Object.entries(KONDISI_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label>Jumlah</Label>
                  <Input type="number" min={1} value={row.jumlah} onChange={(event) => updateRow(row.key, { jumlah: event.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <Label>Catatan (opsional)</Label>
                  <Input value={row.catatan} onChange={(event) => updateRow(row.key, { catatan: event.target.value })} placeholder="mis. merk berbeda" />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button variant="ghost" size="icon" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} disabled={rows.length === 1} aria-label="Hapus baris">
                    <Trash2 />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground sm:col-span-12">
                  Baris {index + 1} {row.kodeBarang ? `· ${kandidat.find((item) => item.kodeBarang === row.kodeBarang)?.tersedia ?? 0} NUP tersedia` : ""}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRows((current) => [...current, newRow()])} disabled={rows.length >= 20}>
              <Plus /> Tambah baris
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan & Alokasikan NUP
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Riwayat input ruang</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader label="Memuat…" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aset</TableHead>
                  <TableHead>Kondisi / jumlah</TableHead>
                  <TableHead>NUP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && data.groups.length > 0 ? (
                  data.groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="max-w-64">
                        <div className="truncate font-medium">{group.namaBarang}</div>
                        <div className="font-mono text-xs text-muted-foreground">{group.kodeBarang}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {KONDISI_LABEL[group.kondisi]} · {group.jumlah} unit
                      </TableCell>
                      <TableCell className="font-mono text-xs">{nupRange(group)}</TableCell>
                      <TableCell><StatusBadge status={group.status} /></TableCell>
                      <TableCell className="max-w-52 text-xs text-muted-foreground">
                        <div className="truncate" title={group.catatan ?? ""}>{group.catatan ?? "—"}</div>
                        {group.catatanOtomatis && <div>{group.catatanOtomatis}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Dokumen" onClick={() => void loadDocs(group)}><Paperclip /></Button>
                          {canVerify && group.status === "DOCS_COMPLETE" && (
                            <Button size="icon" variant="ghost" title="Validasi" onClick={() => void verifyGroup(group)}><CheckCircle2 /></Button>
                          )}
                          {canVerify && (group.status === "VALIDATED" || group.status === "DOCS_COMPLETE") && (
                            <Button size="icon" variant="ghost" title="Tolak" onClick={() => void rejectGroup(group)}><XCircle /></Button>
                          )}
                          {group.status !== "VALIDATED" && (
                            <Button size="icon" variant="ghost" title="Hapus grup" onClick={() => void deleteGroup(group)}><Trash2 /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={6}>Belum ada input. Tambahkan hasil sensus di atas.</TableEmpty>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {docsGroup && (
        <Card className="border-primary/40">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Dokumen: {docsGroup.namaBarang} ({docsGroup.jumlah} unit)</CardTitle>
              <CardDescription>Foto grup menandai semua NUP dalam grup DOCS_COMPLETE.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDocsGroup(null)}>Tutup</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {docsError && <Alert variant="destructive"><AlertDescription>{docsError}</AlertDescription></Alert>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="grup-file">File (foto/PDF, maks 15 MB)</Label>
                <Input id="grup-file" type="file" accept="image/*,application/pdf" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grup-jenis">Jenis</Label>
                <Select id="grup-jenis" value={uploadJenis} onChange={(event) => setUploadJenis(event.target.value as "FOTO" | "DOKUMEN")}>
                  <option value="FOTO">Foto</option>
                  <option value="DOKUMEN">Dokumen pendukung</option>
                </Select>
              </div>
              <Button onClick={() => void uploadDoc()} disabled={!uploadFile || uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload
              </Button>
            </div>
            {docs && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={docs.docsComplete ? "default" : "outline"}>{docs.docsComplete ? "Dokumen lengkap" : "Belum lengkap"}</Badge>
                <span className="text-muted-foreground">{docs.items.length} file</span>
              </div>
            )}
            {docsLoading ? <Loader label="Memuat dokumen…" /> : docs && docs.items.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docs.items.map((doc) => (
                  <div key={doc.id} className="rounded-lg border p-3">
                    {doc.jenis === "FOTO" ? (
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        <img src={doc.thumbUrl ?? doc.url} alt="Foto sensus" className="h-36 w-full rounded-md object-cover" />
                      </a>
                    ) : (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="flex h-36 items-center justify-center rounded-md bg-muted text-sm underline">Buka dokumen</a>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{doc.jenis} · {doc.uploadedBy.nama}</span>
                      <Button size="icon" variant="ghost" onClick={() => void deleteDoc(doc)} aria-label="Hapus dokumen"><Trash2 /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>NUP hasil mapping ruang ini</CardTitle></CardHeader>
        <CardContent>
          {data && data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NUP</TableHead>
                  <TableHead>Kode Register</TableHead>
                  <TableHead>Nama aset</TableHead>
                  <TableHead>Kondisi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.masterAset.kodeSiman ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.masterAset.kodeRegister ?? "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">{row.masterAset.nama}</TableCell>
                    <TableCell className="text-xs">{row.kondisi ? KONDISI_LABEL[row.kondisi] : "—"}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-xs">
                      Cetak: {row.labelPrintedAt ? "sudah" : "belum"} · Tempel: {row.labelAppliedAt ? "sudah" : "belum"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground">Belum ada NUP yang dipetakan ke ruang ini.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
