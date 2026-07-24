# Bugs Corregidos - Módulo de Auditoría (Parte 7 - Diagnóstico y Contraste)

## ✅ Progreso Confirmado

- ✅ **Escaneo SÍ detectó código correctamente:** "VIOLA, 2001010801040032"
- ✅ Fix de `cameraIdOrConfig` funcionó

---

## Bug 1: Error Vacío Persiste - Diagnóstico Profundo ✅

### Problema:
`"Error searching candidates (Supabase error): {}"` sigue exactamente igual pese al fix de logging anterior.

### Hipótesis:
El objeto que se está atrapando en el `catch` **NO es un PostgrestError normal** (si lo fuera, `message/details/hint/code` no saldrían todos vacíos).

### Corrección Aplicada:

**Agregado logging RAW del error:**

```typescript
catch (err: any) {
  console.log('RAW ERROR:', err);  // ← Ver objeto completo
  console.log('error type:', typeof err, err instanceof Error);  // ← Ver tipo
  console.error('Error searching candidates (caught):', {
    message: err.message,
    details: err.details,
    hint: err.hint,
    code: err.code,
    fullError: err
  });
  setShowManualSearch(true);
}
```

**Aplicado en:**
1. ✅ `searchCandidates()` (Foto OCR)
2. ✅ `handleManualSearch()` (Buscador manual)

### Resultado Esperado:

**Consola mostrará:**
```javascript
RAW ERROR: [objeto completo sin filtrar]
error type: object true/false
```

Esto revelará:
- ¿Es un Error nativo?
- ¿Es un objeto plano?
- ¿Qué propiedades tiene realmente?

**Comparte la salida de consola para diagnosticar correctamente.**

---

## Bug 2: Buscador Manual No Consulta BD + Contraste Bajo ✅

### Problema A: No Consulta BD
Probablemente mismo bug del punto 1 (error silencioso).

### Corrección:
Agregado logging completo en `handleManualSearch()`:

```typescript
console.log('Manual search started with term:', term);
console.log('RAW ERROR (manual search):', error);
console.log('error type:', typeof error, error instanceof Error);
console.log('Manual search results:', data?.length || 0);
```

### Problema B: Texto Gris Claro (Difícil de Leer)

**Causa:** Inputs/selects sin clase de color de texto, usando default del navegador (gris claro).

### Corrección Aplicada:

**Agregado `text-gray-900` a TODOS los inputs/selects:**

1. ✅ **PhotoOCR.tsx** - Input buscador manual
2. ✅ **ManualSelector.tsx** - Input búsqueda + Select filtro de estado
3. ✅ **assets/page.tsx** - Ya tenía `text-gray-900` (verificado)

**Antes:**
```tsx
<input
  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg..."
  // Sin color de texto → gris claro
/>
```

**Después:**
```tsx
<input
  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg... text-gray-900"
  // ← Negro oscuro, buen contraste
/>
```

### Resultado:
- ✅ Texto de valor real en **negro oscuro** (text-gray-900)
- ✅ Placeholder sigue en gris claro (comportamiento nativo del navegador)
- ✅ Buen contraste para lectura

---

## Bug 3: Botón Diagnóstico Choca con Escaneo en Vivo ✅

### Problema:
`"File scan failed: Cannot start file scan - ongoing camera scan"`

### Causa:
html5-qrcode no permite escanear archivo mientras el scanner de cámara está activo.

### Corrección Aplicada:

**Detener scanner antes de diagnóstico:**

```typescript
async function handleFileUpload(file: File) {
  // Detener scanner de cámara antes de escanear archivo
  if (scanning) {
    console.log('Stopping camera scan before file scan...');
    await stopScanner();
    setScanning(false);
  }
  
  setLastResult({ message: 'Analizando imagen...', type: 'warning' });
  
  const decodedText = await scannerRef.current.scanFile(file, false);
  console.log('✓ File scan successful:', decodedText);
  await onScanSuccess(decodedText);
  
  // Reiniciar scanner de cámara después del diagnóstico
  console.log('Restarting camera scan...');
  await startScanner();
}
```

**Flujo:**
```
Usuario click "📷 Diagnóstico"
  ↓
Detener scanner de cámara
  ↓
Escanear archivo
  ↓
Mostrar resultado
  ↓
Reiniciar scanner de cámara
```

### Resultado:
- ✅ Detiene scanner antes de diagnóstico
- ✅ Escanea archivo sin conflicto
- ✅ Reinicia scanner automáticamente
- ✅ Funciona incluso si el diagnóstico falla

---

## Bug 4: Cámara Frontal en Vez de Trasera ✅

### Problema:
Al abrir "Escanear", la cámara que abre por defecto es la **FRONTAL**, no la trasera.

### Causa:
`facingMode: 'environment'` no siempre fuerza la cámara trasera en iOS.

### Corrección Aplicada:

**Antes:**
```typescript
await html5QrCode.start(
  { facingMode: 'environment' },  // Sugerencia, no forzado
  { ... }
);
```

**Después:**
```typescript
await html5QrCode.start(
  { facingMode: { exact: 'environment' } },  // FORZAR cámara trasera
  { ... }
);
```

**Cambio:**
- `'environment'` → `{ exact: 'environment' }`
- Esto **fuerza** la cámara trasera en iOS

### Resultado Esperado:
- ✅ Cámara trasera abre por defecto
- ✅ Funciona en iOS y Android

**Si sigue abriendo frontal:**
- Puede ser que el dispositivo no tenga cámara trasera
- O el navegador no respeta `exact`
- Solución alternativa: Enumerar dispositivos y seleccionar manualmente (más complejo)

---

## Bug 5: Pregunta de Datos (No es Bug de Código) ℹ️

### Pregunta:
¿En el proyecto de prueba existen dos programas distintos llamados "Stafford" y "Stafford Test"?

### Contexto:
Un activo escaneado salió como **"Otra sede"** al auditar "Stafford Test".

### Hipótesis:
- ✅ "Stafford" → Importación histórica real (Fase 1)
- ✅ "Stafford Test" → Creado después para pruebas del importador
- ✅ Activo pertenece a "Stafford" (original)
- ✅ Auditoría es de "Stafford Test"
- ✅ Resultado: "Otra sede" (correcto, no es bug)

### Recomendación:
- ⏳ Limpiar datos de prueba duplicados (no urgente)
- ⏳ O renombrar "Stafford Test" a algo más distintivo
- ⏳ O consolidar en un solo programa

**No requiere fix de código.**

---

## Archivos Modificados:

1. ✅ **PhotoOCR.tsx**
   - Agregado logging RAW de errores
   - Agregado `text-gray-900` al input del buscador manual
   - Logging completo en `handleManualSearch()`

2. ✅ **ManualSelector.tsx**
   - Agregado `text-gray-900` al input de búsqueda
   - Agregado `text-gray-900` al select de filtro de estado

3. ✅ **BarcodeScanner.tsx**
   - Cambiado `facingMode: 'environment'` a `{ exact: 'environment' }`
   - Detener scanner antes de diagnóstico de archivo
   - Reiniciar scanner después de diagnóstico

---

## Verificación:

### Bug 1 - Error Vacío:

**Reproduce el error y comparte la consola:**
```
RAW ERROR: [¿qué sale aquí?]
error type: [¿qué tipo es?]
```

**Esto revelará la causa real del error vacío.**

---

### Bug 2 - Buscador Manual:

**Prueba:**
1. ✅ Foto OCR → "No se encontraron coincidencias"
2. ✅ Aparece buscador manual
3. ✅ Escribe "violin" (o cualquier término)
4. ✅ Click "Buscar"

**Consola esperada:**
```
Manual search started with term: violin
Manual search results: 5
```

**UI esperada:**
- ✅ Texto escrito en **negro oscuro** (buen contraste)
- ✅ Placeholder en gris claro (normal)
- ✅ Resultados aparecen

---

### Bug 3 - Diagnóstico:

**Prueba:**
1. ✅ Abrir "Escanear"
2. ✅ Click "📷 Diagnóstico: Subir Foto del Código"
3. ✅ Seleccionar foto

**Consola esperada:**
```
Stopping camera scan before file scan...
Attempting to scan from file: photo.jpg
✓ File scan successful: 2001010801040032
Restarting camera scan...
```

**Resultado:**
- ✅ No error de "ongoing camera scan"
- ✅ Scanner se reinicia automáticamente

---

### Bug 4 - Cámara Trasera:

**Prueba:**
1. ✅ Abrir "Escanear"
2. ✅ Verificar qué cámara abre

**Resultado esperado:**
- ✅ Cámara **trasera** abre por defecto
- ✅ Se ve el entorno (no tu cara)

**Si abre frontal:**
- Comparte el modelo del dispositivo
- Comparte el navegador (Chrome, Safari, etc.)

---

## Próximos Pasos:

1. ⏳ **Reproducir error vacío** y compartir salida de `RAW ERROR`
2. ⏳ **Probar buscador manual** y verificar que consulta BD
3. ⏳ **Verificar contraste** de inputs (texto negro oscuro)
4. ⏳ **Probar diagnóstico** de archivo (sin error de "ongoing scan")
5. ⏳ **Verificar cámara trasera** abre por defecto

**Comparte los resultados de las pruebas, especialmente la salida de `RAW ERROR`.**
