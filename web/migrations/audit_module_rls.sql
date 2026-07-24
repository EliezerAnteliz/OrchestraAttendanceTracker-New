-- Políticas RLS para Módulo de Auditoría (Ambiente de Prueba)
-- Permite lectura/escritura pública sin autenticación

-- Habilitar RLS en las tablas
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública para audit_sessions
CREATE POLICY "Allow public read access to audit_sessions"
ON audit_sessions
FOR SELECT
TO public
USING (true);

-- Política de inserción pública para audit_sessions
CREATE POLICY "Allow public insert access to audit_sessions"
ON audit_sessions
FOR INSERT
TO public
WITH CHECK (true);

-- Política de actualización pública para audit_sessions
CREATE POLICY "Allow public update access to audit_sessions"
ON audit_sessions
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Política de lectura pública para audit_events
CREATE POLICY "Allow public read access to audit_events"
ON audit_events
FOR SELECT
TO public
USING (true);

-- Política de inserción pública para audit_events
CREATE POLICY "Allow public insert access to audit_events"
ON audit_events
FOR INSERT
TO public
WITH CHECK (true);

-- Política de actualización pública para audit_events
CREATE POLICY "Allow public update access to audit_events"
ON audit_events
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Comentario
COMMENT ON POLICY "Allow public read access to audit_sessions" ON audit_sessions IS 'Ambiente de prueba - permite acceso sin autenticación';
COMMENT ON POLICY "Allow public insert access to audit_sessions" ON audit_sessions IS 'Ambiente de prueba - permite acceso sin autenticación';
COMMENT ON POLICY "Allow public update access to audit_sessions" ON audit_sessions IS 'Ambiente de prueba - permite acceso sin autenticación';
COMMENT ON POLICY "Allow public read access to audit_events" ON audit_events IS 'Ambiente de prueba - permite acceso sin autenticación';
COMMENT ON POLICY "Allow public insert access to audit_events" ON audit_events IS 'Ambiente de prueba - permite acceso sin autenticación';
COMMENT ON POLICY "Allow public update access to audit_events" ON audit_events IS 'Ambiente de prueba - permite acceso sin autenticación';
