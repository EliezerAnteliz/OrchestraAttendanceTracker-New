'use client';

// Autorregistro público desactivado (26/07): esta pantalla dejaba que
// cualquier visitante eligiera una organización real de una lista
// desplegable y se autoasignara el rol "Staff" (puede editar estudiantes),
// con la cuenta activa de inmediato — sin ninguna aprobación de un Admin.
// Estaba enlazada desde la página principal y desde el login; esos links
// ya se quitaron. Esta ruta se deja como redirect (en vez de borrar el
// archivo) por si quedó indexada en buscadores o alguien la tiene guardada.
// Todas las cuentas se crean ahora desde Admin/Usuarios (invitación por
// correo — ver /api/admin/users/invite-user).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return null;
}
