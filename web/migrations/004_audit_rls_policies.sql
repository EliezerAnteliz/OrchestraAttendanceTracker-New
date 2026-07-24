-- ========================================
-- MIGRACIÓN 004: POLÍTICAS RLS PARA MÓDULO DE AUDITORÍA (PRODUCCIÓN)
-- ========================================
-- Fecha: 2026-07-24
-- Descripción: Row Level Security real para audit_sessions/audit_events,
-- para cuando el módulo se conecte a producción. Sigue el mismo patrón que
-- 003_inventory_rls_policies.sql (assets/asset_maintenance_log): alcance
-- por sede vía `user_program_memberships`, solo Admin puede escribir.
--
-- ⚠️ ESTADO (24/07): hoy el ambiente de prueba (rrajmmykivbzzobljqmm) usa
-- `audit_module_rls.sql` (lectura/escritura pública, sin login real) — este
-- archivo NUEVO es el diseño real para producción, todavía no aplicado en
-- ningún proyecto. NO reemplaza a audit_module_rls.sql en el proyecto de
-- prueba.
--
-- Supuesto a confirmar con Eliezer antes de aplicar de verdad: quién hace
-- la auditoría física en cada sede tiene rol Admin de esa sede (así lo
-- describió el 24/07 — "Admin Stafford hace Stafford, Admin Japhet hace
-- Japhet"), así que estas políticas exigen 'admin' para crear/actualizar
-- sesiones y eventos de auditoría, igual que para editar `assets`. Si en
-- la práctica alguien con rol Staff también debe poder auditar, avisar
-- para relajar estas políticas antes de aplicarlas.
--
-- ✅ RESUELTO (24/07): `audit/page.tsx` (createNewSession) y
-- `audit/[id]/page.tsx` (saveAuditEvent) ya llaman a
-- `inventorySupabase.auth.getUser()` y guardan el `id` en `started_by`/
-- `scanned_by` al crear sesión/evento. En el ambiente de prueba (sin login)
-- esto sigue dando NULL, como antes — el cambio solo empieza a llenar el
-- dato de verdad una vez que haya sesión real de Supabase Auth en producción.
-- ========================================

ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- ========================================
-- audit_sessions
-- ========================================

-- SELECT: cualquier rol (admin/staff/viewer) puede ver las sesiones de
-- auditoría de las sedes donde tiene membresía — consultar el historial y
-- el reporte de una auditoría cerrada es lectura, no edición.
CREATE POLICY "Users can view audit sessions from their programs"
  ON audit_sessions FOR SELECT
  TO authenticated
  USING (
    program_id IN (
      SELECT program_id
      FROM user_program_memberships
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: solo Admin puede iniciar una sesión de auditoría en su sede.
CREATE POLICY "Only Admin can create audit sessions"
  ON audit_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_program_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND program_id = audit_sessions.program_id
    )
  );

-- UPDATE: solo Admin puede cerrar/editar una sesión de auditoría de su sede.
CREATE POLICY "Only Admin can update audit sessions"
  ON audit_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_program_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND program_id = audit_sessions.program_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_program_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND program_id = audit_sessions.program_id
    )
  );

-- Nota: sin política de DELETE a propósito, mismo criterio que `assets`
-- (nunca se borra físicamente, solo se cierra la sesión).

-- ========================================
-- audit_events
-- ========================================

-- SELECT: cualquier rol puede ver los eventos de sesiones de sedes donde
-- tiene membresía (necesario para el Reporte de Auditoría).
CREATE POLICY "Users can view audit events from their programs"
  ON audit_events FOR SELECT
  TO authenticated
  USING (
    audit_session_id IN (
      SELECT id FROM audit_sessions
      WHERE program_id IN (
        SELECT program_id
        FROM user_program_memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: solo Admin puede registrar un evento (escaneo/manual/foto) en
-- una sesión de su sede.
CREATE POLICY "Only Admin can create audit events"
  ON audit_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM audit_sessions s
      JOIN user_program_memberships upm ON upm.program_id = s.program_id
      WHERE s.id = audit_session_id
      AND upm.user_id = auth.uid()
      AND upm.role = 'admin'
    )
  );

-- UPDATE: solo Admin puede modificar un evento existente (hoy no se usa
-- desde la app, pero se deja consistente con el resto del módulo).
CREATE POLICY "Only Admin can update audit events"
  ON audit_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM audit_sessions s
      JOIN user_program_memberships upm ON upm.program_id = s.program_id
      WHERE s.id = audit_session_id
      AND upm.user_id = auth.uid()
      AND upm.role = 'admin'
    )
  );

-- DELETE: solo Admin puede deshacer/borrar un evento — es la única tabla
-- del módulo con DELETE real, porque la función "Deshacer auditado por
-- error" (ver `audit/[id]/page.tsx`) sí borra la fila de `audit_events`
-- (no es un "dar de baja" con rastro, es corregir un error de captura).
CREATE POLICY "Only Admin can delete audit events"
  ON audit_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM audit_sessions s
      JOIN user_program_memberships upm ON upm.program_id = s.program_id
      WHERE s.id = audit_session_id
      AND upm.user_id = auth.uid()
      AND upm.role = 'admin'
    )
  );

-- ========================================
-- FIN DE MIGRACIÓN 004
-- ========================================
