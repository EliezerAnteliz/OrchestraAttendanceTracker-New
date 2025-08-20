import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useProgram } from '@/contexts/ProgramContext';

export type UserRole = 'admin' | 'staff' | 'viewer' | null;

export function useUserRole() {
  const [actualUserRole, setActualUserRole] = useState<UserRole>(null);
  const [viewingAsRole, setViewingAsRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const { activeProgram } = useProgram();
  
  // El rol efectivo es el que está viendo actualmente o su rol real
  const userRole = viewingAsRole || actualUserRole;

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!activeProgram?.id) {
        setActualUserRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setActualUserRole(null);
          setLoading(false);
          return;
        }

        const { data: membership, error } = await supabase
          .from('user_program_memberships')
          .select('role')
          .eq('user_id', user.id)
          .eq('program_id', activeProgram.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setActualUserRole(null);
        } else {
          setActualUserRole(membership?.role as UserRole || null);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setActualUserRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [activeProgram?.id]);

  const isAdmin = userRole === 'admin';
  const isStaff = userRole === 'staff';
  const isViewer = userRole === 'viewer';
  const canBulkUpload = userRole === 'admin'; // Solo admin puede hacer carga masiva
  const canEditStudents = userRole === 'admin' || userRole === 'staff';
  const canViewOnly = userRole === 'viewer';
  
  // Funciones para cambiar la vista (solo para admins)
  const switchToRole = (role: UserRole) => {
    if (actualUserRole === 'admin') {
      setViewingAsRole(role);
    }
  };
  
  const resetToActualRole = () => {
    setViewingAsRole(null);
  };

  return {
    userRole,
    actualUserRole,
    viewingAsRole,
    loading,
    isAdmin,
    isStaff,
    isViewer,
    canBulkUpload,
    canEditStudents,
    canViewOnly,
    switchToRole,
    resetToActualRole,
    canSwitchRoles: actualUserRole === 'admin'
  };
}
