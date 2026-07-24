# Verificación: Cámara Trasera en iOS

## ✅ Cambio Crítico Implementado

**Problema confirmado:** Sigue abriendo cámara frontal en iOS real.

**Solución aplicada:** Usar `deviceId` con `exact` en lugar de `facingMode`.

---

## Código Correcto Implementado

### Antes (NO FUNCIONABA):
```typescript
await html5QrCode.start(
  cameraId || { facingMode: { exact: 'environment' } },  // ❌ Pasaba string directamente
  { ... }
);
```

### Después (CORRECTO):
```typescript
const cameraConfig = cameraId 
  ? { deviceId: { exact: cameraId } }  // ✅ Formato correcto con exact
  : { facingMode: { exact: 'environment' } };

await html5QrCode.start(
  cameraConfig,  // ✅ Objeto con deviceId.exact
  { ... }
);
```

---

## Flujo Completo de Selección

```typescript
// 1. Enumerar dispositivos
const devices = await navigator.mediaDevices.enumerateDevices();
const videoDevices = devices.filter(device => device.kind === 'videoinput');

// 2. Buscar cámara trasera por label
let rearCamera = videoDevices.find(device => 
  device.label.toLowerCase().includes('back') ||
  device.label.toLowerCase().includes('rear')
);

// 3. Fallback: última cámara (iOS)
if (!rearCamera && videoDevices.length > 1) {
  rearCamera = videoDevices[videoDevices.length - 1];
}

// 4. Construir config con deviceId.exact
const cameraConfig = cameraId 
  ? { deviceId: { exact: cameraId } }
  : { facingMode: { exact: 'environment' } };

// 5. Iniciar con deviceId específico
await html5QrCode.start(cameraConfig, { ... });
```

---

## Logging para Verificación

**Consola mostrará:**

```javascript
Initializing barcode scanner...
Enumerating camera devices...
Available cameras: [
  { id: "abc123...", label: "Front Camera" },
  { id: "def456...", label: "Back Camera" }
]
Selected camera: {
  id: "def456...",
  label: "Back Camera"
}
Starting camera with barcode formats...
Camera config: { deviceId: { exact: "def456..." } }  // ← IMPORTANTE: Debe mostrar deviceId
QR Box size: 480 x 240
Scanner configuration: {
  camera: "Back Camera",
  resolution: "1920x1080",
  fps: 30,
  formats: [...]
}
Scanner started successfully
```

---

## Verificación en iOS Safari

### Paso 1: Conectar iPhone a Mac

1. Conectar iPhone con cable
2. En iPhone: Ajustes → Safari → Avanzado → Activar "Inspector Web"
3. En Mac: Safari → Preferencias → Avanzado → Mostrar menú Desarrollo

### Paso 2: Abrir Inspector

1. En iPhone: Abrir la app en Safari
2. En Mac: Safari → Develop → [Tu iPhone] → [página]
3. Se abre el inspector web

### Paso 3: Abrir Escaneo y Verificar Consola

1. En iPhone: Click "Escanear"
2. En Mac Inspector: Ver pestaña "Console"
3. **Verificar salida:**

**✅ Correcto (cámara trasera):**
```
Available cameras: [
  { id: "...", label: "Front Camera" },
  { id: "...", label: "Back Camera" }
]
Selected camera: { id: "...", label: "Back Camera" }
Camera config: { deviceId: { exact: "..." } }
```

**❌ Incorrecto (sigue frontal):**
```
Available cameras: [
  { id: "...", label: "Front Camera" },
  { id: "...", label: "Back Camera" }
]
Selected camera: { id: "...", label: "Front Camera" }  ← Seleccionó mal
```

### Paso 4: Verificar Visualmente

**En el iPhone:**
- ✅ **Cámara trasera:** Se ve el entorno, objetos alrededor
- ❌ **Cámara frontal:** Se ve tu cara

---

## Casos Posibles

### Caso A: Labels Claros (Común en iOS moderno)

**Consola:**
```
Available cameras: [
  { label: "Front Camera" },
  { label: "Back Camera" }
]
Selected camera: { label: "Back Camera" }
```

**Resultado esperado:** ✅ Cámara trasera

---

### Caso B: Labels Vacíos (Antes de dar permiso)

**Consola:**
```
Available cameras: [
  { label: "" },
  { label: "" }
]
No rear camera found by label, using last camera (iOS fallback)
Selected camera: { label: "" }
```

**Resultado esperado:** ✅ Cámara trasera (última en lista)

---

### Caso C: iPhone con Múltiples Cámaras Traseras

**Consola:**
```
Available cameras: [
  { label: "Front Camera" },
  { label: "Back Camera" },
  { label: "Back Ultra Wide Camera" },
  { label: "Back Telephoto Camera" }
]
Selected camera: { label: "Back Camera" }  ← Primera trasera
```

**Resultado esperado:** ✅ Cámara trasera principal

---

## Si SIGUE Abriendo Frontal

### Diagnóstico 1: Verificar Consola

**Comparte la salida completa:**
```
Available cameras: [...]
Selected camera: {...}
Camera config: {...}
```

**Preguntas:**
1. ¿Cuántas cámaras detectó?
2. ¿Qué labels tienen?
3. ¿Cuál seleccionó?
4. ¿Qué muestra `Camera config`?

### Diagnóstico 2: Verificar Permisos

**En iPhone:**
1. Ajustes → Safari → Cámara
2. Verificar que esté en "Preguntar" o "Permitir"
3. Si está en "Denegar", cambiar a "Preguntar"
4. Recargar página y dar permiso de nuevo

### Diagnóstico 3: Probar Manualmente

**En consola del inspector (Mac):**
```javascript
// Listar cámaras
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log(devices.filter(d => d.kind === 'videoinput'));
});

// Probar cámara trasera directamente
navigator.mediaDevices.getUserMedia({
  video: { deviceId: { exact: 'ID_DE_LA_CAMARA_TRASERA' } }
}).then(stream => {
  console.log('Stream obtenido:', stream);
}).catch(err => {
  console.error('Error:', err);
});
```

---

## Cambios Realizados

**Archivo:** `BarcodeScanner.tsx`

**Líneas modificadas:**
- Línea 87-91: Construir `cameraConfig` con `{ deviceId: { exact: cameraId } }`
- Línea 93: Pasar `cameraConfig` en lugar de `cameraId` directamente

**Diferencia clave:**
```typescript
// ANTES (incorrecto)
await html5QrCode.start(cameraId, { ... });
// Pasaba: "abc123..." (string)

// DESPUÉS (correcto)
await html5QrCode.start({ deviceId: { exact: cameraId } }, { ... });
// Pasa: { deviceId: { exact: "abc123..." } } (objeto)
```

---

## Checklist de Verificación

- [ ] Código compiló sin errores
- [ ] Conecté iPhone a Mac
- [ ] Abrí inspector web de Safari
- [ ] Abrí "Escanear" en el iPhone
- [ ] Vi la consola en el inspector
- [ ] Consola muestra `Available cameras: [...]`
- [ ] Consola muestra `Selected camera: { label: "Back Camera" }`
- [ ] Consola muestra `Camera config: { deviceId: { exact: "..." } }`
- [ ] Visualmente se ve el **entorno** (no mi cara)
- [ ] Puedo escanear códigos de barras

---

## Resultado Esperado

**✅ ÉXITO:**
- Consola: `Selected camera: { label: "Back Camera" }`
- Visual: Se ve el entorno
- Funcional: Puede escanear códigos

**❌ FALLO:**
- Consola: `Selected camera: { label: "Front Camera" }`
- Visual: Se ve tu cara
- Acción: Compartir consola completa para diagnóstico

---

**IMPORTANTE: Prueba en dispositivo real (iOS Safari) y comparte la consola completa si sigue fallando.**
