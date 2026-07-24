# Dependencias del Módulo de Auditoría

## Librerías necesarias

Ejecutar en el directorio `web`:

```bash
npm install html5-qrcode tesseract.js
```

### 1. html5-qrcode
- **Propósito:** Escaneo de códigos de barras desde la cámara
- **Compatibilidad:** iOS Safari + Android Chrome
- **Formatos soportados:** Code128, Code39, QR, EAN, UPC, etc.
- **Gratuito:** Sí, MIT License
- **Documentación:** https://github.com/mebjas/html5-qrcode

### 2. tesseract.js
- **Propósito:** OCR (reconocimiento óptico de caracteres) para leer texto de fotos
- **Compatibilidad:** Navegador (client-side) y Node.js (server-side)
- **Idiomas:** Inglés y español
- **Gratuito:** Sí, Apache 2.0 License
- **Sin límites:** No requiere API key ni tiene límites de uso
- **Documentación:** https://github.com/naptha/tesseract.js

## Alternativas descartadas

### BarcodeDetector API (nativo del navegador)
- **Problema:** No funciona en iOS Safari
- **Solución:** Usar html5-qrcode que tiene polyfill

### @zxing/browser
- **Alternativa válida** a html5-qrcode
- Se eligió html5-qrcode por mejor documentación y ejemplos

### Google Cloud Vision / OpenAI Vision / Claude Vision
- **Problema:** Servicios de pago, requieren tarjeta de crédito
- **Decisión de Eliezer:** No hay presupuesto para servicios de IA de pago
- **Solución:** Tesseract.js (100% gratuito, sin límites)

## Notas de implementación

- **Tesseract.js** puede ser más débil que servicios de IA leyendo letra manuscrita
- El flujo SIEMPRE debe permitir fallback a búsqueda manual si OCR no funciona
- La foto se usa solo para lectura transitoria - NO se guarda
- Prioridad: terminar de codificar los 84 instrumentos históricos con códigos de barras
- Una vez todos tengan barras, el escaneo cubre 100% y OCR se vuelve innecesario
