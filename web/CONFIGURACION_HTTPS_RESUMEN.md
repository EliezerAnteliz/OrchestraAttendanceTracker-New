# ✅ Configuración HTTPS Local - Resumen

## 🎯 Problema Identificado

**Error en móvil:**
```
Camera streaming not supported by the browser
No se pudo acceder a la cámara
undefined is not an object (evaluating 'navigator.mediaDevices.getUserMedia')
```

**Causa:**
Entrando por `http://192.168.1.246:3000` (HTTP por IP local).

Los navegadores móviles **bloquean** `getUserMedia()` fuera de contexto seguro:
- ✅ HTTPS (certificado válido o autofirmado)
- ✅ localhost (solo mismo dispositivo)
- ❌ **HTTP por IP local** ← **BLOQUEADO**

---

## ✅ Solución Aplicada

### 1. Agregado Script HTTPS

**Archivo modificado:** `package.json`

```json
"scripts": {
  "dev": "next dev",
  "dev:https": "next dev --experimental-https",  ← NUEVO
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

### 2. Documentación Creada

**Archivos nuevos:**

1. ✅ **`HTTPS_LOCAL_SETUP.md`**
   - Guía completa de configuración HTTPS
   - Instrucciones paso a paso para móvil
   - Solución de problemas (firewall, certificados, etc.)
   - Notas técnicas sobre `--experimental-https`

2. ✅ **`INICIO_RAPIDO_HTTPS.md`**
   - Pasos rápidos para arrancar
   - Checklist de verificación
   - Pruebas de cámara

3. ✅ **`ESTADO_ACTUAL.md`** (actualizado)
   - Agregada sección de servidor HTTPS
   - Advertencia sobre cámara en móvil
   - Referencia a documentación HTTPS

---

## 🚀 Cómo Usar

### Arrancar Servidor con HTTPS

```bash
npm run dev:https
```

**Salida:**
```
▲ Next.js 15.4.6
- Local:        https://localhost:3000
- Network:      https://192.168.1.246:3000  ← USAR ESTA URL EN MÓVIL
```

### Acceder desde Móvil

1. Teléfono en la misma red WiFi
2. Navegar a: `https://192.168.1.246:3000` (tu IP real)
3. Aceptar certificado autofirmado
4. ✅ Cámara funciona

---

## 📱 Aceptar Certificado Autofirmado

### Chrome (Android)
1. "Your connection is not private"
2. Click **"Advanced"**
3. Click **"Proceed to 192.168.1.246 (unsafe)"**

### Safari (iOS)
1. "This Connection Is Not Private"
2. Click **"Show Details"**
3. Click **"visit this website"**
4. Click **"Visit Website"** de nuevo

---

## 🔧 Solución de Problemas Comunes

### No puedo acceder desde el teléfono

**Firewall de Windows bloqueando puerto 3000:**

```powershell
# Ejecutar como Administrador
New-NetFirewallRule -DisplayName "Next.js Dev HTTPS" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Certificado no se acepta en Chrome

```
chrome://flags
→ "Allow invalid certificates for resources loaded from localhost"
→ Enabled
→ Reiniciar Chrome
```

### Puerto 3000 ocupado

```powershell
# Windows
netstat -ano | findstr :3000
taskkill /PID [número] /F
```

---

## 📖 Documentación Completa

- **Inicio rápido:** `INICIO_RAPIDO_HTTPS.md`
- **Guía completa:** `HTTPS_LOCAL_SETUP.md`
- **Estado del proyecto:** `ESTADO_ACTUAL.md`

---

## ✅ Verificación

Una vez configurado, deberías ver:

1. ✅ Servidor corriendo en `https://192.168.1.246:3000`
2. ✅ Teléfono accede a la URL
3. ✅ Certificado aceptado
4. ✅ Página carga normalmente
5. ✅ Módulo Auditoría → "Escanear" → **Cámara funciona**
6. ✅ Módulo Auditoría → "Foto OCR" → "Abrir Cámara" → **Cámara funciona**

**Si ves el preview de la cámara en el teléfono, ¡está todo correcto!**

---

## 🔄 Volver a HTTP Normal

Para desarrollo en desktop (sin móvil):

```bash
npm run dev
```

Corre en `http://localhost:3000` (sin HTTPS).

**Nota:** La cámara NO funcionará en móvil con HTTP por IP.

---

## 📝 Notas Técnicas

### ¿Qué hace `--experimental-https`?

Next.js 15+:
1. Genera certificado autofirmado automáticamente
2. Lo guarda en `.next/certificates/`
3. Arranca servidor en `https://` (no `http://`)
4. Expone `localhost` y la IP de red con HTTPS

### ¿Es seguro?

- ✅ **Desarrollo local:** Sí
- ❌ **Producción:** NO (usa certificados reales)

### ¿Afecta rendimiento?

No significativamente (~10-20ms de latencia por SSL handshake).

---

## 🎉 Resultado Final

Con esta configuración:

- ✅ Cámara funciona en móvil (HTTPS)
- ✅ Cámara funciona en desktop (HTTPS)
- ✅ Escaneo de código de barras funcional
- ✅ Foto OCR con cámara en vivo funcional
- ✅ Mismo código funciona en ambos dispositivos
- ✅ No requiere cambios en el código de la app
- ✅ Solo cambio en cómo se arranca el servidor

**¡Todo listo para probar el módulo de Auditoría desde el teléfono!**
