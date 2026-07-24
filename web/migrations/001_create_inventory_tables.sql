-- ========================================
-- MIGRACIÓN 001: CREAR TABLAS DE INVENTARIO
-- ========================================
-- Proyecto: TOSA Inventario - Test
-- Fecha: 2026-07-21
-- Descripción: Crea todas las tablas necesarias para el sistema de inventario
-- ⚠️ IMPORTANTE: Ejecutar SOLO en proyecto de prueba rrajmmykivbzzobljqmm
-- ========================================

-- 1. TABLA: asset_locations
-- Ubicaciones físicas donde pueden estar los activos
CREATE TABLE IF NOT EXISTS asset_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL,
  category varchar NOT NULL CHECK (category IN ('administrativa','ascend_gerencia','agrupacion')),
  program_id uuid REFERENCES programs(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE asset_locations IS 'Ubicaciones físicas donde se almacenan los activos';
COMMENT ON COLUMN asset_locations.category IS 'Categoría de ubicación: administrativa, ascend_gerencia, agrupacion';

-- 2. TABLA: asset_work_areas
-- Áreas de trabajo dentro de cada ubicación
CREATE TABLE IF NOT EXISTS asset_work_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES asset_locations(id),
  code varchar(2) NOT NULL,
  name varchar NOT NULL,
  program_id uuid REFERENCES programs(id),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(location_id, code)
);

COMMENT ON TABLE asset_work_areas IS 'Áreas de trabajo específicas dentro de cada ubicación';

-- 3. TABLA: asset_sources
-- Origen de adquisición del activo
CREATE TABLE IF NOT EXISTS asset_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL
);

COMMENT ON TABLE asset_sources IS 'Fuente de adquisición: Comprado, Donado, Alquilado';

-- 4. TABLA: asset_groups
-- Grupos de clasificación de activos
CREATE TABLE IF NOT EXISTS asset_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL
);

COMMENT ON TABLE asset_groups IS 'Clasificación principal de activos (terrenos, construcciones, instrumentos, etc.)';

-- 5. TABLA: asset_classes
-- Clases de activos
CREATE TABLE IF NOT EXISTS asset_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL
);

COMMENT ON TABLE asset_classes IS 'Clase del activo: Tangible, Intangible, Inversiones';

-- 6. TABLA: asset_characteristics
-- Características contables de los activos
CREATE TABLE IF NOT EXISTS asset_characteristics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  description text NOT NULL
);

COMMENT ON TABLE asset_characteristics IS 'Características contables y de depreciación de los activos';

-- 7. TABLA: asset_status
-- Estados posibles de un activo
CREATE TABLE IF NOT EXISTS asset_status (
  code varchar NOT NULL PRIMARY KEY,
  description varchar NOT NULL
);

COMMENT ON TABLE asset_status IS 'Estados del activo: disponible, asignado, en reparación, dado de baja, etc.';

-- 8. TABLA: assets (PRINCIPAL)
-- Tabla principal de activos/inventario
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  full_code varchar(16) UNIQUE,
  location_id uuid NOT NULL REFERENCES asset_locations(id),
  work_area_id uuid REFERENCES asset_work_areas(id),
  source_id uuid NOT NULL REFERENCES asset_sources(id),
  group_id uuid NOT NULL REFERENCES asset_groups(id),
  class_id uuid NOT NULL REFERENCES asset_classes(id),
  characteristic_id uuid REFERENCES asset_characteristics(id),
  sequence_number integer NOT NULL,
  description varchar NOT NULL,
  brand varchar,
  size varchar,
  serial_number varchar,
  model varchar,
  owner varchar,
  estimated_cost numeric(10,2),
  status_code varchar NOT NULL REFERENCES asset_status(code),
  current_program_id uuid REFERENCES programs(id),
  assigned_student_id uuid REFERENCES students(id),
  assigned_to_text varchar,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE assets IS 'Tabla principal de activos e inventario';
COMMENT ON COLUMN assets.full_code IS 'Código completo de 16 dígitos (formato: 2+2+2+2+2+2+4)';
COMMENT ON COLUMN assets.assigned_student_id IS 'Estudiante asignado (si aplica)';
COMMENT ON COLUMN assets.assigned_to_text IS 'Texto libre para asignaciones no-estudiantes (ej: Terranova)';

-- Índice único para evitar duplicados de secuencia por grupo
CREATE UNIQUE INDEX IF NOT EXISTS assets_group_sequence_idx ON assets(group_id, sequence_number);

-- Índice para búsquedas por código completo
CREATE INDEX IF NOT EXISTS assets_full_code_idx ON assets(full_code) WHERE full_code IS NOT NULL;

-- Índice para búsquedas por estudiante asignado
CREATE INDEX IF NOT EXISTS assets_assigned_student_idx ON assets(assigned_student_id) WHERE assigned_student_id IS NOT NULL;

-- Índice para búsquedas por programa
CREATE INDEX IF NOT EXISTS assets_program_idx ON assets(current_program_id) WHERE current_program_id IS NOT NULL;

-- 9. TABLA: asset_maintenance_log
-- Registro de mantenimiento y reparaciones
CREATE TABLE IF NOT EXISTS asset_maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  event_date date NOT NULL,
  event_type varchar NOT NULL,
  vendor varchar,
  description text,
  cost numeric(10,2),
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE asset_maintenance_log IS 'Historial de mantenimiento y reparaciones de activos';

-- Índice para búsquedas por activo
CREATE INDEX IF NOT EXISTS maintenance_asset_idx ON asset_maintenance_log(asset_id);

-- Índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS maintenance_date_idx ON asset_maintenance_log(event_date);

-- Trigger para actualizar updated_at en assets
CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_updated_at_trigger
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_assets_updated_at();

-- ========================================
-- FIN DE MIGRACIÓN 001
-- ========================================
