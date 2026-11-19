import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
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
import { DataTable, type DataTableColumn } from "@/components/DataTable";
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
  const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(
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
    username: "",
    password: "",
    role: "MAHASISWA" as Role,
    nim: "",
    programStudi: "",
    instansi: "",
    noHp: "",
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      await api<User>("/users", { method: "POST", body: createForm });
      setNotice(`User ${createForm.username} dibuat.`);
      setCreateForm({
        nama: "", username: "", password: "", role: "MAHASISWA",
        nim: "", programStudi: "", instansi: "", noHp: "",
      });
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
  const [editForm, setEditForm] = useState({
    nama: "", username: "", role: "MAHASISWA" as Role,
    nim: "", programStudi: "", instansi: "", noHp: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (user: User) => {
    setEditing(user);
    setEditForm({
      nama: user.nama, username: user.username, role: user.role,
      nim: user.nim ?? "", programStudi: user.programStudi ?? "",
      instansi: user.instansi ?? "", noHp: user.noHp ?? "",
    });
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
      setNotice(`User ${editForm.username} diperbarui.`);
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
    if (!window.confirm(`Reset password ${user.username}? Token lama user ini akan mati.`)) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    setTempPassword(null);
    try {
      const result = await api<{ password: string }>(`/users/${user.id}/reset-password`, {
        method: "POST",
      });
      setTempPassword({ username: user.username, password: result.password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal reset password");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (user: User) => {
    const activate = !user.isActive;
    if (!window.confirm(`${activate ? "Aktifkan" : "Nonaktifkan"} ${user.username}?`)) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await api<User>(`/users/${user.id}/${activate ? "activate" : "deactivate"}`, {
        method: "POST",
      });
      setNotice(`${user.username} ${activate ? "diaktifkan" : "dinonaktifkan"}.`);
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

  const userColumns: DataTableColumn<User>[] = [
    {
      key: "nama",
      header: "Nama",
      mobilePriority: "title",
      sortValue: (user) => user.nama,
      cell: (user) => (
        <div className="font-medium">
          {user.nama}
          {user.id === actor?.id && (
            <span className="ml-2 text-xs text-muted-foreground">(Anda)</span>
          )}
          {user.nim && (
            <div className="text-xs font-normal text-muted-foreground">NIM {user.nim}</div>
          )}
        </div>
      ),
    },
    {
      key: "username",
      header: "Username",
      mobilePriority: "subtitle",
      sortValue: (user) => user.username,
      cell: (user) => (
        <div className="text-muted-foreground">
          @{user.username}
          {user.programStudi && <div className="text-xs">{user.programStudi}</div>}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      mobilePriority: "primary",
      sortValue: (user) => user.role,
      cell: (user) => (
        <Badge variant={user.role === "SUPERADMIN" ? "default" : "outline"}>
          {ROLE_LABEL[user.role]}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobilePriority: "primary",
      sortValue: (user) => (user.isActive ? 1 : 0),
      cell: (user) => (
        <Badge variant={user.isActive ? "secondary" : "destructive"}>
          {user.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      key: "lastLogin",
      header: "Login terakhir",
      mobileLabel: "Login terakhir",
      className: "whitespace-nowrap text-xs text-muted-foreground",
      cell: (user) => formatDate(user.lastLoginAt),
    },
    {
      key: "aksi",
      header: "",
      mobilePriority: "actions",
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            title="Edit"
            aria-label={`Edit ${user.username}`}
            disabled={!canManage(user)}
            onClick={() => startEdit(user)}
          >
            <Pencil />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Reset password"
            aria-label={`Reset password ${user.username}`}
            disabled={!canManage(user) || busyId === user.id}
            onClick={() => void handleReset(user)}
          >
            <KeyRound />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title={user.isActive ? "Nonaktifkan" : "Aktifkan"}
            aria-label={`${user.isActive ? "Nonaktifkan" : "Aktifkan"} ${user.username}`}
            disabled={!canManage(user) || busyId === user.id}
            onClick={() => void handleToggleActive(user)}
          >
            {user.isActive ? <UserX /> : <UserCheck />}
          </Button>
        </div>
      ),
    },
  ];

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
              untuk {tempPassword.username}. Password ini tidak bisa ditampilkan lagi.
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
                  <Label htmlFor="create-username">Username</Label>
                  <Input
                    id="create-username"
                    autoComplete="username"
                    value={createForm.username}
                    onChange={(event) =>
                      setCreateForm((form) => ({ ...form, username: event.target.value }))
                    }
                    minLength={3}
                    maxLength={40}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-nim">NIM</Label>
                  <Input id="create-nim" value={createForm.nim} onChange={(event) => setCreateForm((form) => ({ ...form, nim: event.target.value }))} placeholder="untuk mahasiswa" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-prodi">Program studi</Label>
                  <Input id="create-prodi" value={createForm.programStudi} onChange={(event) => setCreateForm((form) => ({ ...form, programStudi: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-instansi">Instansi / kampus</Label>
                  <Input id="create-instansi" value={createForm.instansi} onChange={(event) => setCreateForm((form) => ({ ...form, instansi: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-hp">No. HP</Label>
                  <Input id="create-hp" value={createForm.noHp} onChange={(event) => setCreateForm((form) => ({ ...form, noHp: event.target.value }))} />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={creating}>
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
            <CardDescription>{editing.username}</CardDescription>
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
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    autoComplete="username"
                    value={editForm.username}
                    onChange={(event) =>
                      setEditForm((form) => ({ ...form, username: event.target.value }))
                    }
                    minLength={3}
                    maxLength={40}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-nim">NIM</Label>
                  <Input id="edit-nim" value={editForm.nim} onChange={(event) => setEditForm((form) => ({ ...form, nim: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-prodi">Program studi</Label>
                  <Input id="edit-prodi" value={editForm.programStudi} onChange={(event) => setEditForm((form) => ({ ...form, programStudi: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-instansi">Instansi / kampus</Label>
                  <Input id="edit-instansi" value={editForm.instansi} onChange={(event) => setEditForm((form) => ({ ...form, instansi: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-hp">No. HP</Label>
                  <Input id="edit-hp" value={editForm.noHp} onChange={(event) => setEditForm((form) => ({ ...form, noHp: event.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="w-full sm:w-auto" disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="animate-spin" /> : <Save />}
                  Simpan
                </Button>
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditing(null)}>
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
              className="grid flex-1 gap-2 sm:flex sm:flex-wrap sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                setQ(search.trim());
                setPage(1);
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="search">Cari nama/username</Label>
                <Input
                  id="search"
                  type="search"
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
                    className="w-full sm:w-auto"
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
                  className="w-full sm:w-auto"
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
              <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                <Search /> Cari
              </Button>
            </form>
          </div>

          <DataTable
            columns={userColumns}
            data={data?.items ?? []}
            getRowId={(user) => user.id}
            page={page}
            total={data?.total}
            limit={data?.limit ?? 20}
            onPageChange={setPage}
            loading={loading}
            emptyText="Tidak ada user yang cocok."
          />
        </CardContent>
      </Card>
    </div>
  );
}
