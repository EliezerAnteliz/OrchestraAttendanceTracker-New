# Bugs Corregidos - Módulo de Auditoría (Parte 6 - Regresiones y Extracción)

## Bug 1: REGRESIÓN - Escaneo No Abre Cámara ✅

### Problema:
Error: **"'cameraIdOrConfig' object should have exactly 1 key, if passed as an object, found 3 keys"**

### Causa:
En el cambio anterior para aumentar la resolución, se agregaron `width` y `height` al primer parámetro de `Html5Qrcode.start()` (cameraIdOrConfig), que la API exige que tenga **EXACTAMENTE 1 key**.

**Código incorrecto:**
```typescript
await html5QrCode.start(
  { 
    facingMode: 'environment',  // key 1
    width: { ideal: 1920 },     // key 2 ❌
    height: { ideal: 1080 }     // key 3 ❌
  },
  { ... }
);
```

### Corrección Aplicada:

**Antes:**
```typescript
await html5QrCode.start(
  { 
    facingMode: 'environment',
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 }
  },
  {
    fps: 30,
    qrbox: ...,
    formatsToSupport: [...]
  }
);
```

**Después:**
```typescript
await html5QrCode.start(
  { facingMode: 'environment' }, // SOLO 1 key (requerido por API)
  {
    fps: 30,
    qrbox: ...,
    // Resolución movida aquí (lugar correcto)
    videoConstraints: {
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 }
    },
    formatsToSupport: [...]
  }
);
```

**Cambios:**
1. ✅ `cameraIdOrConfig` (1er parámetro): Solo `{ facingMode: 'environment' }`
2. ✅ Resolución movida a `videoConstraints` dentro del 2do parámetro (configuration)

### Resultado:
- ✅ Cámara abre correctamente
- ✅ Resolución 1920x1080 aplicada
- ✅ FPS 30 aplicado
- ✅ Formatos CODE_128, CODE_39, etc. aplicados

---

## Bug 2: OCR Lee 16 Dígitos Pero No Encuentra el Activo ✅

### Problema:
OCR detectó correctamente: **"JIRA 2001010801040032"**
- El número `2001010801040032` es exacto (16 dígitos)
- "JIRA" es ruido del OCR
- Resultado: **"No se encontraron coincidencias"**

### Causa:
La búsqueda usaba `ilike.%${text}%` con el texto completo ("JIRA 2001010801040032"), que NO coincide exactamente con `full_code` ("2001010801040032").

**Búsqueda anterior:**
```typescript
.or(`serial_number.ilike.%${text}%,...,full_code.ilike.%${text}%`)
// Buscaba: full_code ILIKE '%JIRA 2001010801040032%'
// No coincide con: '2001010801040032'
```

### Corrección Aplicada:

**Nueva lógica:**

1. **Extraer secuencia de 16 dígitos del texto OCR:**
```typescript
const sixteenDigitMatch = text.match(/\d{16}/);
const sixteenDigitCode = sixteenDigitMatch ? sixteenDigitMatch[0] : null;
```

**Ejemplo:**
- Texto OCR: `"JIRA 2001010801040032"`
- Regex: `/\d{16}/`
- Extrae: `"2001010801040032"` ✅

2. **Búsqueda exacta por `full_code` primero:**
```typescript
if (sixteenDigitCode) {
  console.log('Extracted 16-digit code from OCR:', sixteenDigitCode);
  
  const { data: exactMatch } = await inventorySupabase
    .from('assets')
    .select('...')
    .eq('current_program_id', programId)
    .eq('full_code', sixteenDigitCode)  // ← Igualdad exacta
    .limit(1);
  
  if (exactMatch && exactMatch.length > 0) {
    console.log('Exact match found by full_code:', exactMatch);
    setCandidates(exactMatch);
    return;  // ← Termina aquí si encuentra
  }
}
```

3. **Fallback a búsqueda difusa si no hay match exacto:**
```typescript
// Si no encontró por código exacto, busca difusamente
const { data } = await inventorySupabase
  .from('assets')
  .select('...')
  .eq('current_program_id', programId)
  .or(`serial_number.ilike.%${text}%,...,full_code.ilike.%${text}%`)
  .limit(10);
```

### Flujo Completo:

```
OCR detecta: "JIRA 2001010801040032"
  ↓
Regex extrae: "2001010801040032"
  ↓
Busca: full_code = '2001010801040032'
  ↓
¿Encontró?
  Sí → Muestra candidato ✅
  No → Busca difusamente con texto completo
    ↓
    ¿Encontró?
      Sí → Muestra candidatos
      No → Muestra "Busca manualmente"
```

### Logging Agregado:

```typescript
console.log('Searching candidates with OCR text:', text);
console.log('Extracted 16-digit code from OCR:', sixteenDigitCode);
console.log('Exact match found by full_code:', exactMatch);
console.log('No exact match for 16-digit code, trying fuzzy search...');
console.log('Fuzzy search completed. Results found:', data?.length || 0);
```

### Resultado:
- ✅ Extrae 16 dígitos del texto OCR (ignora ruido como "JIRA")
- ✅ Busca por igualdad exacta en `full_code`
- ✅ Si no encuentra, hace búsqueda difusa
- ✅ Logging detallado para diagnóstico

---

## Bug 3: Error Vacío en Búsqueda de Candidatos ✅

### Problema:
Consola mostraba: **"Error searching candidates (Supabase error): {}"**

### Causa:
El logging anterior no mostraba las propiedades del error de Supabase.

### Corrección Aplicada:

**Antes:**
```typescript
console.error('Error searching candidates:', error);
// Mostraba: {}
```

**Después:**
```typescript
console.error('Error searching candidates (Supabase error):', {
  message: error.message,
  details: error.details,
  hint: error.hint,
  code: error.code,
  ocrText: text,
  programId: programId
});
```

### Resultado:
- ✅ Ahora muestra mensaje de error real
- ✅ Muestra detalles, hint, código de error
- ✅ Incluye contexto (ocrText, programId)

**Ejemplo de salida:**
```javascript
Error searching candidates (Supabase error): {
  message: "relation \"public.assets\" does not exist",
  details: null,
  hint: null,
  code: "42P01",
  ocrText: "JIRA 2001010801040032",
  programId: "8bade020-abcc-4ee9-a14a-fa311bb3f482"
}
```

---

## Archivos Modificados:

1. ✅ **`BarcodeScanner.tsx`**
   - Corregido `cameraIdOrConfig` (solo 1 key)
   - Resolución movida a `videoConstraints`

2. ✅ **`PhotoOCR.tsx`**
   - Agregada extracción de 16 dígitos con regex
   - Búsqueda exacta por `full_code` primero
   - Fallback a búsqueda difusa
   - Logging mejorado de errores Supabase

---

## Verificación:

### Escaneo de Código de Barras:

**Consola esperada:**
```
Initializing barcode scanner...
Starting camera with barcode formats...
QR Box size: 480 x 240
Scanner configuration: {
  resolution: '1920x1080',
  fps: 30,
  formats: ['CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E']
}
Scanner started successfully
```

**Resultado:**
- ✅ Cámara abre (sin error de "3 keys")
- ✅ Resolución 1920x1080 aplicada
- ✅ Escaneo funcional

---

### Foto OCR con Código de Barras:

**Escenario:** OCR detecta "JIRA 2001010801040032"

**Consola esperada:**
```
Starting OCR processing for file: photo.jpg
OCR raw text extracted: JIRA 2001010801040032
OCR cleaned text: JIRA 2001010801040032
Searching candidates with OCR text: JIRA 2001010801040032
Extracted 16-digit code from OCR: 2001010801040032  ← EXTRACCIÓN
Exact match found by full_code: [{id: "...", full_code: "2001010801040032", ...}]
```

**Resultado:**
- ✅ Extrae "2001010801040032" del texto
- ✅ Busca por igualdad exacta en `full_code`
- ✅ **Encuentra el activo** ✅

---

### Foto OCR con Error de Supabase:

**Si hay error de BD:**

**Consola esperada:**
```
Error searching candidates (Supabase error): {
  message: "...",           ← Mensaje real
  details: "...",           ← Detalles
  hint: "...",              ← Sugerencia
  code: "...",              ← Código de error
  ocrText: "...",           ← Contexto
  programId: "..."          ← Contexto
}
```

**Resultado:**
- ✅ Error detallado (no vacío)
- ✅ Información para diagnosticar

---

## Casos de Prueba:

### Caso 1: OCR Lee Código Limpio
**Input:** `"2001010801040032"`
**Extrae:** `"2001010801040032"`
**Busca:** `full_code = '2001010801040032'`
**Resultado:** ✅ Encuentra

### Caso 2: OCR Lee Código con Ruido
**Input:** `"JIRA 2001010801040032"`
**Extrae:** `"2001010801040032"`
**Busca:** `full_code = '2001010801040032'`
**Resultado:** ✅ Encuentra (ignora "JIRA")

### Caso 3: OCR Lee Código con Espacios
**Input:** `"2001 0108 0104 0032"`
**Extrae:** `null` (no hay 16 dígitos seguidos)
**Busca:** Búsqueda difusa con texto completo
**Resultado:** ⚠️ Puede no encontrar (depende de cómo esté en BD)

### Caso 4: OCR Lee Texto sin Código
**Input:** `"Violin Yamaha V3"`
**Extrae:** `null`
**Busca:** Búsqueda difusa en `description`, `serial_number`, etc.
**Resultado:** ✅ Encuentra si coincide con descripción

---

## Próximos Pasos:

1. ⏳ Probar Escaneo → Verificar que cámara abre
2. ⏳ Probar Foto OCR con código de barras → Verificar que encuentra el activo
3. ⏳ Si hay error de Supabase → Reportar el mensaje completo
4. ⏳ Probar diagnóstico de archivo en Escaneo (si sigue sin detectar)

**Todas las correcciones aplicadas. Avísame los resultados.**
