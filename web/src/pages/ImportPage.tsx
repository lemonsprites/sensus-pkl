import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { FileSpreadsheet, Loader2, Pencil, Save, Upload, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { api, apiUpload } from "@/lib/api";
import type {
  ImportBatch,
  ImportBatchList,
  ImportPreview,
  ImportRow,
} from "@/lib/types";

interface UploadResult {
  batch: ImportBatch;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  backup: boolean;
}

interface CommitResult {
  batch: ImportBatch;
  inserted: number;
  updated: number;
  skipped: number;
  durationMs: number;
}

interface EditForm {
  kodeRegister: string;
  kodeBarang: string;
  kodeSiman: string;
  nama: string;
  kategori: string;
  kodeSatker: string;
  jumlahLama: string;
  merk: string;
  noSeri: string;
  tahun: string;
  nilaiPerolehan: string;
  lokasiSiman: string;
  kondisiSiman: string;
  statusAset: string;
  catatan: string;
}

const EMPTY_FORM: EditForm = {
  kodeRegister: "",
  kodeBarang: "",
  kodeSiman: "",
  nama: "",
  kategori: "",
  kodeSatker: "",
  jumlahLama: "",
  merk: "",
  noSeri: "",
  tahun: "",
  nilaiPerolehan: "",
  lokasiSiman: "",
  kondisiSiman: "",
  statusAset: "",
  catatan: "",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function statusVariant(status: ImportBatch["status"]): "default" | "secondary" | "destructive" {
  if (status === "COMMITTED") return "default";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
}

function toForm(row: ImportRow): EditForm {
  return {
    kodeRegister: row.kodeRegister ?? "",
    kodeBarang: row.kodeBarang ?? "",
    kodeSiman: row.kodeSiman ?? "",
    nama: row.nama,
    kategori: row.kategori ?? "",
    kodeSatker: row.kodeSatker ?? "",
    jumlahLama: String(row.jumlahLama ?? ""),
    merk: row.merk ?? "",
    noSeri: row.noSeri ?? "",
    tahun: row.tahun === null ? "" : String(row.tahun),
    nilaiPerolehan: row.nilaiPerolehan ?? "",
    lokasiSiman: row.lokasiSiman ?? "",
    kondisiSiman: row.kondisiSiman ?? "",
    statusAset: row.statusAset ?? "",
    catatan: row.catatan ?? "",
  };
}

export default function ImportPage() {
  const [batches, setBatches] = useState<ImportBatchList | null>(null);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [batchId, setBatchId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [page, setPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [editing, setEditing] = useState<ImportRow | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      setBatches(await api<ImportBatchList>("/import/siman/batches?limit=10"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat riwayat import");
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch riwayat saat halaman dibuka.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBatches();
  }, [loadBatches]);

  const loadPreview = useCallback(async (id: string, targetPage: number) => {
    setPreviewLoading(true);
    setError("");
    try {
      setPreview(await api<ImportPreview>(`/import/siman/preview/${id}?page=${targetPage}&limit=20`));
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Gagal memuat preview");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!batchId) return;
    // Fetch preview per halaman (setState setelah await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPreview(batchId, page);
  }, [batchId, page, loadPreview]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setError("");
    setNotice("");
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Pilih file XLSX atau CSV terlebih dahulu.");
      return;
    }

    setUploading(true);
    setError("");
    setNotice("");
    setEditing(null);
    setPreview(null);

    try {
      const data = new FormData();
      data.append("file", file);
      const result = await apiUpload<UploadResult>("/import/siman/preview", data);
      setNotice(
        `File ${result.batch.filename} dibaca: ${result.totalRows} baris (${result.validRows} valid, ${result.invalidRows} error).`,
      );
      if (!result.backup) {
        setError("Backup MinIO gagal — staging hanya di Redis. Jangan flush Redis sebelum commit.");
      }
      setFile(null);
      setPage(1);
      setBatchId(result.batch.id);
      await loadBatches();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!batchId || !preview) return;
    if (!window.confirm(`Commit ${preview.meta.totalRows} baris ke master SIMAN?`)) return;

    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await api<CommitResult>("/import/siman/commit", {
        method: "POST",
        body: { batchId },
      });
      setNotice(
        `Commit selesai: ${result.inserted} baru, ${result.updated} diperbarui, ${result.skipped} dilewati (${(result.durationMs / 1000).toFixed(1)} detik).`,
      );
      setBatchId(null);
      setPreview(null);
      setEditing(null);
      await loadBatches();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Commit gagal");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!batchId) return;
    if (!window.confirm("Batalkan batch ini? Staging Redis + MinIO akan dihapus.")) return;

    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      await api("/import/siman/cancel", { method: "POST", body: { batchId } });
      setNotice("Batch dibatalkan dan staging dibersihkan.");
      setBatchId(null);
      setPreview(null);
      setEditing(null);
      await loadBatches();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membatalkan batch");
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (row: ImportRow) => {
    setEditing(row);
    setForm(toForm(row));
    setError("");
    setNotice("");
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!batchId || !editing) return;

    const payload: Record<string, unknown> = {
      kodeRegister: form.kodeRegister,
      kodeBarang: form.kodeBarang,
      kodeSiman: form.kodeSiman,
      nama: form.nama,
      kategori: form.kategori,
      kodeSatker: form.kodeSatker,
      merk: form.merk,
      noSeri: form.noSeri,
      lokasiSiman: form.lokasiSiman,
      kondisiSiman: form.kondisiSiman,
      statusAset: form.statusAset,
      catatan: form.catatan,
    };
    if (form.jumlahLama.trim() !== "") payload.jumlahLama = Number(form.jumlahLama);
    if (form.tahun.trim() !== "") payload.tahun = Number(form.tahun);
    if (form.nilaiPerolehan.trim() !== "") payload.nilaiPerolehan = form.nilaiPerolehan;

    setSavingEdit(true);
    setError("");
    setNotice("");
    try {
      await api(`/import/siman/preview/${batchId}/row/${editing.rowNum}`, {
        method: "PATCH",
        body: payload,
      });
      setNotice(`Baris ${editing.rowNum} disimpan di staging Redis.`);
      setEditing(null);
      await loadPreview(batchId, page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan baris");
    } finally {
      setSavingEdit(false);
    }
  };

  const totalPages = preview ? Math.max(1, Math.ceil(preview.total / preview.limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileSpreadsheet className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Import SIMAN</h1>
          <p className="text-sm text-muted-foreground">
            Upload XLSX/CSV → preview (Redis + backup MinIO) → commit transaksional.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant="success">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Maksimal 50 MB / 50.000 baris. Kolom wajib: Kode Register, Kode Barang, NUP,
            Nama Barang, Kode Satker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1 space-y-2">
              <Label htmlFor="import-file">File SIMAN (.xlsx / .xls / .csv)</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} — {formatBytes(file.size)}
                </p>
              )}
            </div>
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading ? "Memproses…" : "Upload & Preview"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {batchId && preview && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Preview: {preview.batch.filename}</CardTitle>
              <CardDescription>
                {preview.meta.totalRows} baris · {preview.meta.validRows} valid ·{" "}
                {preview.meta.invalidRows} error · backup MinIO:{" "}
                {preview.meta.backup ? "ada" : "TIDAK ADA"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void loadPreview(batchId, page)}
                disabled={previewLoading || actionLoading}
              >
                Muat Ulang
              </Button>
              <Button variant="destructive" onClick={() => void handleCancel()} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleCommit()}
                disabled={actionLoading || preview.meta.invalidRows > 0}
                title={
                  preview.meta.invalidRows > 0
                    ? "Perbaiki semua baris error sebelum commit"
                    : undefined
                }
              >
                {actionLoading ? <Loader2 className="animate-spin" /> : <Save />}
                Commit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.meta.invalidRows > 0 && (
              <Alert variant="destructive">
                <AlertTitle>{preview.meta.invalidRows} baris error</AlertTitle>
                <AlertDescription>
                  Perbaiki lewat tombol Edit sebelum commit. Commit diblokir sampai semua baris valid.
                </AlertDescription>
              </Alert>
            )}

            {editing && (
              <Card className="border-primary/40">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>Edit baris {editing.rowNum}</CardTitle>
                    <CardDescription>Perubahan hanya di Redis; snapshot MinIO tidak diubah.</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Tutup">
                    <X />
                  </Button>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          ["kodeRegister", "Kode Register"],
                          ["kodeBarang", "Kode Barang"],
                          ["kodeSiman", "NUP"],
                          ["nama", "Nama Barang"],
                          ["kategori", "Kategori"],
                          ["kodeSatker", "Kode Satker"],
                          ["jumlahLama", "Jumlah"],
                          ["merk", "Merk"],
                          ["noSeri", "No Seri"],
                          ["tahun", "Tahun"],
                          ["nilaiPerolehan", "Nilai Perolehan"],
                          ["lokasiSiman", "Lokasi Ruang"],
                          ["kondisiSiman", "Kondisi"],
                          ["statusAset", "Status BMN"],
                          ["catatan", "Catatan"],
                        ] as Array<[keyof EditForm, string]>
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={`edit-${key}`}>{label}</Label>
                          <Input
                            id={`edit-${key}`}
                            value={form[key]}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, [key]: event.target.value }))
                            }
                            required={key === "nama"}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={savingEdit}>
                        {savingEdit ? <Loader2 className="animate-spin" /> : <Save />}
                        Simpan Baris
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                        Batal
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {previewLoading ? (
              <Loader label="Memuat preview…" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baris</TableHead>
                    <TableHead>Kode Register / NUP</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Validasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.items.length > 0 ? (
                    preview.items.map((row) => (
                      <TableRow key={row.rowNum}>
                        <TableCell className="text-xs text-muted-foreground">{row.rowNum}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <div>{row.kodeRegister ?? "—"}</div>
                          <div className="text-muted-foreground">NUP {row.kodeSiman ?? "—"}</div>
                        </TableCell>
                        <TableCell className="max-w-64">
                          <div className="truncate" title={row.nama}>{row.nama}</div>
                          <div className="text-xs text-muted-foreground">{row.kodeBarang ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">{row.kategori ?? "—"}</TableCell>
                        <TableCell className="max-w-52 truncate text-xs" title={row.lokasiSiman ?? ""}>
                          {row.lokasiSiman ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {row.errors.length > 0 ? (
                              <Badge variant="destructive" title={row.errors.join("\n")}>
                                {row.errors.length} error
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Valid</Badge>
                            )}
                            {row.warnings.length > 0 && (
                              <Badge variant="outline" title={row.warnings.join("\n")}>
                                {row.warnings.length} warning
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(row)}
                            aria-label={`Edit baris ${row.rowNum}`}
                          >
                            <Pencil />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmpty colSpan={7}>Tidak ada baris.</TableEmpty>
                  )}
                </TableBody>
              </Table>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || previewLoading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || previewLoading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Import</CardTitle>
          <CardDescription>10 batch terakhir yang Anda upload.</CardDescription>
        </CardHeader>
        <CardContent>
          {batchesLoading ? (
            <Loader label="Memuat riwayat…" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Baris</TableHead>
                  <TableHead>Baru / Update</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Kedaluwarsa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches && batches.items.length > 0 ? (
                  batches.items.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.filename}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(batch.status)}>{batch.status}</Badge>
                      </TableCell>
                      <TableCell>{batch.totalRows}</TableCell>
                      <TableCell>
                        {batch.inserted} / {batch.updated}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(batch.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(batch.expiresAt ?? null)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={6}>Belum ada batch import.</TableEmpty>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
