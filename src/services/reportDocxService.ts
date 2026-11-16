import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { ReportData } from "./reportService.js";

const FONT = "Times New Roman";
const SIZE = 24;

function text(value: string | null | undefined, bold = false, size = SIZE): TextRun {
  return new TextRun({ text: value ?? "-", bold, font: FONT, size });
}

function p(value: string, opts: { bold?: boolean; center?: boolean; size?: number; spacing?: number } = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts.spacing ?? 120 },
    children: [text(value, opts.bold, opts.size)],
  });
}

function heading(value: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: value, bold: true, font: FONT, size: 28 })],
  });
}

function cell(value: string, bold = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: value, bold, font: FONT, size: 20 })],
      }),
    ],
  });
}

function table(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header) => cell(header, true, AlignmentType.CENTER)),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value, index) =>
              cell(value, false, index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER),
            ),
          }),
      ),
    ],
  });
}

function signatureBlock(data: ReportData) {
  const { meta } = data;
  const row = (left: string, right: string) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [p(left, { center: true }), p("", { spacing: 600 }), p("..............................", { center: true })],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [p(right, { center: true }), p("", { spacing: 600 }), p("..............................", { center: true })],
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row("Mengetahui,\nKepala Madrasah", "Admin BMN"),
      new TableRow({
        children: [
          cell("", false),
          new TableCell({
            children: [
              p(`${meta.kota || "...................."}, ${new Date(meta.generatedAt).toLocaleDateString("id-ID")}`, { center: true }),
              p("Dosen Pembimbing PKL", { center: true }),
              p("", { spacing: 600 }),
              p("..............................", { center: true }),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function buildReportDocx(data: ReportData): Promise<Buffer> {
  const { meta, summary, perGedung, perRuang, findings, contributors, logs } = data;
  const period = `${meta.periode.from ? new Date(meta.periode.from).toLocaleDateString("id-ID") : "awal"} s.d. ${
    meta.periode.to ? new Date(meta.periode.to).toLocaleDateString("id-ID") : "sekarang"
  }`;
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1800, after: 240 },
      children: [new TextRun({ text: "LAPORAN SENSUS FISIK", bold: true, font: FONT, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "ASET BARANG MILIK NEGARA (BMN)", bold: true, font: FONT, size: 32 })],
    }),
    p(meta.sekolah || "Nama Satuan Kerja", { center: true, size: 28 }),
    p(meta.alamat || "Alamat satuan kerja", { center: true, size: 22 }),
    p("", { spacing: 1200 }),
    p(`Periode: ${period}`, { center: true }),
    p(`Kode Satker: ${meta.satker || "-"}`, { center: true }),
    p(`Lingkup: ${meta.scope.gedung.length > 0 ? meta.scope.gedung.join(", ") : "Seluruh gedung"}`, { center: true }),
    new Paragraph({ children: [new PageBreak()] }),
    heading("LEMBAR PENGESAHAN", HeadingLevel.HEADING_1),
    p("Laporan Sensus Fisik Aset Barang Milik Negara (BMN) ini disusun sebagai hasil pelaksanaan sensus fisik dan rekonsiliasi data SIMAN pada satuan kerja tersebut di atas.", { spacing: 240 }),
    p(`Disahkan pada tanggal ${new Date(meta.generatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`),
    p("", { spacing: 480 }),
    signatureBlock(data),
    new Paragraph({ children: [new PageBreak()] }),
    heading("RINGKASAN EKSEKUTIF"),
    p(`Pelaksanaan sensus mencakup ${summary.totalGroups.toLocaleString("id-ID")} grup pencatatan dengan ${summary.totalNup.toLocaleString("id-ID")} NUP aset yang dialokasikan. Dari ${summary.totalMaster.toLocaleString("id-ID")} aset aktif pada data SIMAN, cakupan sensus tercatat ${summary.coverage}%.`),
    p(`Rincian kondisi: BAIK ${summary.conditions.BAIK.toLocaleString("id-ID")} unit, RUSAK RINGAN ${summary.conditions.RUSAK_RINGAN.toLocaleString("id-ID")} unit, dan RUSAK BERAT ${summary.conditions.RUSAK_BERAT.toLocaleString("id-ID")} unit.`),
    p(`Status validasi: ${summary.status.VALIDATED} grup tervalidasi, ${summary.status.DOCS_COMPLETE} grup menunggu verifikasi, ${summary.status.ASSESSED} grup dalam penilaian, dan ${summary.status.TIDAK_DITEMUKAN} grup tidak ditemukan.`),
    p(`Temuan yang perlu ditindaklanjuti: ${summary.findings} grup. Total dokumen pendukung: ${summary.totalDocs.toLocaleString("id-ID")} file.`),
    heading("HASIL SENSUS PER GEDUNG", HeadingLevel.HEADING_2),
    table(
      ["Gedung", "Ruang", "Grup", "NUP", "Baik", "Rusak Ringan", "Rusak Berat"],
      perGedung.map((row) => [
        row.nama,
        String(row.rooms),
        String(row.groups),
        String(row.nup),
        String(row.conditions.BAIK),
        String(row.conditions.RUSAK_RINGAN),
        String(row.conditions.RUSAK_BERAT),
      ]),
    ),
    heading("REKAP PER RUANG", HeadingLevel.HEADING_2),
    table(
      ["Gedung / Ruang", "Grup", "NUP", "Baik", "Rusak Ringan", "Rusak Berat", "Validasi"],
      perRuang.map((row) => [
        `${row.gedung} / ${row.nama} (${row.kode})`,
        String(row.groups),
        String(row.nup),
        String(row.conditions.BAIK),
        String(row.conditions.RUSAK_RINGAN),
        String(row.conditions.RUSAK_BERAT),
        String(row.status.VALIDATED),
      ]),
    ),
  );

  if (findings.length > 0) {
    children.push(
      heading("TEMUAN DAN REKOMENDASI", HeadingLevel.HEADING_2),
      p("Grup berikut memerlukan perhatian karena kondisi tidak baik, status tidak ditemukan, atau memiliki catatan."),
      table(
        ["Gedung / Ruang", "Barang", "Kondisi", "Jumlah", "Status", "Catatan"],
        findings.slice(0, 200).map((row) => [
          `${row.gedung} / ${row.ruang}`,
          row.namaBarang,
          row.kondisi,
          String(row.jumlah),
          row.status,
          row.catatan ?? "-",
        ]),
      ),
    );
  }

  children.push(
    heading("KONTRIBUSI MAHASISWA PKL", HeadingLevel.HEADING_2),
    table(
      ["Nama", "NIM", "Grup", "NUP", "Dokumen", "Koreksi", "Tervalidasi"],
      contributors.map((row) => [
        row.nama,
        row.nim ?? "-",
        String(row.groups),
        String(row.nup),
        String(row.docs),
        String(row.corrections),
        String(row.validated),
      ]),
    ),
  );

  if (logs.length > 0) {
    children.push(
      heading("LAMPIRAN: LOG AKTIVITAS TERBARU", HeadingLevel.HEADING_2),
      table(
        ["Waktu", "Aktor", "Aksi", "Ringkasan"],
        logs.slice(0, 60).map((row) => [
          new Date(row.createdAt).toLocaleString("id-ID"),
          row.actorNama,
          row.action,
          row.summary,
        ]),
      ),
    );
  }

  children.push(
    heading("KESIMPULAN", HeadingLevel.HEADING_2),
    p("Sensus fisik telah dilaksanakan dan seluruh perubahan data tercatat dalam log aktivitas aplikasi. Data yang telah divalidasi dapat digunakan sebagai bahan rekonsiliasi dengan SIMAN v2, sedangkan temuan yang belum selesai perlu ditindaklanjuti oleh pengelola BMN."),
    p("Laporan ini dihasilkan otomatis oleh aplikasi Sensus BMN. Perubahan data setelah tanggal cetak tidak tercakup dalam laporan ini."),
  );

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Halaman ", font: FONT, size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
                  new TextRun({ text: " dari ", font: FONT, size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
