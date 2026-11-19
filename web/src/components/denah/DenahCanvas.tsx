import { Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DENAH_AREAS,
  DENAH_HEIGHT,
  DENAH_HOTSPOTS,
  DENAH_SITE_PATH,
  DENAH_WIDTH,
  type DenahAreaKind,
} from "@/lib/denah-layout";
import { roomTone, TONE_STYLE } from "@/lib/denah-tone";
import type { RuangHierarki } from "@/lib/types";

const AREA_STYLE: Record<DenahAreaKind, { fill: string; stroke: string }> = {
  court: { fill: "#ecfdf5", stroke: "#86efac" },
  parking: { fill: "#f1f5f9", stroke: "#cbd5e1" },
  garden: { fill: "#f0fdf4", stroke: "#bbf7d0" },
};

function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Cari ukuran font terbesar yang masih muat di dalam kotak. */
function fitLabel(label: string, width: number, height: number) {
  const maxWidth = width - 8;
  const maxHeight = height - 6;
  for (let size = 17; size >= 7; size -= 1) {
    const maxChars = Math.max(3, Math.floor(maxWidth / (size * 0.62)));
    const lines = wrapLabel(label, maxChars);
    const lineHeight = size * 1.15;
    if (lines.every((line) => line.length <= maxChars) && lines.length * lineHeight <= maxHeight) {
      return { size, lines, lineHeight };
    }
  }
  return null;
}

interface DenahCanvasProps {
  roomsByKode: Map<string, RuangHierarki>;
  /** Kode yang sedang disorot dari daftar/pencarian. */
  highlightKode?: string | null;
  /** Redupkan ruangan selain `highlightKode`. */
  dimOthers?: boolean;
  onSelectRoom: (room: RuangHierarki) => void;
  /** Tampilkan kode di atas setiap kotak (untuk verifikasi pemetaan). */
  debug?: boolean;
}

export function DenahCanvas({
  roomsByKode,
  highlightKode,
  dimOthers = false,
  onSelectRoom,
  debug = false,
}: DenahCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [activeKode, setActiveKode] = useState<string | null>(null);

  const activeRoom = activeKode ? roomsByKode.get(activeKode) : undefined;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border bg-white">
        <div className="max-h-[68vh] overflow-auto">
          <div style={{ width: `${zoom * 100}%` }} className="min-w-full">
            <svg
              viewBox={`0 0 ${DENAH_WIDTH} ${DENAH_HEIGHT}`}
              className="block h-auto w-full select-none"
              role="group"
              aria-label="Denah sekolah interaktif"
            >
              <defs>
                <filter id="denah-shadow" x="-2%" y="-2%" width="104%" height="108%">
                  <feDropShadow
                    dx="0"
                    dy="3"
                    stdDeviation="6"
                    floodColor="#0f172a"
                    floodOpacity="0.12"
                  />
                </filter>
                <pattern id="denah-grid" width="46" height="46" patternUnits="userSpaceOnUse">
                  <path d="M46 0H0V46" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Kavling sekolah */}
              <path
                d={DENAH_SITE_PATH}
                fill="#ffffff"
                stroke="#94a3b8"
                strokeWidth={2}
                filter="url(#denah-shadow)"
              />
              <path d={DENAH_SITE_PATH} fill="url(#denah-grid)" />

              {/* Area non-ruang */}
              {DENAH_AREAS.map((area) => {
                const [x, y, w, h] = area.rect;
                const areaStyle = AREA_STYLE[area.kind];
                return (
                  <g key={area.label} pointerEvents="none">
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={6}
                      fill={areaStyle.fill}
                      stroke={areaStyle.stroke}
                      strokeWidth={1.5}
                      strokeDasharray="7 5"
                    />
                    <text
                      x={x + w / 2}
                      y={y + h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(26, Math.max(15, w / 14))}
                      letterSpacing="0.08em"
                      fill="#64748b"
                      stroke="#ffffff"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {area.label.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* Ruangan */}
              {DENAH_HOTSPOTS.map((hotspot) => {
                const room = roomsByKode.get(hotspot.kode);
                const tone = roomTone(room);
                const style = TONE_STYLE[tone];
                const [x, y, w, h] = hotspot.rect;
                const active = activeKode === hotspot.kode || highlightKode === hotspot.kode;
                const dimmed =
                  dimOthers && highlightKode != null && highlightKode !== hotspot.kode;
                const disabled = !room;
                const fitted = fitLabel(hotspot.label, w, h);
                const lineCount = fitted?.lines.length ?? 1;

                return (
                  <g
                    key={hotspot.kode}
                    tabIndex={disabled ? -1 : 0}
                    role={disabled ? undefined : "button"}
                    aria-label={
                      room
                        ? `${room.nama} (${room.kode}) — ${TONE_STYLE[tone].label}, ${room.jumlahNup} NUP, ${room.jumlahGrup} grup input`
                        : `Ruangan ${hotspot.kode} tidak ditemukan`
                    }
                    aria-disabled={disabled || undefined}
                    className={cn(
                      "outline-none transition-opacity",
                      disabled ? "cursor-not-allowed" : "cursor-pointer",
                    )}
                    onClick={() => {
                      if (room) onSelectRoom(room);
                    }}
                    onKeyDown={(event) => {
                      if (!room) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectRoom(room);
                      }
                    }}
                    onMouseEnter={() => setActiveKode(hotspot.kode)}
                    onMouseLeave={() => setActiveKode(null)}
                    onFocus={() => setActiveKode(hotspot.kode)}
                    onBlur={() => setActiveKode(null)}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={5}
                      fill={disabled ? "#fecaca" : active ? style.hover : style.fill}
                      stroke={disabled ? "#dc2626" : style.stroke}
                      strokeWidth={active ? 3 : 1.5}
                      strokeDasharray={disabled ? "6 4" : undefined}
                      opacity={dimmed ? 0.35 : 1}
                      className="transition-colors focus-visible:stroke-[4px]"
                    />

                    {debug ? (
                      <text
                        x={x + w / 2}
                        y={y + h / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={8}
                        fontWeight={700}
                        fill="#b91c1c"
                        textLength={Math.min(w - 6, hotspot.kode.length * 4.6)}
                        lengthAdjust="spacingAndGlyphs"
                        pointerEvents="none"
                      >
                        {hotspot.kode}
                      </text>
                    ) : (
                      fitted && (
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={fitted.size}
                          fontWeight={600}
                          fill={disabled ? "#991b1b" : "#0f172a"}
                          pointerEvents="none"
                        >
                          {fitted.lines.map((line, index) => {
                            const naturalWidth = line.length * fitted.size * 0.62;
                            const maxWidth = w - 8;
                            return (
                              <tspan
                                key={`${line}-${index}`}
                                x={x + w / 2}
                                y={y + h / 2 + (index - (lineCount - 1) / 2) * fitted.lineHeight}
                                textLength={Math.min(naturalWidth, maxWidth)}
                                lengthAdjust="spacingAndGlyphs"
                              >
                                {line}
                              </tspan>
                            );
                          })}
                        </text>
                      )
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="absolute right-2 top-2 flex flex-col gap-1 rounded-lg border bg-background/95 p-1 shadow-sm">
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label="Perbesar denah"
            disabled={zoom >= 3}
            onClick={() => setZoom((current) => Math.min(3, Number((current + 0.5).toFixed(1))))}
          >
            <Plus />
          </Button>
          <span className="text-center text-[10px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label="Perkecil denah"
            disabled={zoom <= 1}
            onClick={() => setZoom((current) => Math.max(1, Number((current - 0.5).toFixed(1))))}
          >
            <Minus />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label="Reset zoom"
            disabled={zoom === 1}
            onClick={() => setZoom(1)}
          >
            <RotateCcw />
          </Button>
        </div>

        {activeRoom && (
          <div className="pointer-events-none absolute left-2 top-2 max-w-[min(18rem,70%)] rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
            <div className="font-medium">{activeRoom.nama}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{activeRoom.kode}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
              <span>{activeRoom.jumlahNup} NUP</span>
              <span>{activeRoom.jumlahGrup} grup</span>
              {activeRoom.jumlahValidated > 0 && (
                <span className="text-emerald-700">{activeRoom.jumlahValidated} tervalidasi</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Klik ruangan untuk membuka input sensusnya. Gunakan tombol +/− bila kotak terlalu kecil.
      </p>
    </div>
  );
}
