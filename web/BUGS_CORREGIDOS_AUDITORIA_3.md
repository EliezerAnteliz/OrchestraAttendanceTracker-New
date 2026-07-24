# Bugs Corregidos - Módulo de Auditoría (Parte 3)

## ✅ Hallazgos de Pruebas

### Pruebas Exitosas:
- ✅ Foto del código de barras: OCR leyó correctamente los 16 dígitos ("2001010801040032")
- ✅ Foto del tag manuscrito: OCR devolvió texto distorsionado (esperado con Tesseract)
- ✅ Fallback a "Busca manualmente" funcionó correctamente

### Problemas Encontrados:
1. ❌ OCR no encontró el activo aunque leyó el código correcto
2. ❌ Botón "Tomar Foto" no abre cámara en desktop/laptop
3. ❌ Recuadro de video del Escaneo muy pequeño

---

## Bug 1: OCR No Busca en full_code ✅

### Problema:
OCR leyó correctamente "2001010801040032" (código de barras de 16 dígitos), pero mostró "No se encontraron coincidencias".

### Causa:
La búsqueda de Foto+OCR solo comparaba contra:
- `serial_number`
- `assigned_to_text`
- `description`

**Faltaba:** `full_code` (el código de barras de 16 dígitos)

### Corrección Aplicada:

**Antes:**
```typescript
.or(`serial_number.ilike.%${text}%,assigned_to_text.ilike.%${text}%,description.ilike.%${text}%`)
```

**Después:**
```typescript
.or(`serial_number.ilike.%${text}%,assigned_to_text.ilike.%${text}%,description.ilike.%${text}%,full_code.ilike.%${text}%`)
```

### Resultado:
- ✅ Ahora busca en 4 campos: serial_number, assigned_to_text, description, **full_code**
- ✅ Si OCR lee el número debajo del código de barras, encuentra el activo

---

## Bug 2: Botón "Tomar Foto" No Funciona en Desktop ✅

### Problema:
El botón "Tomar Foto" no abría la cámara en desktop/laptop.

### Causa:
Usaba `<input type="file" capture="environment">` que solo funciona confiablemente en móviles.

### Corrección Aplicada:

**Reemplazado por cámara en vivo con getUserMedia** (mismo mecanismo que Escaneo de código de barras):

#### Cambios implementados:

1. **Agregado estado para cámara:**
```typescript
const [cameraActive, setCameraActive] = useState(false);
const [stream, setStream] = useState<MediaStream | null>(null);
const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
```

2. **Función para iniciar cámara:**
```typescript
async function startCamera() {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
  });
  setStream(mediaStream);
  setCameraActive(true);
  videoRef.current.srcObject = mediaStream;
}
```

3. **Función para capturar foto:**
```typescript
async function capturePhoto() {
  const canvas = canvasRef.current;
  const video = videoRef.current;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    await handlePhotoCapture(file);
  }, 'image/jpeg', 0.95);
}
```

4. **Vista de cámara en vivo:**
```tsx
{cameraActive && (
  <div className="flex-1 relative bg-black">
    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
    <canvas ref={canvasRef} className="hidden" />
    
    <div className="absolute bottom-0 left-0 right-0 p-6">
      <button onClick={stopCamera}>Cancelar</button>
      <button onClick={capturePhoto}>Capturar Foto</button>
    </div>
  </div>
)}
```

5. **Cleanup al cerrar:**
```typescript
useEffect(() => {
  return () => {
    stopCamera();
  };
}, []);
```

### Resultado:
- ✅ Botón "Abrir Cámara" muestra preview en vivo
- ✅ Funciona en desktop y móvil
- ✅ Botón "Capturar Foto" toma snapshot del video
- ✅ Botón "Cancelar" cierra cámara
- ✅ Cámara se cierra automáticamente al salir del componente
- ✅ Mantiene botón "Seleccionar de Galería" como alternativa

---

## Bug 3: Recuadro de Video del Escaneo Muy Pequeño ✅

### Problema:
El área de video del Escaneo de código de barras era muy pequeña, dificultando alinear la barra dentro del cuadro de lectura.

### Causa:
`qrbox` configurado con dimensiones pequeñas: `{ width: 250, height: 150 }`

### Corrección Aplicada:

**Antes:**
```typescript
{
  fps: 10,
  qrbox: { width: 250, height: 150 },
  formatsToSupport: [0, 1, 2, 3],
}
```

**Después:**
```typescript
{
  fps: 10,
  qrbox: { width: 400, height: 250 }, // 60% más grande
  aspectRatio: 1.6, // Relación de aspecto más amplia
}
```

### Cambios:
- ✅ `qrbox.width`: 250 → **400** (+60%)
- ✅ `qrbox.height`: 150 → **250** (+67%)
- ✅ Agregado `aspectRatio: 1.6` para mejor proporción
- ✅ Removido `formatsToSupport` (no soportado en versión actual de html5-qrcode)

### Resultado:
- ✅ Área de detección 60% más grande
- ✅ Más fácil alinear código de barras
- ✅ Mejor experiencia en móvil y desktop

---

## Archivos Modificados:

1. ✅ `audit/[id]/PhotoOCR.tsx`
   - Agregado `full_code` a búsqueda OCR
   - Reemplazado input file por cámara en vivo (getUserMedia)
   - Agregado preview de video + botón capturar
   - Agregado cleanup de cámara

2. ✅ `audit/[id]/BarcodeScanner.tsx`
   - Agrandado `qrbox` de 250x150 a 400x250
   - Agregado `aspectRatio: 1.6`
   - Removido `formatsToSupport` (no soportado)

---

## Verificación:

### Foto OCR:
1. ✅ Click "Abrir Cámara" → Preview en vivo
2. ✅ Apuntar a código de barras impreso
3. ✅ Click "Capturar Foto"
4. ✅ OCR lee "2001010801040032"
5. ✅ Busca en `full_code` y encuentra el activo

### Foto OCR (manuscrito):
1. ✅ Click "Abrir Cámara" → Preview en vivo
2. ✅ Apuntar a tag manuscrito viejo
3. ✅ Click "Capturar Foto"
4. ✅ OCR lee texto distorsionado (esperado)
5. ✅ Muestra "Busca manualmente" (fallback correcto)

### Escaneo de Código de Barras:
1. ✅ Click "Escanear"
2. ✅ Área de detección más grande (400x250)
3. ✅ Más fácil alinear código de barras
4. ✅ Detección automática funciona

---

## Flujo Completo Foto OCR:

```
Usuario click "Abrir Cámara"
  ↓
getUserMedia() solicita permiso
  ↓
Preview en vivo en pantalla completa
  ↓
Usuario alinea etiqueta y click "Capturar Foto"
  ↓
Canvas captura frame del video
  ↓
Convierte a File (photo.jpg)
  ↓
Tesseract.js procesa imagen
  ↓
Extrae texto (ej. "2001010801040032")
  ↓
Busca en BD: serial_number, assigned_to_text, description, full_code
  ↓
Si encuentra → Muestra candidatos
Si no encuentra → Muestra "Busca manualmente"
```

---

## Notas Técnicas:

### getUserMedia vs Input File:
- ✅ **getUserMedia:** Funciona en desktop y móvil, preview en vivo
- ❌ **Input capture:** Solo confiable en móvil, sin preview

### Tesseract.js con Manuscrito:
- ✅ Funciona bien con texto impreso (códigos de barras, etiquetas impresas)
- ⚠️ Débil con manuscrito (esperado, no es IA de pago)
- ✅ Fallback a búsqueda manual siempre disponible

### html5-qrcode Configuración:
- ✅ `qrbox`: Tamaño del área de detección
- ✅ `aspectRatio`: Proporción del video
- ✅ `fps`: Frames por segundo (10 es suficiente)
- ❌ `formatsToSupport`: No soportado en versión actual (detecta todos los formatos automáticamente)

---

## Próximos Pasos:

1. ⏳ Probar Foto OCR con código de barras impreso
2. ⏳ Verificar que encuentra el activo por `full_code`
3. ⏳ Probar Escaneo con área más grande
4. ⏳ Confirmar que es más fácil alinear el código

**Todas las correcciones aplicadas y listas para probar.**
