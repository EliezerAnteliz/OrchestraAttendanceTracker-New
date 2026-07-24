# Diagnóstico: Verificar Cámara Real en Uso

## Objetivo

Después de 3 intentos fallidos (deviceId, exact:'environment', copiar PhotoOCR), necesitamos **verificar con datos reales** qué cámara está usando el scanner.

---

## Código de Diagnóstico Agregado

```typescript
// Después de html5QrCode.start()
setTimeout(() => {
  const videoEl = (document.querySelector('#barcode-reader video') || document.querySelector('video')) as HTMLVideoElement;
  const stream = videoEl?.srcObject as MediaStream;
  const videoTrack = stream?.getVideoTracks()[0];
  
  console.log('========================================');
  console.log('CÁMARA REAL EN USO:', videoTrack?.label);
  console.log('Video track settings:', videoTrack?.getSettings());
  console.log('Video track capabilities:', videoTrack?.getCapabilities());
  console.log('========================================');
}, 1000);
```

---

## Qué Verificar

### 1. Abrir "Escanear" en iPhone

### 2. Ver Consola en Safari Inspector

**Buscar el bloque:**
```
========================================
CÁMARA REAL EN USO: [¿Qué dice aquí?]
Video track settings: {...}
Video track capabilities: {...}
========================================
```

---

## Resultados Posibles

### Resultado A: Cámara Frontal (Confirma el problema)

```javascript
========================================
CÁMARA REAL EN USO: Front Camera
Video track settings: {
  facingMode: "user",  // ← FRONTAL
  ...
}
========================================
```

**Conclusión:** html5-qrcode NO está respetando `facingMode: 'environment'`

**Acción:** Cambiar a controlar el stream nosotros mismos (como PhotoOCR)

---

### Resultado B: Cámara Trasera (Funcionó)

```javascript
========================================
CÁMARA REAL EN USO: Back Camera
Video track settings: {
  facingMode: "environment",  // ← TRASERA ✅
  ...
}
========================================
```

**Conclusión:** Funcionó correctamente

**Acción:** Ninguna, problema resuelto

---

## Si Confirma Cámara Frontal → Solución Alternativa

### Problema Confirmado:
html5-qrcode gestiona su propia llamada a `getUserMedia` internamente y **NO respeta `facingMode`** de forma confiable en iOS.

### Solución:
**Replicar EXACTAMENTE lo que hace PhotoOCR:**

1. ✅ Capturar el stream nosotros mismos con `getUserMedia`
2. ✅ Asignarlo a un `<video>` que controlamos
3. ✅ Decodificar códigos desde ESE video con una librería alternativa

---

## Plan de Implementación (Si es necesario)

### Opción 1: Usar @zxing/browser

```typescript
import { BrowserMultiFormatReader } from '@zxing/browser';

async function startScanner() {
  // 1. Obtener stream (IGUAL que PhotoOCR)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
  
  // 2. Asignar a video
  const videoEl = document.querySelector('#barcode-video') as HTMLVideoElement;
  videoEl.srcObject = stream;
  await videoEl.play();
  
  // 3. Decodificar desde video
  const codeReader = new BrowserMultiFormatReader();
  codeReader.decodeFromVideoElement(videoEl, (result, error) => {
    if (result) {
      console.log('Código detectado:', result.getText());
      onScanSuccess(result.getText());
    }
  });
}
```

### Opción 2: Usar html5-qrcode con stream existente

```typescript
async function startScanner() {
  // 1. Obtener stream (IGUAL que PhotoOCR)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
  
  console.log('Stream obtenido:', stream.getVideoTracks()[0].label);
  
  // 2. Pasar stream a html5-qrcode (si soporta)
  const html5QrCode = new Html5Qrcode('barcode-reader');
  // Verificar si html5-qrcode acepta stream directamente
  // (puede que no sea posible)
}
```

---

## Ventajas de Controlar el Stream

1. ✅ **Mismo mecanismo que PhotoOCR** (probado y funcionando)
2. ✅ **Control total sobre la cámara** (no depende de html5-qrcode)
3. ✅ **Garantiza cámara trasera** (ya sabemos que `getUserMedia` funciona)
4. ✅ **Más flexible** (podemos cambiar de librería de decodificación)

---

## Dependencias Necesarias

### @zxing/browser

```bash
npm install @zxing/browser
```

**Ventajas:**
- ✅ Soporta múltiples formatos (Code128, Code39, EAN, etc.)
- ✅ Permite decodificar desde `HTMLVideoElement` existente
- ✅ Activamente mantenido
- ✅ TypeScript nativo

---

## Checklist de Diagnóstico

- [ ] Abrir "Escanear" en iPhone
- [ ] Conectar Safari Inspector
- [ ] Ver consola
- [ ] Buscar bloque `========================================`
- [ ] Leer `CÁMARA REAL EN USO: [...]`
- [ ] Verificar `facingMode` en settings
- [ ] Compartir salida completa

---

## Próximos Pasos

### Paso 1: Diagnóstico (AHORA)
- Ejecutar en iPhone
- Compartir salida de consola

### Paso 2A: Si es cámara frontal
- Implementar solución con `getUserMedia` + @zxing/browser
- Replicar exactamente PhotoOCR

### Paso 2B: Si es cámara trasera
- ¡Funcionó! No hacer nada más

---

## Ejemplo de Salida Esperada

```javascript
Initializing barcode scanner...
Starting camera with barcode formats...
QR Box size: 480 x 240
Scanner configuration: {
  facingMode: 'environment',
  fps: 30,
  formats: [...]
}
Scanner started successfully
========================================
CÁMARA REAL EN USO: Front Camera  ← O "Back Camera"
Video track settings: {
  aspectRatio: 1.777777777777778,
  deviceId: "abc123...",
  facingMode: "user",  ← O "environment"
  frameRate: 30,
  height: 720,
  width: 1280
}
Video track capabilities: {
  aspectRatio: {...},
  deviceId: "abc123...",
  facingMode: ["user", "environment"],  ← Capacidades del dispositivo
  frameRate: {...},
  height: {...},
  width: {...}
}
========================================
```

---

**CRÍTICO: Ejecuta en iPhone y comparte la salida completa del bloque `========================================`**

**Esto nos dirá definitivamente si el problema es html5-qrcode o algo más.**
