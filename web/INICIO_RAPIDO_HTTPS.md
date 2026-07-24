# 🚀 Inicio Rápido - HTTPS Local para Cámara en Móvil

## ⚡ Pasos Rápidos

### 1. Detener el Servidor HTTP Actual

Si tienes `npm run dev` corriendo, deténlo con `Ctrl+C`.

### 2. Arrancar con HTTPS

```bash
npm run dev:https
```

**Salida esperada:**
```
▲ Next.js 15.4.6
- Local:        https://localhost:3000
- Network:      https://192.168.1.246:3000  ← ESTA ES TU URL

✓ Ready in 2.3s
⚠ Using experimental HTTPS server
```

### 3. Conectar desde el Teléfono

1. **Asegúrate que el teléfono esté en la misma red WiFi**

2. **Abre el navegador del teléfono** (Chrome, Safari, etc.)

3. **Navega a la URL que apareció en "Network":**
   ```
   https://192.168.1.246:3000
   ```
   (Usa tu IP real, la que aparece en la salida del servidor)

4. **Acepta el certificado autofirmado:**

   **Chrome (Android):**
   - "Your connection is not private"
   - Click **"Advanced"**
   - Click **"Proceed to 192.168.1.246 (unsafe)"**

   **Safari (iOS):**
   - "This Connection Is Not Private"
   - Click **"Show Details"**
   - Click **"visit this website"**
   - Click **"Visit Website"** de nuevo

5. **¡Listo!** Ahora la cámara funcionará

---

## 🧪 Probar la Cámara

1. Navega a: **Auditoría** (en el menú superior)
2. Click **"Nueva Auditoría"**
3. Selecciona una sede → **"Iniciar"**
4. Prueba cualquiera de estos:
   - **"Escanear"** → Debería abrir la cámara
   - **"Foto OCR"** → **"Abrir Cámara"** → Debería abrir la cámara

**Si ves el preview de la cámara, ¡funciona!** ✅

---

## 🔧 Si No Funciona

### Problema: No puedo acceder desde el teléfono

**Verifica:**
1. ¿El teléfono está en la misma red WiFi?
2. ¿Usaste la IP correcta (la que aparece en "Network")?
3. ¿Usaste `https://` (no `http://`)?

**Si sigue sin funcionar:**
- Firewall de Windows bloqueando el puerto 3000
- Ver `HTTPS_LOCAL_SETUP.md` sección "Solución de Problemas"

### Problema: Certificado no se acepta

**Chrome Android:**
1. Ve a `chrome://flags`
2. Busca "Allow invalid certificates for resources loaded from localhost"
3. Habilita
4. Reinicia Chrome

---

## 📋 Checklist

- [ ] Servidor corriendo con `npm run dev:https`
- [ ] Salida muestra `https://192.168.1.246:3000` (o tu IP)
- [ ] Teléfono en la misma red WiFi
- [ ] Navegador apunta a `https://[TU_IP]:3000`
- [ ] Certificado aceptado
- [ ] Página carga
- [ ] Cámara funciona en módulo de Auditoría

---

## 📖 Documentación Completa

- **Instrucciones detalladas:** `HTTPS_LOCAL_SETUP.md`
- **Solución de problemas:** `HTTPS_LOCAL_SETUP.md` → "Solución de Problemas"
- **Estado del proyecto:** `ESTADO_ACTUAL.md`
