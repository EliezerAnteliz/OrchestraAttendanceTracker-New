# Módulo de Auditoría de Inventario - Guía Completa

## 📋 Resumen

Módulo mobile-first para auditar físicamente el inventario desde el teléfono, escaneando códigos de barras o seleccionando manualmente. Incluye OCR gratuito (Tesseract.js) para leer etiquetas sin código de barras.

## 🚀 Instalación

### 1. Instalar dependencias

```bash
cd web
npm install html5-qrcode tesseract.js
```

### 2. Crear tablas en Supabase

Ejecutar el script SQL en el proyecto de prueba de Supabase:

```sql
-- Ver archivo: migrations/audit_module.sql
```

Tablas creadas:
- `audit_sessions` - Sesiones de auditoría por sede
- `audit_events` - Eventos individuales (cada activo escaneado/marcado)

### 3. Verificar rutas

Las páginas ya están creadas en:
- `/dashboard/inventory/audit` - Lista de auditorías
- `/dashboard/inventory/audit/[id]` - Sesión activa
- `/dashboard/inventory/audit/[id]/report` - Reporte final

## 📱 Flujo de Uso

### 1. Crear Nueva Auditoría

1. Ir a `/dashboard/inventory/audit`
2. Click en "Nueva Auditoría"
3. Seleccionar sede (ej. Stafford, Japhet)
4. Si ya existe una sesión abierta para esa sede, se reanuda automáticamente

### 2. Auditar Activos - 3 Métodos

#### A. Escaneo por Cámara (Códigos de Barras)

**Para:** Instrumentos que ya tienen el código de barras nuevo (16 dígitos)

**Cómo:**
1. Click en botón "Escanear"
2. Apuntar cámara al código de barras del estuche
3. Sistema lee automáticamente y marca como auditado

**Resultados posibles:**
- ✅ **Encontrado** - Código coincide con activo de la sede correcta
- ⚠️ **Otra sede** - Código existe pero pertenece a otra sede
- ❌ **No encontrado** - Código no existe en el sistema

**Formatos soportados:** Code128, Code39, EAN13, EAN8

#### B. Selección Manual

**Para:** Cualquier instrumento (con o sin código de barras)

**Cómo:**
1. Click en botón "Manual"
2. Buscar por descripción, marca, código, serial, asignado a
3. Filtrar por estado (disponible, asignado, etc.)
4. Seleccionar activo de la lista
5. Sistema marca como auditado

**Útil cuando:**
- Etiqueta muy pequeña o mala luz
- Tag manuscrito viejo sin código de barras
- Preferencia por recorrer lista en vez de escanear

#### C. Foto + OCR (Tesseract.js)

**Para:** Instrumentos sin código de barras

**Cómo:**
1. Click en botón "Foto OCR"
2. Tomar foto de la etiqueta externa del estuche
3. Sistema lee texto con OCR (identificador viejo tipo "NYOSA14022", nombre estudiante)
4. Muestra candidatos que coinciden
5. Confirmar cuál es el correcto

**Fallback:**
- Si OCR no lee nada útil → botón "Búsqueda Manual" siempre disponible
- Nunca bloquea la auditoría

**Importante:**
- La foto NO se guarda (solo lectura transitoria)
- OCR es gratuito (Tesseract.js, sin límites)
- Más débil que servicios de IA de pago leyendo manuscritas
- Prioridad: terminar de codificar los 84 instrumentos históricos

### 3. Cerrar Auditoría

1. Click en "Finalizar Auditoría"
2. Confirmar
3. Sistema genera reporte automático

## 📊 Reporte Final

Muestra 4 categorías:

### ✅ Encontrados
- Activos auditados correctamente
- Indica método usado (Escaneado / Manual / Foto OCR)

### ❌ Faltantes
- Activos de la sede que NO fueron auditados
- Incluye tanto los que tienen código como los que nunca lo tuvieron

### ⚠️ Otra Sede
- Activos encontrados pero registrados en otra sede
- Para revisar (posible error de registro o movimiento no documentado)

### 🔍 No Encontrados
- Códigos escaneados que no existen en el sistema
- Posible error de impresión o typo en etiqueta

## 🔧 Configuración Técnica

### Librerías Usadas

#### html5-qrcode
- **Función:** Escaneo de códigos de barras
- **Compatibilidad:** iOS Safari + Android Chrome
- **Gratuito:** Sí (MIT License)
- **Sin instalación:** Funciona directo en el navegador

#### Tesseract.js
- **Función:** OCR (reconocimiento de texto en fotos)
- **Compatibilidad:** Navegador (client-side)
- **Gratuito:** Sí (Apache 2.0 License)
- **Sin límites:** No requiere API key
- **Idiomas:** Inglés y español

### Alternativas Descartadas

❌ **BarcodeDetector API** - No funciona en iOS Safari  
❌ **Google Cloud Vision** - Servicio de pago  
❌ **OpenAI/Claude Vision** - Servicio de pago  

✅ **Decisión:** Solo soluciones 100% gratuitas (Eliezer no tiene presupuesto para servicios de IA de pago)

## 🧪 Pruebas Recomendadas

### Fase 1: Prueba Pequeña (3-5 activos)

Mezcla de:
- 2 activos CON código de barras → probar escaneo
- 2 activos SIN código de barras → probar manual y foto OCR
- 1 activo de otra sede → verificar que marca "mismatch"

### Fase 2: Prueba Completa

- Auditar una sede completa
- Verificar que el reporte de faltantes sea correcto
- Confirmar que no hay duplicados

### Casos de Prueba Específicos

1. **Escaneo exitoso:** Código de barras válido de la sede correcta
2. **Mismatch:** Código válido pero de otra sede
3. **Unknown:** Código que no existe en BD
4. **Manual:** Buscar por nombre de estudiante asignado
5. **Foto OCR:** Leer identificador viejo tipo "NYOSA14022"
6. **Foto OCR fallback:** Si no lee nada, usar búsqueda manual

## 📝 Modelo de Datos

### audit_sessions
```sql
id UUID PRIMARY KEY
organization_id UUID NOT NULL
program_id UUID NOT NULL  -- Sede auditada
started_by UUID  -- Nullable (ambiente prueba sin auth)
started_at TIMESTAMPTZ NOT NULL
ended_at TIMESTAMPTZ  -- NULL mientras está abierta
status TEXT NOT NULL  -- 'open' | 'closed'
```

### audit_events
```sql
id UUID PRIMARY KEY
audit_session_id UUID NOT NULL
asset_id UUID  -- Nullable (null si fue escaneo sin match)
source TEXT NOT NULL  -- 'scan' | 'manual' | 'photo_assist'
scanned_code TEXT  -- Texto crudo leído; null si manual/foto
result TEXT NOT NULL  -- 'found' | 'mismatch_site' | 'unknown_code'
scanned_by UUID  -- Nullable (ambiente prueba sin auth)
scanned_at TIMESTAMPTZ NOT NULL
```

### Valores de `source`
- **scan:** Escaneo de código de barras
- **manual:** Selección manual de lista
- **photo_assist:** OCR + selección (el staff confirma)

### Valores de `result`
- **found:** Encontrado en sede correcta
- **mismatch_site:** Encontrado en otra sede
- **unknown_code:** Código no existe en sistema

## 🎯 Permisos

- **Admin/Staff de una sede:** Pueden auditar esa sede
- **Cuenta de Eliezer (Admin global):** Puede auditar cualquier sede

## ⚠️ Notas Importantes

### Fuera de Alcance (Primera Versión)

❌ Codificar instrumentos sin código durante auditoría  
❌ Guardar fotos como evidencia  
❌ Export a Excel del reporte  

### Decisiones de Diseño

✅ **No guardar fotos:** Solo check presente/no presente (más rápido, sin storage)  
✅ **OCR gratuito:** Tesseract.js en vez de servicios de pago  
✅ **Fallback siempre disponible:** Si OCR falla, búsqueda manual  
✅ **Prioridad:** Terminar de codificar los 84 instrumentos históricos  

### Ambiente de Prueba

- Cliente de Supabase sin autenticación
- `started_by` y `scanned_by` con valor placeholder
- En producción se capturará usuario real

## 🐛 Errores de TypeScript Esperados

Los siguientes errores aparecerán hasta que se instalen las dependencias:

```
Cannot find module 'html5-qrcode'
Cannot find module 'tesseract.js'
```

**Solución:** Ejecutar `npm install html5-qrcode tesseract.js`

También hay warnings de tipos de Supabase (relaciones que devuelven arrays). Estos no afectan la funcionalidad.

## 📞 Próximos Pasos

1. ✅ Código implementado
2. ⏳ Instalar dependencias (`npm install html5-qrcode tesseract.js`)
3. ⏳ Crear tablas en Supabase (ejecutar `migrations/audit_module.sql`)
4. ⏳ Probar con 3-5 activos (mezcla con/sin código)
5. ⏳ Ajustar según feedback de Eliezer
6. ⏳ Probar con sede completa
7. ⏳ Terminar de codificar los 84 instrumentos históricos restantes

## 🎉 Beneficios

- ✅ Auditoría rápida desde el teléfono (sin computadora)
- ✅ 3 métodos flexibles (escaneo, manual, foto OCR)
- ✅ 100% gratuito (sin servicios de pago)
- ✅ Reporte automático al finalizar
- ✅ Mobile-first (diseñado para uso en movimiento)
- ✅ Funciona offline para escaneo (html5-qrcode client-side)
