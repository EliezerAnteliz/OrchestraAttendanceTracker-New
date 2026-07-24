# Contador de Intentos y Errores Visibles

## Problema Identificado

**Síntoma:** "Escaneando... (0 intentos)" sin moverse

**Causa:** El contador `scanAttempts` estaba conectado al callback viejo de html5-qrcode, que ya no se usa. Nunca se conectó al callback de ZXing.

---

## Solución Implementada

### 1. Contador Conectado al Bucle Real de ZXing

**Antes:**
```typescript
reader.decodeFromVideoElement(videoRef.current!, (result: any, error: any) => {
  if (result) {
    onScanSuccess(result.getText());
  }
  if (error) {
    setScanAttempts(prev => prev + 1); // Solo en error
  }
});
```

**Problema:** Solo incrementaba en errores, no en cada frame.

---

**Después:**
```typescript
reader.decodeFromVideoDevice(null, videoRef.current!, (result: any, error: any) => {
  // Incrementar contador en CADA frame (resultado o error)
  setScanAttempts(prev => prev + 1);
  
  if (result) {
    console.log('✓ Barcode detected:', result.getText());
    onScanSuccess(result.getText());
  }
  
  // Los errores son normales (NotFoundException cuando no hay código)
  // Solo logear errores inesperados
  if (error && error.name !== 'NotFoundException') {
    console.warn('Decode error:', error.name, error.message);
    setErrorInfo(`⚠️ Error: ${error.name}`);
  }
});
```

**Cambios:**
1. ✅ Cambio de `decodeFromVideoElement` a `decodeFromVideoDevice` (API correcta)
2. ✅ Contador incrementa en **CADA frame** (no solo en errores)
3. ✅ Distingue entre errores normales (`NotFoundException`) y errores inesperados
4. ✅ Muestra errores inesperados en pantalla

---

### 2. Errores Visibles en Pantalla

**Estado agregado:**
```typescript
const [errorInfo, setErrorInfo] = useState<string>('');
```

**Manejo de errores críticos:**
```typescript
catch (err: any) {
  console.error('Error starting scanner:', err);
  const errorMsg = err?.message || err?.name || 'Error desconocido';
  setCameraInfo('❌ Error al iniciar cámara');
  setErrorInfo(`🔴 Error crítico: ${errorMsg}`);
  setLastResult({
    code: '',
    message: `Error al iniciar la cámara: ${errorMsg}`,
    type: 'error'
  });
}
```

**UI visible:**
```tsx
{/* Error Info - ERRORES VISIBLES */}
{errorInfo && (
  <div className="absolute top-20 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-sm font-bold shadow-lg z-10">
    <p className="text-center">{errorInfo}</p>
  </div>
)}
```

---

## Indicadores en Pantalla

### 1. Recuadro Amarillo (Cámara)
```
┌─────────────────────────────────────────┐
│ 📷 Back Camera (facingMode: environment)│ ← AMARILLO
└─────────────────────────────────────────┘
```

### 2. Recuadro Rojo (Errores - si hay)
```
┌─────────────────────────────────────────┐
│ 🔴 Error crítico: NotAllowedError       │ ← ROJO
└─────────────────────────────────────────┘
```

### 3. Contador de Intentos
```
Escaneando... (1234 intentos)  ← Verde parpadeante
```

---

## Tipos de Errores

### Errores Normales (No se muestran)
- **NotFoundException:** No hay código en el frame actual
  - Es normal, ocurre en cada frame sin código
  - No se muestra en pantalla
  - Solo incrementa el contador

### Errores Inesperados (Se muestran en ROJO)
- **NotAllowedError:** Permisos de cámara denegados
- **NotFoundError:** No hay cámara disponible
- **NotReadableError:** Cámara en uso por otra app
- **OverconstrainedError:** Restricciones no soportadas
- **Otros:** Cualquier error no esperado

---

## Verificación

### Escenario A: Funcionando Correctamente

**Pantalla:**
```
┌─────────────────────────────────────────┐
│ 📷 Back Camera (facingMode: environment)│ ← AMARILLO
└─────────────────────────────────────────┘

Escaneando... (1234 intentos)  ← Contador AVANZANDO
```

**Indica:**
- ✅ Cámara trasera activa
- ✅ Bucle de ZXing corriendo
- ✅ Procesando frames continuamente

---

### Escenario B: Error Crítico

**Pantalla:**
```
┌─────────────────────────────────────────┐
│ ❌ Error al iniciar cámara              │ ← AMARILLO
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ 🔴 Error crítico: NotAllowedError       │ ← ROJO
└─────────────────────────────────────────┘

Escaneando... (0 intentos)  ← Contador en 0
```

**Indica:**
- ❌ Error al iniciar
- ❌ Bucle no está corriendo
- ❌ Problema específico visible

---

### Escenario C: Error Durante Escaneo

**Pantalla:**
```
┌─────────────────────────────────────────┐
│ 📷 Back Camera (facingMode: environment)│ ← AMARILLO
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ⚠️ Error: ChecksumException             │ ← ROJO
└─────────────────────────────────────────┘

Escaneando... (1234 intentos)  ← Contador AVANZANDO
```

**Indica:**
- ✅ Cámara funcionando
- ✅ Bucle corriendo
- ⚠️ Error inesperado durante decodificación

---

## Flujo de Diagnóstico

```
1. Abrir "Escanear"
   ↓
2. Ver recuadro AMARILLO
   ├─ "📷 Back Camera" → ✅ Cámara correcta
   └─ "❌ Error" → ❌ Ver recuadro ROJO
   ↓
3. Ver contador de intentos
   ├─ Avanzando (1, 2, 3...) → ✅ Bucle corriendo
   └─ En 0 → ❌ Bucle no inició
   ↓
4. Si hay recuadro ROJO
   └─ Leer mensaje de error específico
```

---

## Cambios en el Código

### Archivo: `BarcodeScanner.tsx`

**Cambios:**
1. ✅ Agregado estado `errorInfo`
2. ✅ Cambiado a `decodeFromVideoDevice`
3. ✅ Contador incrementa en cada frame
4. ✅ Distingue errores normales vs inesperados
5. ✅ Errores críticos capturados con mensaje
6. ✅ UI con recuadro rojo para errores
7. ✅ Ajuste dinámico de posición de instrucciones

---

## Resultado Esperado

### Si el Contador Avanza:

```
Escaneando... (1 intentos)
Escaneando... (2 intentos)
Escaneando... (3 intentos)
...
Escaneando... (1234 intentos)
```

**Significa:**
- ✅ El bucle de ZXing está corriendo
- ✅ Procesando frames continuamente
- ✅ Listo para detectar códigos

---

### Si el Contador NO Avanza:

**Buscar recuadro ROJO con mensaje de error:**
```
🔴 Error crítico: [mensaje específico]
```

**Posibles causas:**
- Permisos denegados
- Cámara no disponible
- Error de inicialización
- Problema con ZXing

---

## Prueba

1. ✅ Abrir "Escanear" en iPhone
2. ✅ Verificar recuadro amarillo: `📷 Back Camera`
3. ✅ Verificar contador: **DEBE avanzar** (1, 2, 3...)
4. ✅ Si hay error: Ver recuadro rojo con mensaje
5. ✅ Apuntar a código de barras y verificar detección

---

**PRUEBA AHORA. El contador debe avanzar continuamente si el bucle está corriendo.**
