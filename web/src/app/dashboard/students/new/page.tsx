'use client';

// Ruta huérfana (31/07): esta pantalla de "Nuevo Estudiante" nunca se
// rediseñó y no está enlazada desde ningún lugar de la app — students/page.tsx
// tiene su propio modal de creación (rediseñado, tarea #171) que reemplazó
// por completo este flujo. No se pudo borrar el archivo por una restricción
// de permisos del montaje de esta carpeta, así que se deja como redirect en
// vez de dejar la pantalla vieja accesible por URL directa.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewStudentPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/students');
  }, [router]);
  return null;
}
