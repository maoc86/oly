"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PermissionsCatalog, User } from "@/lib/types";
import { Button, EmptyState, Input, Modal } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Users,
  UserCheck,
  UserX,
  Phone,
  Plus,
  Pencil,
  Search,
  Shield,
  Calendar,
  Mail,
} from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  user: "Usuario",
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  vendedor: "bg-amber-100 text-amber-800",
  user: "bg-gray-100 text-gray-700",
};

const ROLE_ORDER = ["admin", "vendedor", "user"];

function roleList(u: User): string[] {
  const roles = u.roles?.length ? u.roles : u.role ? [u.role] : [];
  return [...roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
}

/** Modal de alta/edición con roles (checkboxes) y matriz de permisos. */
function UserFormModal({
  user,
  catalog,
  onClose,
  onSaved,
}: {
  user: User | null;
  catalog: PermissionsCatalog;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(user?.is_active ?? true);
  const [roles, setRoles] = useState<string[]>(
    user ? roleList(user) : ["user"]
  );
  const [overrides, setOverrides] = useState<Record<string, "grant" | "deny">>(() => {
    const map: Record<string, "grant" | "deny"> = {};
    (user?.grants ?? []).forEach((c) => (map[c] = "grant"));
    (user?.denies ?? []).forEach((c) => (map[c] = "deny"));
    return map;
  });
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, typeof catalog.permissions>();
    for (const p of catalog.permissions) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return Array.from(map.entries());
  }, [catalog]);

  // Permisos que otorgan los roles seleccionados (para mostrarlos como "del rol").
  const inherited = useMemo(() => {
    const set = new Set<string>();
    for (const role of roles) {
      for (const code of catalog.role_defaults[role] ?? []) set.add(code);
    }
    return set;
  }, [roles, catalog]);

  function toggleRole(role: string) {
    setRoles((prev) => {
      if (prev.includes(role)) {
        if (prev.length === 1) return prev; // siempre al menos un rol
        return prev.filter((r) => r !== role);
      }
      return [...prev, role];
    });
  }

  function setOverride(code: string, value: "grant" | "deny" | null) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === null) delete next[code];
      else next[code] = value;
      return next;
    });
  }

  async function save() {
    if (!name.trim()) return toastError("El nombre es obligatorio.");
    if (!email.trim()) return toastError("El email es obligatorio.");
    if (!isEdit && password.length < 8)
      return toastError("La contraseña debe tener al menos 8 caracteres.");
    if (password && password.length < 8)
      return toastError("La contraseña debe tener al menos 8 caracteres.");
    if (roles.length === 0) return toastError("Elegí al menos un rol.");

    const grants = Object.entries(overrides)
      .filter(([, v]) => v === "grant")
      .map(([k]) => k);
    const denies = Object.entries(overrides)
      .filter(([, v]) => v === "deny")
      .map(([k]) => k);
    const body: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      roles,
      grants,
      denies,
      is_active: active,
    };
    if (password) body.password = password;

    setSaving(true);
    try {
      if (isEdit && user) {
        await api.put(`/admin/users/${user.id}`, body);
        toastSuccess("Usuario actualizado.");
      } else {
        await api.post("/admin/users", body);
        toastSuccess("Usuario creado.");
      }
      onSaved();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? `Editar ${user?.name}` : "Nuevo usuario"} size="3xl">
      <div className="space-y-5">
        {/* Datos */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label={isEdit ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña"}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "••••••••" : ""}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          Usuario activo
        </label>

        {/* Roles */}
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Roles</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_ORDER.map((role) => {
              const on = roles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    on
                      ? "bg-brand-500 text-ink-900 border-brand-500 font-semibold"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {ROLE_LABEL[role]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permisos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">Permisos por acción</p>
            <p className="text-xs text-gray-500">
              «Hereda» usa lo que dan los roles · «Permite»/«Niega» son excepciones de este usuario.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {groups.map(([group, items]) => (
              <div key={group} className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {group}
                </p>
                <div className="space-y-1.5">
                  {items.map((p) => {
                    const ov = overrides[p.code];
                    const isInherited = inherited.has(p.code);
                    return (
                      <div
                        key={p.code}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="text-gray-800">{p.label}</span>
                          {isInherited && !ov && (
                            <span className="ml-2 text-xs text-gray-400">(del rol)</span>
                          )}
                        </div>
                        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden flex-shrink-0">
                          {(
                            [
                              [null, "Hereda", "text-gray-600"],
                              ["grant", "Permite", "text-green-700"],
                              ["deny", "Niega", "text-red-700"],
                            ] as const
                          ).map(([value, label, color]) => {
                            const on = (ov ?? null) === value;
                            return (
                              <button
                                key={String(value)}
                                type="button"
                                onClick={() => setOverride(p.code, value)}
                                className={`px-2.5 py-1 text-xs border-r last:border-r-0 border-gray-200 ${
                                  on ? `bg-gray-100 font-semibold ${color}` : "text-gray-400 hover:bg-gray-50"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<PermissionsCatalog | null>(null);
  const [modalUser, setModalUser] = useState<User | null | undefined>(undefined);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const inactive = total - active;
    const admins = users.filter((u) => roleList(u).includes("admin")).length;
    const vendedores = users.filter((u) => roleList(u).includes("vendedor")).length;
    return { total, active, inactive, admins, vendedores };
  }, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (!term) return true;
      return (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone || "").toLowerCase().includes(term)
      );
    });
  }, [users, search, statusFilter]);

  useEffect(() => {
    api
      .get<PermissionsCatalog>("/admin/permissions")
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  function usersPath() {
    const params = new URLSearchParams();
    if (roleFilter) params.set("role", roleFilter);
    if (search.trim()) params.set("search", search.trim());
    return `/admin/users${params.toString() ? `?${params}` : ""}`;
  }

  useEffect(() => {
    api
      .get<User[]>(usersPath())
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  function load() {
    setLoading(true);
    return api
      .get<User[]>(usersPath())
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  async function toggleActive(user: User) {
    try {
      await api.put(`/admin/users/${user.id}/toggle-active`);
      await load();
      toastSuccess(user.is_active ? "Usuario desactivado." : "Usuario activado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  async function confirmToggle(user: User) {
    const ok = await confirmDialog({
      message: `${user.name}: ¿${user.is_active ? "desactivar" : "activar"} la cuenta?`,
    });
    if (ok) await toggleActive(user);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Creá usuarios, asigná roles (varios por usuario) y ajustá permisos por acción.
          </p>
        </div>
        <Button onClick={() => setModalUser(null)} disabled={!catalog}>
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-gray-100 text-gray-700">
            <Users className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-green-50 text-green-700">
            <UserCheck className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Activos</p>
            <p className="text-lg font-semibold text-gray-900">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-red-50 text-red-600">
            <UserX className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Inactivos</p>
            <p className="text-lg font-semibold text-gray-900">{stats.inactive}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-purple-50 text-purple-700">
            <Shield className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Administradores</p>
            <p className="text-lg font-semibold text-gray-900">{stats.admins}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-amber-50 text-amber-700">
            <Users className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs text-gray-500">Vendedores</p>
            <p className="text-lg font-semibold text-gray-900">{stats.vendedores}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["", "Todos"],
              ["admin", "Admins"],
              ["vendedor", "Vendedores"],
              ["user", "Usuarios"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setRoleFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                roleFilter === value
                  ? "bg-brand-500 text-ink-900 border-brand-500 font-semibold"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-8 bg-gray-200 hidden sm:block" />
          {(
            [
              ["all", "Todos los estados"],
              ["active", "Activos"],
              ["inactive", "Inactivos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                statusFilter === value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-72"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No se encontraron usuarios con los filtros actuales." />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-medium text-gray-900">{filtered.length}</span> de{" "}
              <span className="font-medium text-gray-900">{users.length}</span> usuarios
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Usuario</th>
                  <th className="text-left p-4">Contacto</th>
                  <th className="text-left p-4">Roles</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-left p-4">Registro</th>
                  <th className="text-right p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center ring-1 ring-brand-100">
                          <Users className="w-4 h-4 text-brand-700" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {u.phone ? (
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Phone className="w-3.5 h-3.5" /> {u.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {roleList(u).map((role) => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              ROLE_BADGE[role] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {ROLE_LABEL[role] || role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}
                      >
                        {u.is_active ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(u.created_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setModalUser(u)}
                          disabled={!catalog}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Pencil className="w-3 h-3" /> Editar
                        </button>
                        <button
                          onClick={() => confirmToggle(u)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                            u.is_active
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-green-200 text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {u.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalUser !== undefined && catalog && (
        <UserFormModal
          key={modalUser ? `u-${modalUser.id}` : "new"}
          user={modalUser}
          catalog={catalog}
          onClose={() => setModalUser(undefined)}
          onSaved={() => {
            setModalUser(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
