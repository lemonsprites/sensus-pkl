import type { RuangHierarki } from "@/lib/types";

export type DenahTone = "validated" | "allocated" | "drafted" | "empty";

export const TONE_STYLE: Record<
  DenahTone,
  { fill: string; hover: string; stroke: string; label: string }
> = {
  validated: { fill: "#a7f3d0", hover: "#6ee7b7", stroke: "#059669", label: "Tervalidasi" },
  allocated: { fill: "#bae6fd", hover: "#7dd3fc", stroke: "#0284c7", label: "Ada NUP" },
  drafted: { fill: "#fde68a", hover: "#fcd34d", stroke: "#d97706", label: "Ada input" },
  empty: { fill: "#e2e8f0", hover: "#cbd5e1", stroke: "#94a3b8", label: "Belum ada input" },
};

/** Warna ruangan mengikuti progres sensus: validated > ada NUP > ada grup > kosong. */
export function roomTone(room?: RuangHierarki): DenahTone {
  if (!room) return "empty";
  if (room.jumlahValidated > 0) return "validated";
  if (room.jumlahNup > 0) return "allocated";
  if (room.jumlahGrup > 0) return "drafted";
  return "empty";
}
