# Configuración HTTPS Local para Pruebas con Cámara en Móvil

## 🔒 ¿Por Qué HTTPS?

Los navegadores móviles (Chrome, Safari, Firefox) **bloquean** `navigator.mediaDevices.getUserMedia()` fuera de un "contexto seguro":

- ✅ **HTTPS** (certificado válido o autofirmado)
- ✅ **localhost** (solo en el mismo dispositivo)
- ❌ **HTTP por IP local** (192.168.x.x) ← **BLOQUEADO**

### Error sin HTTPS:
```
Camera streaming not supported by the browser
No se pudo acceder a la cámara
undefined is not an object (evaluating 'navigator.mediaDevices.getUserMedia')
```

---

## 🚀 Cómo Arrancar con HTTPS

### Opción 1: Usar Script Configurado (Recomendado)

```bash
npm run dev:https
```

Esto ejecuta: `next dev --experimental-https`

### Opción 2: Comando Directo

```bash
npx next dev --experimental-https
```

---

## 📱 Cómo Acceder desde el Teléfono

### Paso 1: Arrancar el Servidor

En tu computadora:

```bash
cd D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New\web
npm run dev:https
```

**Salida esperada:**
```
▲ Next.js 15.4.6
- Local:        https://localhost:3000
- Network:      https://192.168.1.246:3000

✓ Starting...
✓ Ready in 2.3s
⚠ Using experimental HTTPS server
```

### Paso 2: Obtener la IP de tu Computadora

La IP ya aparece en la salida del servidor (ej. `https://192.168.1.246:3000`).

Si no aparece, obtén tu IP manualmente:

**Windows:**
```powershell
ipconfig
```
Busca "IPv4 Address" en tu adaptador WiFi/Ethernet (ej. `192.168.1.246`)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

### Paso 3: Conectar desde el Teléfono

1. **Asegúrate que el teléfono esté en la misma red WiFi** que tu computadora

2. **Abre el navegador en el teléfono** (Chrome, Safari, etc.)

3. **Navega a:**
   ```
   https://192.168.1.246:3000
   ```
   (Reemplaza `192.168.1.246` con tu IP real)

4. **Acepta el certificado autofirmado:**

   #### En Chrome (Android):
   - Verás: "Your connection is not private"
   - Click **"Advanced"**
   - Click **"Proceed to 192.168.1.246 (unsafe)"**

   #### En Safari (iOS):
   - Verás: "This Connection Is Not Private"
   - Click **"Show Details"**
   - Click **"visit this website"**
   - Click **"Visit Website"** de nuevo
   - Ingresa el código del teléfono si te lo pide

5. **¡Listo!** Ahora puedes usar la cámara en el módulo de Auditoría

---

## 🔧 Solución de Problemas

### Problema: "Cannot reach this page" / "Site can't be reached"

**Causa:** Firewall de Windows bloqueando el puerto 3000.

**Solución:**

1. Abre PowerShell como Administrador
2. Ejecuta:
   ```powershell
   New-NetFirewallRule -DisplayName "Next.js Dev HTTPS" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

### Problema: "ERR_CERT_AUTHORITY_INVALID" y no aparece opción para continuar

**Causa:** Navegador muy restrictivo con certificados autofirmados.

**Solución (Chrome Android):**
1. Escribe en la barra de direcciones: `chrome://flags`
2. Busca: "Allow invalid certificates for resources loaded from localhost"
3. Cambia a **"Enabled"**
4. Reinicia Chrome

**Solución (Safari iOS):**
1. Ve a Ajustes → General → Información → Ajustes de certificados
2. Habilita certificados para desarrollo local

### Problema: Certificado expira o da error

**Solución:** Next.js regenera el certificado automáticamente. Detén el servidor (`Ctrl+C`) y vuelve a arrancar:

```bash
npm run dev:https
```

### Problema: "Address already in use" (Puerto 3000 ocupado)

**Solución:** Mata el proceso que usa el puerto 3000:

**Windows:**
```powershell
netstat -ano | findstr :3000
taskkill /PID [número_de_PID] /F
```

**Mac/Linux:**
```bash
lsof -ti:3000 | xargs kill -9
```

---

## 📋 Checklist de Verificación

Antes de probar en el teléfono:

- [ ] Servidor corriendo con `npm run dev:https`
- [ ] Salida muestra `https://192.168.1.246:3000` (o tu IP)
- [ ] Teléfono conectado a la misma red WiFi
- [ ] Navegador del teléfono apunta a `https://[TU_IP]:3000`
- [ ] Certificado autofirmado aceptado
- [ ] Página carga correctamente

Ahora prueba:

- [ ] Módulo de Auditoría → "Escanear" → Cámara funciona
- [ ] Módulo de Auditoría → "Foto OCR" → "Abrir Cámara" funciona

---

## 🔄 Volver a HTTP Normal

Si quieres volver a desarrollo sin HTTPS (solo para desktop):

```bash
npm run dev
```

Esto arranca en `http://localhost:3000` (sin HTTPS).

**Nota:** La cámara NO funcionará en móvil con HTTP por IP.

---

## 📝 Notas Técnicas

### ¿Qué hace `--experimental-https`?

Next.js 15+ incluye un servidor HTTPS de desarrollo que:

1. Genera un certificado autofirmado automáticamente
2. Lo guarda en `.next/certificates/`
3. Arranca el servidor en `https://` en vez de `http://`
4. Expone tanto `localhost` como la IP de red con HTTPS

### ¿Es seguro?

- ✅ **Para desarrollo local:** Sí, es seguro
- ❌ **Para producción:** NO, usa certificados reales (Let's Encrypt, etc.)

El certificado autofirmado solo sirve para desarrollo. Los navegadores lo marcan como "no confiable" pero puedes aceptarlo manualmente.

### ¿Afecta el rendimiento?

No significativamente. HTTPS local agrega ~10-20ms de latencia por el handshake SSL, pero es imperceptible en desarrollo.

---

## 🎯 Resumen Rápido

```bash
# 1. Arrancar servidor con HTTPS
npm run dev:https

# 2. Obtener IP (aparece en la salida del servidor)
# Ejemplo: https://192.168.1.246:3000

# 3. En el teléfono (misma red WiFi):
# Navegar a: https://192.168.1.246:3000
# Aceptar certificado autofirmado

# 4. Probar cámara en módulo de Auditoría
# ✅ Escaneo de código de barras
# ✅ Foto OCR
```

---

## ✅ Confirmación

Una vez que aceptes el certificado en el teléfono, deberías ver:

1. ✅ Página carga normalmente
2. ✅ Click "Escanear" → Solicita permiso de cámara
3. ✅ Permites cámara → Preview en vivo funciona
4. ✅ Click "Foto OCR" → "Abrir Cámara" → Preview funciona

**Si ves el preview de la cámara, ¡está funcionando correctamente!**
