import { useState, type FormEvent } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";

import { useAuth } from "@/auth/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, tokenStore } from "@/lib/api";
import type { Role, User } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  MAHASISWA: "Mahasiswa",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

export default function ProfilPage() {
  const { user, refresh } = useAuth();

  const [nama, setNama] = useState(user?.nama ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [nim, setNim] = useState(user?.nim ?? "");
  const [programStudi, setProgramStudi] = useState(user?.programStudi ?? "");
  const [instansi, setInstansi] = useState(user?.instansi ?? "");
  const [noHp, setNoHp] = useState(user?.noHp ?? "");
  const [savingProfil, setSavingProfil] = useState(false);
  const [profilNotice, setProfilNotice] = useState("");
  const [profilError, setProfilError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (!user) return null;

  const profilDirty =
    nama.trim() !== user.nama ||
    username.trim() !== user.username ||
    nim.trim() !== (user.nim ?? "") ||
    programStudi.trim() !== (user.programStudi ?? "") ||
    instansi.trim() !== (user.instansi ?? "") ||
    noHp.trim() !== (user.noHp ?? "");

  const handleSaveProfil = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfilError("");
    setProfilNotice("");
    setSavingProfil(true);
    try {
      const updated = await api<User>("/me", {
        method: "PATCH",
        body: {
          nama: nama.trim(), username: username.trim(),
          nim: nim.trim(), programStudi: programStudi.trim(),
          instansi: instansi.trim(), noHp: noHp.trim(),
        },
      });
      setNama(updated.nama);
      setUsername(updated.username);
      setNim(updated.nim ?? "");
      setProgramStudi(updated.programStudi ?? "");
      setInstansi(updated.instansi ?? "");
      setNoHp(updated.noHp ?? "");
      await refresh();
      setProfilNotice("Profil disimpan.");
    } catch (cause) {
      setProfilError(cause instanceof Error ? cause.message : "Gagal menyimpan profil");
    } finally {
      setSavingProfil(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak sama.");
      return;
    }

    setSavingPassword(true);
    try {
      const result = await api<{ token: string }>("/me/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      tokenStore.set(result.token);
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Password diganti. Sesi di perangkat lain sudah tidak berlaku.");
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : "Gagal mengganti password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{user.nama}</h1>
          <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
        </div>
        <Badge variant={user.role === "SUPERADMIN" ? "default" : "secondary"}>
          {ROLE_LABEL[user.role]}
        </Badge>
        {!user.isActive && <Badge variant="destructive">Nonaktif</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Profil</CardTitle>
          <CardDescription>Nama dan username yang dipakai untuk login.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfil} className="space-y-4">
            {profilError && (
              <Alert variant="destructive">
                <AlertDescription>{profilError}</AlertDescription>
              </Alert>
            )}
            {profilNotice && (
              <Alert variant="success">
                <AlertDescription>{profilNotice}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nama">Nama</Label>
                <Input
                  id="nama"
                  value={nama}
                  onChange={(event) => setNama(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={40}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nim">NIM</Label>
                <Input id="nim" value={nim} onChange={(event) => setNim(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="programStudi">Program studi</Label>
                <Input id="programStudi" value={programStudi} onChange={(event) => setProgramStudi(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instansi">Instansi / kampus</Label>
                <Input id="instansi" value={instansi} onChange={(event) => setInstansi(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noHp">No. HP</Label>
                <Input id="noHp" value={noHp} onChange={(event) => setNoHp(event.target.value)} />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={!profilDirty || savingProfil}>
              {savingProfil ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan Profil
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ganti Password</CardTitle>
          <CardDescription>
            Setelah diganti, semua token lama (perangkat lain) otomatis tidak berlaku.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            {passwordNotice && (
              <Alert variant="success">
                <AlertDescription>{passwordNotice}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password lama</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password baru</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Ulangi password baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={savingPassword}>
              {savingPassword && <Loader2 className="animate-spin" />}
              Ganti Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
