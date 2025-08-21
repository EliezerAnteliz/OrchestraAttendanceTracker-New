'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Verificar la sesión actual
    const getSession = async () => {
      setLoading(true);
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (data.session?.user) {
          // Verificar si el usuario está activo en user_profiles
          const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('is_active')
            .eq('user_id', data.session.user.id)
            .single();

          if (profileError || !userProfile?.is_active) {
            // Si no se encuentra el perfil o el usuario está inactivo, cerrar sesión
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            if (pathname.startsWith('/dashboard')) {
              router.push('/login');
            }
            return;
          }
        }

        setSession(data.session);
        setUser(data.session?.user || null);
      } catch (error) {
        console.error('Error al obtener la sesión:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Escuchar cambios en la autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);
        setLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Función para cerrar sesión
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
