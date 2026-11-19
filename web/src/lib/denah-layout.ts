/**
 * Geometri denah sekolah (murni SVG, tanpa gambar raster).
 *
 * Sumber: `data/DENAH.pdf` (sketsa tangan) yang ditelusuri lalu digambar ulang
 * sebagai denah skematik vektor. Semua koordinat memakai sistem 1900×1080.
 *
 * Verifikasi cepat: buka `/denah?debug=1` untuk melihat kode setiap kotak.
 */

export const DENAH_WIDTH = 1900;
export const DENAH_HEIGHT = 1080;

/** Batas kavling sekolah (mengikuti bentuk blok bangunan, bukan persegi penuh). */
export const DENAH_SITE_PATH = "M40 206 H1880 V955 H1330 V1070 H770 V945 H40 Z";

export interface DenahHotspot {
  /** Kode ruang pada tabel `Ruang` (unik). */
  kode: string;
  /** Label yang digambar pada denah. */
  label: string;
  /** Persegi: [x, y, lebar, tinggi]. */
  rect: [number, number, number, number];
}

export type DenahAreaKind = "court" | "parking" | "garden";

export interface DenahArea {
  label: string;
  rect: [number, number, number, number];
  kind: DenahAreaKind;
}

/** Area non-ruang (lapangan, parkir, taman) untuk konteks visual. */
export const DENAH_AREAS: DenahArea[] = [
  { label: "Lapangan / Taman", rect: [760, 420, 770, 345], kind: "court" },
  { label: "Parkir", rect: [1630, 235, 215, 175], kind: "parking" },
  { label: "Taman", rect: [1720, 505, 110, 250], kind: "garden" },
];

export const DENAH_HOTSPOTS: DenahHotspot[] = [
  // ---- Gedung Pendidikan 1 (DIK.01) — 9A..9G, UKS, toilet ----
  { kode: "DIK.01.01.01", label: "9A", rect: [1050, 820, 155, 108] },
  { kode: "DIK.01.01.02", label: "9B", rect: [905, 820, 145, 108] },
  { kode: "DIK.01.01.03", label: "9C", rect: [770, 820, 135, 108] },
  { kode: "DIK.01.01.04", label: "UKS 1", rect: [1265, 820, 65, 108] },
  { kode: "DIK.01.01.05", label: "UKS 2", rect: [1205, 820, 60, 108] },
  // Penyimpanan Adiwiyata berada di depan (sisi lapangan) ruang 9A dan 9B.
  { kode: "DIK.01.01.06", label: "PENYIMPANAN ADIWIYATA", rect: [905, 770, 300, 46] },
  { kode: "DIK.01.01.07", label: "WC 1", rect: [1050, 1010, 70, 35] },
  { kode: "DIK.01.01.08", label: "WC 2", rect: [1120, 1010, 70, 35] },
  { kode: "DIK.01.01.09", label: "WC 3", rect: [1190, 1010, 68, 35] },
  { kode: "DIK.01.01.10", label: "WC 4", rect: [1258, 1010, 72, 35] },
  { kode: "DIK.01.02.01", label: "9D", rect: [770, 925, 135, 90] },
  { kode: "DIK.01.02.02", label: "9E", rect: [905, 925, 145, 90] },
  { kode: "DIK.01.02.03", label: "9F", rect: [1050, 925, 155, 90] },
  { kode: "DIK.01.02.04", label: "9G", rect: [1205, 925, 125, 90] },

  // ---- Gedung Pendidikan 2 (DIK.02) — 7A..7G, BK, 8A ----
  { kode: "DIK.02.01.01", label: "7A", rect: [1340, 330, 180, 80] },
  { kode: "DIK.02.01.02", label: "7B", rect: [1218, 330, 122, 80] },
  { kode: "DIK.02.01.03", label: "7C", rect: [1125, 330, 93, 80] },
  { kode: "DIK.02.01.04", label: "7D", rect: [823, 235, 140, 145] },
  // Toilet BK adalah sekat kecil di bagian atas ruang BK.
  { kode: "DIK.02.01.06", label: "BK", rect: [963, 278, 72, 102] },
  { kode: "DIK.02.01.07", label: "TOILET BK", rect: [963, 235, 72, 40] },
  // Kolom di kiri 7E: penyimpanan atas di atas, WC publik di bawahnya.
  { kode: "DIK.02.02.04", label: "PENYIMPANAN ATAS", rect: [1035, 235, 90, 58] },
  { kode: "DIK.02.01.05", label: "WC PUBLIK", rect: [1035, 295, 90, 85] },
  { kode: "DIK.02.01.08", label: "8A", rect: [690, 235, 133, 145] },
  { kode: "DIK.02.02.01", label: "7E", rect: [1125, 235, 93, 95] },
  { kode: "DIK.02.02.02", label: "7F", rect: [1218, 235, 122, 95] },
  { kode: "DIK.02.02.03", label: "7G", rect: [1340, 235, 180, 95] },

  // ---- Gedung Pendidikan 3 (DIK.03) — pramuka, 8B, 8C ----
  { kode: "DIK.03.01.02", label: "8B", rect: [508, 530, 142, 105] },
  { kode: "DIK.03.01.03", label: "8C", rect: [190, 445, 188, 163] },
  // Di kanan 8E: ruang pramuka, di bawahnya toilet publik.
  { kode: "DIK.03.01.01", label: "PRAMUKA", rect: [355, 805, 105, 110] },
  { kode: "DIK.03.01.04", label: "WC", rect: [355, 917, 51, 28] },
  { kode: "DIK.03.01.05", label: "WC", rect: [406, 917, 54, 28] },

  // ---- Gedung Tempat Kerja Lainnya (KET) — 8D, 8E, futsal, paskibra ----
  { kode: "KET.01.01.01", label: "8E", rect: [205, 805, 150, 140] },
  { kode: "KET.01.01.02", label: "8D", rect: [190, 608, 188, 162] },
  { kode: "KET.01.01.03", label: "PASKIBRA", rect: [310, 408, 68, 37] },
  { kode: "KET.01.01.04", label: "FUTSAL", rect: [190, 408, 120, 37] },

  // ---- Gedung Laboratorium (LAB) ----
  { kode: "LAB.01.01.01", label: "LAB. IPA", rect: [190, 232, 210, 143] },
  // Ruang penyimpanan IPA tersekat dua: penyimpanan + penyimpanan bahan.
  { kode: "LAB.01.01.02", label: "PENYIMPANAN", rect: [400, 232, 97, 44] },
  { kode: "LAB.01.01.03", label: "PENYIMPANAN BAHAN", rect: [400, 276, 97, 44] },
  { kode: "LAB.01.01.04", label: "ROBOTIK", rect: [400, 320, 97, 55] },
  { kode: "LAB.02.01.01", label: "LAB. KOM", rect: [508, 415, 142, 115] },
  { kode: "LAB.02.01.02", label: "8F", rect: [65, 805, 140, 140] },

  // ---- Gedung Perpustakaan (PUS) ----
  { kode: "PUS.01.01.01", label: "KEPALA PERPUS", rect: [508, 635, 142, 45] },
  { kode: "PUS.01.01.02", label: "PERPUSTAKAAN", rect: [508, 680, 142, 115] },
  // Toilet perpustakaan berada di sisi kiri arsip.
  { kode: "PUS.01.01.04", label: "TOILET PERPUS", rect: [446, 795, 58, 105] },
  { kode: "PUS.01.01.03", label: "ARSIP", rect: [508, 795, 62, 105] },
  { kode: "PUS.01.01.05", label: "OSIS", rect: [570, 795, 80, 105] },

  // ---- Gedung Pos Jaga (GJP) ----
  { kode: "GJP.01.01.01", label: "POS JAGA", rect: [537, 245, 113, 120] },

  // ---- Gedung Pendidikan 4 (DIK.04) — TU, kepala, guru ----
  { kode: "DIK.04.01.01", label: "R. TU", rect: [1550, 505, 160, 185] },
  // Toilet kepala adalah sekat di dalam ruang kepala.
  { kode: "DIK.04.01.02", label: "R. KEPALA", rect: [1550, 690, 110, 80] },
  { kode: "DIK.04.01.03", label: "TOILET KEPALA", rect: [1662, 690, 48, 80] },
  // Toilet guru di dalam ruang guru; dua WC publik lainnya di luar (sisi kiri).
  { kode: "DIK.04.01.04", label: "R. GURU", rect: [1410, 795, 285, 130] },
  { kode: "DIK.04.01.05", label: "TOILET", rect: [1414, 798, 54, 46] },
  { kode: "DIK.04.01.06", label: "WC", rect: [1360, 800, 48, 58] },
  { kode: "DIK.04.01.07", label: "WC", rect: [1360, 860, 48, 57] },

  // ---- Gedung Tempat Ibadah (IBD) ----
  // Masjid dua lantai: lantai 2 (wanita) di atas, lantai 1 (pria) di bawah.
  { kode: "IBD.02.02.01", label: "AULA WANITA", rect: [1720, 790, 135, 82] },
  { kode: "IBD.02.01.01", label: "AULA PRIA", rect: [1720, 872, 135, 83] },
];

/** Kode ruang yang punya hotspot (untuk menandai sisanya sebagai belum dipetakan). */
export const DENAH_KODE_SET = new Set(DENAH_HOTSPOTS.map((hotspot) => hotspot.kode));
