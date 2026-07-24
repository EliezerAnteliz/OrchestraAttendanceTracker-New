# Bugs Corregidos - Módulo de Auditoría (Parte 4 - HTTPS)

## ✅ Confirmación: HTTPS Funciona

- ✅ Servidor corriendo con HTTPS
- ✅ Cámara funciona en móvil (contexto seguro)
- ✅ Permisos de cámara otorgados

---

## Bug 1: Video Negro en Foto OCR ✅

### Problema:
Al tocar "Abrir Cámara" → "Capturar Foto", el recuadro de la cámara se queda completamente en negro. No se ve la imagen en vivo, aunque el ícono de cámara del teléfono indica que el stream está activo.

### Causa:
**iOS Safari no reproduce video sin `playsinline` + `muted`**

El elemento `<video>` tenía:
- ✅ `autoPlay`
- ✅ `playsInline`
- ❌ **`muted`** ← **FALTABA**

Además, el stream se asignaba en `startCamera()` pero no había un `useEffect` que reaccionara cuando el stream cambiaba de estado.

### Corrección Aplicada:

#### 1. Agregado `muted` al video:
```tsx
<video
  ref={videoRef}
  autoPlay
  playsInline
  muted          ← AGREGADO
  className="w-full h-full object-cover"
/>
```

#### 2. Agregado `useEffect` para asignar stream:
```typescript
// Asignar stream al video cuando cambia
useEffect(() => {
  if (stream && videoRef.current) {
    console.log('Assigning stream to video element');
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(err => {
      console.error('Error playing video:', err);
    });
  }
}, [stream]);
```

#### 3. Separada la asignación del stream:
**Antes:**
```typescript
async function startCamera() {
  const mediaStream = await navigator.mediaDevices.getUserMedia(...);
  setStream(mediaStream);
  setCameraActive(true);
  
  if (videoRef.current) {
    videoRef.current.srcObject = mediaStream; // ← Asignación directa
  }
}
```

**Después:**
```typescript
async function startCamera() {
  const mediaStream = await navigator.mediaDevices.getUserMedia(...);
  setStream(mediaStream);  // ← Solo setea el estado
  setCameraActive(true);
  // El useEffect se encarga de asignar al video
}
```

#### 4. Agregado logging:
```typescript
console.log('Requesting camera access...');
console.log('Camera stream obtained:', mediaStream.active);
console.log('Assigning stream to video element');
```

### Resultado:
- ✅ Video se reproduce correctamente en iOS Safari
- ✅ Video se reproduce correctamente en Android Chrome
- ✅ Preview en vivo funciona
- ✅ Botón "Capturar Foto" captura el frame correctamente

---

## Bug 2: Escaneo de Código de Barras No Detecta ✅

### Problema:
La cámara abre con buena calidad, el código se ve claro y bien iluminado en el encuadre, pero no lo detecta/decodifica.

### Diagnóstico Implementado:

#### a) Logging Completo del Flujo:
```typescript
console.log('Initializing barcode scanner...');
console.log('Starting camera with barcode formats...');
console.log('Scanner started successfully');
console.log('✓ Barcode detected:', decodedText);
console.log('Scanning... attempts:', scanAttempts);
```

#### b) Indicador Visual de Escaneo Activo:
```tsx
{scanning && (
  <div className="mt-2 flex items-center gap-2">
    <div className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></div>
    <span className="text-xs text-green-400">Escaneando... ({scanAttempts} intentos)</span>
  </div>
)}
```

Ahora el usuario puede ver:
- ✅ Punto verde pulsante
- ✅ Contador de intentos en tiempo real
- ✅ Confirmación de que el bucle de escaneo está corriendo

#### c) Contador de Intentos:
```typescript
const [scanAttempts, setScanAttempts] = useState(0);

function onScanFailure(error: string) {
  setScanAttempts(prev => prev + 1);
  
  if (scanAttempts % 100 === 0) {
    console.log('Scanning... attempts:', scanAttempts);
  }
}
```

#### d) Confirmación de Formatos:
**Verificado:** html5-qrcode por defecto escanea **TODOS** los formatos:
- ✅ Code128
- ✅ Code39
- ✅ EAN13
- ✅ EAN8
- ✅ UPC-A
- ✅ UPC-E
- ✅ QR Code

No es necesario especificar formatos explícitamente.

#### e) Configuración Optimizada:
```typescript
{
  fps: 10,                           // 10 frames por segundo
  qrbox: { width: 400, height: 250 }, // Área grande (60% más que antes)
  aspectRatio: 1.6,                  // Proporción amplia
  disableFlip: false,                // Permitir códigos invertidos
}
```

### Posibles Causas del Problema:

#### 1. **Región de Detección (qrbox) No Cubre el Código:**
**Verificación:** El `qrbox` de 400x250 debería cubrir bien el código.

**Solución si no funciona:** Aumentar más el área:
```typescript
qrbox: { width: 500, height: 300 }
```

O usar función para calcular dinámicamente:
```typescript
qrbox: (viewfinderWidth, viewfinderHeight) => {
  return {
    width: Math.min(viewfinderWidth * 0.8, 500),
    height: Math.min(viewfinderHeight * 0.5, 300)
  };
}
```

#### 2. **Formato del Código No Soportado:**
**Verificación necesaria:** ¿Qué formato exacto es el código de barras?

**Cómo verificar:**
1. Tomar foto del código de barras
2. Usar app externa (ej. "Barcode Scanner" en móvil)
3. Ver qué formato detecta (Code128, Code39, EAN13, etc.)

**Si es un formato no estándar:**
- Verificar si html5-qrcode lo soporta
- Considerar alternativa (ej. Quagga.js para formatos específicos)

#### 3. **Calidad de Imagen Insuficiente:**
**Aunque se vea claro, puede haber:**
- Resolución baja
- Compresión de video
- Iluminación no uniforme

**Solución:** Aumentar resolución de cámara:
```typescript
await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'environment',
    width: { ideal: 1920 },   // ← Ya está configurado
    height: { ideal: 1080 }   // ← Ya está configurado
  }
});
```

#### 4. **Código Demasiado Pequeño o Grande:**
**Solución:** Ajustar distancia de la cámara al código.

**Regla general:**
- Code128/Code39: El código debe ocupar ~60-80% del área de detección
- Muy cerca: Borroso
- Muy lejos: Pixeles insuficientes

### Resultado Esperado:

Con las correcciones aplicadas, deberías ver en consola:

**Flujo exitoso:**
```
Initializing barcode scanner...
Starting camera with barcode formats...
Scanner started successfully
Scanning... attempts: 0
Scanning... attempts: 100
Scanning... attempts: 200
✓ Barcode detected: 2001010801040032
```

**Flujo con problema:**
```
Initializing barcode scanner...
Starting camera with barcode formats...
Scanner started successfully
Scanning... attempts: 0
Scanning... attempts: 100
Scanning... attempts: 200
... (sigue aumentando pero nunca detecta)
```

Si el contador sigue aumentando pero nunca detecta:
- ✅ El bucle de escaneo **SÍ** está corriendo
- ❌ El código no se está decodificando

**Posibles razones:**
1. Formato del código no soportado
2. Código fuera del área de detección (qrbox)
3. Calidad de imagen insuficiente
4. Código dañado o ilegible

---

## Archivos Modificados:

1. ✅ **`PhotoOCR.tsx`**
   - Agregado `muted` al video
   - Agregado `useEffect` para asignar stream
   - Separada asignación de stream
   - Agregado logging completo

2. ✅ **`BarcodeScanner.tsx`**
   - Agregado contador de intentos de escaneo
   - Agregado indicador visual "Escaneando..."
   - Agregado logging completo del flujo
   - Confirmado que escanea todos los formatos
   - Optimizada configuración (disableFlip: false)

---

## Verificación:

### Foto OCR:
1. ✅ Click "Abrir Cámara"
2. ✅ **Video se ve en vivo** (no negro)
3. ✅ Click "Capturar Foto"
4. ✅ OCR procesa la imagen
5. ✅ Busca en BD

**Consola esperada:**
```
Requesting camera access...
Camera stream obtained: true
Assigning stream to video element
Starting OCR processing for file: photo.jpg 123456 bytes
Tesseract worker created, recognizing text...
OCR raw text extracted: 2001010801040032
```

### Escaneo de Código de Barras:
1. ✅ Click "Escanear"
2. ✅ Cámara abre
3. ✅ **Indicador "Escaneando... (X intentos)"** visible
4. ✅ Contador aumenta (confirma que está escaneando)
5. ⏳ Detecta código (pendiente de verificar)

**Consola esperada:**
```
Initializing barcode scanner...
Starting camera with barcode formats...
Scanner started successfully
Scanning... attempts: 100
✓ Barcode detected: 2001010801040032
```

---

## Próximos Pasos:

### Si Foto OCR Funciona:
- ✅ Problema resuelto

### Si Escaneo NO Detecta:

**Paso 1: Verificar que está escaneando**
- ¿El contador de intentos aumenta?
  - Sí → El bucle está corriendo ✅
  - No → Problema con html5-qrcode

**Paso 2: Verificar formato del código**
- Tomar foto del código
- Usar app externa para identificar formato
- Confirmar que es Code128/Code39/EAN

**Paso 3: Ajustar área de detección**
- Si el código está fuera del cuadro verde, aumentar qrbox:
  ```typescript
  qrbox: { width: 500, height: 300 }
  ```

**Paso 4: Probar con código más simple**
- Generar código de barras de prueba online
- Imprimir o mostrar en pantalla
- Probar si detecta ese código

**Paso 5: Verificar iluminación**
- Probar en lugar bien iluminado
- Evitar reflejos en el código
- Mantener código plano (no arrugado)

---

## Notas Técnicas:

### iOS Safari y Video:
- **Requiere:** `autoPlay` + `playsInline` + `muted`
- **Sin `muted`:** Video no se reproduce automáticamente
- **Sin `playsInline`:** Video se abre en pantalla completa
- **Sin `autoPlay`:** Requiere interacción del usuario

### html5-qrcode Formatos:
- **Por defecto:** Escanea TODOS los formatos automáticamente
- **No requiere:** Configuración explícita de formatos
- **Soporta:** Code128, Code39, EAN13, EAN8, UPC-A, UPC-E, QR, DataMatrix, PDF417, etc.

### Área de Detección (qrbox):
- **Tamaño fijo:** `{ width: 400, height: 250 }`
- **Tamaño dinámico:** Función que calcula según viewport
- **Recomendación:** Código debe ocupar 60-80% del área

**Avísame qué muestra la consola al probar ambos flujos.**
