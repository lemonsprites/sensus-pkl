import { Bug, Eye, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { DenahCanvas } from "@/components/denah/DenahCanvas";
import { DenahLegend } from "@/components/denah/DenahLegend";
import { DenahRoomList } from "@/components/denah/DenahRoomList";
import { Loader } from "@/components/Loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { DENAH_HOTSPOTS } from "@/lib/denah-layout";
import { roomTone, type DenahTone } from "@/lib/denah-tone";
import type { HierarkiResponse, RuangHierarki } from "@/lib/types";

export default function DenahPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const debug = params.get("debug") === "1";

  const [data, setData] = useState<HierarkiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hoverKode, setHoverKode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<HierarkiResponse>("/hierarki"));
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Gagal memuat denah");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const roomsByKode = useMemo(() => {
    const map = new Map<string, RuangHierarki>();
    for (const building of data?.buildings ?? []) {
      for (const room of building.ruang) map.set(room.kode, room);
    }
    return map;
  }, [data]);

  const counts = useMemo(() => {
    const result: Record<DenahTone, number> = {
      validated: 0,
      allocated: 0,
      drafted: 0,
      empty: 0,
    };
    for (const hotspot of DENAH_HOTSPOTS) {
      result[roomTone(roomsByKode.get(hotspot.kode))] += 1;
    }
    return result;
  }, [roomsByKode]);

  // Kode yang cocok dengan pencarian → disorot di denah.
  const matchedKode = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    const hit = DENAH_HOTSPOTS.find((hotspot) => {
      const room = roomsByKode.get(hotspot.kode);
      if (!room) return false;
      return `${room.nama} ${room.kode} ${hotspot.label}`.toLowerCase().includes(needle);
    });
    return hit?.kode ?? null;
  }, [query, roomsByKode]);

  const highlightKode = hoverKode ?? matchedKode;

  const toggleDebug = () => {
    const next = new URLSearchParams(params);
    if (debug) next.delete("debug");
    else next.set("debug", "1");
    setParams(next, { replace: true });
  };

  const openRoom = (room: RuangHierarki) => navigate(`/sensus/${room.id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Denah Sekolah</h1>
          <p className="text-sm text-muted-foreground">
            Klik ruangan pada denah untuk membuka input sensusnya. Warna menunjukkan progres
            sensus ruangan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleDebug} aria-pressed={debug}>
          {debug ? <Eye /> : <Bug />}
          {debug ? "Sembunyikan kode" : "Tampilkan kode"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Loader label="Memuat denah…" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama / kode ruang…"
                className="pl-9"
              />
            </div>
            <DenahLegend counts={counts} />
          </div>

          <DenahCanvas
            roomsByKode={roomsByKode}
            highlightKode={highlightKode}
            dimOthers={Boolean(query.trim())}
            onSelectRoom={openRoom}
            debug={debug}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daftar ruang</CardTitle>
            </CardHeader>
            <CardContent>
              <DenahRoomList
                buildings={data?.buildings ?? []}
                query={query}
                onSelectRoom={openRoom}
                onHoverRoom={setHoverKode}
                highlightKode={highlightKode}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
