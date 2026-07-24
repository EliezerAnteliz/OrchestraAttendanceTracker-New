-- ========================================
-- MIGRACIÓN 000: DATOS SEMILLA PARA PRUEBAS
-- ========================================
-- Proyecto: TOSA Inventario - Test
-- Fecha: 2026-07-21
-- Descripción: Crea datos mínimos de prueba (NO REALES) para organizations y programs
-- ⚠️ IMPORTANTE: Ejecutar SOLO en proyecto de prueba rrajmmykivbzzobljqmm
-- ⚠️ ESTOS SON DATOS DE PRUEBA, NO DATOS REALES
-- ========================================

-- 1. Crear organización de prueba
INSERT INTO organizations (id, name, description, is_active, created_at, updated_at)
VALUES (
  'test-org-001',
  'TOSA Test Organization',
  'Organización de prueba para desarrollo del módulo de inventario',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- 2. Crear programas de prueba
INSERT INTO programs (id, name, description, organization_id, is_active, created_at, updated_at)
VALUES 
(
  'test-prog-stafford',
  'Stafford Test',
  'Programa de prueba Stafford para desarrollo de inventario',
  'test-org-001',
  true,
  now(),
  now()
),
(
  'test-prog-japhet',
  'Japhet Test',
  'Programa de prueba Japhet para desarrollo de inventario',
  'test-org-001',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- Verificar que se crearon correctamente
DO $$
DECLARE
  org_count INTEGER;
  prog_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations WHERE id = 'test-org-001';
  SELECT COUNT(*) INTO prog_count FROM programs WHERE organization_id = 'test-org-001';
  
  RAISE NOTICE 'Organizaciones de prueba creadas: %', org_count;
  RAISE NOTICE 'Programas de prueba creados: %', prog_count;
  
  IF org_count = 0 OR prog_count = 0 THEN
    RAISE EXCEPTION 'Error: No se pudieron crear los datos de prueba';
  END IF;
END $$;

-- ========================================
-- FIN DE MIGRACIÓN 000
-- ========================================
