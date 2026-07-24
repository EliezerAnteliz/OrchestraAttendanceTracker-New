# Diagnóstico Visible en Pantalla

## Cambio Implementado

### Indicador Visual Agregado

**Ubicación:** Parte superior del scanner, recuadro amarillo con texto negro

**Contenido:**
```
📷 [Nombre de la cámara] (facingMode: [user/environment])
```

**Ejemplos:**
- `📷 Front Camera (facingMode: user)` ← FRONTAL ❌
- `📷 Back Camera (facingMode: environment)` ← TRASERA ✅

---

## Código Implementado

### Estado para mostrar info:
```typescript
const [cameraInfo, setCameraInfo] = useState<string>('Iniciando cámara...');
```

### Captura de info de cámara:
```typescript
setTimeout(() => {
  const videoEl = (document.querySelector('#barcode-reader video') || document.querySelector('video')) as HTMLVideoElement;
  const stream = videoEl?.srcObject as MediaStream;
  const videoTrack = stream?.getVideoTracks()[0];
  const settings = videoTrack?.getSettings();
  
  const cameraLabel = videoTrack?.label || 'Desconocida';
  const facingMode = settings?.facingMode || 'unknown';
  setCameraInfo(`📷 ${cameraLabel} (facingMode: ${facingMode})`);
}, 1000);
```

### UI visible:
```tsx
{/* Camera Info - DIAGNÓSTICO VISIBLE */}
<div className="absolute top-4 left-4 right-4 bg-yellow-500 text-black p-3 rounded-lg text-sm font-bold shadow-lg">
  <p className="text-center">{cameraInfo}</p>
</div>
```

---

## Qué Verás en Pantalla

### Escenario A: Cámara Frontal (Problema)
```
┌─────────────────────────────────────────┐
│ 📷 Front Camera (facingMode: user)      │ ← AMARILLO
└─────────────────────────────────────────┘
```

**Indica:** html5-qrcode está usando la cámara frontal

---

### Escenario B: Cámara Trasera (Correcto)
```
┌─────────────────────────────────────────┐
│ 📷 Back Camera (facingMode: environment)│ ← AMARILLO
└─────────────────────────────────────────┘
```

**Indica:** html5-qrcode está usando la cámara trasera ✅

---

## Análisis del Historial

### Versión Original (FUNCIONABA)

**BUGS_CORREGIDOS_AUDITORIA_5.md:**
```typescript
await html5QrCode.start(
  { 
    facingMode: 'environment',
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 }
  },
  { ... }
);
```

**Resultado:** Abría cámara trasera, pero NO detectaba códigos

---

### Fix de Regresión (BUGS_CORREGIDOS_AUDITORIA_6.md)

**Problema:** Error `'cameraIdOrConfig' object should have exactly 1 key, if passed as an object, found 3 keys`

**Causa:** `width` y `height` estaban en el primer parámetro (cameraIdOrConfig)

**Fix aplicado:**
```typescript
await html5QrCode.start(
  { facingMode: 'environment' }, // SOLO 1 key
  {
    videoConstraints: {
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 }
    },
    ...
  }
);
```

**Resultado:** Cámara abrió, pero ¿cuál?

---

### Hipótesis del Problema

**Versión que funcionaba (cámara trasera):**
```typescript
{ 
  facingMode: 'environment',
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 }
}
```

**Aunque era incorrecto según la API**, puede que html5-qrcode lo interpretara de forma diferente y **SÍ respetaba facingMode**.

**Versión actual (cámara frontal):**
```typescript
{ facingMode: 'environment' }  // Correcto según API, pero no funciona
```

**Posible causa:** Al separar `width`/`height` a `videoConstraints`, html5-qrcode puede estar:
1. Ignorando `facingMode` del primer parámetro
2. Usando su propia lógica de selección de cámara
3. Tomando la primera cámara disponible (frontal)

---

## Posible Solución: Volver a la Versión que Funcionaba

### Opción 1: Ignorar el error de "3 keys"

**Código:**
```typescript
await html5QrCode.start(
  { 
    facingMode: 'environment',
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 }
  } as any,  // ← Ignorar TypeScript
  { ... }
);
```

**Ventaja:** Si esto SÍ abría la cámara trasera, volvemos a ese comportamiento

**Desventaja:** Puede que el error vuelva a aparecer

---

### Opción 2: Probar sin videoConstraints

**Código:**
```typescript
await html5QrCode.start(
  { facingMode: 'environment' },
  {
    fps: 30,
    qrbox: ...,
    // SIN videoConstraints
  }
);
```

**Ventaja:** Más simple, puede que funcione

**Desventaja:** Resolución más baja

---

### Opción 3: Controlar el stream nosotros mismos (RECOMENDADO)

**Ya sabemos que PhotoOCR funciona:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
});
```

**Usar ese stream para decodificar códigos:**
- Opción A: Buscar si html5-qrcode acepta un stream existente
- Opción B: Usar @zxing/browser que SÍ acepta un `<video>` con stream

---

## Próximos Pasos

### 1. Verificar Diagnóstico Visual

- [ ] Abrir "Escanear" en iPhone
- [ ] Ver recuadro amarillo en la parte superior
- [ ] Leer: `📷 [Nombre] (facingMode: [...])`
- [ ] Compartir qué dice exactamente

### 2A. Si dice "Front Camera (facingMode: user)"

**Confirma:** html5-qrcode NO respeta `facingMode: 'environment'`

**Acción:** Implementar solución con `getUserMedia` + @zxing/browser

### 2B. Si dice "Back Camera (facingMode: environment)"

**Confirma:** Funcionó correctamente

**Acción:** Ninguna, problema resuelto

---

## Resumen de Cambios

**Archivo:** `BarcodeScanner.tsx`

**Cambios:**
1. ✅ Agregado estado `cameraInfo`
2. ✅ Captura de info de cámara real (label + facingMode)
3. ✅ Indicador visual amarillo en pantalla
4. ✅ Logging en consola (backup)

**Resultado:**
- Diagnóstico visible sin necesidad de Safari Inspector
- Confirmación visual de qué cámara está usando

---

**PRUEBA EN IPHONE y comparte qué dice el recuadro amarillo.**
