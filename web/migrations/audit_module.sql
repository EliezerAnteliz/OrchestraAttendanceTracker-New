-- Módulo de Auditoría de Inventario
-- Tablas para gestionar sesiones de auditoría física de activos

-- Tabla de sesiones de auditoría
CREATE TABLE IF NOT EXISTS audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  started_by UUID, -- Nullable por ahora (ambiente de prueba sin auth)
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ, -- NULL mientras está abierta
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de eventos de auditoría (cada activo escaneado/marcado)
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL, -- Nullable: null si fue escaneo sin match
  source TEXT NOT NULL CHECK (source IN ('scan', 'manual', 'photo_assist')),
  scanned_code TEXT, -- Texto crudo leído por cámara; null si fue manual/foto
  result TEXT NOT NULL CHECK (result IN ('found', 'mismatch_site', 'unknown_code')),
  scanned_by UUID, -- Nullable por ahora (ambiente de prueba sin auth)
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_audit_sessions_program ON audit_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_started_at ON audit_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_asset ON audit_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_result ON audit_events(result);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_audit_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_sessions_updated_at
  BEFORE UPDATE ON audit_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_sessions_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE audit_sessions IS 'Sesiones de auditoría física de inventario por sede';
COMMENT ON TABLE audit_events IS 'Eventos individuales de auditoría (cada activo escaneado/marcado)';
COMMENT ON COLUMN audit_events.source IS 'scan=escaneo barcode, manual=selección manual, photo_assist=OCR+selección';
COMMENT ON COLUMN audit_events.result IS 'found=encontrado en sede correcta, mismatch_site=encontrado en otra sede, unknown_code=código no existe';
