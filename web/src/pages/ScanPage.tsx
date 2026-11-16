import { useState, type FormEvent } from "react";
import { QrCode, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ScanResponse } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ASSESSED: "Diperiksa",
  DOCS_COMPLETE: "Dokumen lengkap",
  VALIDATED: "Tervalidasi",
  TIDAK_DITEMUKAN: "Tidak ditemukan",
};

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await api<ScanResponse>(`/scan/${encodeURIComponent(value)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal scan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Scan / Verifikasi Kode Register</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan isi QR (Kode Register SIMAN) untuk memeriksa aset, ruang, status sensus, dan gate
          label.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cek Kode</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-2">
              <Label htmlFor="scan-code">Kode Register</Label>
              <div className="relative">
                <QrCode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="scan-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="E232FE0C50A925B1E0531261F20AD862"
                  className="pl-9 font-mono"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
              Cek
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{result.asset.nama}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {result.asset.kodeRegister} · Kode {result.asset.kodeBarang ?? "—"} · NUP{" "}
                {result.asset.kodeSiman ?? "—"}
              </p>
            </div>
            <Badge variant={result.gate.ok ? "default" : "destructive"}>
              {result.gate.ok ? "Lolos gate label" : "Tidak lolos gate"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!result.gate.ok && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-inside list-disc">
                    {result.gate.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Gedung / Ruang</div>
                <div>{result.asset.ruang?.bangunanAset.nama ?? "—"}</div>
                <div className="text-muted-foreground">
                  {result.asset.ruang
                    ? `${result.asset.ruang.nama} (${result.asset.ruang.kode}) · Lantai ${result.asset.ruang.lantai}`
                    : "tanpa ruang"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status SIMAN</div>
                <div>
                  {result.asset.statusAset ?? "—"} · {result.asset.syncStatus}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status sensus</div>
                <div>
                  {result.asset.sensus ? STATUS_LABEL[result.asset.sensus.status] : "Belum disensus"}
                </div>
                {result.asset.sensus && (
                  <div className="text-muted-foreground">
                    {result.asset.sensus.jumlahFisik ?? "—"} · {result.asset.sensus.kondisi ?? "—"}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Label</div>
                <div>
                  Cetak: {result.asset.sensus?.labelPrintedAt ? "sudah" : "belum"} · Tempel:{" "}
                  {result.asset.sensus?.labelAppliedAt ? "sudah" : "belum"}
                </div>
              </div>
            </div>

            {result.asset.ruang && (
              <Button asChild variant="outline" size="sm">
                <Link to="/hierarki">Buka ruang aset</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
