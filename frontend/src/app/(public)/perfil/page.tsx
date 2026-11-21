"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { User } from "@/lib/types";
import { Button, Input } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { User as UserIcon, Mail, ShieldCheck, KeyRound } from "lucide-react";

export default function PerfilPage() {
  const router = useRouter();
  const { isAuthenticated, user, updateUser } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cedula, setCedula] = useState("");
  const [saving, setSaving] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changing, setChanging] = useState(false);

  // Sin sesión no hay nada que editar: mandamos al login.
  useEffect(() => {
    if (!isAuthenticated) router.replace("/login?redirect=/perfil");
  }, [isAuthenticated, router]);

  // Carga los datos una sola vez, cuando el usuario ya está disponible. Se hace
  // durante el render (patrón recomendado por React para "ajustar estado cuando
  // cambia una prop") en vez de dentro de un efecto, y así no pisa lo que el
  // usuario esté escribiendo ni provoca un render extra.
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  if (user && user.id !== loadedUserId) {
    setLoadedUserId(user.id);
    setName(user.name);
    setPhone(user.phone || "");
    setCedula(user.cedula || "");
  }

  async function save() {
    if (!name.trim()) {
      toastError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<User>("/auth/me", {
        name: name.trim(),
        phone: phone.trim(),
        cedula: cedula.trim(),
      });
      updateUser(updated);
      toastSuccess("Datos guardados.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "No se pudieron guardar los datos");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (next.length < 8) {
      toastError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      toastError("Las contraseñas no coinciden.");
      return;
    }
    setChanging(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toastSuccess("Contraseña actualizada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    } finally {
      setChanging(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500 mt-1">
          Actualizá tus datos de contacto. Los usamos para tus compras y envíos.
        </p>
      </div>

      <div className="space-y-6">
        {/* Datos personales */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
            <UserIcon className="w-4 h-4" /> Datos personales
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
            <Input
              label="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0412-1234567"
              maxLength={50}
            />
            <Input
              label="Cédula / RIF"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="V-12345678"
              maxLength={40}
            />
          </div>
          <div className="flex justify-end mt-5">
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar datos"}
            </Button>
          </div>
        </div>

        {/* Seguridad */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
            <ShieldCheck className="w-4 h-4" /> Seguridad
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Input
              label="Contraseña actual"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <Input
              label="Repetir contraseña"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repetí la nueva"
            />
          </div>
          <div className="flex justify-end mt-5">
            <Button
              variant="secondary"
              onClick={changePassword}
              disabled={changing || !current || !next || !confirm}
            >
              <KeyRound className="w-4 h-4" />
              {changing ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
