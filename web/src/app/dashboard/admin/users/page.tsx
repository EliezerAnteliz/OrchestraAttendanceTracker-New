"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/contexts/I18nContext";
import { useProgram } from "@/contexts/ProgramContext";
import { MdRefresh, MdPeople, MdEdit, MdDelete, MdAdd } from "react-icons/md";

type Program = { id: string; name: string; organization_id: string };

type MemberRow = { email: string; role: "admin" | "staff" | "viewer"; created_at: string };

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: "admin" | "staff" | "viewer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const { programs, refreshPrograms, loading: programsLoading } = useProgram();
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "viewer">("staff");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === selectedProgramId) || null,
    [programs, selectedProgramId]
  );

  // Initialize/refresh programs via ProgramContext
  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        await refreshPrograms();
      } catch (e: any) {
        console.error("AdminUsers: refreshPrograms error", e);
        const msg = e?.message || e?.hint || e?.details || "No fue posible cargar los programas.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first program when available
  useEffect(() => {
    if (!selectedProgramId && programs?.length) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  const loadMembers = async () => {
    if (!selectedProgramId) return;
    setError(null);
    try {
      const { data, error } = await supabase.rpc("list_program_members", {
        target_program_id: selectedProgramId,
      });
      if (error) {
        console.error("AdminUsers: list_program_members rpc error", { error });
        throw error;
      }
      setMembers((data as MemberRow[]) || []);
    } catch (e: any) {
      console.error("AdminUsers: loadMembers error", e);
      const msg = e?.message || e?.hint || e?.details || "No fue posible cargar los miembros. Verifica que el RPC list_program_members exista y tenga permisos.";
      setError(msg);
    }
  };

  const loadAllUsers = async () => {
    if (!selectedProgram?.organization_id) return;
    setError(null);
    try {
      const { data, error } = await supabase.rpc("get_organization_users", {
        org_id: selectedProgram.organization_id,
      });
      if (error) {
        console.error("AdminUsers: get_organization_users rpc error", { error });
        throw error;
      }
      setAllUsers((data as UserProfile[]) || []);
    } catch (e: any) {
      console.error("AdminUsers: loadAllUsers error", e);
      const msg = e?.message || e?.hint || e?.details || "No fue posible cargar todos los usuarios.";
      setError(msg);
    }
  };

  const handleGrant = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedProgramId || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("grant_membership_by_email", {
        target_email: email.trim(),
        target_program_id: selectedProgramId,
        target_role: role,
      });
      if (error) {
        console.error("AdminUsers: grant_membership_by_email rpc error", { error });
        throw error;
      }
      setEmail("");
      await loadMembers();
    } catch (e: any) {
      console.error("AdminUsers: grant error", e);
      const msg = e?.message || e?.hint || e?.details || "No fue posible conceder el acceso. Verifica que el RPC grant_membership_by_email exista y tenga permisos.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (targetEmail: string) => {
    if (!selectedProgramId || !targetEmail) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("revoke_membership_by_email", {
        target_email: targetEmail,
        target_program_id: selectedProgramId,
      });
      if (error) {
        console.error("AdminUsers: revoke_membership_by_email rpc error", { error });
        throw error;
      }
      await loadMembers();
    } catch (e: any) {
      console.error("AdminUsers: revoke error", e);
      const msg = e?.message || e?.hint || e?.details || "No fue posible revocar el acceso. Verifica que el RPC revoke_membership_by_email exista y tenga permisos.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  // Remove previous loadPrograms effect; handled above via ProgramContext

  const updateUserRole = async (userId: string, newRole: "admin" | "staff" | "viewer") => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);
      
      if (error) throw error;
      
      await loadAllUsers();
      setEditingUser(null);
    } catch (e: any) {
      console.error("AdminUsers: updateUserRole error", e);
      setError(e?.message || "Error al actualizar el rol del usuario");
    } finally {
      setBusy(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);
      
      if (error) throw error;
      
      await loadAllUsers();
    } catch (e: any) {
      console.error("AdminUsers: toggleUserStatus error", e);
      setError(e?.message || "Error al cambiar el estado del usuario");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadMembers();
    if (showAllUsers) {
      loadAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, showAllUsers]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800">{t('admin_users_page_title')}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {t('admin_users_page_desc')}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <label className="text-sm text-gray-700" htmlFor="programSelect">{t('program_label')}</label>
          <select
            id="programSelect"
            className="border border-gray-300 rounded px-2 py-2 text-gray-800 bg-white"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {loading && <span className="text-sm text-gray-500">{t('loading_programs')}</span>}
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      <form onSubmit={handleGrant} className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-3">
        <h2 className="text-lg font-medium text-gray-800">{t('grant_update_access')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1" htmlFor="email">{t('email')}</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 bg-white"
              placeholder={t('email_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1" htmlFor="role">{t('role')}</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 bg-white"
            >
              <option value="admin">{t('admin_label')}</option>
              <option value="staff">{t('staff_label')}</option>
              <option value="viewer">{t('viewer_label')}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy || !selectedProgramId}
              className={`px-4 py-2 rounded-md shadow-sm ${busy ? 'bg-gray-300 text-gray-500' : 'bg-[#0073ea] text-white hover:bg-[#0060c0]'}`}
            >
              {busy ? t('processing') : t('save_access')}
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium text-gray-800">
              {showAllUsers ? 'Todos los Usuarios Registrados' : t('members_title')}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAllUsers(!showAllUsers)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  showAllUsers 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <MdPeople className="inline mr-1" size={16} />
                {showAllUsers ? 'Ver Miembros del Programa' : 'Ver Todos los Usuarios'}
              </button>
            </div>
          </div>
          <button
            onClick={showAllUsers ? loadAllUsers : loadMembers}
            disabled={!selectedProgramId || busy}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <MdRefresh size={16} /> {t('refresh')}
          </button>
        </div>
        {!selectedProgramId ? (
          <p className="text-gray-600">{t('select_a_program')}</p>
        ) : showAllUsers ? (
          allUsers.length === 0 ? (
            <p className="text-gray-600">No hay usuarios registrados en esta organización</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm text-gray-700 sticky top-0 z-10">
                    <th className="px-3 py-2 border border-gray-200">Nombre</th>
                    <th className="px-3 py-2 border border-gray-200">{t('email')}</th>
                    <th className="px-3 py-2 border border-gray-200">{t('role')}</th>
                    <th className="px-3 py-2 border border-gray-200">Estado</th>
                    <th className="px-3 py-2 border border-gray-200">Registrado</th>
                    <th className="px-3 py-2 border border-gray-200">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => (
                    <tr key={user.id} className="text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        {user.full_name || 'Sin nombre'}
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">{user.email}</td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        {editingUser?.id === user.id ? (
                          <select
                            value={user.role}
                            onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                            className="text-xs border rounded px-1 py-0.5"
                            disabled={busy}
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                            ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : user.role === 'staff' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {user.role === 'admin' ? 'Admin' : user.role === 'staff' ? 'Staff' : 'Viewer'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                          ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setEditingUser(editingUser?.id === user.id ? null : user)}
                            disabled={busy}
                            className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            <MdEdit size={14} />
                          </button>
                          <button
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                            disabled={busy}
                            className={`px-2 py-1 rounded text-xs ${
                              user.is_active 
                                ? 'bg-red-50 text-red-700 hover:bg-red-100' 
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : members.length === 0 ? (
          <p className="text-gray-600">{t('no_members')}</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-gray-700 sticky top-0 z-10">
                  <th className="px-3 py-2 border border-gray-200">{t('email')}</th>
                  <th className="px-3 py-2 border border-gray-200">{t('role')}</th>
                  <th className="px-3 py-2 border border-gray-200">{t('since')}</th>
                  <th className="px-3 py-2 border border-gray-200">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={`${m.email}-${m.role}-${m.created_at}`} className="text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors">
                    <td className="px-3 py-2 border border-gray-200 text-gray-800">{m.email}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-800">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${m.role === 'admin' ? 'bg-blue-100 text-blue-800' : m.role === 'staff' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}
                      >
                        {m.role === 'admin' ? t('admin_label') : m.role === 'staff' ? t('staff_label') : t('viewer_label')}
                      </span>
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-800">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 border border-gray-200">
                      <button
                        onClick={() => handleRevoke(m.email)}
                        disabled={busy}
                        className="px-3 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        {t('revoke')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
