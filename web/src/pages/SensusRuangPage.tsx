import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Loader2, Paperclip, Pencil, Plus, Save,
  Trash2, Upload, XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-context";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader } from "@/components/Loader";
import { api } from "@/lib/api";
import type {
  DokumenItem, DokumenListResponse, KandidatItem, KandidatResponse, Kondisi,
  RuangData, Sensus, SensusGrup, SensusStatus,
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
  const [kandidatLoading, setKandidatLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, KandidatItem>>({});
  const [kandidatQuery, setKandidatQuery] = useState("");
  const [rows, setRows] = useState<FormRow[]>([newRow()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<SensusGrup | null>(null);
  const [editKondisi, setEditKondisi] = useState<Kondisi>("BAIK");
  const [editCatatan, setEditCatatan] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

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
    setKandidatLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const result = await api<KandidatResponse>(`/ruang/${ruangId}/kandidat${params}`);
      setKandidat(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat kandidat aset");
    } finally {
      setKandidatLoading(false);
    }
  }, [ruangId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Pencarian kandidat otomatis (debounce) agar pengguna mobile tidak perlu menekan tombol.
  useEffect(() => {
    const handle = window.setTimeout(() => void loadKandidat(kandidatQuery), 300);
    return () => window.clearTimeout(handle);
  }, [kandidatQuery, loadKandidat]);

  const updateRow = (key: string, patch: Partial<FormRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const selectBarang = (key: string, value: string) => {
    updateRow(key, { kodeBarang: value });
    const item = kandidat.find((candidate) => candidate.kodeBarang === value);
    if (item) setPicked((current) => ({ ...current, [value]: item }));
  };

  // Gabungkan hasil pencarian dengan aset yang sudah dipilih supaya label tidak hilang saat query berubah.
  const kandidatOptions = useMemo<ComboboxOption[]>(() => {
    const merged = new Map<string, KandidatItem>();
    for (const item of kandidat) merged.set(item.kodeBarang, item);
    for (const item of Object.values(picked)) {
      if (!merged.has(item.kodeBarang)) merged.set(item.kodeBarang, item);
    }
    return [...merged.values()].map((item) => ({
      value: item.kodeBarang,
      label: item.nama,
      hint: `${item.kodeBarang} · ${item.tersedia} NUP tersedia`,
      keywords: `${item.kategori ?? ""} ${item.kodeBarang}`,
    }));
  }, [kandidat, picked]);

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
      setPicked({});
      setFormOpen(false);
      await load();
      await loadKandidat(kandidatQuery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal alokasi NUP");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (group: SensusGrup) => {
    setEditGroup(group);
    setEditKondisi(group.kondisi);
    setEditCatatan(group.catatan ?? "");
    setError("");
  };

  const saveEdit = async () => {
    if (!editGroup) return;
    setSavingEdit(true);
    setError("");
    setNotice("");
    try {
      await api(`/sensus-grup/${editGroup.id}`, {
        method: "PATCH",
        body: { kondisi: editKondisi, catatan: editCatatan },
      });
      setNotice(`Koreksi ${editGroup.namaBarang} tersimpan dan tercatat di log.`);
      setEditGroup(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan koreksi");
    } finally {
      setSavingEdit(false);
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

  const groupColumns: DataTableColumn<SensusGrup>[] = [
    {
      key: "aset",
      header: "Aset",
      mobilePriority: "title",
      sortValue: (group) => group.namaBarang,
      cell: (group) => (
        <div className="max-w-64">
          <div className="truncate font-medium">{group.namaBarang}</div>
          <div className="font-mono text-xs text-muted-foreground">{group.kodeBarang}</div>
        </div>
      ),
    },
    {
      key: "kondisi",
      header: "Kondisi / jumlah",
      mobilePriority: "primary",
      sortValue: (group) => group.jumlah,
      cell: (group) => <span className="text-xs">{KONDISI_LABEL[group.kondisi]} · {group.jumlah} unit</span>,
    },
    {
      key: "nup",
      header: "NUP",
      sortValue: (group) => nupRange(group),
      cell: (group) => <span className="font-mono text-xs">{nupRange(group)}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobilePriority: "primary",
      sortValue: (group) => group.status,
      cell: (group) => <StatusBadge status={group.status} />,
    },
    {
      key: "catatan",
      header: "Catatan",
      cell: (group) => (
        <div className="max-w-52 text-xs text-muted-foreground">
          <div className="truncate" title={group.catatan ?? ""}>{group.catatan ?? "—"}</div>
          {group.catatanOtomatis && <div>{group.catatanOtomatis}</div>}
          {group.updatedBy && <div>Dikoreksi: {group.updatedBy.nama}</div>}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "",
      mobilePriority: "actions",
      cell: (group) => (
        <div className="flex justify-end gap-1">
          {(group.status === "ASSESSED" || group.status === "DOCS_COMPLETE") && (
            <Button size="icon" variant="ghost" title="Koreksi kondisi/catatan" aria-label="Koreksi kondisi/catatan" onClick={() => openEdit(group)}><Pencil /></Button>
          )}
          <Button size="icon" variant="ghost" title="Dokumen" aria-label="Dokumen" onClick={() => void loadDocs(group)}><Paperclip /></Button>
          {canVerify && group.status === "DOCS_COMPLETE" && (
            <Button size="icon" variant="ghost" title="Validasi" aria-label="Validasi" onClick={() => void verifyGroup(group)}><CheckCircle2 /></Button>
          )}
          {canVerify && (group.status === "VALIDATED" || group.status === "DOCS_COMPLETE") && (
            <Button size="icon" variant="ghost" title="Tolak" aria-label="Tolak" onClick={() => void rejectGroup(group)}><XCircle /></Button>
          )}
          {group.status !== "VALIDATED" && (canVerify || group.createdBy.id === user?.id) && (
            <Button size="icon" variant="ghost" title="Hapus grup" aria-label="Hapus grup" onClick={() => void deleteGroup(group)}><Trash2 /></Button>
          )}
        </div>
      ),
    },
  ];

  const mappingColumns: DataTableColumn<Sensus>[] = [
    {
      key: "nup",
      header: "NUP",
      sortValue: (row) => Number(row.masterAset.kodeSiman ?? 0),
      cell: (row) => (
        <span className="font-mono text-xs">{row.masterAset.kodeSiman ?? "—"}</span>
      ),
    },
    {
      key: "register",
      header: "Kode Register",
      mobileLabel: "Kode register",
      mobilePriority: "subtitle",
      sortValue: (row) => row.masterAset.kodeRegister ?? "",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.masterAset.kodeRegister ?? "—"}
        </span>
      ),
    },
    {
      key: "nama",
      header: "Nama aset",
      mobilePriority: "title",
      sortValue: (row) => row.masterAset.nama,
      cell: (row) => <span className="block max-w-64 truncate">{row.masterAset.nama}</span>,
    },
    {
      key: "kondisi",
      header: "Kondisi",
      mobilePriority: "primary",
      cell: (row) => (
        <span className="text-xs">{row.kondisi ? KONDISI_LABEL[row.kondisi] : "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobilePriority: "primary",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "label",
      header: "Label",
      cell: (row) => (
        <span className="text-xs">
          Cetak: {row.labelPrintedAt ? "sudah" : "belum"} · Tempel:{" "}
          {row.labelAppliedAt ? "sudah" : "belum"}
        </span>
      ),
    },
  ];

  const groupRows = (data?.groups ?? []).filter((group) =>
    !groupSearch
      ? true
      : `${group.namaBarang} ${group.kodeBarang} ${group.catatan ?? ""}`
          .toLowerCase()
          .includes(groupSearch.toLowerCase()),
  );

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
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Badge variant="outline">{data.ruang._count.grup} grup input</Badge>
            <Badge variant="secondary">{data.ruang._count.sensus} NUP disensus</Badge>
            <Button className="w-full sm:w-auto" onClick={() => { setRows([newRow()]); setFormOpen(true); }}>
              <Plus /> Tambah Sensus
            </Button>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tambah hasil sensus</DialogTitle>
            <DialogDescription>
              Pilih jenis aset, kondisi, dan jumlah. Sistem mengambil NUP terakhir yang belum disensus
              lalu memetakannya ke ruang ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={row.key} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Baris {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                      disabled={rows.length === 1}
                      aria-label={`Hapus baris ${index + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label>Aset</Label>
                    <Combobox
                      options={kandidatOptions}
                      value={row.kodeBarang}
                      onValueChange={(value) => selectBarang(row.key, value)}
                      onSearchChange={setKandidatQuery}
                      onOpenChange={(open) => {
                        if (!open) setKandidatQuery("");
                      }}
                      placeholder="— pilih aset —"
                      searchPlaceholder="Cari nama / kode barang / NUP…"
                      emptyText="Tidak ada aset yang cocok."
                      loading={kandidatLoading}
                    />
                    {row.kodeBarang && (
                      <p className="text-xs text-muted-foreground">
                        {kandidat.find((item) => item.kodeBarang === row.kodeBarang)?.tersedia ??
                          picked[row.kodeBarang]?.tersedia ??
                          0}{" "}
                        NUP tersedia
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Jumlah</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={row.jumlah}
                        onChange={(event) => updateRow(row.key, { jumlah: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Kondisi</Label>
                      <Select
                        value={row.kondisi}
                        onChange={(event) =>
                          updateRow(row.key, { kondisi: event.target.value as Kondisi })
                        }
                      >
                        {Object.entries(KONDISI_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Catatan (opsional)</Label>
                    <Input
                      value={row.catatan}
                      onChange={(event) => updateRow(row.key, { catatan: event.target.value })}
                      placeholder="mis. merk berbeda"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-col gap-2 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Button
                variant="outline"
                onClick={() => setRows((current) => [...current, newRow()])}
                disabled={rows.length >= 20}
              >
                <Plus /> Tambah baris
              </Button>
              <Button onClick={() => void submit()} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Save />}
                Simpan & Alokasikan NUP
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Riwayat input ruang</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={groupColumns}
            data={groupRows}
            getRowId={(group) => group.id}
            search={groupSearch}
            onSearchChange={setGroupSearch}
            searchPlaceholder="Cari barang / kode / catatan…"
            loading={loading}
            emptyText="Belum ada input. Tambahkan hasil sensus di atas."
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(docsGroup)} onOpenChange={(open) => !open && setDocsGroup(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dokumen: {docsGroup?.namaBarang} ({docsGroup?.jumlah} unit)</DialogTitle>
            <DialogDescription>Foto grup menandai semua NUP dalam grup DOCS_COMPLETE.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {docsError && <Alert variant="destructive"><AlertDescription>{docsError}</AlertDescription></Alert>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 basis-full space-y-2 sm:basis-auto">
                <Label htmlFor="grup-file">File (foto/PDF, maks 15 MB)</Label>
                <Input id="grup-file" type="file" accept="image/*,application/pdf" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
              </div>
              <div className="w-full space-y-2 sm:w-40">
                <Label htmlFor="grup-jenis">Jenis</Label>
                <Select id="grup-jenis" value={uploadJenis} onChange={(event) => setUploadJenis(event.target.value as "FOTO" | "DOKUMEN")}>
                  <option value="FOTO">Foto</option>
                  <option value="DOKUMEN">Dokumen pendukung</option>
                </Select>
              </div>
              <Button className="w-full sm:w-auto" onClick={() => void uploadDoc()} disabled={!uploadFile || uploading}>
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
                      {(canVerify || doc.uploadedBy.id === user?.id) && (
                        <Button size="icon" variant="ghost" onClick={() => void deleteDoc(doc)} aria-label="Hapus dokumen"><Trash2 /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editGroup)} onOpenChange={(open) => !open && setEditGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Koreksi grup sensus</DialogTitle>
            <DialogDescription>
              {editGroup ? `${editGroup.namaBarang} (${editGroup.kodeBarang}) · ${editGroup.jumlah} unit` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Kondisi</Label>
              <Select value={editKondisi} onChange={(event) => setEditKondisi(event.target.value as Kondisi)}>
                {Object.entries(KONDISI_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-catatan">Catatan</Label>
              <Input id="edit-catatan" value={editCatatan} onChange={(event) => setEditCatatan(event.target.value)} placeholder="alasan koreksi / kondisi khusus" />
            </div>
            <p className="text-xs text-muted-foreground">
              Koreksi tercatat di log aktivitas dan mengubah status verifikasi bila diperlukan.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Batal</Button>
            <Button onClick={() => void saveEdit()} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="animate-spin" /> : <Save />} Simpan koreksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>NUP hasil mapping ruang ini</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={mappingColumns}
            data={data?.items ?? []}
            getRowId={(row) => row.id}
            emptyText="Belum ada NUP yang dipetakan ke ruang ini."
            searchPlaceholder="Cari NUP / kode register / nama aset…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
