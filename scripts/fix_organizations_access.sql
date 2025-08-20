-- Script para permitir acceso público a organizaciones durante el registro
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar si RLS está habilitado en organizations
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'organizations';

-- 2. Ver políticas actuales
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'organizations';

-- 3. Crear política para permitir lectura pública de organizaciones activas
-- Esto es necesario para que usuarios no autenticados puedan ver las organizaciones en el registro
CREATE POLICY "Allow public read access to active organizations" ON organizations
    FOR SELECT USING (is_active = true);

-- 4. Alternativamente, si ya existe una política similar, actualizarla
-- DROP POLICY IF EXISTS "Allow public read access to active organizations" ON organizations;
-- CREATE POLICY "Allow public read access to active organizations" ON organizations
--     FOR SELECT USING (is_active = true);

-- 5. Verificar que las organizaciones existen y están activas
SELECT id, name, is_active, created_at 
FROM organizations 
WHERE is_active = true 
ORDER BY name;

-- 6. Si no hay organizaciones, insertar una de ejemplo
INSERT INTO organizations (name, is_active, settings, created_at, updated_at)
SELECT 'CMI Orchestra', true, '{"timezone": "America/Mexico_City", "defaultLanguage": "es"}', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'CMI Orchestra');

-- 7. Verificar permisos de la tabla
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'organizations';
