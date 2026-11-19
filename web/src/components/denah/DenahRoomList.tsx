import { MapPinOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DENAH_KODE_SET } from "@/lib/denah-layout";
import { roomTone, TONE_STYLE } from "@/lib/denah-tone";
import type { BangunanHierarki, RuangHierarki } from "@/lib/types";

interface DenahRoomListProps {
  buildings: BangunanHierarki[];
  query: string;
  onSelectRoom: (room: RuangHierarki) => void;
  onHoverRoom: (kode: string | null) => void;
  highlightKode?: string | null;
}

export function DenahRoomList({
  buildings,
  query,
  onSelectRoom,
  onHoverRoom,
  highlightKode,
}: DenahRoomListProps) {
  const needle = query.trim().toLowerCase();
  const matches = (room: RuangHierarki) =>
    !needle ||
    `${room.nama} ${room.kode} ${room.tipeRuang ?? ""}`.toLowerCase().includes(needle);

  const sections = buildings
    .map((building) => ({
      building,
      rooms: building.ruang.filter(matches),
    }))
    .filter((section) => section.rooms.length > 0);

  if (sections.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Tidak ada ruang yang cocok.
      </p>
    );
  }

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map(({ building, rooms }) => (
        <div key={building.id} className="space-y-1 rounded-lg border p-2">
          <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {building.nama}
              {building.kodeSiman ? ` · NUP ${building.kodeSiman}` : ""}
            </h3>
            <span className="shrink-0 text-[11px] text-muted-foreground">{rooms.length}</span>
          </div>
          <ul className="space-y-1">
            {rooms.map((room) => {
              const tone = roomTone(room);
              const mapped = DENAH_KODE_SET.has(room.kode);
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room)}
                    onMouseEnter={() => onHoverRoom(room.kode)}
                    onMouseLeave={() => onHoverRoom(null)}
                    onFocus={() => onHoverRoom(room.kode)}
                    onBlur={() => onHoverRoom(null)}
                    aria-current={highlightKode === room.kode ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${
                      highlightKode === room.kode ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: TONE_STYLE[tone].fill }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{room.nama}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {room.kode} · Lantai {room.lantai}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className="whitespace-nowrap">
                        {room.jumlahNup} NUP
                      </Badge>
                      {!mapped && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-700">
                          <MapPinOff className="size-3" /> belum di denah
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
