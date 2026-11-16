import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import { useAuth } from "@/auth/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader } from "@/components/Loader";
import { api } from "@/lib/api";
import type { Paginated, Role, User } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  MAHASISWA: "Mahasiswa",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
};

const ROLE_OPTIONS: Role[] = ["MAHASISWA", "ADMIN", "SUPERADMIN"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function UsersPage() {
  const { user: actor } = useAuth();
  const isSuperadmin = actor?.role === "SUPERADMIN";
  const isAdmin = actor?.role === "ADMIN" || isSuperadmin;

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState<"" | Role>("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const [data, setData] = useState<Paginated<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q) params.set("q", q);
    if (filterRole) params.set("role", filterRole);
    if (filterActive) params.set("isActive", filterActive);
    try {
      setData(await api<Paginated<User>>(`/users?${params.toString()}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat daftar user");
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, filterRole, filterActive]);

  useEffect(() => {
    // Fetch daftar setiap filter/page berubah (setState terjadi setelah await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // ── Tambah user ─────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nama: "",
    email: "",
    password: "",
    role: "MAHASISWA" as Role,
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      await api<User>("/users", { method: "POST", body: createForm });
      setNotice(`User ${createForm.email} dibuat.`);
      setCreateForm({ nama: "", email: "", password: "", role: "MAHASISWA" });
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat user");
    } finally {
      setCreating(false);
    }
  };

  // ── Edit user ───────────────────────────────────────────────
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ nama: "", email: "", role: "MAHASISWA" as Role });
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (user: User) => {
    setEditing(user);
    setEditForm({ nama: user.nama, email: user.email, role: user.role });
    setError("");
    setNotice("");
    setTempPassword(null);
  };

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setError("");
    setNotice("");
    try {
      await api<User>(`/users/${editing.id}`, { method: "PATCH", body: editForm });
      setNotice(`User ${editForm.email} diperbarui.`);
      setEditing(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui user");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Aksi per baris ──────────────────────────────────────────
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleReset = async (user: User) => {
    if (!window.confirm(`Reset password ${user.email}? Token lama user ini akan mati.`)) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    setTempPassword(null);
    try {
      const result = await api<{ password: string }>(`/users/${user.id}/reset-password`, {
        method: "POST",
      });
      setTempPassword({ email: user.email, password: result.password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal reset password");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (user: User) => {
    const activate = !user.isActive;
    if (!window.confirm(`${activate ? "Aktifkan" : "Nonaktifkan"} ${user.email}?`)) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await api<User>(`/users/${user.id}/${activate ? "activate" : "deactivate"}`, {
        method: "POST",
      });
      setNotice(`${user.email} ${activate ? "diaktifkan" : "dinonaktifkan"}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengubah status user");
    } finally {
      setBusyId(null);
    }
  };

  const canManage = (user: User): boolean => {
    if (!actor || actor.id === user.id) return false;
    if (isSuperadmin) return true;
    return actor.role === "ADMIN" && user.role === "MAHASISWA";
  };

  const roleChoices = isSuperadmin ? ROLE_OPTIONS : (["MAHASISWA"] as Role[]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Manajemen User</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperadmin
              ? "Kelola semua akun (MAHASISWA, ADMIN, SUPERADMIN)."
              : "Admin hanya dapat mengelola akun MAHASISWA."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen((open) => !open)}>
          {createOpen ? <X /> : <Plus />}
          {createOpen ? "Tutup" : "Tambah User"}
        </Button>
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
      {tempPassword && (
        <Alert variant="success">
          <AlertTitle>Password sementara — catat SEKALI</AlertTitle>
          <AlertDescription>
            <div className="mt-1 font-mono text-base">{tempPassword.password}</div>
            <div className="text-xs">
              untuk {tempPassword.email}. Password ini tidak bisa ditampilkan lagi.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah User</CardTitle>
            <CardDescription>Password minimal 8 karakter.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-nama">Nama</Label>
                  <Input
                    id="create-nama"
                    value={createForm.nama}
                    onChange={(event) =>
                      setCreateForm((form) => ({ ...form, nama: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm((form) => ({ ...form, email: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Password awal</Label>
                  <Input
                    id="create-password"
                    type="password"
                    minLength={8}
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((form) => ({ ...form, password: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">Role</Label>
                  <Select
                    id="create-role"
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm((form) => ({ ...form, role: event.target.value as Role }))
                    }
                  >
                    {roleChoices.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="animate-spin" />}
                Simpan User
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
            <CardDescription>{editing.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-nama">Nama</Label>
                  <Input
                    id="edit-nama"
                    value={editForm.nama}
                    onChange={(event) =>
                      setEditForm((form) => ({ ...form, nama: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm((form) => ({ ...form, email: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    id="edit-role"
                    value={editForm.role}
                    onChange={(event) =>
                      setEditForm((form) => ({ ...form, role: event.target.value as Role }))
                    }
                  >
                    {roleChoices.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="animate-spin" /> : <Save />}
                  Simpan
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar User</CardTitle>
          <CardDescription>{data ? `${data.total} akun` : "Memuat…"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <form
              className="flex flex-1 flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setQ(search.trim());
                setPage(1);
              }}
            >
              <div className="min-w-48 flex-1 space-y-2">
                <Label htmlFor="search">Cari nama/email</Label>
                <Input
                  id="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="kata kunci…"
                />
              </div>
              {isSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="filter-role">Role</Label>
                  <Select
                    id="filter-role"
                    value={filterRole}
                    onChange={(event) => {
                      setFilterRole(event.target.value as "" | Role);
                      setPage(1);
                    }}
                  >
                    <option value="">Semua</option>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="filter-status">Status</Label>
                <Select
                  id="filter-status"
                  value={filterActive}
                  onChange={(event) => {
                    setFilterActive(event.target.value as "" | "true" | "false");
                    setPage(1);
                  }}
                >
                  <option value="">Semua</option>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </Select>
              </div>
              <Button type="submit" variant="secondary">
                <Search /> Cari
              </Button>
            </form>
          </div>

          {loading ? (
            <Loader label="Memuat user…" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Login terakhir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data && data.items.length > 0 ? (
                  data.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.nama}
                        {user.id === actor?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "SUPERADMIN" ? "default" : "outline"}>
                          {ROLE_LABEL[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "secondary" : "destructive"}>
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(user.lastLoginAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit"
                            aria-label={`Edit ${user.email}`}
                            disabled={!canManage(user)}
                            onClick={() => startEdit(user)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Reset password"
                            aria-label={`Reset password ${user.email}`}
                            disabled={!canManage(user) || busyId === user.id}
                            onClick={() => void handleReset(user)}
                          >
                            <KeyRound />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
                            aria-label={`${user.isActive ? "Nonaktifkan" : "Aktifkan"} ${user.email}`}
                            disabled={!canManage(user) || busyId === user.id}
                            onClick={() => void handleToggleActive(user)}
                          >
                            {user.isActive ? <UserX /> : <UserCheck />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty colSpan={6}>Tidak ada user yang cocok.</TableEmpty>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Halaman {data?.page ?? page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft /> Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Berikutnya <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
