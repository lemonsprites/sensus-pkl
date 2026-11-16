import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, apiDownload } from "@/lib/api";
import type { HierarkiResponse, ReportData, SensusStatus } from "@/lib/types";

const KONDISI_LABEL = { BAIK: "Baik", RUSAK_RINGAN: "Rusak ringan", RUSAK_BERAT: "Rusak berat" };
const STATUS_LABEL: Record<SensusStatus, string> = {
  DRAFT: "Draft",
  ASSESSED: "Diperiksa",
  DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi",
  TIDAK_DITEMUKAN: "Tidak ditemukan",
};

function dateStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}
function dateEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}
function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("id-ID", { dateStyle: "long" }) : "—";
}

interface ReportForm {
  from: string;
  to: string;
  buildingId: string;
  roomId: string;
  sekolah: string;
  alamat: string;
  kota: string;
  kepala: string;
  adminBmn: string;
  pembimbing: string;
  includeLog: string;
}

function buildParams(form: ReportForm): URLSearchParams {
  const params = new URLSearchParams();
  if (dateStart(form.from)) params.set("from", dateStart(form.from)!);
  if (dateEnd(form.to)) params.set("to", dateEnd(form.to)!);
  if (form.buildingId) params.set("buildingId", form.buildingId);
  if (form.roomId) params.set("roomId", form.roomId);
  if (form.sekolah) params.set("sekolah", form.sekolah);
  if (form.alamat) params.set("alamat", form.alamat);
  if (form.kota) params.set("kota", form.kota);
  if (form.kepala) params.set("kepala", form.kepala);
  if (form.adminBmn) params.set("adminBmn", form.adminBmn);
  if (form.pembimbing) params.set("pembimbing", form.pembimbing);
  params.set("includeLog", form.includeLog);
  return params;
}

export default function ReportPage() {
  const [hierarchy, setHierarchy] = useState<HierarkiResponse | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState<ReportForm>({
    from: "", to: "", buildingId: "", roomId: "",
    sekolah: "", alamat: "", kota: "",
    kepala: "", adminBmn: "", pembimbing: "",
    includeLog: "true",
  });
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = buildParams(formRef.current);
      setReport(await api<ReportData>(`/report/summary?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void api<HierarkiResponse>("/hierarki").then(setHierarchy).catch(() => undefined);
    // Muat sekali saat halaman dibuka; perubahan filter diterapkan lewat tombol.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const rooms = useMemo(() => {
    if (!hierarchy) return [];
    return hierarchy.buildings.flatMap((building) =>
      building.ruang.map((room) => ({ ...room, gedung: building.nama, gedungId: building.id })),
    ).filter((room) => !form.buildingId || room.gedungId === form.buildingId);
  }, [hierarchy, form.buildingId]);

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await apiDownload(`/report/export?${buildParams(form).toString()}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal export DOCX");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Laporan Resmi</h1>
          <p className="text-sm text-muted-foreground">
            Susun laporan sensus untuk lampiran PKL: ringkasan, rekap ruang, temuan, kontribusi, dan pengesahan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Terapkan filter
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!report}>
            <Printer /> Cetak / PDF
          </Button>
          <Button onClick={() => void handleExport()} disabled={exporting || !report}>
            <Download /> Export DOCX
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive" className="no-print"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card className="no-print">
        <CardHeader><CardTitle className="text-base">Konfigurasi laporan</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2"><Label>Dari</Label><Input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></div>
          <div className="space-y-2"><Label>Sampai</Label><Input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Gedung</Label>
            <Select value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value, roomId: "" })}>
              <option value="">Semua gedung</option>
              {hierarchy?.buildings.map((building) => <option key={building.id} value={building.id}>{building.nama}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ruang</Label>
            <Select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">Semua ruang</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.nama} ({room.kode})</option>)}
            </Select>
          </div>
          <div className="space-y-2"><Label>Nama sekolah</Label><Input value={form.sekolah} onChange={(e) => setForm({ ...form, sekolah: e.target.value })} placeholder="mis. MTsN 1 ..." /></div>
          <div className="space-y-2"><Label>Alamat</Label><Input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} /></div>
          <div className="space-y-2"><Label>Kota</Label><Input value={form.kota} onChange={(e) => setForm({ ...form, kota: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Sertakan log</Label>
            <Select value={form.includeLog} onChange={(e) => setForm({ ...form, includeLog: e.target.value })}>
              <option value="true">Ya</option><option value="false">Tidak</option>
            </Select>
          </div>
          <div className="space-y-2"><Label>Kepala Madrasah</Label><Input value={form.kepala} onChange={(e) => setForm({ ...form, kepala: e.target.value })} /></div>
          <div className="space-y-2"><Label>Admin BMN</Label><Input value={form.adminBmn} onChange={(e) => setForm({ ...form, adminBmn: e.target.value })} /></div>
          <div className="space-y-2"><Label>Dosen Pembimbing</Label><Input value={form.pembimbing} onChange={(e) => setForm({ ...form, pembimbing: e.target.value })} /></div>
        </CardContent>
      </Card>

      {loading && <p className="no-print text-sm text-muted-foreground">Memuat laporan…</p>}

      {report && (
        <div className="print-area rounded-xl border bg-white p-6 text-sm text-black shadow-sm">
          <div className="report-page border-b pb-8">
            <div className="mb-10 text-center">
              <div className="text-xs uppercase tracking-widest">Laporan Sensus Fisik</div>
              <h2 className="mt-2 text-2xl font-bold uppercase">Aset Barang Milik Negara (BMN)</h2>
              <div className="mt-2 text-lg font-semibold">{report.meta.sekolah || "Nama Satuan Kerja"}</div>
              <div className="text-xs">{report.meta.alamat || "Alamat satuan kerja"}</div>
              <div className="mt-6 text-sm">
                Periode: {formatDate(report.meta.periode.from)} s.d. {formatDate(report.meta.periode.to)}
              </div>
              <div className="text-sm">Kode Satker: {report.meta.satker ?? "—"}</div>
              <div className="mt-1 text-xs">
                Lingkup: {report.meta.scope.gedung.length > 0 ? report.meta.scope.gedung.join(", ") : "Seluruh gedung"}
              </div>
            </div>
            <div className="mx-auto max-w-lg border p-5 text-center">
              <div className="font-semibold uppercase">Lembar Pengesahan</div>
              <p className="mt-3 text-justify text-xs leading-relaxed">
                Laporan Sensus Fisik Aset Barang Milik Negara ini disusun berdasarkan pelaksanaan sensus fisik dan rekonsiliasi data SIMAN v2 pada satuan kerja tersebut di atas. Laporan ini menjadi bagian dari dokumentasi pelaksanaan Praktik Kerja Lapangan (PKL).
              </p>
              <p className="mt-3 text-xs">Disahkan pada tanggal {new Date(report.meta.generatedAt).toLocaleDateString("id-ID", { dateStyle: "long" })}.</p>
            </div>
          </div>

          <div className="report-page py-6">
            <h3 className="mb-3 border-b pb-1 text-base font-bold uppercase">Ringkasan Eksekutif</h3>
            <p className="mb-2 text-justify">
              Pelaksanaan sensus mencakup {report.summary.totalGroups.toLocaleString("id-ID")} grup pencatatan dengan {report.summary.totalNup.toLocaleString("id-ID")} NUP aset yang dialokasikan. Dari {report.summary.totalMaster.toLocaleString("id-ID")} aset aktif pada data SIMAN, cakupan sensus tercatat {report.summary.coverage}%.
            </p>
            <div className="my-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {([
                ["Total grup", report.summary.totalGroups], ["NUP disensus", report.summary.totalNup],
                ["Dokumen", report.summary.totalDocs], ["Temuan", report.summary.findings],
                ["Tervalidasi", report.summary.status.VALIDATED], ["Perlu verifikasi", report.summary.status.DOCS_COMPLETE],
                ["Rusak ringan", report.summary.conditions.RUSAK_RINGAN], ["Rusak berat", report.summary.conditions.RUSAK_BERAT],
              ] as const).map(([label, value]) => (
                <div key={label} className="border p-2"><div className="text-muted-foreground">{label}</div><div className="text-lg font-semibold">{value}</div></div>
              ))}
            </div>
            <h3 className="mb-3 mt-6 border-b pb-1 text-base font-bold uppercase">Ruang Lingkup dan Metodologi</h3>
            <p className="mb-2 text-justify">
              Sensus dilaksanakan pada ruang lingkup {report.meta.scope.gedung.length > 0 ? report.meta.scope.gedung.join(", ") : "seluruh gedung"} dengan membandingkan data SIMAN v2 terhadap kondisi fisik aset di lapangan. Setiap kelompok pencatatan memuat kode barang, kondisi, jumlah, ruang, dan NUP hasil alokasi. Bukti foto/dokumen diunggah per grup, kemudian diverifikasi oleh admin BMN sebelum dinyatakan valid.
            </p>
            <p className="mb-2 text-justify">
              Data yang disajikan merupakan data aktual pada tanggal cetak. Perubahan setelah tanggal tersebut tidak tercakup. Rekonsiliasi akhir tetap mengacu pada SIMAN v2 sebagai sistem resmi.
            </p>

            <h3 className="mb-3 mt-6 border-b pb-1 text-base font-bold uppercase">Hasil Sensus per Gedung</h3>
            <table className="w-full border-collapse text-xs">
              <thead><tr className="bg-muted">{["Gedung", "Ruang", "Grup", "NUP", "Baik", "Rusak Ringan", "Rusak Berat"].map((h) => <th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{report.perGedung.map((row) => (
                <tr key={row.id}><td className="border p-1">{row.nama}</td><td className="border p-1 text-center">{row.rooms}</td><td className="border p-1 text-center">{row.groups}</td><td className="border p-1 text-center">{row.nup}</td><td className="border p-1 text-center">{row.conditions.BAIK}</td><td className="border p-1 text-center">{row.conditions.RUSAK_RINGAN}</td><td className="border p-1 text-center">{row.conditions.RUSAK_BERAT}</td></tr>
              ))}</tbody>
            </table>

            <h3 className="mb-3 mt-6 border-b pb-1 text-base font-bold uppercase">Rekap per Ruang</h3>
            <table className="w-full border-collapse text-xs">
              <thead><tr className="bg-muted">{["Gedung / Ruang", "Grup", "NUP", "Dokumen", "Baik", "Rusak Ringan", "Rusak Berat", "Validasi"].map((h) => <th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{report.perRuang.map((row) => (
                <tr key={row.id}><td className="border p-1">{row.gedung} / {row.nama} ({row.kode})</td><td className="border p-1 text-center">{row.groups}</td><td className="border p-1 text-center">{row.nup}</td><td className="border p-1 text-center">{row.docs}</td><td className="border p-1 text-center">{row.conditions.BAIK}</td><td className="border p-1 text-center">{row.conditions.RUSAK_RINGAN}</td><td className="border p-1 text-center">{row.conditions.RUSAK_BERAT}</td><td className="border p-1 text-center">{row.status.VALIDATED}</td></tr>
              ))}</tbody>
            </table>
          </div>

          {report.findings.length > 0 && (
            <div className="report-page py-6">
              <h3 className="mb-3 border-b pb-1 text-base font-bold uppercase">Temuan dan Rekomendasi</h3>
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-muted">{["Gedung / Ruang", "Barang", "Kondisi", "Jumlah", "Status", "Catatan"].map((h) => <th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
                <tbody>{report.findings.map((row) => (
                  <tr key={`${row.grupId}-${row.kodeBarang}`}><td className="border p-1">{row.gedung} / {row.ruang}</td><td className="border p-1">{row.namaBarang}</td><td className="border p-1">{KONDISI_LABEL[row.kondisi]}</td><td className="border p-1 text-center">{row.jumlah}</td><td className="border p-1">{STATUS_LABEL[row.status]}</td><td className="border p-1">{row.catatan ?? "—"}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div className="report-page py-6">
            <h3 className="mb-3 border-b pb-1 text-base font-bold uppercase">Kontribusi Mahasiswa PKL</h3>
            <table className="w-full border-collapse text-xs">
              <thead><tr className="bg-muted">{["Nama", "NIM", "Grup", "NUP", "Dokumen", "Koreksi", "Tervalidasi"].map((h) => <th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{report.contributors.map((row) => (
                <tr key={row.id}><td className="border p-1">{row.nama}</td><td className="border p-1">{row.nim ?? "—"}</td><td className="border p-1 text-center">{row.groups}</td><td className="border p-1 text-center">{row.nup}</td><td className="border p-1 text-center">{row.docs}</td><td className="border p-1 text-center">{row.corrections}</td><td className="border p-1 text-center">{row.validated}</td></tr>
              ))}</tbody>
            </table>
          </div>

          {report.logs.length > 0 && (
            <div className="report-page py-6">
              <h3 className="mb-3 border-b pb-1 text-base font-bold uppercase">Lampiran: Log Aktivitas Terbaru</h3>
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-muted">{["Waktu", "Aktor", "Aksi", "Ringkasan"].map((h) => <th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
                <tbody>{report.logs.slice(0, 40).map((log) => (
                  <tr key={log.id}><td className="border p-1 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("id-ID")}</td><td className="border p-1">{log.actorNama}</td><td className="border p-1">{log.action}</td><td className="border p-1">{log.summary}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div className="report-page py-6">
            <h3 className="mb-3 border-b pb-1 text-base font-bold uppercase">Kesimpulan</h3>
            <p className="mb-2 text-justify">Sensus fisik telah dilaksanakan dan seluruh perubahan data tercatat dalam log aktivitas aplikasi. Data yang telah divalidasi dapat digunakan sebagai bahan rekonsiliasi dengan SIMAN v2, sedangkan temuan yang belum selesai perlu ditindaklanjuti oleh pengelola BMN.</p>
            <p className="text-justify">Laporan ini dihasilkan otomatis oleh aplikasi Sensus BMN pada {new Date(report.meta.generatedAt).toLocaleString("id-ID")}. Perubahan data setelah tanggal cetak tidak tercakup dalam laporan ini.</p>
            <div className="mt-10 grid grid-cols-2 gap-10 text-center text-xs">
              <div><div>Mengetahui,<br />Kepala Madrasah</div><div className="h-20" /><div className="border-t">{report.meta.signatures.kepala || ".............................."}</div></div>
              <div><div>{report.meta.kota || "...................."}, {new Date(report.meta.generatedAt).toLocaleDateString("id-ID")}<br />Admin BMN</div><div className="h-20" /><div className="border-t">{report.meta.signatures.adminBmn || ".............................."}</div></div>
              <div /><div><div>Dosen Pembimbing PKL</div><div className="h-20" /><div className="border-t">{report.meta.signatures.pembimbing || ".............................."}</div></div>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"><FileText className="size-3" /> Dokumen ini dihasilkan dari data aktual aplikasi.</div>
          </div>
        </div>
      )}
    </div>
  );
}
