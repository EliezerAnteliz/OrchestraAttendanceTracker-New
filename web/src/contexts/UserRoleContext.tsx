'use client';

/**
 * CONTEXTO COMPARTIDO DE ROL DE USUARIO
 *
 * Antes (24/07) `useUserRole()` era un hook normal: cada componente que lo
 * llamaba (RoleSwitcher, el layout de Inventario, el Listado, el Sidebar
 * general, etc.) creaba su PROPIA copia independiente del estado
 * (actualUserRole/viewingAsRole), cada una leyendo localStorage y
 * consultando Supabase por separado. En teoría todas debían converger al
 * mismo valor, pero en la práctica se detectó un caso real donde el botón
 * "Nuevo Activo" (dentro de la página) sí reflejaba "viendo como Staff"
 * correctamente, mientras que los tabs "Importar"/"Auditoría" (en el
 * layout, un componente distinto) seguían mostrándose como si fuera Admin
 * — dos instancias del mismo hook divergiendo entre sí.
 *
 * Ahora todos comparten esta ÚNICA instancia de estado vía Context, montada
 * una sola vez en `dashboard/layout.tsx`. `src/hooks/useUserRole.ts` sigue
 * existiendo con el mismo nombre e igual forma de uso (no hubo que tocar
 * ninguno de los ~15 archivos que ya lo importaban) pero ahora solo lee de
 * aquí en vez de recalcular todo por su cuenta.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useProgram } from '@/contexts/ProgramContext';

export type UserRole = 'admin' | 'staff' | 'viewer' | null;

interface UserRoleContextValue {
  userRole: UserRole;
  actualUserRole: UserRole;
  viewingAsRole: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isViewer: boolean;
  canBulkUpload: boolean;
  canEditStudents: boolean;
  canViewOnly: boolean;
  switchToRole: (role: UserRole) => void;
  resetToActualRole: () => void;
  canSwitchRoles: boolean;
}

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [actualUserRole, setActualUserRole] = useState<UserRole>(null);
  const [viewingAsRole, setViewingAsRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const { activeProgram } = useProgram();

  // El rol efectivo es el que está viendo actualmente o su rol real
  const userRole = viewingAsRole || actualUserRole;

  // Cargar rol persistido al inicializar (una sola vez, para toda la app)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('admin_viewing_as_role');
      if (savedRole && (savedRole === 'admin' || savedRole === 'staff' || savedRole === 'viewer')) {
        setViewingAsRole(savedRole as UserRole);
      }
    }
  }, []);

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
  const canBulkUpload = userRole === 'admin';
  const canEditStudents = userRole === 'admin' || userRole === 'staff';
  const canViewOnly = userRole === 'viewer';

  // Se escribe a localStorage aquí mismo, de forma síncrona, ANTES de
  // llamar a reload() — así el valor ya está guardado cuando el navegador
  // empieza a recargar la página.
  const switchToRole = (role: UserRole) => {
    if (actualUserRole === 'admin') {
      if (role === actualUserRole) {
        setViewingAsRole(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_viewing_as_role');
        }
      } else {
        setViewingAsRole(role);
        if (typeof window !== 'undefined' && role) {
          localStorage.setItem('admin_viewing_as_role', role);
        }
      }
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  const resetToActualRole = () => {
    setViewingAsRole(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_viewing_as_role');
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const value: UserRoleContextValue = {
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
    canSwitchRoles: actualUserRole === 'admin',
  };

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export function useUserRoleContext() {
  const ctx = useContext(UserRoleContext);
  if (!ctx) {
    throw new Error('useUserRoleContext must be used within a UserRoleProvider');
  }
  return ctx;
}
