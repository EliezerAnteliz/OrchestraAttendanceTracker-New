# FIX: React Strict Mode - Doble Cámara

**Fecha:** 23 de julio de 2026  
**Estado:** ✅ RESUELTO

---

## Causa Raíz Identificada

### El Problema Real

**NO era la cámara ni la librería** — era React Strict Mode causando doble montaje del componente.

### Diagnóstico

El `useEffect` que arranca la cámara **no tenía protección contra doble-invocación** de React Strict Mode (modo desarrollo de Next.js monta → desmonta → vuelve a montar el efecto a propósito).

### Secuencia del Bug

```
1. React Strict Mode monta el componente
   ↓
2. useEffect inicia → startScanner() (async)
   ↓
3. getUserMedia obtiene stream temporal
   ↓
4. React Strict Mode DESMONTA (cleanup)
   ↓
5. stopScanner() se ejecuta pero scannerRef.current es null
   (porque startScanner() aún no terminó)
   ↓
6. Stream temporal NO se detiene → CÁMARA HUÉRFANA #1
   ↓
7. React Strict Mode VUELVE A MONTAR
   ↓
8. Segundo useEffect inicia → startScanner() otra vez
   ↓
9. Segundo getUserMedia obtiene stream → CÁMARA #2
   ↓
10. html5QrCode.start() con deviceId → CÁMARA #3 (?)
```

**Resultado:** 2-3 cámaras abiertas simultáneamente

---

## Síntomas Observados

### 1. Dos Cámaras Simultáneas

- **Indicador:** "Cámara trasera triple (facingMode: environment)"
- **Video:** Mostraba cámara frontal (cara del usuario)
- **Causa:** Stream temporal huérfano + nueva cámara de html5-qrcode

### 2. Scanner Not Initialized

- **Error:** "Scanner not initialized" en diagnóstico por archivo
- **Causa:** `scannerRef.current` se asignaba DESPUÉS de `start()`, pero el cleanup lo limpiaba antes

### 3. Comportamiento Inconsistente

- A veces funcionaba, a veces no
- Dependía del timing de React Strict Mode
- Más evidente en desarrollo que en producción

---

## Solución Implementada

### Flag de Cancelación

**Concepto:** Agregar un flag `cancelled` que se marca `true` en el cleanup del `useEffect`. Cada punto del arranque async revisa este flag antes de continuar.

### Código Antes (INCORRECTO)

```typescript
useEffect(() => {
  startScanner();
  return () => {
    stopScanner();
  };
}, []);

async function startScanner() {
  const tempStream = await getUserMedia(...);
  const deviceId = tempStream.getVideoTracks()[0].getSettings().deviceId;
  tempStream.getTracks().forEach(t => t.stop());
  
  const html5QrCode = new Html5Qrcode('barcode-reader');
  await html5QrCode.start({ deviceId: { exact: deviceId } }, ...);
  
  scannerRef.current = html5QrCode; // ← Asignado al final
}

async function stopScanner() {
  if (scannerRef.current && scanning) { // ← scannerRef.current puede ser null
    await scannerRef.current.stop();
  }
}
```

**Problemas:**
1. ❌ No hay forma de cancelar `startScanner()` a mitad de ejecución
2. ❌ `stopScanner()` no puede detener el stream temporal (no tiene referencia)
3. ❌ `scannerRef.current` se asigna al final, puede quedar null en cleanup

---

### Código Después (CORRECTO)

```typescript
useEffect(() => {
  let cancelled = false; // ← Flag de cancelación

  async function init() {
    try {
      const tempStream = await getUserMedia(...);
      
      if (cancelled) { // ← Revisar después de cada await
        tempStream.getTracks().forEach(t => t.stop());
        return;
      }
      
      const deviceId = tempStream.getVideoTracks()[0].getSettings().deviceId;
      tempStream.getTracks().forEach(t => t.stop());
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (cancelled) { // ← Revisar de nuevo
        return;
      }
      
      const html5QrCode = new Html5Qrcode('barcode-reader');
      await html5QrCode.start({ deviceId: { exact: deviceId } }, ...);
      
      if (cancelled) { // ← Revisar después de start
        await html5QrCode.stop();
        html5QrCode.clear();
        return;
      }
      
      scannerRef.current = html5QrCode; // ← Solo si no cancelado
      setScanning(true);
    } catch (err: any) {
      if (cancelled) return; // ← No mostrar errores de ejecución cancelada
      // ... manejo de error
    }
  }

  init();

  return () => {
    cancelled = true; // ← Marcar como cancelado
    
    if (scannerRef.current) {
      const toStop = scannerRef.current;
      scannerRef.current = null;
      toStop.stop()
        .then(() => toStop.clear())
        .catch((e) => console.error('Error stopping scanner on cleanup:', e));
    }
    setScanning(false);
  };
}, []);
```

**Ventajas:**
1. ✅ Cada `await` revisa si fue cancelado
2. ✅ Stream temporal se detiene inmediatamente si hay cancelación
3. ✅ html5-qrcode se detiene si termina de arrancar después de cancelación
4. ✅ No se asigna `scannerRef.current` si fue cancelado
5. ✅ Cleanup detiene instancia real si existe

---

## Puntos de Verificación del Flag

### 1. Después de getUserMedia

```typescript
const tempStream = await navigator.mediaDevices.getUserMedia(...);

if (cancelled) {
  tempStream.getTracks().forEach(t => t.stop());
  return;
}
```

**Por qué:** Permiso de cámara puede tardar, usuario puede cerrar mientras espera

---

### 2. Después del Delay

```typescript
await new Promise(resolve => setTimeout(resolve, 500));

if (cancelled) {
  return;
}
```

**Por qué:** 500ms es tiempo suficiente para un remount de Strict Mode

---

### 3. Después de html5QrCode.start()

```typescript
await html5QrCode.start(...);

if (cancelled) {
  await html5QrCode.stop();
  html5QrCode.clear();
  return;
}
```

**Por qué:** `start()` puede tardar, si termina después de desmontaje, detenerla inmediatamente

---

### 4. En el Catch

```typescript
catch (err: any) {
  if (cancelled) return; // No mostrar errores de ejecución cancelada
  // ...
}
```

**Por qué:** Errores de una ejecución cancelada no son relevantes

---

## Función restartScanner

**Nueva función** para reiniciar la cámara después del diagnóstico por archivo:

```typescript
async function restartScanner() {
  try {
    const tempStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    const videoTrack = tempStream.getVideoTracks()[0];
    const deviceId = videoTrack.getSettings().deviceId;
    tempStream.getTracks().forEach(t => t.stop());
    await new Promise(resolve => setTimeout(resolve, 500));

    const html5QrCode = new Html5Qrcode('barcode-reader');
    await html5QrCode.start(
      { deviceId: { exact: deviceId } },
      { ... },
      onScanSuccess,
      onScanFailure
    );
    scannerRef.current = html5QrCode;
    setScanning(true);
  } catch (err: any) {
    console.error('Error restarting scanner:', err);
    setErrorInfo(`🔴 Error al reiniciar cámara: ${err?.message || err?.name}`);
  }
}
```

**Uso:** Después de `scanFile()` en `handleFileUpload`

---

## Diagnóstico por Archivo Actualizado

```typescript
async function handleFileUpload(file: File) {
  try {
    // Detener scanner de cámara
    if (scannerRef.current) {
      await stopScanner();
    }

    // Crear instancia NUEVA para archivo (no usa cámara)
    const fileScanner = new Html5Qrcode('barcode-reader');
    const decodedText = await fileScanner.scanFile(file, false);
    await onScanSuccess(decodedText);

    // Reiniciar scanner de cámara
    await restartScanner();
  } catch (err: any) {
    // Reiniciar incluso si falla
    if (!scannerRef.current) {
      await restartScanner();
    }
  }
}
```

**Cambio clave:** Instancia nueva para archivo, no reutiliza `scannerRef.current`

---

## Resultados

### ✅ Problema Resuelto

1. ✅ **Una sola cámara** abre correctamente
2. ✅ **Cámara trasera** (no frontal)
3. ✅ **Video correcto** (entorno, no cara)
4. ✅ **Diagnóstico por archivo** funciona
5. ✅ **Sin cámaras huérfanas** en segundo plano

### ✅ Botón Reactivado

- Botón "Escanear" visible y funcional
- Layout vuelto a `grid-cols-3`
- Manual y Foto OCR siguen funcionando

---

## Lecciones Aprendidas

### 1. React Strict Mode es Importante

**Propósito:** Detectar efectos secundarios y problemas de ciclo de vida

**Comportamiento:** Monta → Desmonta → Vuelve a montar (solo en desarrollo)

**Implicación:** Cualquier efecto async debe ser cancelable

---

### 2. Siempre Usar Flag de Cancelación

**Patrón recomendado para useEffect con async:**

```typescript
useEffect(() => {
  let cancelled = false;

  async function init() {
    const result = await someAsyncOperation();
    if (cancelled) return;
    
    const result2 = await anotherAsyncOperation();
    if (cancelled) return;
    
    // ... usar resultados
  }

  init();

  return () => {
    cancelled = true;
    // ... cleanup
  };
}, []);
```

---

### 3. Recursos Externos Requieren Cleanup Robusto

**Cámaras, sockets, timers, etc.** deben limpiarse en cleanup:

```typescript
return () => {
  cancelled = true;
  
  // Limpiar recursos externos
  if (externalResource) {
    externalResource.cleanup();
  }
};
```

---

### 4. Debugging Sin Consola es Difícil

**Solución:** Indicadores visuales en pantalla

```tsx
<div className="absolute top-4 left-4 right-4 bg-yellow-500 text-black p-3 rounded-lg">
  <p>{cameraInfo}</p>
</div>
```

**Ventaja:** Ver estado sin acceso a consola del dispositivo

---

## Archivos Modificados

### 1. BarcodeScanner.tsx

**Cambios:**
- ✅ useEffect con flag `cancelled`
- ✅ Verificaciones después de cada `await`
- ✅ Cleanup robusto
- ✅ Función `restartScanner()`
- ✅ `handleFileUpload()` actualizado
- ✅ `onScanFailure()` mejorado

---

### 2. page.tsx

**Cambios:**
- ✅ Botón "Escanear" reactivado
- ✅ Layout vuelto a `grid-cols-3`
- ✅ Comentarios de pausa removidos

---

## Verificación

### Checklist de Prueba

1. ✅ Abrir "Escanear"
2. ✅ Verificar indicador: "📷 Back Camera (facingMode: environment)"
3. ✅ Verificar video: Muestra entorno (no cara)
4. ✅ Apuntar a código de barras
5. ✅ Verificar detección correcta
6. ✅ Probar diagnóstico por archivo
7. ✅ Verificar que Manual y Foto OCR siguen funcionando

---

### Consola Esperada

```javascript
Initializing barcode scanner with html5-qrcode...
Requesting temporary camera access to identify deviceId...
========================================
CÁMARA IDENTIFICADA: Back Camera
Device ID: abc123...
Facing mode: environment
========================================
Stopping temporary stream...
Track stopped: video Back Camera
Temporary stream fully released
Starting html5-qrcode with deviceId: abc123...
Scanner started successfully with deviceId
```

**NO debe aparecer:**
- ❌ Mensajes duplicados
- ❌ "Init finished after unmount"
- ❌ Errores de cámara en uso

---

## Conclusión

**El problema NO era:**
- ❌ La librería html5-qrcode
- ❌ La configuración de cámara
- ❌ El deviceId
- ❌ iOS Safari

**El problema ERA:**
- ✅ React Strict Mode causando doble montaje
- ✅ useEffect sin protección contra cancelación
- ✅ Recursos externos (cámara) no limpiados correctamente

**La solución:**
- ✅ Flag `cancelled` en useEffect
- ✅ Verificaciones después de cada `await`
- ✅ Cleanup robusto de recursos

---

**ESCANEO POR CÓDIGO DE BARRAS FUNCIONANDO CORRECTAMENTE** ✅
