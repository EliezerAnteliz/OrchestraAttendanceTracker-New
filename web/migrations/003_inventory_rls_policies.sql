-- ========================================
-- MIGRACIÓN 003: POLÍTICAS RLS PARA INVENTARIO
-- ========================================
-- Fecha original: 2026-07-21 · Corregida: 2026-07-24
-- Descripción: Configura Row Level Security para las tablas de inventario
-- Reutiliza la misma lógica de permisos que las tablas existentes (user_program_memberships)
-- ⚠️ ESTADO (24/07): este archivo usa `TO authenticated`, así que NO aplica
-- tal cual al ambiente de prueba (rrajmmykivbzzobljqmm, sin login real —
-- ahí se usan políticas de lectura/escritura pública por separado). Este
-- archivo es el DISEÑO REAL para cuando el módulo se conecte a producción.
-- CORRECCIÓN 24/07 (decisión de Eliezer): el inventario es delicado — solo
-- el rol Admin puede crear/editar assets y registros de mantenimiento;
-- Staff queda en solo lectura igual que Viewer (antes decía "admin, staff").
-- CONFIRMADO 24/07 (Eliezer): el catálogo real de roles de la app es
-- exactamente admin / staff / viewer — coincide con lo ya escrito aquí
-- (role = 'admin'), no hace falta ajustar nada. Listo para aplicar tal cual
-- una vez que se decida el camino a producción.
-- ========================================

-- Habilitar RLS en todas las tablas de inventario
ALTER TABLE asset_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_work_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_characteristics ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS PARA TABLAS DE CATÁLOGOS
-- (Lectura para todos los usuarios autenticados)
-- ========================================

-- asset_locations
CREATE POLICY "Users can view asset locations"
  ON asset_locations FOR SELECT
  TO authenticated
  USING (true);

-- asset_work_areas
CREATE POLICY "Users can view asset work areas"
  ON asset_work_areas FOR SELECT
  TO authenticated
  USING (true);

-- asset_sources
CREATE POLICY "Users can view asset sources"
  ON asset_sources FOR SELECT
  TO authenticated
  USING (true);

-- asset_groups
CREATE POLICY "Users can view asset groups"
  ON asset_groups FOR SELECT
  TO authenticated
  USING (true);

-- asset_classes
CREATE POLICY "Users can view asset classes"
  ON asset_classes FOR SELECT
  TO authenticated
  USING (true);

-- asset_characteristics
CREATE POLICY "Users can view asset characteristics"
  ON asset_characteristics FOR SELECT
  TO authenticated
  USING (true);

-- asset_status
CREATE POLICY "Users can view asset status"
  ON asset_status FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- POLÍTICAS PARA TABLA PRINCIPAL: assets
-- (Basadas en user_program_memberships)
-- ========================================

-- SELECT: Usuarios pueden ver activos de sus programas
CREATE POLICY "Users can view assets from their programs"
  ON assets FOR SELECT
  TO authenticated
  USING (
    current_program_id IN (
      SELECT program_id 
      FROM user_program_memberships 
      WHERE user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT DISTINCT p.organization_id
      FROM user_program_memberships upm
      JOIN programs p ON p.id = upm.program_id
      WHERE upm.user_id = auth.uid()
    )
  );

-- INSERT: Solo Admin puede crear activos
-- CORREGIDO 24/07 (decisión de Eliezer): el inventario es delicado, Staff
-- queda en solo lectura igual que Viewer — antes decía "admin, staff".
CREATE POLICY "Only Admin can create assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_program_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND program_id = current_program_id
    )
  );

-- UPDATE: Solo Admin puede actualizar activos
-- CORREGIDO 24/07 (decisión de Eliezer): mismo criterio que INSERT arriba.
CREATE POLICY "Only Admin can update assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_program_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND program_id = current_program_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_program_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND program_id = current_program_id
    )
  );

-- Sin política de DELETE a propósito — decisión ya tomada el 22/07 (auditoría
-- de Grupo 1, ambiente de prueba): un activo nunca se borra físicamente,
-- solo se "da de baja" (status_code + is_active=false, con rastro en notes).
-- Sin política de DELETE, ningún rol (ni siquiera Admin) puede borrar una
-- fila de `assets` vía la API — refuerza la regla a nivel de base de datos,
-- igual que ya quedó aplicado en el proyecto de prueba.

-- ========================================
-- POLÍTICAS PARA: asset_maintenance_log
-- ========================================

-- SELECT: Usuarios pueden ver mantenimiento de activos de sus programas
CREATE POLICY "Users can view maintenance logs from their programs"
  ON asset_maintenance_log FOR SELECT
  TO authenticated
  USING (
    asset_id IN (
      SELECT id FROM assets
      WHERE current_program_id IN (
        SELECT program_id 
        FROM user_program_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: Solo Admin puede registrar mantenimiento
-- CORREGIDO 24/07 (decisión de Eliezer): antes decía "admin, staff".
CREATE POLICY "Only Admin can create maintenance logs"
  ON asset_maintenance_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM assets a
      JOIN user_program_memberships upm ON upm.program_id = a.current_program_id
      WHERE a.id = asset_id
      AND upm.user_id = auth.uid()
      AND upm.role = 'admin'
    )
  );

-- UPDATE: Solo Admin puede actualizar registros de mantenimiento
-- CORREGIDO 24/07 (decisión de Eliezer): antes decía "admin, staff".
CREATE POLICY "Only Admin can update maintenance logs"
  ON asset_maintenance_log FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM assets a
      JOIN user_program_memberships upm ON upm.program_id = a.current_program_id
      WHERE a.id = asset_id
      AND upm.user_id = auth.uid()
      AND upm.role = 'admin'
    )
  );

-- Sin política de DELETE a propósito, mismo criterio que `assets` arriba:
-- un registro de mantenimiento es bitácora/historial, no debe poder borrarse
-- una vez creado (si se registró mal, se corrige agregando un nuevo evento,
-- no borrando el anterior).

-- ========================================
-- FIN DE MIGRACIÓN 003
-- ========================================
