'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si no está cargando y no hay usuario, redirigir a login
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Mostrar un indicador de carga mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-[#C2492B] border-r-[#C2492B] border-b-[#EAE3D6] border-l-[#EAE3D6] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8A8177] text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si hay un usuario, mostrar el contenido protegido
  return user ? <>{children}</> : null;
}
