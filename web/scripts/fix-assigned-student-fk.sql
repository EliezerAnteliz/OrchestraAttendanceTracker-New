-- Script para crear la foreign key de assigned_student_id
-- Proyecto: TOSA Inventario - Test (rrajmmykivbzzobljqmm)
-- Error: "Could not find a relationship between 'assets' and 'students' in the schema cache"

-- PASO 1: Verificar FKs existentes en assets
-- (Si no aparece ninguna con referencia = students, confirma que falta la FK)
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS tabla,
  confrelid::regclass AS referencia
FROM pg_constraint
WHERE conrelid = 'assets'::regclass AND contype = 'f';

-- PASO 2: Crear la FK que falta
-- (Ejecuta esto directamente - si ya existe, dará un error inofensivo)
ALTER TABLE assets
  ADD CONSTRAINT assets_assigned_student_id_fkey
  FOREIGN KEY (assigned_student_id) 
  REFERENCES students(id)
  ON DELETE SET NULL;

-- PASO 3: Refrescar el schema cache de PostgREST
-- (OBLIGATORIO después de crear una FK nueva)
NOTIFY pgrst, 'reload schema';

-- PASO 4: Verificar que la FK fue creada
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS tabla,
  confrelid::regclass AS referencia
FROM pg_constraint
WHERE conrelid = 'assets'::regclass 
  AND contype = 'f'
  AND confrelid = 'students'::regclass;

-- RESULTADO ESPERADO:
-- Deberías ver una fila con:
-- constraint_name: assets_assigned_student_id_fkey
-- tabla: assets
-- referencia: students

-- NOTA: Si después de esto el Listado sigue sin cargar:
-- 1. Ve a Settings → General → Restart project en el dashboard de Supabase
-- 2. Espera 1-2 minutos a que el proyecto reinicie
-- 3. Recarga la página del Listado
