# Estado del Escaneo por Código de Barras - PAUSADO

**Fecha:** 23 de julio de 2026  
**Estado:** PAUSADO temporalmente  
**Alternativas funcionales:** Manual Selector ✅ | Foto + OCR ✅

---

## Resumen Ejecutivo

El escaneo por código de barras ha sido **pausado temporalmente** después de múltiples intentos de corrección. Las alternativas **Manual** y **Foto + OCR** están funcionando correctamente y son suficientes para continuar con las auditorías.

---

## Hallazgos Importantes

### ✅ Decodificación Confirmada

**Hecho crítico:** html5-qrcode **SÍ logró decodificar** el código de barras exitosamente en una prueba anterior:

- **Código:** `"VIOLA · 2001010801040032"`
- **Resultado:** Detectado como "Escaneado"
- **Momento:** ANTES de que se rompiera la selección de cámara

**Conclusión:** El código de barras físico es válido y el decodificador html5-qrcode es capaz de leerlo.

---

## Problema Actual

### Síntoma Principal

**Dos cámaras abriéndose simultáneamente:**
- **Indicador en pantalla:** "Cámara trasera triple (facingMode: environment)"
- **Video mostrado:** Cámara frontal (cara del usuario)
- **Resultado:** Conflicto de recursos, cámara incorrecta

### Problema Secundario

**Diagnóstico por archivo falla:**
- **Error:** "Scanner not initialized"
- **Causa:** Instancia de html5-qrcode no disponible para `scanFile()`

---

## Intentos de Solución

### 1. Configuración Directa de facingMode

**Enfoque:** Usar `facingMode: 'environment'` directamente en html5-qrcode

**Resultado:** ❌ html5-qrcode ignora `facingMode` en iOS, abre cámara frontal

---

### 2. Enumeración de Dispositivos

**Enfoque:** Usar `enumerateDevices()` para listar cámaras y seleccionar la última (trasera en iPhone)

**Resultado:** ❌ Formato de `deviceId` incorrecto, no funcionó

---

### 3. Cambio a @zxing/browser

**Enfoque:** Reemplazar html5-qrcode con ZXing, usando `getUserMedia` directamente

**Resultado:** 
- ✅ Cámara trasera correcta
- ❌ No logra decodificar (ni en vivo ni por archivo)
- **Regresión del decodificador**

---

### 4. Vuelta a html5-qrcode con deviceId

**Enfoque:** 
1. Obtener stream temporal con `getUserMedia({ facingMode: 'environment' })`
2. Leer `deviceId` real de la cámara trasera
3. Detener stream temporal
4. Iniciar html5-qrcode con `{ deviceId: { exact: deviceId } }`

**Resultado:** ❌ Dos cámaras abriéndose simultáneamente (stream temporal + html5-qrcode)

---

### 5. Corrección de Stream Temporal

**Enfoque:**
- Detener todos los tracks del stream temporal con logging
- Esperar 500ms para liberación completa
- Asignar `scannerRef.current` DESPUÉS de `start()` exitoso

**Resultado:** ❌ Persiste el problema de dos cámaras simultáneas

---

## Diagnóstico Técnico

### Hipótesis Principal

**Problema de liberación de recursos en iOS Safari:**

iOS Safari puede tener restricciones o comportamientos específicos en la gestión de `MediaStream`:
- El stream temporal puede no liberarse completamente antes de que html5-qrcode intente abrir su propia cámara
- Puede haber un límite de tiempo o condiciones específicas para liberar recursos de cámara
- html5-qrcode puede estar abriendo una cámara diferente a la especificada por `deviceId`

### Evidencia

1. ✅ PhotoOCR funciona correctamente con `getUserMedia({ facingMode: 'environment' })`
2. ✅ html5-qrcode decodificó el código exitosamente en el pasado
3. ❌ Combinación de ambos enfoques causa conflicto
4. ❌ ZXing no logra decodificar (diferente problema)

---

## Decisión

**PAUSAR** el desarrollo del escaneo por código de barras por las siguientes razones:

1. **Múltiples iteraciones sin éxito:** 5 enfoques diferentes probados
2. **Debugging limitado:** No hay acceso a consola del dispositivo iOS
3. **Alternativas funcionales:** Manual y Foto+OCR cubren las necesidades
4. **Presión de tiempo:** Mejor pausar y retomar con calma

---

## Alternativas Funcionales

### ✅ Manual Selector

**Estado:** Funcionando correctamente

**Características:**
- Búsqueda por descripción, marca, código, serial
- Filtro por estado (todos/encontrados/no encontrados)
- Contraste de UI corregido
- Resultados inmediatos

**Uso:** Cuando se conoce parte de la información del activo

---

### ✅ Foto + OCR

**Estado:** Funcionando correctamente

**Características:**
- Captura con cámara trasera (getUserMedia funciona)
- OCR de texto en la foto
- Búsqueda automática de código de 16 dígitos
- Búsqueda manual si OCR no encuentra código
- Contraste de UI corregido

**Uso:** Cuando el activo tiene etiqueta con texto legible

---

## Estado Actual del Código

### Botón "Escanear"

**Ubicación:** `page.tsx` (sesión de auditoría)

**Estado:** Comentado/oculto

```tsx
{/* Botón Escanear - DESHABILITADO TEMPORALMENTE
<button
  disabled
  className="flex flex-col items-center gap-1 px-3 py-3 bg-gray-400 text-gray-200 rounded-lg cursor-not-allowed opacity-60"
  title="Próximamente — usa Manual o Foto OCR por ahora"
>
  <MdQrCodeScanner size={24} />
  <span className="text-xs font-medium">Escanear</span>
  <span className="text-[10px] text-gray-300">Próximamente</span>
</button>
*/}
```

**Layout:** Cambiado de `grid-cols-3` a `grid-cols-2` (solo Manual y Foto OCR)

---

### Componente BarcodeScanner

**Ubicación:** `BarcodeScanner.tsx`

**Estado:** Código completo disponible, no se usa actualmente

**Última versión:** html5-qrcode con deviceId de getUserMedia temporal

---

## Archivos Relevantes

### Código

- ✅ `page.tsx` - Botón "Escanear" oculto
- ✅ `BarcodeScanner.tsx` - Componente completo (no usado)
- ✅ `ManualSelector.tsx` - Funcionando ✅
- ✅ `PhotoOCR.tsx` - Funcionando ✅

### Documentación

- ✅ `SOLUCION_CAMARA_FINAL.md` - Intento con facingMode
- ✅ `DIAGNOSTICO_CAMARA_REAL.md` - Diagnóstico con logging
- ✅ `DIAGNOSTICO_PANTALLA_VISIBLE.md` - Indicador visual
- ✅ `CAMBIO_A_ZXING.md` - Cambio a ZXing
- ✅ `CORRECCION_DECODIFICADOR_ZXING.md` - Correcciones ZXing
- ✅ `VUELTA_A_HTML5_QRCODE_CON_DEVICEID.md` - Vuelta a html5-qrcode
- ✅ `CORRECCION_STREAM_TEMPORAL.md` - Último intento
- ✅ `ESTADO_ESCANEO_BARCODE.md` - Este documento

---

## Plan de Retoma (Futuro)

### Prerrequisitos

1. **Acceso a debugging iOS:** Safari Inspector o similar
2. **Tiempo sin presión:** Poder iterar con calma
3. **Dispositivo de prueba:** iPhone disponible para pruebas extensivas

### Enfoques a Explorar

#### Opción A: Investigar html5-qrcode + deviceId

**Hipótesis:** Puede haber un timing específico o método para liberar el stream temporal

**Pasos:**
1. Investigar documentación de html5-qrcode sobre `deviceId`
2. Probar delays más largos (1000ms, 2000ms)
3. Verificar eventos de liberación de stream
4. Probar en diferentes versiones de iOS Safari

---

#### Opción B: Usar Solo getUserMedia (Sin html5-qrcode)

**Hipótesis:** Controlar completamente el stream y decodificar manualmente

**Pasos:**
1. Mantener stream de getUserMedia activo
2. Capturar frames del video manualmente
3. Usar librería de decodificación que acepte ImageData/Canvas
4. Evitar que html5-qrcode abra su propia cámara

---

#### Opción C: Librería Alternativa

**Hipótesis:** Otra librería puede manejar mejor iOS Safari

**Candidatos:**
- `quagga2` (fork de QuaggaJS, especializado en códigos de barras 1D)
- `@ericblade/quagga2` (versión mantenida)
- Implementación custom con `@zxing/library` pero controlando el stream

---

#### Opción D: Solución Nativa/Híbrida

**Hipótesis:** Usar capacidades nativas del dispositivo

**Enfoques:**
- PWA con API nativa de escaneo (si disponible)
- Wrapper nativo (Capacitor/Cordova) con plugin de barcode
- Solución híbrida para iOS específicamente

---

## Métricas de Éxito (Cuando se Retome)

### Mínimo Viable

1. ✅ Cámara trasera abre correctamente
2. ✅ Video muestra entorno (no cara)
3. ✅ Decodifica código `"VIOLA · 2001010801040032"`
4. ✅ Diagnóstico por archivo funciona

### Ideal

1. ✅ Todo lo anterior
2. ✅ Sin conflictos de cámaras
3. ✅ Tiempo de inicialización < 2 segundos
4. ✅ Detección rápida (< 3 segundos con código visible)
5. ✅ Funciona en múltiples modelos de iPhone

---

## Lecciones Aprendidas

### 1. Debugging Remoto es Crítico

**Problema:** Sin acceso a consola del dispositivo, debugging a ciegas

**Solución futura:** Configurar Safari Inspector o herramientas de debugging remoto desde el inicio

---

### 2. Probar en Dispositivo Real Temprano

**Problema:** Comportamiento diferente entre desktop y iOS Safari

**Solución futura:** Probar en dispositivo real desde las primeras iteraciones

---

### 3. Alternativas Múltiples

**Ventaja:** Tener Manual y Foto+OCR funcionando permitió pausar sin bloquear el proyecto

**Solución futura:** Siempre implementar múltiples caminos para funcionalidad crítica

---

### 4. Documentación Continua

**Ventaja:** Cada intento documentado facilita retomar después

**Solución futura:** Mantener documentación detallada de cada enfoque probado

---

## Conclusión

El escaneo por código de barras está **pausado temporalmente** pero con:

- ✅ **Hallazgos valiosos:** html5-qrcode puede decodificar el código
- ✅ **Alternativas funcionales:** Manual y Foto+OCR cubren las necesidades
- ✅ **Documentación completa:** Fácil retomar cuando haya tiempo
- ✅ **Plan claro:** Enfoques específicos a explorar

**No es un bloqueo, es una pausa estratégica.**

---

**Última actualización:** 23 de julio de 2026  
**Próxima revisión:** Cuando haya acceso a debugging iOS y tiempo sin presión
