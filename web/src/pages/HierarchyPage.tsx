import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, Landmark, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import { api } from "@/lib/api";
import type { HierarkiResponse, RuangHierarki, Sensus, SensusStatus } from "@/lib/types";

const STATUS_LABEL: Record<SensusStatus, string> = {
  DRAFT: "Draft",
  ASSESSED: "Diperiksa",
  DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi",
  TIDAK_DITEMUKAN: "Tidak ditemukan",
};

function statusVariant(status: SensusStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "VALIDATED") return "default";
  if (status === "TIDAK_DITEMUKAN") return "destructive";
  if (status === "DRAFT") return "outline";
  return "secondary";
}

function SensusBadge({ sensus }: { sensus: Sensus | null }) {
  if (!sensus) return <Badge variant="outline">Belum disensus</Badge>;
  return <Badge variant={statusVariant(sensus.status)}>{STATUS_LABEL[sensus.status]}</Badge>;
}

function groupByFloor(rooms: RuangHierarki[]): Array<[number, RuangHierarki[]]> {
  const map = new Map<number, RuangHierarki[]>();
  for (const room of rooms) {
    map.set(room.lantai, [...(map.get(room.lantai) ?? []), room]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export default function HierarchyPage() {
  const [data, setData] = useState<HierarkiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<HierarkiResponse>("/hierarki"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat hierarki");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const buildings = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.buildings ?? [])
      .map((building) => ({
        ...building,
        ruang: building.ruang.filter((room) => {
          if (!term) return true;
          return [room.kode, room.nama, room.tipeRuang ?? ""].some((value) =>
            value.toLowerCase().includes(term),
          );
        }),
      }))
      .filter(
        (building) =>
          !term ||
          building.ruang.length > 0 ||
          building.nama.toLowerCase().includes(term),
      );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hierarki Ruang</h1>
          <p className="text-sm text-muted-foreground">
            Pilih ruangan untuk mulai sensus fisik. Ruang <strong>TANPA RUANGAN</strong> menampung
            aset yang belum punya lokasi di SIMAN.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="cari-ruang">Cari ruang</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cari-ruang"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="kode / nama ruang…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Bangunan", data.total.bangunan],
            ["Ruang", data.total.ruang],
            ["NUP disensus", data.total.nupDisensus],
            ["Tanah", data.total.tanah],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-2xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <Loader label="Memuat hierarki…" />
      ) : buildings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada bangunan/ruang yang cocok.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {buildings.map((building) => {
            return (
              <Card key={building.id}>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{building.nama}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        Kode {building.kodeBarang ?? "—"} · NUP {building.kodeSiman ?? "—"}
                      </div>
                    </div>
                  </div>
                  <SensusBadge sensus={building.sensus} />
                </CardHeader>
                <CardContent className="space-y-4">
                  {groupByFloor(building.ruang).map(([floor, rooms]) => (
                    <div key={floor} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Landmark className="size-3.5" />
                        {floor === 0 ? "Tanpa lantai" : `Lantai ${floor}`}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.map((room) => (
                          <Link
                            key={room.id}
                            to={`/sensus/${room.id}`}
                            className="group rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{room.nama}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {room.kode} · {room.tipeRuang ?? "—"}
                                </div>
                              </div>
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge variant="outline">{room.jumlahNup} NUP</Badge>
                              <Badge variant="secondary">{room.jumlahGrup} grup</Badge>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  {building.ruang.length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada ruang yang cocok.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
