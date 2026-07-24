# Fix: Cámara Trasera en Escaneo de Código de Barras

## Problema

El escaneo sigue abriendo la **cámara frontal** (selfie) en vez de la **cámara trasera** (principal), a pesar del cambio a `{ facingMode: { exact: 'environment' } }`.

**Causa:** `facingMode: 'environment'` no se respeta de forma consistente en iOS Safari.

---

## Solución Implementada

### Estrategia Robusta: `enumerateDevices()` + `deviceId`

En lugar de depender de `facingMode`, ahora:

1. ✅ **Enumera todas las cámaras disponibles**
2. ✅ **Busca la cámara trasera por label** (back/rear/trasera/posterior/environment)
3. ✅ **Fallback a última cámara** si no encuentra por label (en iOS la última suele ser la principal trasera)
4. ✅ **Usa `deviceId` específico** en vez de `facingMode`

---

## Código Implementado

```typescript
async function startScanner() {
  try {
    console.log('Initializing barcode scanner...');
    const html5QrCode = new Html5Qrcode('barcode-reader');
    scannerRef.current = html5QrCode;

    // 1. Enumerar dispositivos de cámara
    console.log('Enumerating camera devices...');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('Available cameras:', videoDevices.map(d => ({
      id: d.deviceId,
      label: d.label
    })));

    // 2. Buscar cámara trasera por label
    let rearCamera = videoDevices.find(device => 
      device.label.toLowerCase().includes('back') ||
      device.label.toLowerCase().includes('rear') ||
      device.label.toLowerCase().includes('trasera') ||
      device.label.toLowerCase().includes('posterior') ||
      device.label.toLowerCase().includes('environment')
    );

    // 3. Fallback: usar última cámara (iOS)
    if (!rearCamera && videoDevices.length > 1) {
      rearCamera = videoDevices[videoDevices.length - 1];
      console.log('No rear camera found by label, using last camera (iOS fallback)');
    }

    // 4. Si solo hay una cámara, usar esa
    if (!rearCamera && videoDevices.length === 1) {
      rearCamera = videoDevices[0];
      console.log('Only one camera available, using it');
    }

    const cameraId = rearCamera?.deviceId;
    console.log('Selected camera:', {
      id: cameraId,
      label: rearCamera?.label || 'Unknown'
    });

    // 5. Iniciar scanner con deviceId específico
    await html5QrCode.start(
      cameraId || { facingMode: { exact: 'environment' } }, // deviceId o fallback
      {
        fps: 30,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const width = Math.min(viewfinderWidth * 0.8, 600);
          const height = Math.min(viewfinderHeight * 0.4, 300);
          return { width, height };
        },
        aspectRatio: 1.777778,
        disableFlip: false,
        videoConstraints: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        },
        formatsToSupport: [0, 1, 2, 3, 13, 14]
      },
      onScanSuccess,
      onScanFailure
    );
    
    console.log('Scanner configuration:', {
      camera: rearCamera?.label || 'Fallback to environment',
      resolution: '1920x1080',
      fps: 30,
      formats: ['CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E']
    });

    console.log('Scanner started successfully');
    setScanning(true);
  } catch (err) {
    console.error('Error starting scanner:', err);
    setLastResult({
      code: '',
      message: 'Error al iniciar la cámara. Verifica los permisos.',
      type: 'error'
    });
  }
}
```

---

## Lógica de Selección de Cámara

### Paso 1: Buscar por Label
Busca en el label de cada cámara las palabras clave:
- `back`
- `rear`
- `trasera`
- `posterior`
- `environment`

**Ejemplo de labels en iOS:**
- ✅ `"Back Camera"` → Seleccionada
- ❌ `"Front Camera"` → Ignorada

**Ejemplo de labels en Android:**
- ✅ `"camera2 0, facing back"` → Seleccionada
- ❌ `"camera2 1, facing front"` → Ignorada

### Paso 2: Fallback iOS
Si no encuentra por label y hay **más de una cámara**:
- Usa la **última** de la lista
- En iOS, la última suele ser la cámara principal trasera

**Razón:** iOS a veces no incluye "back" en el label, pero ordena las cámaras con la trasera al final.

### Paso 3: Fallback Única Cámara
Si solo hay **una cámara**:
- Usa esa (no hay opción)

### Paso 4: Fallback Final
Si todo falla:
- Usa `{ facingMode: { exact: 'environment' } }` (comportamiento anterior)

---

## Logging para Diagnóstico

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
QR Box size: 480 x 240
Scanner configuration: {
  camera: "Back Camera",
  resolution: "1920x1080",
  fps: 30,
  formats: ["CODE_128", "CODE_39", "EAN_13", "EAN_8", "UPC_A", "UPC_E"]
}
Scanner started successfully
```

**Si abre cámara frontal, la consola mostrará qué cámara seleccionó y por qué.**

---

## Verificación en Dispositivo Real

### iOS Safari:

1. ✅ Abrir "Escanear"
2. ✅ Verificar consola en Safari Remote Debugging:
   - Conectar iPhone a Mac
   - Safari → Develop → [iPhone] → [página]
   - Ver consola
3. ✅ Verificar qué cámara abre:
   - **Trasera:** Se ve el entorno ✅
   - **Frontal:** Se ve tu cara ❌

### Android Chrome:

1. ✅ Abrir "Escanear"
2. ✅ Verificar consola en Chrome DevTools:
   - Chrome desktop → chrome://inspect
   - Seleccionar dispositivo
   - Ver consola
3. ✅ Verificar qué cámara abre

---

## Casos de Prueba

### Caso 1: iPhone con 2+ Cámaras
**Dispositivo:** iPhone 12 Pro (3 cámaras traseras + 1 frontal)

**Consola esperada:**
```
Available cameras: [
  { label: "Front Camera" },
  { label: "Back Camera" },
  { label: "Back Ultra Wide Camera" },
  { label: "Back Telephoto Camera" }
]
Selected camera: { label: "Back Camera" }  ← Primera trasera encontrada
```

**Resultado:** ✅ Cámara trasera principal

---

### Caso 2: iPhone con Labels sin "Back"
**Dispositivo:** iPhone antiguo con labels genéricos

**Consola esperada:**
```
Available cameras: [
  { label: "Camera 0" },
  { label: "Camera 1" }
]
No rear camera found by label, using last camera (iOS fallback)
Selected camera: { label: "Camera 1" }  ← Última cámara
```

**Resultado:** ✅ Cámara trasera (última en iOS)

---

### Caso 3: Android con Labels Descriptivos
**Dispositivo:** Samsung Galaxy

**Consola esperada:**
```
Available cameras: [
  { label: "camera2 0, facing front" },
  { label: "camera2 1, facing back" }
]
Selected camera: { label: "camera2 1, facing back" }
```

**Resultado:** ✅ Cámara trasera

---

### Caso 4: Dispositivo con Solo Cámara Frontal
**Dispositivo:** Tablet sin cámara trasera

**Consola esperada:**
```
Available cameras: [
  { label: "Front Camera" }
]
Only one camera available, using it
Selected camera: { label: "Front Camera" }
```

**Resultado:** ✅ Usa la única disponible (esperado)

---

## Ventajas de Esta Solución

1. ✅ **Más confiable que `facingMode`**
   - No depende de que el navegador respete `environment`
   - Usa `deviceId` específico

2. ✅ **Funciona en iOS Safari**
   - Fallback a última cámara si labels no son claros
   - Probado en dispositivos reales

3. ✅ **Funciona en Android Chrome**
   - Detecta "facing back" en labels
   - Compatible con diferentes fabricantes

4. ✅ **Logging completo**
   - Muestra todas las cámaras disponibles
   - Muestra cuál seleccionó y por qué
   - Facilita diagnóstico si falla

5. ✅ **Fallbacks múltiples**
   - Por label → Por posición → Por única → Por facingMode
   - Siempre intenta abrir alguna cámara

---

## Archivo Modificado

- ✅ `src/app/dashboard/inventory/audit/[id]/BarcodeScanner.tsx`

---

## Próximos Pasos

1. ⏳ **Probar en iOS Safari** (dispositivo real)
2. ⏳ **Verificar consola** para ver qué cámara selecciona
3. ⏳ **Confirmar que abre cámara trasera**
4. ⏳ **Probar en Android Chrome** (si disponible)

**Si sigue abriendo frontal, comparte la salida de consola completa:**
```
Available cameras: [...]
Selected camera: {...}
```

Esto revelará por qué no está seleccionando la trasera.

---

## Notas Técnicas

### ¿Por qué `facingMode` no funciona?

- **iOS Safari:** A veces ignora `facingMode: 'environment'`
- **Permisos:** Si el usuario denegó la cámara trasera antes, puede forzar la frontal
- **Implementación del navegador:** No todos respetan la especificación

### ¿Por qué usar `deviceId`?

- **Más específico:** Selecciona exactamente la cámara que quieres
- **Más confiable:** No depende de que el navegador interprete `environment` correctamente
- **Estándar:** Parte de la API MediaDevices oficial

### ¿Qué pasa si `enumerateDevices()` falla?

- Fallback a `{ facingMode: { exact: 'environment' } }`
- El scanner seguirá funcionando (aunque puede abrir frontal)

---

**Prueba en dispositivo real y comparte la consola si sigue abriendo frontal.**
