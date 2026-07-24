-- ========================================
-- PRODUCCIÓN: SETUP COMPLETO DEL ESQUEMA DE INVENTARIO + AUDITORÍA
-- ========================================
-- Fecha: 2026-07-24
-- Proyecto destino: producción real (lbanldhbmuabmybtlkbs)
--
-- Por qué existe este archivo: 001/002/audit_module.sql (en esta misma
-- carpeta) fueron escritos y ejecutados el 21-23/07 SOLO contra el proyecto
-- de PRUEBA (rrajmmykivbzzobljqmm) — production nunca tuvo estas tablas.
-- Además, el 22/07 se corrigió a mano (fuera de un archivo de migración
-- numerado) el índice único y la función get_next_asset_sequence para que
-- el consecutivo del código sea por Grupo+Sede en vez de compartido — ese
-- fix nunca quedó guardado en 001. Este archivo consolida TODO lo que hoy
-- vive realmente en el proyecto de prueba (esquema final, ya con esa
-- corrección aplicada) en un solo script, listo para correr UNA vez en
-- producción, en el orden correcto.
--
-- Es 100% aditivo — solo CREATE TABLE/INDEX/FUNCTION e INSERT de catálogos
-- (datos de referencia fijos, no datos de negocio reales). No toca ninguna
-- tabla existente de Asistencia (organizations, programs, students, etc.),
-- solo las referencia por FK.
--
-- Orden de ejecución en producción:
--   1. Este archivo (PRODUCCION_00_schema_completo.sql)
--   2. 003_inventory_rls_policies.sql
--   3. 004_audit_rls_policies.sql
--   4. Reimportar el inventario histórico (aparte, con el importador de la app)
-- ========================================


-- ============================================================
-- PARTE 1 — Tablas de catálogos + tabla principal `assets`
-- (mismo contenido que 001_create_inventory_tables.sql)
-- ============================================================

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

CREATE TABLE IF NOT EXISTS asset_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL
);

COMMENT ON TABLE asset_sources IS 'Fuente de adquisición: Comprado, Donado, Alquilado';

CREATE TABLE IF NOT EXISTS asset_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL
);

COMMENT ON TABLE asset_groups IS 'Clasificación principal de activos (terrenos, construcciones, instrumentos, etc.)';

CREATE TABLE IF NOT EXISTS asset_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar NOT NULL
);

COMMENT ON TABLE asset_classes IS 'Clase del activo: Tangible, Intangible, Inversiones';

CREATE TABLE IF NOT EXISTS asset_characteristics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  description text NOT NULL
);

COMMENT ON TABLE asset_characteristics IS 'Características contables y de depreciación de los activos';

CREATE TABLE IF NOT EXISTS asset_status (
  code varchar NOT NULL PRIMARY KEY,
  description varchar NOT NULL
);

COMMENT ON TABLE asset_status IS 'Estados del activo: disponible, asignado, en reparación, dado de baja, etc.';

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

-- Índice para búsquedas por código completo
CREATE INDEX IF NOT EXISTS assets_full_code_idx ON assets(full_code) WHERE full_code IS NOT NULL;

-- Índice para búsquedas por estudiante asignado
CREATE INDEX IF NOT EXISTS assets_assigned_student_idx ON assets(assigned_student_id) WHERE assigned_student_id IS NOT NULL;

-- Índice para búsquedas por programa
CREATE INDEX IF NOT EXISTS assets_program_idx ON assets(current_program_id) WHERE current_program_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS maintenance_asset_idx ON asset_maintenance_log(asset_id);
CREATE INDEX IF NOT EXISTS maintenance_date_idx ON asset_maintenance_log(event_date);

CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assets_updated_at_trigger ON assets;
CREATE TRIGGER assets_updated_at_trigger
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_assets_updated_at();


-- ============================================================
-- PARTE 2 — Consecutivo por Grupo + Sede
-- (versión FINAL, corregida el 22/07 — el índice original de 001 nunca
-- se crea aquí a propósito, se reemplaza directo por este)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS assets_group_location_area_sequence_idx
  ON assets(group_id, location_id, work_area_id, sequence_number);

CREATE OR REPLACE FUNCTION get_next_asset_sequence(p_group_id uuid, p_location_id uuid, p_work_area_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  next_seq integer;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM assets
  WHERE group_id = p_group_id
    AND location_id = p_location_id
    AND (work_area_id = p_work_area_id OR (work_area_id IS NULL AND p_work_area_id IS NULL))
    AND full_code IS NOT NULL;
  RETURN next_seq;
END;
$$;


-- ============================================================
-- PARTE 3 — Catálogos (datos de referencia fijos, no son datos de
-- negocio reales — mismo contenido que 002_seed_inventory_catalogs.sql)
-- ============================================================

INSERT INTO asset_locations (code, name, category) VALUES
('01','Sede administrativa actual oficina','administrativa'),
('02','Sede Norte u otro Estado','administrativa'),
('20','Gerencia Ascend Oeste','ascend_gerencia'),
('21','Gerencia Ascend Norte','ascend_gerencia'),
('22','Gerencia Ascend Este','ascend_gerencia'),
('23','Gerencia Ascend Sur','ascend_gerencia'),
('50','Agrupaciones','agrupacion')
ON CONFLICT (code) DO NOTHING;

INSERT INTO asset_work_areas (location_id, code, name) VALUES
((SELECT id FROM asset_locations WHERE code='01'),'00','Sede administrativa actual oficina'),
((SELECT id FROM asset_locations WHERE code='01'),'01','Presidencia'),
((SELECT id FROM asset_locations WHERE code='01'),'02','Junta Directiva'),
((SELECT id FROM asset_locations WHERE code='01'),'03','Dpto Dani'),
((SELECT id FROM asset_locations WHERE code='01'),'04','Dpto Kara'),
((SELECT id FROM asset_locations WHERE code='01'),'05','Dpto Mariana'),
((SELECT id FROM asset_locations WHERE code='02'),'00','Sede Norte u otro Estado'),
((SELECT id FROM asset_locations WHERE code='02'),'01','Logística'),
((SELECT id FROM asset_locations WHERE code='02'),'02','Inventario'),
((SELECT id FROM asset_locations WHERE code='20'),'00','Gerencia Ascend Oeste'),
((SELECT id FROM asset_locations WHERE code='20'),'01','Ascend Stafford'),
((SELECT id FROM asset_locations WHERE code='20'),'02','Ascend Japhet'),
((SELECT id FROM asset_locations WHERE code='20'),'03','Ascend Edgewood'),
((SELECT id FROM asset_locations WHERE code='20'),'04','Ascend área cercana'),
((SELECT id FROM asset_locations WHERE code='21'),'00','Gerencia Ascend Norte'),
((SELECT id FROM asset_locations WHERE code='22'),'00','Gerencia Ascend Este'),
((SELECT id FROM asset_locations WHERE code='23'),'00','Gerencia Ascend Sur'),
((SELECT id FROM asset_locations WHERE code='50'),'00','Agrupaciones'),
((SELECT id FROM asset_locations WHERE code='50'),'01','Orquesta TOSA'),
((SELECT id FROM asset_locations WHERE code='50'),'02','Orquesta de Cámara TOSA'),
((SELECT id FROM asset_locations WHERE code='50'),'03','Cuarteto'),
((SELECT id FROM asset_locations WHERE code='50'),'04','Quinteto')
ON CONFLICT (location_id, code) DO NOTHING;

-- Vincula las áreas de Stafford/Japhet a los `programs` REALES de
-- producción (busca por nombre, no por ID — ya confirmamos que en
-- producción existen "Stafford" y "Japhet" con esos nombres exactos).
UPDATE asset_work_areas
SET program_id = (SELECT id FROM programs WHERE name ILIKE '%stafford%' LIMIT 1)
WHERE code='01' AND location_id = (SELECT id FROM asset_locations WHERE code='20')
AND EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%stafford%');

UPDATE asset_work_areas
SET program_id = (SELECT id FROM programs WHERE name ILIKE '%japhet%' LIMIT 1)
WHERE code='02' AND location_id = (SELECT id FROM asset_locations WHERE code='20')
AND EXISTS (SELECT 1 FROM programs WHERE name ILIKE '%japhet%');

INSERT INTO asset_sources (code, name) VALUES
('01','Comprado'),
('02','Donado'),
('03','Alquilado')
ON CONFLICT (code) DO NOTHING;

INSERT INTO asset_groups (code, name) VALUES
('01','Terrenos y bienes naturales'),
('02','Construcciones'),
('03','Instalaciones técnicas'),
('04','Maquinarias'),
('05','Mobiliario'),
('06','Equipos para procesos informáticos'),
('07','Elementos de transporte'),
('08','Instrumentos musicales')
ON CONFLICT (code) DO NOTHING;

INSERT INTO asset_classes (code, name) VALUES
('01','Tangible'),
('02','Intangible'),
('03','Inversiones en compañía')
ON CONFLICT (code) DO NOTHING;

INSERT INTO asset_characteristics (code, description) VALUES
('01','Se compran para el suministro de bienes o servicios, para el proceso de producción, para usarlos en la organización o para alquilarlos a terceros'),
('02','Son recursos o inversiones a largo plazo de una empresa'),
('03','No se consumen totalmente ni se venden dentro del año contable'),
('04','Tienen una forma física tangible'),
('05','Se deprecian para fines contables a lo largo de su vida útil'),
('06','Cuando llegan al término de su vida útil, generalmente se eliminan vendiéndolos por un valor de rescate'),
('07','Aparecen en los registros financieros a su valor neto en libros, que es su costo original menos la depreciación acumulada y cualquier cargo por deterioro')
ON CONFLICT (code) DO NOTHING;

INSERT INTO asset_status (code, description) VALUES
('available','Disponible / en bodega'),
('assigned','Asignado a estudiante'),
('repair','En reparación'),
('retired','Dado de baja'),
('on_loan','Prestado a taller externo')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- PARTE 4 — Tablas del módulo de Auditoría
-- (mismo contenido que audit_module.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  started_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('scan', 'manual', 'photo_assist')),
  scanned_code TEXT,
  result TEXT NOT NULL CHECK (result IN ('found', 'mismatch_site', 'unknown_code')),
  scanned_by UUID,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_program ON audit_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_started_at ON audit_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_asset ON audit_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_result ON audit_events(result);

CREATE OR REPLACE FUNCTION update_audit_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_sessions_updated_at ON audit_sessions;
CREATE TRIGGER audit_sessions_updated_at
  BEFORE UPDATE ON audit_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_sessions_updated_at();

COMMENT ON TABLE audit_sessions IS 'Sesiones de auditoría física de inventario por sede';
COMMENT ON TABLE audit_events IS 'Eventos individuales de auditoría (cada activo escaneado/marcado)';
COMMENT ON COLUMN audit_events.source IS 'scan=escaneo barcode, manual=selección manual, photo_assist=OCR+selección';
COMMENT ON COLUMN audit_events.result IS 'found=encontrado en sede correcta, mismatch_site=encontrado en otra sede, unknown_code=código no existe';

-- ========================================
-- FIN — verificar con:
-- SELECT count(*) FROM asset_locations;  -- debería dar 7
-- SELECT count(*) FROM asset_work_areas; -- debería dar 21
-- SELECT code, name, program_id FROM asset_work_areas WHERE code IN ('01','02') AND location_id = (SELECT id FROM asset_locations WHERE code='20');
--   -- las 2 filas deben mostrar program_id NO NULO (Stafford/Japhet reales)
-- ========================================
