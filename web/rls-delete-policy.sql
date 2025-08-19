-- Política RLS para permitir DELETE en la tabla attendance
-- Permite a usuarios autenticados eliminar registros de asistencia

-- Primero, verificar las políticas existentes
-- SELECT * FROM pg_policies WHERE tablename = 'attendance';

-- Crear política simple para permitir DELETE en attendance
CREATE POLICY "Allow delete attendance records" ON attendance
FOR DELETE
TO authenticated
USING (true);

-- Esta política permite a cualquier usuario autenticado eliminar registros de attendance
-- Para aplicar esta política, ejecuta este script en el SQL Editor de Supabase
