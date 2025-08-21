"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { useI18n } from "@/contexts/I18nContext";
import { useProgram } from "@/contexts/ProgramContext";
import { MdAdd, MdEdit, MdDelete, MdWarning, MdRefresh, MdToggleOn, MdToggleOff, MdClose, MdPeople, MdCancel, MdSave } from 'react-icons/md';

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
        // Create new user
        isNewUser = true;
        const { data: currentSession } = await supabase.auth.getSession();
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: '123456',
          options: {
            emailRedirectTo: undefined,
            data: {
              organization_id: selectedOrganizationId,
              program_id: selectedProgramIds[0],
              role: role,
              full_name: fullName || email.split('@')[0]
            }
          }
        });

        // Restore admin session
        if (currentSession?.session && authData.user && !authError) {
          await supabase.auth.setSession(currentSession.session);
        }

        if (authError?.message.includes('User already registered')) {
          // Handle existing auth user without profile
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const existingAuthUser = authUsers?.users?.find(u => u.email === email);
          if (existingAuthUser) {
            userId = existingAuthUser.id;
          }
        } else if (!authError && authData.user) {
          userId = authData.user.id;
        } else if (authError) {
          throw authError;
        }

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
          ? `Usuario creado exitosamente. Password temporal: 123456`
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

      // Try to delete from Supabase Auth using service role (optional)
      try {
        const supabaseAdmin = getSupabaseAdmin();
        if (supabaseAdmin) {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.user_id);
          if (authError) {
            console.warn("AdminUsers: Could not delete from auth:", authError);
          } else {
            console.log("AdminUsers: user deleted from auth successfully");
          }
        } else {
          console.warn("AdminUsers: No admin client available - user not deleted from auth");
        }
      } catch (authErr: any) {
        // Don't throw error if service role key is missing - this is expected in many setups
        if (authErr?.message?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          console.warn("AdminUsers: Service role key not configured - user must be deleted manually from Supabase Auth panel");
        } else {
          console.error("AdminUsers: Auth deletion failed:", authErr);
        }
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


  if (loading || programsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando programas...</p>
        </div>
      </div>
    );
  }

  if (!programs?.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <MdWarning size={48} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('no_programs_available')}</h2>
          <p className="text-gray-600">{t('contact_admin_programs')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Monday.com Style Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <MdPeople size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">{t('admin_users_title')}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{t('admin_users_subtitle')}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <MdWarning className="text-red-500 mr-2" size={16} />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <MdSave className="text-green-500 mr-2" size={16} />
              <p className="text-sm text-green-600">{success}</p>
            </div>
          </div>
        )}

        {/* Monday.com Style Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowCreateModal(true);
              if (organizations.length === 0) {
                loadOrganizations();
              }
            }}
            className="inline-flex items-center space-x-3 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 shadow-sm"
          >
            <MdAdd size={18} className="text-white" />
            <span className="font-medium">{t('add_new_user')}</span>
          </button>
        </div>

        {/* Monday.com Style Table Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <MdPeople size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{t('registered_users')}</h2>
                  <p className="text-gray-500 text-sm">{t('manage_all_users')} • {allUsers.length} {t('users_count')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => loadAllUsers()}
                  disabled={busy}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50 transition-colors"
                >
                  <MdRefresh size={16} className={busy ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-52">{t('name_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-60">{t('email_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-28">{t('organization_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-56">{t('program_site_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-20">{t('role_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-20">{t('status_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-24">{t('registration_date_column')}</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-28">{t('actions_column')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {allUsers.map((user, index) => (
                  <tr key={user.user_id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xs">
                          {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="text-sm font-medium text-gray-900 truncate max-w-36">{user.full_name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 truncate max-w-52">{user.email}</div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        CMI
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      {user.programs?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {user.programs.slice(0, 3).map((program) => (
                            <span key={program.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {program.name.length > 12 ? program.name.substring(0, 12) + '...' : program.name}
                            </span>
                          ))}
                          {user.programs.length > 3 && (
                            <span className="text-xs text-gray-500">+{user.programs.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">{t('no_program')}</span>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'staff' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role === 'admin' ? t('admin_role') : user.role === 'staff' ? t('staff_role') : t('viewer_role_short')}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.is_active ? t('active_status') : t('inactive_status')}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <div className="text-xs text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('es-ES', { 
                          day: '2-digit',
                          month: 'short'
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                          }}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-150"
                          title={t('edit_tooltip')}
                        >
                          <MdEdit size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingUser(user);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-150"
                          title={t('delete_tooltip')}
                        >
                          <MdDelete size={16} />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user)}
                          className={`p-2 rounded transition-colors duration-150 ${
                            user.is_active 
                              ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50' 
                              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={user.is_active ? t('deactivate_user') : t('activate_user')}
                        >
                          {user.is_active ? <MdToggleOff size={16} /> : <MdToggleOn size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MdAdd className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t('create_new_user')}</h3>
                    <p className="text-sm text-gray-600">{t('grant_system_access')}</p>
                  </div>
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
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <MdClose size={20} />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleGrant(e);
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('user_full_name')}</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder={t('user_full_name_placeholder')}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('user_email_address')}</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder={t('user_email_placeholder')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_organization_label')}</label>
                    <select
                      value={selectedOrganizationId}
                      onChange={(e) => setSelectedOrganizationId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_user_role')}</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="admin">{t('admin_role')} - {t('admin_role_desc')}</option>
                      <option value="staff">{t('staff_role')} - {t('staff_role_desc')}</option>
                      <option value="viewer">{t('viewer_role_short')} - {t('viewer_role_desc')}</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('select_programs_label')}</label>
                  <p className="text-xs text-gray-500 mb-2">{t('select_programs_help')}</p>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto bg-white">
                    {programs
                      .filter(program => !selectedOrganizationId || program.organization_id === selectedOrganizationId)
                      .map((program) => (
                      <label key={program.id} className="flex items-center space-x-2 py-1">
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
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{program.name}</span>
                      </label>
                    ))}
                    {programs.filter(program => !selectedOrganizationId || program.organization_id === selectedOrganizationId).length === 0 && (
                      <p className="text-sm text-gray-500 py-2">
                        {selectedOrganizationId ? t('no_programs_organization') : t('select_organization_placeholder')}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
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
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
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
          <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <MdWarning className="text-red-600" size={20} />
                </div>
                <h3 className="text-lg font-semibold text-black">{t('confirm_deletion')}</h3>
              </div>
              <div className="text-black mb-6" dangerouslySetInnerHTML={{ __html: t('delete_user_confirmation', { email: deletingUser.email }) }} />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingUser(null);
                  }}
                  className="px-4 py-2 text-black border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => deleteUserCompletely(deletingUser)}
                  disabled={busy}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {busy ? t('deleting') : t('delete_user_button')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto border border-gray-100">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <MdEdit className="text-white" size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('edit_user')}</h3>
                    <p className="text-xs text-gray-500">{t('update_user_info_permissions')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all duration-200"
                >
                  <MdCancel size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-5">
                {/* Información Personal */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    {t('personal_info_section')}
                  </h4>
                  <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">{t('full_name_label')}</label>
                      <input
                        type="text"
                        required
                        value={editingUser.full_name || ''}
                        onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder={t('full_name_placeholder')}
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">{t('email_address_label')}</label>
                      <input
                        type="email"
                        required
                        value={editingUser.email || ''}
                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder={t('email_placeholder_user')}
                      />
                    </div>
                  </div>
                </div>

                {/* Permisos y Acceso */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    {t('permissions_access_section')}
                  </h4>
                  
                  {/* Rol */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">{t('user_role_label')}</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    >
                      <option value="admin">{t('administrator')}</option>
                      <option value="staff">{t('staff_member')}</option>
                      <option value="viewer">{t('viewer_role')}</option>
                    </select>
                  </div>

                  {/* Sedes/Programas */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">{t('assigned_sites_programs')}</label>
                    <p className="text-xs text-gray-600 mb-3 bg-white rounded-md p-2 border border-gray-200">
                      {t('sites_selection_help')}
                    </p>
                    <div className="bg-white rounded-md border border-gray-200 p-3 max-h-32 overflow-y-auto">
                      <div className="space-y-2">
                        {programs.map((program) => {
                          const isAssigned = editingUser.programs?.some(p => p.id === program.id);
                          return (
                            <label key={program.id} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => handleProgramToggle({...program, organization_id: program.organization_id || ''}, e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-900">{program.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-all duration-200 text-sm font-medium"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2 text-sm font-medium"
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
