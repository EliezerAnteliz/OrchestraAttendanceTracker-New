# Instrucciones para Ejecutar SQL en Supabase

## Paso 1: Acceder al SQL Editor de Supabase

1. Ir a https://supabase.com/dashboard
2. Seleccionar el proyecto de prueba: **`rrajmmykivbzzobljqmm`** (TOSA Inventario - Test)
3. En el menú lateral izquierdo, click en **"SQL Editor"**

## Paso 2: Crear Nueva Query

1. Click en el botón **"New query"** (arriba a la derecha)
2. Se abrirá un editor SQL en blanco

## Paso 3: Copiar y Pegar el SQL (Parte 1 - Tablas)

Copiar TODO el contenido del archivo `migrations/audit_module.sql` y pegarlo en el editor.

O copiar directamente desde aquí:

```sql
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
```

## Paso 4: Ejecutar el SQL (Parte 1)

1. Click en el botón **"Run"** (o presionar `Ctrl + Enter` / `Cmd + Enter`)
2. Esperar a que termine la ejecución
3. Verificar que aparezca el mensaje **"Success. No rows returned"**

## Paso 5: Ejecutar Políticas RLS (Parte 2 - IMPORTANTE)

**⚠️ CRÍTICO:** Sin este paso, el módulo NO funcionará (error al crear sesiones)

1. Click en **"New query"** de nuevo
2. Copiar TODO el contenido de `migrations/audit_module_rls.sql`:

```sql
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
```

3. Click en **"Run"**
4. Verificar que aparezca **"Success. No rows returned"**

## Paso 6: Verificar que las Tablas se Crearon

1. En el menú lateral izquierdo, click en **"Table Editor"**
2. Deberías ver las nuevas tablas:
   - `audit_sessions`
   - `audit_events`

## Paso 6: Verificar Estructura de las Tablas

### audit_sessions
Debería tener estas columnas:
- id (uuid, primary key)
- organization_id (uuid, not null)
- program_id (uuid, not null)
- started_by (uuid, nullable)
- started_at (timestamptz, not null)
- ended_at (timestamptz, nullable)
- status (text, not null, default 'open')
- created_at (timestamptz, not null)
- updated_at (timestamptz, not null)

### audit_events
Debería tener estas columnas:
- id (uuid, primary key)
- audit_session_id (uuid, not null)
- asset_id (uuid, nullable)
- source (text, not null)
- scanned_code (text, nullable)
- result (text, not null)
- scanned_by (uuid, nullable)
- scanned_at (timestamptz, not null)
- created_at (timestamptz, not null)

## ✅ Confirmación

Una vez ejecutado correctamente, el módulo de auditoría estará listo para usar.

**Siguiente paso:** Navegar a http://localhost:3000/dashboard/inventory/audit para probar el módulo.

## ⚠️ Notas

- El SQL usa `IF NOT EXISTS` para evitar errores si las tablas ya existen
- Los índices también usan `IF NOT EXISTS`
- Es seguro ejecutar el script múltiples veces
- Si hay algún error, revisar que las tablas `organizations`, `programs` y `assets` existan
