"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from '@/lib/supabase';
import { useI18n } from "@/contexts/I18nContext";
import { useProgram } from "@/contexts/ProgramContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { MdAdd, MdEdit, MdDelete, MdWarning, MdRefresh, MdToggleOn, MdToggleOff, MdClose, MdCancel, MdSave } from 'react-icons/md';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  programs?: { id: string; name: string; role: string }[];
  organizationName?: string;
};

export default function AdminUsersPage() {
  const { t } = useI18n();
  const router = useRouter();
  // Esta pantalla no tenía NINGÚN candado de rol a nivel de página (a
  // diferencia de Inventario, donde sí se agregó) — cualquier usuario con
  // sesión iniciada podía entrar por URL directa y ver/gestionar usuarios,
  // aunque el RLS del lado de la base de datos bloqueara las escrituras
  // reales. Mismo patrón ya usado en inventory/assets/new/page.tsx.
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const { programs, refreshPrograms, loading: programsLoading } = useProgram();
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'staff' | 'viewer'>('staff');
  const [fullName, setFullName] = useState('');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
  }, [refreshPrograms]);

  // Auto-select first program when available
  useEffect(() => {
    if (!selectedProgramId && programs?.length) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [roleLoading, isAdmin, router]);

  const loadMembers = async () => {
    if (!selectedProgramId) return;
    setBusy(true);
    setError(null);
    
    try {
      // Get memberships first
      const { data: memberships, error: membershipsError } = await supabase
        .from('user_program_memberships')
        .select('user_id, role, created_at')
        .eq('program_id', selectedProgramId);
      
      if (membershipsError) {
        console.error('Memberships query error:', membershipsError);
        throw membershipsError;
      }
      
      if (!memberships || memberships.length === 0) {
        setMembers([]);
        return;
      }
      
      // Get user profiles separately
      const userIds = memberships.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      
      if (profilesError) {
        console.error('Profiles query error:', profilesError);
        throw profilesError;
      }
      
      // Combine data
      const transformedData = memberships.map((membership: any) => {
        const profile = profiles?.find(p => p.user_id === membership.user_id);
        return {
          user_id: membership.user_id,
          email: profile?.email || 'Unknown',
          full_name: profile?.full_name || 'Unknown',
          role: membership.role,
          created_at: membership.created_at || new Date().toISOString()
        };
      });
      
      setMembers(transformedData);
      
    } catch (e: any) {
      console.error('AdminUsers: loadMembers error', e);
      setError(e?.message || e?.hint || e?.details || 'Error loading members');
    } finally {
      setBusy(false);
    }
  };

  const loadAllUsers = async () => {
    if (!selectedProgram) return;
    
    setBusy(true);
    setError(null);
    
    try {
      
      // Get users and their memberships in parallel
      const [usersResult, membershipsResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('organization_id', selectedProgram.organization_id),
        supabase
          .from('user_program_memberships')
          .select(`
            user_id,
            program_id,
            role,
            programs (
              id,
              name
            )
          `)
      ]);
      
      if (usersResult.error) throw usersResult.error;
      if (membershipsResult.error) throw membershipsResult.error;
      
      
      const validUsers = (usersResult.data || []).filter(user => user?.user_id && user?.email);
      
      const usersWithPrograms = validUsers.map((user: UserProfile) => {
        const userMemberships = (membershipsResult.data || []).filter(
          (membership: any) => membership.user_id === user.user_id
        );
        
        const userPrograms = userMemberships.map((membership: any) => ({
          id: membership.program_id,
          name: membership.programs?.name || 'Unknown Program',
          role: membership.role
        }));
        
        return {
          ...user,
          programs: userPrograms,
          organizationName: 'CMI Orchestra'
        };
      });
      
      // Sort users alphabetically by full_name
      const sortedUsers = usersWithPrograms.sort((a, b) => {
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setAllUsers(sortedUsers);
      
    } catch (e: any) {
      console.error('Error in loadAllUsers:', e);
      setError(e?.message || 'Error cargando usuarios');
    } finally {
      setBusy(false);
    }
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      setSuccess(null);
      setBusy(true);

      if (!email || !selectedOrganizationId || selectedProgramIds.length === 0) {
        setError('Por favor complete todos los campos requeridos');
        return;
      }

      let userId: string | null = null;
      let isNewUser = false;

      // Check if user already exists in user_profiles
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (existingProfile) {
        // Update existing user
        userId = existingProfile.user_id;
        
        await supabase
          .from('user_profiles')
          .update({
            organization_id: selectedOrganizationId,
            role: role,
            full_name: fullName || existingProfile.full_name || email.split('@')[0]
          })
          .eq('user_id', userId);
      } else {
        // Crear usuario nuevo vía invitación por correo (server-side, la
        // única forma de usar auth.admin.* — ver comentario en
        // /api/admin/users/invite-user/route.ts sobre por qué ya no se usa
        // signUp() con una contraseña fija "123456").
        isNewUser = true;

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/users/invite-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
          },
          body: JSON.stringify({
            email,
            full_name: fullName || email.split('@')[0],
            organization_id: selectedOrganizationId,
            role,
            program_id: selectedProgramIds[0],
          }),
        });
        const inviteResult = await res.json();
        if (!res.ok) {
          throw new Error(inviteResult?.error || 'No se pudo invitar al usuario');
        }
        userId = inviteResult.user_id;

        // Create user profile
        if (userId) {
          await supabase
            .from('user_profiles')
            .insert({
              user_id: userId,
              email: email,
              full_name: fullName || email.split('@')[0],
              organization_id: selectedOrganizationId,
              role: role,
              is_active: true
            });
        }
      }

      if (userId) {
        // Replace existing memberships
        await supabase
          .from('user_program_memberships')
          .delete()
          .eq('user_id', userId);

        // Create new memberships in batch
        const memberships = selectedProgramIds.map(programId => ({
          user_id: userId,
          program_id: programId,
          role: role
        }));

        const { error: membershipError } = await supabase
          .from('user_program_memberships')
          .insert(memberships);

        if (membershipError) {
          throw membershipError;
        }

        const successMessage = isNewUser
          ? `Usuario invitado exitosamente. Le llegará un correo a ${email} para que cree su propia contraseña.`
          : `Usuario actualizado exitosamente. Los programas y rol han sido actualizados.`;
        setSuccess(successMessage);
        
        // Reset form and close modal
        setEmail('');
        setFullName('');
        setRole('viewer');
        setSelectedProgramIds([]);
        setSelectedOrganizationId('');
        setShowCreateModal(false);
        
        await loadAllUsers();
      } else {
        setError('No se pudo obtener el ID del usuario');
      }
      
    } catch (e: any) {
      setError(`Error: ${e?.message || 'Error desconocido'}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteUserCompletely = async (user: UserProfile) => {
    setBusy(true);
    setError(null);
    
    try {
      console.log("AdminUsers: Starting complete user deletion for", user.email);
      
      // Note: We don't delete students, attendance, or student_parents records
      // because students are shared resources that may be managed by multiple users
      // Only delete records directly tied to this specific user account

      // Delete user program memberships first (foreign key dependencies)
      const { data: deletedMemberships, error: membershipsError } = await supabase
        .from('user_program_memberships')
        .delete()
        .eq('user_id', user.user_id)
        .select();
      
      if (membershipsError) {
        console.error("AdminUsers: memberships deletion failed", membershipsError);
        throw new Error(`Failed to delete user memberships: ${membershipsError.message}`);
      } else {
        console.log(`AdminUsers: ${deletedMemberships?.length || 0} memberships deleted successfully`);
      }

      // Delete user profile and verify deletion
      const { data: deletedProfile, error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', user.user_id)
        .select();
      
      if (profileError || !deletedProfile || deletedProfile.length === 0) {
        console.error("AdminUsers: profile deletion failed", { profileError, deletedProfile });
        throw new Error(`Failed to delete user profile: ${profileError?.message || 'No profile deleted'}`);
      }
      
      console.log("AdminUsers: user profile deleted successfully", deletedProfile);

      // Borrar la cuenta de Supabase Auth vía la ruta de servidor (la
      // service role key no puede vivir en el navegador — ver comentario
      // en /api/admin/users/delete-auth-user/route.ts). Antes esto llamaba
      // getSupabaseAdmin() directo desde este componente "use client" y
      // fallaba en silencio: el perfil se borraba pero la cuenta de Auth
      // quedaba viva para siempre.
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/users/delete-auth-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
          },
          body: JSON.stringify({ user_id: user.user_id }),
        });
        const result = await res.json();
        if (!res.ok) {
          console.warn("AdminUsers: Could not delete from auth:", result?.error);
        } else {
          console.log("AdminUsers: user deleted from auth successfully");
        }
      } catch (authErr: any) {
        console.error("AdminUsers: Auth deletion failed:", authErr);
      }

      // Refresh the user list
      await loadAllUsers();
      setShowDeleteConfirm(false);
      setDeletingUser(null);
      
      console.log("AdminUsers: Complete user deletion finished successfully");
    } catch (e: any) {
      console.error("AdminUsers: deleteUserCompletely error", e);
      setError(e?.message || 'Error eliminando usuario');
    } finally {
      setBusy(false);
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    setBusy(true);
    setError(null);
    
    try {
      const newStatus = !user.is_active;
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: newStatus })
        .eq('user_id', user.user_id);

      if (error) {
        console.error("AdminUsers: toggleUserStatus error", error);
        throw error;
      }

      // Update the user in the local state
      setAllUsers(prevUsers => 
        prevUsers.map(u => 
          u.user_id === user.user_id 
            ? { ...u, is_active: newStatus }
            : u
        )
      );

      console.log(`AdminUsers: User ${user.email} status changed to ${newStatus ? 'active' : 'inactive'}`);
    } catch (e: any) {
      console.error("AdminUsers: toggleUserStatus error", e);
      setError(e?.message || 'Error cambiando estado del usuario');
    } finally {
      setBusy(false);
    }
  };

  const updateUserRole = async (user: UserProfile, newRole: string) => {
    setBusy(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('user_id', user.user_id);
      
      if (error) throw error;
      
      // Update local state
      setAllUsers(prev => prev.map(u => 
        u.user_id === user.user_id ? { ...u, role: newRole as any } : u
      ));
      
    } catch (e: any) {
      console.error('AdminUsers: updateUserRole error', e);
      setError(e?.message || 'Error actualizando rol del usuario');
      // Reload on error
      await loadAllUsers();
    } finally {
      setBusy(false);
    }
  };

  const handleProgramToggle = (program: Program, isChecked: boolean) => {
    if (!editingUser) return;
    
    let updatedPrograms = [...(editingUser.programs || [])];
    
    if (isChecked) {
      // Add program if not already present
      if (!updatedPrograms.some(p => p.id === program.id)) {
        updatedPrograms.push({
          id: program.id,
          name: program.name,
          role: editingUser.role // Use user's current role
        });
      }
    } else {
      // Remove program
      updatedPrograms = updatedPrograms.filter(p => p.id !== program.id);
    }
    
    setEditingUser({
      ...editingUser,
      programs: updatedPrograms
    });
  };

  const handleUpdateUser = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingUser) return;
    
    setBusy(true);
    setError(null);
    
    try {
      // Update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: editingUser.full_name,
          email: editingUser.email,
          role: editingUser.role
        })
        .eq('user_id', editingUser.user_id);
      
      if (profileError) throw profileError;
      
      // Get current memberships
      const { data: currentMemberships, error: membershipsFetchError } = await supabase
        .from('user_program_memberships')
        .select('program_id')
        .eq('user_id', editingUser.user_id);
      
      if (membershipsFetchError) throw membershipsFetchError;
      
      const currentProgramIds = currentMemberships?.map(m => m.program_id) || [];
      const newProgramIds = editingUser.programs?.map(p => p.id) || [];
      
      // Programs to add
      const programsToAdd = newProgramIds.filter(id => !currentProgramIds.includes(id));
      
      // Programs to remove
      const programsToRemove = currentProgramIds.filter(id => !newProgramIds.includes(id));
      
      // Add new memberships
      if (programsToAdd.length > 0) {
        const newMemberships = programsToAdd.map(programId => ({
          user_id: editingUser.user_id,
          program_id: programId,
          role: editingUser.role
        }));
        
        const { error: insertError } = await supabase
          .from('user_program_memberships')
          .insert(newMemberships);
        
        if (insertError) throw insertError;
      }
      
      // Remove old memberships
      if (programsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_program_memberships')
          .delete()
          .eq('user_id', editingUser.user_id)
          .in('program_id', programsToRemove);
        
        if (deleteError) throw deleteError;
      }
      
      // Update role in existing memberships
      const { error: updateRoleError } = await supabase
        .from('user_program_memberships')
        .update({ role: editingUser.role })
        .eq('user_id', editingUser.user_id);
      
      if (updateRoleError) throw updateRoleError;
      
      // Reload users to reflect changes
      await loadAllUsers();
      setEditingUser(null);
      
    } catch (e: any) {
      console.error('AdminUsers: handleUpdateUser error', e);
      setError(e?.message || 'Error actualizando usuario');
    } finally {
      setBusy(false);
    }
  };

  // Load data when dependencies change
  useEffect(() => {
    if (programs.length > 0) {
      loadAllUsers();
    }
    loadOrganizations(); // Load organizations independently
  }, [programs]);

  // Also load organizations on component mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      console.log('Loading organizations...');
      
      // Check current user and session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Current user:', user?.id, user?.email);
      
      // Try to get organizations with RLS bypass using service role
      console.log('Attempting to load organizations...');
      
      // First try with active filter
      const { data: activeOrgs, error: activeError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      console.log('Active organizations query:', { data: activeOrgs, error: activeError });
      
      // If that fails, try without the active filter
      if (activeError || !activeOrgs || activeOrgs.length === 0) {
        console.log('Trying without is_active filter...');
        const { data: allOrgs, error: allError } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');
        
        console.log('All organizations query:', { data: allOrgs, error: allError });
        
        if (allError) {
          console.error('Organizations query failed:', allError);
          // If we can't read organizations, provide a hardcoded fallback
          console.log('Using hardcoded organization fallback...');
          const hardcodedOrgs = [
            { id: 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4', name: 'CMI Orchestra' }
          ];
          setOrganizations(hardcodedOrgs);
          return;
        }
        
        if (allOrgs && allOrgs.length > 0) {
          console.log('Organizations loaded successfully:', allOrgs);
          setOrganizations(allOrgs);
          return;
        }
      } else if (activeOrgs && activeOrgs.length > 0) {
        console.log('Active organizations loaded successfully:', activeOrgs);
        setOrganizations(activeOrgs);
        return;
      }
      
      // If no organizations found, use hardcoded fallback
      console.warn('No organizations found in database, using hardcoded fallback');
      const fallbackOrgs = [
        { id: 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4', name: 'CMI Orchestra' }
      ];
      setOrganizations(fallbackOrgs);
      
    } catch (e: any) {
      console.error('Error loading organizations:', e);
      // Provide hardcoded fallback as last resort
      console.log('Using emergency hardcoded fallback...');
      const emergencyOrgs = [
        { id: 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4', name: 'CMI Orchestra' }
      ];
      setOrganizations(emergencyOrgs);
    }
  };


  if (loading || programsLoading || roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF7F2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#EAE3D6] border-t-[#C2492B] mx-auto mb-4"></div>
          <p className="text-[#8A8177] text-sm">Cargando programas...</p>
        </div>
      </div>
    );
  }

  if (!programs?.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF7F2]">
        <div className="text-center">
          <MdWarning size={40} className="text-[#8A6A22] mx-auto mb-4" />
          <h2 className="text-lg font-medium text-[#1B1917] mb-2">{t('no_programs_available')}</h2>
          <p className="text-[#8A8177] text-sm">{t('contact_admin_programs')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-7 bg-[#FAF7F2]">
    <div className="max-w-[1420px] mx-auto">
      {/* Header — mismo patrón que el resto de la app (Students, Inventario):
          h1 en Newsreader + subtítulo, botón principal terracota a la derecha. */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-end gap-4 pb-5 border-b border-[#E3DDD1]">
        <div>
          <h1
            className="text-[28px] sm:text-[40px] text-[#1B1917] leading-[1.05]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            {t('admin_users_title')}
          </h1>
          <p className="text-[13px] sm:text-[14px] text-[#8A8177] mt-1.5">{t('admin_users_subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            if (organizations.length === 0) {
              loadOrganizations();
            }
          }}
          className="flex items-center justify-center gap-2 bg-[#C2492B] text-[#FAF7F2] rounded-lg px-[18px] py-2.5 font-medium hover:bg-[#A83A20] transition-colors whitespace-nowrap"
        >
          <MdAdd size={18} />
          {t('add_new_user')}
        </button>
      </div>

      {error && (
        <div className="mt-5 bg-[#F8E9E4] border border-[#EAC7BB] rounded-xl p-4 flex items-start gap-3">
          <MdWarning className="text-[#8f3421] shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-[#8f3421]">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-5 bg-[#EDF1E9] border border-[#CFDCC7] rounded-xl p-4 flex items-start gap-3">
          <MdSave className="text-[#4F6748] shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-[#4F6748]">{success}</p>
        </div>
      )}

      {/* Tabla de usuarios — mismo patrón CSS-grid en filas que el resto de
          listas del módulo (Import/Inventario), fiel al mockup del panel
          de Admin: tarjeta clara con encabezado eyebrow y filas separadas
          por líneas finas, sin "cebra" ni sombras internas. */}
      <div className="mt-6 bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-[#EAE3D6] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15.5px] font-medium text-[#1B1917]">{t('registered_users')}</h2>
            <p className="text-[#8A8177] text-[13px] mt-0.5">{t('manage_all_users')} · {allUsers.length} {t('users_count')}</p>
          </div>
          <button
            onClick={() => loadAllUsers()}
            disabled={busy}
            className="p-2 text-[#8A8177] hover:text-[#C2492B] rounded-lg disabled:opacity-50 transition-colors"
          >
            <MdRefresh size={17} className={busy ? 'animate-spin' : ''} />
          </button>
        </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1120px]">
              {/* Encabezado — mismo estilo eyebrow (uppercase, tracking amplio,
                  color muted) que el resto de encabezados de sección de la app. */}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_70px_minmax(0,1.1fr)_90px_90px_90px_110px] gap-[14px] px-5 sm:px-6 py-3 border-b border-[#EFE9DD] text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">
                <span>{t('name_column')}</span>
                <span>{t('email_column')}</span>
                <span>{t('organization_column')}</span>
                <span>{t('program_site_column')}</span>
                <span>{t('role_column')}</span>
                <span>{t('status_column')}</span>
                <span className="text-right">{t('registration_date_column')}</span>
                <span className="text-right">{t('actions_column')}</span>
              </div>

              {allUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_70px_minmax(0,1.1fr)_90px_90px_90px_110px] gap-[14px] px-5 sm:px-6 py-3.5 border-b border-[#F2ECE1] text-[13.5px] items-center hover:bg-[#FBF9F5] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-[26px] h-[26px] rounded-full bg-[#EFE9DD] flex items-center justify-center text-[11.5px] text-[#6E675E] shrink-0">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                    <span className="text-[#1B1917] font-medium truncate">{user.full_name}</span>
                  </div>
                  <div className="text-[#56504A] truncate">{user.email}</div>
                  <div className="text-[#8A8177]">CMI</div>
                  <div className="text-[#56504A] truncate">
                    {user.programs?.length ? (
                      <>
                        {user.programs.slice(0, 3).map(p => p.name).join(' · ')}
                        {user.programs.length > 3 && (
                          <span className="text-[#A29889]"> +{user.programs.length - 3}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[#A29889] italic">{t('no_program')}</span>
                    )}
                  </div>
                  {/* Mismos colores por rol que el RoleSwitcher (Admin/Staff/Viewer)
                      usado en Inventario y el resto de la app — antes esta tabla
                      usaba morado para Admin y azul para Staff, un esquema distinto. */}
                  <div
                    className={
                      user.role === 'admin' ? 'text-[#C2492B]' :
                      user.role === 'staff' ? 'text-[#56504A]' :
                      'text-[#8A8177]'
                    }
                  >
                    {user.role === 'admin' ? t('admin_role') : user.role === 'staff' ? t('staff_role') : t('viewer_role_short')}
                  </div>
                  <div className={user.is_active ? 'text-[#5F7A57]' : 'text-[#A8402A]'}>
                    {user.is_active ? t('active_status') : t('inactive_status')}
                  </div>
                  <div className="text-right text-[#8A8177]">
                    {new Date(user.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short'
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                      }}
                      className="p-1.5 text-[#A29889] hover:text-[#C2492B] rounded transition-colors"
                      title={t('edit_tooltip')}
                    >
                      <MdEdit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingUser(user);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-1.5 text-[#A29889] hover:text-[#A8402A] rounded transition-colors"
                      title={t('delete_tooltip')}
                    >
                      <MdDelete size={16} />
                    </button>
                    <button
                      onClick={() => toggleUserStatus(user)}
                      className={`p-1.5 rounded transition-colors ${
                        user.is_active
                          ? 'text-[#A29889] hover:text-[#8A6A22]'
                          : 'text-[#A29889] hover:text-[#5F7A57]'
                      }`}
                      title={user.is_active ? t('deactivate_user') : t('activate_user')}
                    >
                      {user.is_active ? <MdToggleOff size={16} /> : <MdToggleOn size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#FAF7F2] rounded-2xl shadow-xl max-w-lg w-full border border-[#E3DDD1] max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-6 pt-[26px] pb-[22px]">
                <div>
                  <h3
                    className="text-2xl text-[#1B1917]"
                    style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                  >
                    {t('create_new_user')}
                  </h3>
                  <p className="text-sm text-[#8A8177] mt-1">{t('grant_system_access')}</p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEmail('');
                    setRole('staff');
                    setFullName('');
                    setSelectedOrganizationId('');
                    setSelectedProgramIds([]);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#DED7C9] text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors shrink-0"
                >
                  <MdClose size={18} />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                handleGrant(e);
              }} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('user_full_name')}</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                      placeholder={t('user_full_name_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('user_email_address')}</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                      placeholder={t('user_email_placeholder')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('select_organization_label')}</label>
                    <select
                      value={selectedOrganizationId}
                      onChange={(e) => setSelectedOrganizationId(e.target.value)}
                      className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                      required
                    >
                      <option value="">{t('select_organization_placeholder')}</option>
                      {organizations.length === 0 ? (
                        <option disabled>{t('loading_organizations_text')}</option>
                      ) : (
                        organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('select_user_role')}</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                    >
                      <option value="admin">{t('admin_role')} - {t('admin_role_desc')}</option>
                      <option value="staff">{t('staff_role')} - {t('staff_role_desc')}</option>
                      <option value="viewer">{t('viewer_role_short')} - {t('viewer_role_desc')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('select_programs_label')}</label>
                  <p className="text-xs text-[#8A8177] mb-2">{t('select_programs_help')}</p>
                  <div className="border border-[#E3DDD1] rounded-[9px] p-3 max-h-32 overflow-y-auto bg-[#FFFDFA]">
                    {programs
                      .filter(program => !selectedOrganizationId || program.organization_id === selectedOrganizationId)
                      .map((program) => (
                      <label key={program.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProgramIds.includes(program.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProgramIds([...selectedProgramIds, program.id]);
                            } else {
                              setSelectedProgramIds(selectedProgramIds.filter(id => id !== program.id));
                            }
                          }}
                          className="rounded border-[#DED7C9] text-[#C2492B] focus:ring-[#C2492B]"
                        />
                        <span className="text-sm text-[#1B1917]">{program.name}</span>
                      </label>
                    ))}
                    {programs.filter(program => !selectedOrganizationId || program.organization_id === selectedOrganizationId).length === 0 && (
                      <p className="text-sm text-[#8A8177] py-2">
                        {selectedOrganizationId ? t('no_programs_organization') : t('select_organization_placeholder')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEmail('');
                      setRole('staff');
                      setFullName('');
                      setSelectedOrganizationId('');
                      setSelectedProgramIds([]);
                    }}
                    className="px-4 py-2.5 text-[#56504A] border border-[#DED7C9] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-6 py-2.5 bg-[#C2492B] text-[#FAF7F2] rounded-lg font-medium hover:bg-[#A83A20] disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <MdAdd size={16} />
                    <span>{busy ? t('creating_user') : t('create_user_button')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#FAF7F2] rounded-2xl shadow-xl max-w-md w-full border border-[#E3DDD1] p-6">
              <div className="flex items-center gap-3 mb-4">
                <MdWarning className="text-[#8f3421]" size={24} />
                <h3
                  className="text-xl text-[#1B1917]"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {t('confirm_deletion')}
                </h3>
              </div>
              <div
                className="text-[#56504A] text-sm mb-6"
                dangerouslySetInnerHTML={{
                  // El email se escapa antes de interpolarse en el string de
                  // traducción (que trae <strong> literal para resaltarlo) —
                  // t() hace un replace() simple sin escapar, así que sin esto
                  // un email con caracteres HTML se ejecutaría en el navegador
                  // del Admin que abre este modal.
                  __html: t('delete_user_confirmation', { email: escapeHtml(deletingUser.email) }),
                }}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingUser(null);
                  }}
                  className="px-4 py-2.5 text-[#56504A] border border-[#DED7C9] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => deleteUserCompletely(deletingUser)}
                  disabled={busy}
                  className="px-4 py-2.5 bg-[#A8402A] text-white rounded-lg font-medium hover:bg-[#8f3421] disabled:opacity-50 transition-colors"
                >
                  {busy ? t('deleting') : t('delete_user_button')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#FAF7F2] rounded-2xl shadow-xl max-w-lg w-full border border-[#E3DDD1] max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-6 pt-[26px] pb-[22px]">
                <div>
                  <h3
                    className="text-2xl text-[#1B1917]"
                    style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                  >
                    {t('edit_user')}
                  </h3>
                  <p className="text-sm text-[#8A8177] mt-1">{t('update_user_info_permissions')}</p>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#DED7C9] text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors shrink-0"
                >
                  <MdCancel size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="px-6 py-5 space-y-5">
                {/* Información Personal */}
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177] pb-2.5 border-b border-[#E3DDD1] mb-4">
                    {t('personal_info_section')}
                  </p>
                  <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                      <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('full_name_label')}</label>
                      <input
                        type="text"
                        required
                        value={editingUser.full_name || ''}
                        onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                        className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                        placeholder={t('full_name_placeholder')}
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('email_address_label')}</label>
                      <input
                        type="email"
                        required
                        value={editingUser.email || ''}
                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                        className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                        placeholder={t('email_placeholder_user')}
                      />
                    </div>
                  </div>
                </div>

                {/* Permisos y Acceso */}
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177] pb-2.5 border-b border-[#E3DDD1] mb-4">
                    {t('permissions_access_section')}
                  </p>

                  {/* Rol */}
                  <div className="mb-4">
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('user_role_label')}</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                      className="w-full appearance-none px-[14px] py-3 rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] transition-colors"
                    >
                      <option value="admin">{t('administrator')}</option>
                      <option value="staff">{t('staff_member')}</option>
                      <option value="viewer">{t('viewer_role')}</option>
                    </select>
                  </div>

                  {/* Sedes/Programas */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('assigned_sites_programs')}</label>
                    <p className="text-xs text-[#8A8177] mb-3 bg-[#F4F0E8] rounded-md p-2 border border-[#E7E0D2]">
                      {t('sites_selection_help')}
                    </p>
                    <div className="bg-[#FFFDFA] rounded-[9px] border border-[#E3DDD1] p-3 max-h-32 overflow-y-auto">
                      <div className="space-y-2">
                        {programs.map((program) => {
                          const isAssigned = editingUser.programs?.some(p => p.id === program.id);
                          return (
                            <label key={program.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-[#F4F0E8] transition-colors">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => handleProgramToggle({...program, organization_id: program.organization_id || ''}, e.target.checked)}
                                className="w-4 h-4 text-[#C2492B] border-[#DED7C9] rounded focus:ring-[#C2492B]"
                              />
                              <span className="text-sm text-[#1B1917]">{program.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[#E3DDD1]">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2.5 text-[#56504A] border border-[#DED7C9] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors text-sm font-medium"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-6 py-2.5 bg-[#C2492B] text-[#FAF7F2] rounded-lg hover:bg-[#A83A20] disabled:opacity-50 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    {busy ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                        <span>{t('saving_changes')}</span>
                      </>
                    ) : (
                      <>
                        <MdSave size={16} />
                        <span>{t('save_changes')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
