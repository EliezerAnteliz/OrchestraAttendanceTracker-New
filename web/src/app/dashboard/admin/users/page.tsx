"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/contexts/I18nContext";
import { useProgram } from "@/contexts/ProgramContext";
import { MdRefresh, MdPeople, MdEdit, MdDelete, MdAdd, MdWarning, MdPersonRemove, MdSave, MdCancel } from "react-icons/md";

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
  organization_id: string;
  programs?: { id: string; name: string }[];
  organizationName?: string;
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
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingUserProgram, setEditingUserProgram] = useState<UserProfile | null>(null);

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
      // Use the existing RPC function that works
      const { data, error } = await supabase.rpc("get_organization_users", {
        org_id: selectedProgram.organization_id,
      });
      
      if (error) {
        console.error("AdminUsers: get_organization_users rpc error", { error });
        throw error;
      }
      
      // For each user, get their program memberships and organization info
      const usersWithPrograms = await Promise.all(
        (data || []).map(async (user: UserProfile) => {
          try {
            const { data: memberships, error: membershipError } = await supabase
              .from('user_program_memberships')
              .select('program_id')
              .eq('user_id', user.user_id);
            
            if (membershipError) {
              console.warn("Could not load memberships for user:", user.email, membershipError);
              return { ...user, programs: [], organizationName: 'CMI Orchestra' };
            }
            
            // Get program names for the memberships
            const programIds = memberships?.map(m => m.program_id) || [];
            const userPrograms = programs.filter(p => programIds.includes(p.id));
            
            return {
              ...user,
              programs: userPrograms,
              organizationName: 'CMI Orchestra' // Fixed organization name
            };
          } catch (err) {
            console.warn("Error loading programs for user:", user.email, err);
            return { ...user, programs: [], organizationName: 'CMI Orchestra' };
          }
        })
      );
      
      setAllUsers(usersWithPrograms);
    } catch (e: any) {
      console.error("AdminUsers: loadAllUsers error", e);
      const msg = e?.message || e?.hint || e?.details || "No fue posible cargar todos los usuarios. Verifica que el RPC get_organization_users exista y tenga permisos.";
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
      // Find the user's email and current program
      const user = allUsers.find(u => u.user_id === userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }
      
      // Get the user's current program (if any)
      const currentProgram = user.programs?.[0];
      
      if (currentProgram) {
        // If user has a program, revoke and re-grant with new role
        await supabase.rpc("revoke_membership_by_email", {
          target_email: user.email,
          target_program_id: currentProgram.id,
        });
        
        const { error } = await supabase.rpc("grant_membership_by_email", {
          target_email: user.email,
          target_program_id: currentProgram.id,
          target_role: newRole,
        });
        
        if (error) {
          console.error("AdminUsers: grant_membership_by_email error", error);
          throw error;
        }
      } else {
        // If user has no program, assign them to the currently selected program with the new role
        if (!selectedProgramId) {
          throw new Error("No hay programa seleccionado. Selecciona un programa primero.");
        }
        
        const { error } = await supabase.rpc("grant_membership_by_email", {
          target_email: user.email,
          target_program_id: selectedProgramId,
          target_role: newRole,
        });
        
        if (error) {
          console.error("AdminUsers: grant_membership_by_email error", error);
          throw error;
        }
      }
      
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
        .eq('user_id', userId);
      
      if (error) throw error;
      
      await loadAllUsers();
    } catch (e: any) {
      console.error("AdminUsers: toggleUserStatus error", e);
      setError(e?.message || "Error al cambiar el estado del usuario");
    } finally {
      setBusy(false);
    }
  };

  const deleteUserCompletely = async (user: UserProfile) => {
    setBusy(true);
    setError(null);
    try {
      // 1. Delete from attendance records
      await supabase
        .from('attendance')
        .delete()
        .eq('student_id', user.user_id);

      // 2. Delete from user_program_memberships
      await supabase
        .from('user_program_memberships')
        .delete()
        .eq('user_id', user.user_id);

      // 3. Delete from user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', user.user_id);
      
      if (profileError) throw profileError;

      // 4. Delete from Supabase Auth
      const { error: authError } = await supabase.auth.admin.deleteUser(user.user_id);
      
      if (authError) {
        console.warn('Could not delete from auth, but profile deleted:', authError);
      }
      
      await loadAllUsers();
      setShowDeleteConfirm(false);
      setDeletingUser(null);
    } catch (e: any) {
      console.error("AdminUsers: deleteUserCompletely error", e);
      setError(e?.message || "Error al eliminar el usuario completamente");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClick = (user: UserProfile) => {
    setDeletingUser(user);
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setDeletingUser(null);
    setShowDeleteConfirm(false);
  };

  const updateUserProgram = async (userId: string, newProgramId: string) => {
    setBusy(true);
    setError(null);
    try {
      // Find the user's email first
      const user = allUsers.find(u => u.user_id === userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }
      
      // First revoke existing memberships for this user from all programs
      const userCurrentPrograms = user.programs || [];
      for (const program of userCurrentPrograms) {
        try {
          await supabase.rpc("revoke_membership_by_email", {
            target_email: user.email,
            target_program_id: program.id,
          });
        } catch (revokeError) {
          console.warn("Could not revoke membership from program:", program.name, revokeError);
        }
      }
      
      // Then grant new membership if a program was selected
      if (newProgramId) {
        const { error } = await supabase.rpc("grant_membership_by_email", {
          target_email: user.email,
          target_program_id: newProgramId,
          target_role: user.role, // Keep the same role
        });
        
        if (error) {
          console.error("AdminUsers: grant_membership_by_email error", error);
          throw error;
        }
      }
      
      await loadAllUsers();
      setEditingUserProgram(null);
    } catch (e: any) {
      console.error("AdminUsers: updateUserProgram error", e);
      setError(e?.message || "Error al actualizar el programa del usuario");
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-xl shadow-lg text-white">
        <div className="flex items-center space-x-3">
          <MdPeople size={32} className="text-blue-100" />
          <div>
            <h1 className="text-2xl font-bold">{t('admin_users_page_title')}</h1>
            <p className="text-blue-100 mt-1">
              {t('admin_users_page_desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <label className="text-sm font-semibold text-gray-700" htmlFor="programSelect">{t('program_label')}</label>
          <select
            id="programSelect"
            className="border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {loading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-500">{t('loading_programs')}</span>
            </div>
          )}
        </div>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <MdWarning className="text-red-500" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleGrant} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <div className="flex items-center space-x-3 mb-4">
          <MdAdd size={24} className="text-green-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Crear Acceso Manual</h2>
            <p className="text-sm text-gray-600">Concede acceso a un usuario nuevo por email al programa seleccionado arriba</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="email">{t('email')}</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="usuario@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="role">{t('role')}</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
              className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
                busy || !selectedProgramId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transform hover:scale-105'
              }`}
            >
              {busy ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('processing')}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <MdAdd size={18} />
                  <span>Crear Acceso</span>
                </div>
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            💡 <strong>Nota:</strong> Este formulario es solo para crear acceso a usuarios nuevos. 
            Para modificar usuarios existentes, usa la tabla de abajo.
          </p>
        </div>
      </form>

      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {showAllUsers ? '👥 Gestión de Usuarios' : `👥 ${t('members_title')}`}
              </h2>
              <p className="text-sm text-gray-600">
                {showAllUsers 
                  ? 'Edita roles, programas y estado de todos los usuarios registrados' 
                  : 'Miembros actuales del programa seleccionado'
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAllUsers(!showAllUsers)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  showAllUsers 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 shadow-md'
                }`}
              >
                <MdPeople className="inline mr-2" size={16} />
                {showAllUsers ? 'Ver Solo Miembros' : 'Gestionar Todos'}
              </button>
            </div>
          </div>
          <button
            onClick={showAllUsers ? loadAllUsers : loadMembers}
            disabled={!selectedProgramId || busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
          >
            <MdRefresh size={16} className={busy ? 'animate-spin' : ''} /> 
            {t('refresh')}
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
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-700 uppercase">
                    <th className="px-3 py-2 border border-gray-200 text-left">Nombre</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Email</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Rol</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Organización</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Sede/Programa</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Estado</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Registrado</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">Acciones</th>
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
                          <div className="flex items-center space-x-2">
                            <select
                              value={user.role}
                              onChange={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                updateUserRole(user.user_id, e.target.value as any);
                              }}
                              className="text-sm border-2 border-blue-300 rounded-lg px-3 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              disabled={busy}
                            >
                              <option value="admin">Admin</option>
                              <option value="staff">Staff</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingUser(null);
                              }}
                              className="p-1 text-gray-500 hover:text-gray-700"
                              title="Cancelar edición"
                            >
                              <MdCancel size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                            ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : user.role === 'staff' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}
                          >
                            {user.role === 'admin' ? 'Admin' : user.role === 'staff' ? 'Staff' : 'Viewer'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {user.organizationName || 'CMI Orchestra'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        {editingUserProgram?.id === user.id ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={user.programs?.[0]?.id || ''}
                              onChange={(e) => updateUserProgram(user.user_id, e.target.value)}
                              className="text-sm border-2 border-blue-300 rounded-lg px-3 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              disabled={busy}
                            >
                              <option value="">Sin programa</option>
                              {programs.map((program) => (
                                <option key={program.id} value={program.id}>
                                  {program.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setEditingUserProgram(null)}
                              className="p-1 text-gray-500 hover:text-gray-700"
                              title="Cancelar edición"
                            >
                              <MdCancel size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">
                              {user.programs && user.programs.length > 0 
                                ? user.programs.map(p => p.name).join(', ')
                                : 'Sin programa'
                              }
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingUserProgram(user);
                              }}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Cambiar programa"
                            >
                              <MdEdit size={14} />
                            </button>
                          </div>
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
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingUser(editingUser?.id === user.id ? null : user);
                              }}
                              disabled={busy}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar rol"
                            >
                              <MdEdit size={16} />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                              disabled={busy}
                              className={`p-2 rounded-lg transition-colors ${
                                user.is_active 
                                  ? 'text-orange-600 hover:bg-orange-50' 
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                            >
                              {user.is_active ? '⏸️' : '▶️'}
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user)}
                              disabled={busy}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              title="Eliminar usuario completamente"
                            >
                              <MdPersonRemove size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <MdPeople size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-2">{t('no_members')}</p>
            <p className="text-sm text-gray-500">Usa el formulario de arriba para crear acceso manual o cambia a "Gestionar Todos" para ver todos los usuarios.</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                ⚠️ <strong>Vista de Solo Lectura:</strong> Esta tabla muestra solo los miembros del programa seleccionado. 
                Para editar usuarios, cambia a "Gestionar Todos".
              </p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-700 uppercase">
                    <th className="px-3 py-2 border border-gray-200 text-left">{t('email')}</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">{t('role')}</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">{t('member_since')}</th>
                    <th className="px-3 py-2 border border-gray-200 text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, idx) => (
                    <tr key={idx} className="text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">{member.email}</td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 
                          member.role === 'staff' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.role === 'admin' ? 'Admin' : member.role === 'staff' ? 'Staff' : 'Viewer'}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-800">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <button
                          onClick={() => handleRevoke(member.email)}
                          disabled={busy}
                          className="px-3 py-1 rounded-lg text-xs bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium"
                          title="Revocar acceso de este programa"
                        >
                          {t('revoke')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <MdWarning size={32} className="text-red-500" />
              <h3 className="text-xl font-bold text-gray-800">Confirmar Eliminación</h3>
            </div>
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                ¿Estás seguro de que deseas eliminar completamente al usuario <strong>{deletingUser.email}</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-semibold mb-2">⚠️ Esta acción:</p>
                <ul className="text-sm text-red-600 space-y-1">
                  <li>• Eliminará todos los registros de asistencia</li>
                  <li>• Eliminará todas las membresías de programas</li>
                  <li>• Eliminará el perfil de usuario</li>
                  <li>• Eliminará la cuenta de autenticación</li>
                  <li>• <strong>NO se puede deshacer</strong></li>
                  <li>• El usuario podrá registrarse nuevamente con el mismo email</li>
                </ul>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={cancelDelete}
                disabled={busy}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteUserCompletely(deletingUser)}
                disabled={busy}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-red-300"
              >
                {busy ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Eliminando...</span>
                  </div>
                ) : (
                  'Eliminar Completamente'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
