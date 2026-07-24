# 🚀 Inicio Rápido - Módulo de Inventario

## ⚡ Configuración en 5 Minutos

### Paso 1: Acceder a Supabase (2 min)

1. Abre: https://supabase.com/dashboard/project/rrajmmykivbzzobljqmm
2. Ve a **SQL Editor**
3. Ejecuta estos 4 scripts en orden:

```sql
-- 1. Datos de prueba (organizations y programs)
-- Copia y pega: migrations/000_seed_test_data.sql

-- 2. Crear tablas
-- Copia y pega: migrations/001_create_inventory_tables.sql

-- 3. Cargar catálogos
-- Copia y pega: migrations/002_seed_inventory_catalogs.sql

-- 4. Configurar RLS
-- Copia y pega: migrations/003_inventory_rls_policies.sql
```

### Paso 2: Importar Datos (2 min)

```bash
cd D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New\web
npx ts-node scripts/import-inventory-csv.ts
```

Espera el mensaje: `✅ IMPORTACIÓN COMPLETADA EXITOSAMENTE`

### Paso 3: Ver en la Web (1 min)

```bash
npm run dev
```

1. Abre: http://localhost:3000
2. Inicia sesión
3. Click en **"Inventario"** en el sidebar
4. ¡Listo! 🎉

---

## 🔍 Verificación Rápida

### En Supabase Dashboard
- `asset_locations`: 7 filas
- `asset_groups`: 8 filas
- `assets`: ~135 filas

### En la Web
- Dashboard muestra estadísticas
- Listado muestra todos los activos
- Filtros funcionan correctamente

---

## ⚠️ Recordatorios

- ✅ Proyecto de prueba: `rrajmmykivbzzobljqmm`
- ❌ NO tocar producción: `lbanldhbmuabmybtlkbs`
- 📋 Ver `INVENTORY_SETUP_README.md` para detalles completos

---

## 🐛 Problemas Comunes

**Error: "No se encontró organización"**  
→ Ejecuta `000_seed_test_data.sql` primero

**Error: "Could not find relationship"**  
→ Ejecuta `003_inventory_rls_policies.sql`

**No aparecen activos**  
→ Verifica que el script de importación terminó exitosamente

---

**¿Necesitas más ayuda?** → Lee `INVENTORY_SETUP_README.md`
