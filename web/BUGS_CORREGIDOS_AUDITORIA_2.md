# Bugs Corregidos - Módulo de Auditoría (Parte 2)

## ✅ Progreso Confirmado

- ✅ Modal con backdrop semitransparente (correcto)
- ✅ Sesión se crea correctamente
- ✅ Auditoría manual funciona (3 activos probados: Viola/Antonio Strad, Violín/Terranova, Bass/CMI)
- ✅ Los 3 quedaron en "Encontrados"

---

## Bug 1: Warning de React - router.push() en Render ✅

### Problema:
```
Warning: Cannot update a component (Router) while rendering a different component (AuditSessionPage)
```

**Ubicación:** `src/app/dashboard/inventory/audit/[id]/page.tsx:187`

### Causa:
`router.push()` se llamaba directamente en el cuerpo del render:

```typescript
if (session.status === 'closed') {
  router.push(`/dashboard/inventory/audit/${sessionId}/report`); // ❌ En render
  return null;
}
```

Esto viola las reglas de React: no se pueden ejecutar side effects (como navegación) durante el render.

### Corrección Aplicada:

**1. Agregado useEffect para navegación:**
```typescript
// Redirigir a reporte si la sesión está cerrada
useEffect(() => {
  if (session && session.status === 'closed') {
    router.push(`/dashboard/inventory/audit/${sessionId}/report`);
  }
}, [session, sessionId, router]);
```

**2. Cambiado el render condicional a mostrar loading:**
```typescript
// Si la sesión está cerrada, el useEffect se encargará de redirigir
if (session.status === 'closed') {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirigiendo al reporte...</p>
      </div>
    </div>
  );
}
```

### Resultado:
- ✅ Warning de React eliminado
- ✅ Navegación ocurre en el momento correcto (useEffect)
- ✅ UI muestra estado de carga mientras redirige

---

## Bug 2: Error en Foto OCR - Logging Mejorado ✅

### Problema:
```
Error searching candidates: {}
```

**Ubicación:** `src/app/dashboard/inventory/audit/[id]/PhotoOCR.tsx:72`

### Diagnóstico Implementado:

#### a) Logging Completo del Flujo OCR

**Agregado logging en cada paso:**

1. **Inicio del procesamiento:**
```typescript
console.log('Starting OCR processing for file:', file.name, file.size, 'bytes');
```

2. **Worker de Tesseract creado:**
```typescript
console.log('Tesseract worker created, recognizing text...');
```

3. **Texto extraído (raw):**
```typescript
console.log('OCR raw text extracted:', text);
```

4. **Texto limpio:**
```typescript
console.log('OCR cleaned text:', cleanedText);
```

5. **Búsqueda iniciada:**
```typescript
console.log('Searching candidates with OCR text:', text);
```

6. **Error de Supabase (si ocurre):**
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

7. **Resultados encontrados:**
```typescript
console.log('Search completed. Results found:', data?.length || 0);
```

#### b) Análisis de la Query

**Query actual:**
```typescript
.or(`serial_number.ilike.%${text}%,assigned_to_text.ilike.%${text}%,description.ilike.%${text}%`)
```

**Posibles causas del error:**

1. **RLS bloqueando lectura** (patrón ya visto)
   - Código esperado: `42501`
   - Solución: Ya aplicada en `audit_module_rls.sql` para `audit_sessions`/`audit_events`
   - **PERO:** `assets` ya tiene políticas RLS públicas (probado en importador y listado)

2. **Sintaxis ILIKE incorrecta**
   - ❌ `.ilike.%${text}%` podría ser sintaxis incorrecta
   - ✅ Debería ser `.ilike(%${text}%)`
   - **Sospecha fuerte:** Este es el problema

3. **Nombre de columna equivocado**
   - Verificar que `serial_number`, `assigned_to_text`, `description` existen
   - Verificar que no son `null` en todos los registros

### Corrección Sospechada (Pendiente de Confirmar):

La sintaxis `.ilike.%${text}%` es incorrecta. Debería ser:

```typescript
// ❌ Incorrecto
.or(`serial_number.ilike.%${text}%,assigned_to_text.ilike.%${text}%,description.ilike.%${text}%`)

// ✅ Correcto
.or(`serial_number.ilike.%${text}%,assigned_to_text.ilike.%${text}%,description.ilike.%${text}%`)
```

**ESPERA:** Revisando documentación de Supabase...

La sintaxis correcta para `.or()` con `.ilike()` es:

```typescript
// Opción 1: Usar textSearch o ilike directo
.textSearch('serial_number', text)

// Opción 2: Usar or con sintaxis correcta
.or(`serial_number.ilike.%${text}%,assigned_to_text.ilike.%${text}%,description.ilike.%${text}%`)
```

**Pero la sintaxis actual parece correcta según docs de Supabase.**

### Siguiente Paso:

**Ejecutar Foto OCR y revisar consola para ver:**

1. ¿Tesseract extrae texto correctamente?
   - Si sí → El error es en la búsqueda de BD
   - Si no → El error es en OCR

2. ¿Qué error exacto devuelve Supabase?
   - `message`: Descripción del error
   - `code`: Código de error (ej. "42501" = RLS, "42703" = columna no existe)
   - `details`: Detalles técnicos
   - `hint`: Sugerencia de Postgres

3. ¿Qué texto extrajo OCR?
   - Si es muy corto (<3 chars) → Muestra búsqueda manual
   - Si es válido → Intenta buscar en BD

---

## Archivos Modificados:

1. ✅ `src/app/dashboard/inventory/audit/[id]/page.tsx`
   - Agregado useEffect para navegación
   - Cambiado render condicional a loading state

2. ✅ `src/app/dashboard/inventory/audit/[id]/PhotoOCR.tsx`
   - Logging completo del flujo OCR
   - Logging detallado de errores de Supabase
   - Logging de texto extraído por Tesseract

---

## Próximos Pasos:

1. ⏳ Probar Foto OCR de nuevo
2. ⏳ Revisar consola del navegador
3. ⏳ Identificar error exacto:
   - ¿Tesseract leyó texto?
   - ¿Qué error devuelve Supabase?
   - ¿Es RLS, sintaxis, o columna inexistente?
4. ⏳ Aplicar corrección específica según el error real

---

## Verificación:

### Consola esperada (flujo exitoso):
```
Starting OCR processing for file: photo.jpg 123456 bytes
Tesseract worker created, recognizing text...
OCR raw text extracted: NYOSA14022
OCR cleaned text: NYOSA14022
Searching candidates with OCR text: NYOSA14022
Search completed. Results found: 2
Candidates found: [...]
```

### Consola esperada (error de BD):
```
Starting OCR processing for file: photo.jpg 123456 bytes
Tesseract worker created, recognizing text...
OCR raw text extracted: NYOSA14022
OCR cleaned text: NYOSA14022
Searching candidates with OCR text: NYOSA14022
Error searching candidates (Supabase error): {
  message: "...",
  details: "...",
  hint: "...",
  code: "..."
}
```

### Consola esperada (OCR sin texto):
```
Starting OCR processing for file: photo.jpg 123456 bytes
Tesseract worker created, recognizing text...
OCR raw text extracted: 
OCR cleaned text: 
OCR text too short, showing manual search: 
```

**Avísame qué muestra la consola al probar Foto OCR.**
