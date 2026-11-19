import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Printer, Search, Stamp } from "lucide-react";
import QRCode from "qrcode";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { LabelEligibleResponse, LabelItem, PrintLabelResponse } from "@/lib/types";

interface PrintedState {
  labels: LabelItem[];
  qr: Record<string, string>;
}

export default function LabelPage() {
  const [data, setData] = useState<LabelEligibleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printed, setPrinted] = useState<PrintedState | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (q) params.set("q", q);
      setData(await api<LabelEligibleResponse>(`/label/eligible?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat label");
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handlePrint = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      setError("Pilih minimal satu label.");
      return;
    }
    setPrinting(true);
    setError("");
    setNotice("");
    try {
      const result = await api<PrintLabelResponse>("/label/print", {
        method: "POST",
        body: { ids },
      });
      const qrEntries = await Promise.all(
        result.labels.map(async (label) => [
          label.sensusId,
          label.qrContent
            ? await QRCode.toDataURL(label.qrContent, { width: 256, margin: 1 })
            : "",
        ] as const),
      );
      setPrinted({ labels: result.labels, qr: Object.fromEntries(qrEntries) });
      setSelected(new Set());
      setNotice(`${result.printed} label siap dicetak.`);
      await load();
      setTimeout(() => window.print(), 500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mencetak label");
    } finally {
      setPrinting(false);
    }
  };

  const handleApply = async () => {
    if (!printed) return;
    try {
      const result = await api<{ applied: number }>("/label/apply", {
        method: "POST",
        body: { ids: printed.labels.map((label) => label.sensusId) },
      });
      setNotice(`${result.applied} label ditandai sudah ditempel.`);
      setPrinted(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menandai label");
    }
  };

  const labelColumns: DataTableColumn<LabelItem>[] = [
    {
      key: "nama",
      header: "Aset",
      mobilePriority: "title",
      sortValue: (item) => item.nama,
      cell: (item) => (
        <span className="block max-w-64 truncate font-medium">{item.nama}</span>
      ),
    },
    {
      key: "nup",
      header: "NUP / Kode Barang",
      mobileLabel: "NUP / kode barang",
      cell: (item) => (
        <div className="text-xs">
          NUP {item.kodeSiman ?? "—"}
          <div className="text-muted-foreground">{item.kodeBarang ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "ruang",
      header: "Ruang",
      cell: (item) => (
        <div className="text-xs">
          {item.ruang ?? "—"}
          <div className="text-muted-foreground">{item.gedung ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "kodeRegister",
      header: "Kode Register (QR)",
      mobileLabel: "Kode register",
      cell: (item) => <span className="font-mono text-xs break-all">{item.kodeRegister ?? "—"}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="no-print space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Cetak Label</h1>
          <p className="text-sm text-muted-foreground">
            Hanya sensus VALIDATED yang lolos gate (NUP valid, aktif, satker cocok, bukan temuan
            baru). QR berisi Kode Register SIMAN.
          </p>
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
            <CardTitle>Label siap cetak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-2 sm:flex sm:flex-wrap sm:items-end"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                setQ(qInput.trim());
                setPage(1);
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="label-q">Cari</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="label-q"
                    type="search"
                    value={qInput}
                    onChange={(event) => setQInput(event.target.value)}
                    placeholder="nama / kode register / NUP"
                    className="pl-9"
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                <Search /> Cari
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={() => void handlePrint()} disabled={printing || selected.size === 0}>
                <Printer /> Cetak ({selected.size})
              </Button>
              {printed && (
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void handleApply()}>
                  <Stamp /> Tandai Ditempel
                </Button>
              )}
            </form>

            <DataTable
              columns={labelColumns}
              data={data?.items ?? []}
              getRowId={(item) => item.sensusId}
              selectable
              selectedIds={[...selected]}
              onSelectionChange={(ids) => setSelected(new Set(ids))}
              page={page}
              total={data?.total}
              limit={data?.limit ?? 20}
              onPageChange={setPage}
              loading={loading}
              emptyText="Tidak ada label yang lolos gate."
            />
          </CardContent>
        </Card>
      </div>

      {printed && (
        <div className="print-area space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Label Siap Tempel</h2>
            <Badge variant="secondary">{printed.labels.length} label</Badge>
          </div>
          <div className="label-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
            {printed.labels.map((label) => (
              <div key={label.sensusId} className="flex gap-3 rounded-md border p-3">
                {printed.qr[label.sensusId] && (
                  <img src={printed.qr[label.sensusId]} alt="QR" className="size-24" />
                )}
                <div className="min-w-0 text-xs">
                  <div className="truncate text-sm font-semibold">{label.nama}</div>
                  <div>NUP {label.kodeSiman ?? "—"} · {label.kodeBarang ?? "—"}</div>
                  <div>{label.gedung ?? "—"}</div>
                  <div>{label.ruang ?? "—"}</div>
                  <div className="mt-1 font-mono break-all">{label.kodeRegister}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
