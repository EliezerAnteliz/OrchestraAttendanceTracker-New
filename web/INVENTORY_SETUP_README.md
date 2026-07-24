# 📦 Módulo de Inventario - Guía de Configuración

## ⚠️ IMPORTANTE: Ambiente de Prueba

Este módulo de inventario está configurado para trabajar **EXCLUSIVAMENTE** en un proyecto de Supabase de prueba separado. **NO toca ni modifica** la base de datos de producción.

### Información del Proyecto de Prueba

- **Nombre**: TOSA Inventario - Test
- **Project ID**: `rrajmmykivbzzobljqmm`
- **URL**: https://rrajmmykivbzzobljqmm.supabase.co
- **Región**: us-west-2 (West US, Oregon)
- **Tipo**: Ambiente de prueba (NO producción)

---

## 📋 Requisitos Previos

1. Acceso al proyecto de Supabase de prueba (`rrajmmykivbzzobljqmm`)
2. Node.js instalado (v18 o superior)
3. Acceso a los archivos CSV de inventario en:
   ```
   D:\Proyectos Aplicaciones\Attendance\Inventory Data\
   ├── japhet_2025_2026.csv
   └── stafford_2025_2026.csv
   ```

---

## 🚀 Pasos de Configuración

### Paso 1: Ejecutar Migraciones SQL en Supabase

Accede al dashboard de Supabase del proyecto de prueba:
https://supabase.com/dashboard/project/rrajmmykivbzzobljqmm

Ve a **SQL Editor** y ejecuta los siguientes scripts en orden:

#### 1.1. Crear Datos Semilla (organizations y programs)
```bash
Archivo: migrations/000_seed_test_data.sql
```
Este script crea:
- 1 organización de prueba: "TOSA Test Organization"
- 2 programas de prueba: "Stafford Test" y "Japhet Test"

#### 1.2. Crear Tablas de Inventario
```bash
Archivo: migrations/001_create_inventory_tables.sql
```
Este script crea las siguientes tablas:
- `asset_locations` - Ubicaciones físicas
- `asset_work_areas` - Áreas de trabajo
- `asset_sources` - Fuentes de adquisición
- `asset_groups` - Grupos de clasificación
- `asset_classes` - Clases de activos
- `asset_characteristics` - Características contables
- `asset_status` - Estados de activos
- `assets` - Tabla principal de activos
- `asset_maintenance_log` - Historial de mantenimiento

#### 1.3. Cargar Catálogos
```bash
Archivo: migrations/002_seed_inventory_catalogs.sql
```
Este script carga:
- Ubicaciones (administrativa, gerencias Ascend, agrupaciones)
- Áreas de trabajo (oficinas, departamentos, sedes)
- Fuentes (Comprado, Donado, Alquilado)
- Grupos (Instrumentos musicales, mobiliario, etc.)
- Clases (Tangible, Intangible)
- Características contables
- Estados (disponible, asignado, en reparación, etc.)

#### 1.4. Configurar Políticas RLS
```bash
Archivo: migrations/003_inventory_rls_policies.sql
```
Este script configura Row Level Security para:
- Permitir lectura de catálogos a todos los usuarios autenticados
- Restringir creación/edición a roles Admin y Staff
- Restringir eliminación solo a Admin

---

### Paso 2: Importar Datos desde CSV

Una vez ejecutadas las migraciones SQL, importa los datos reales de instrumentos:

#### 2.1. Instalar Dependencias (si es necesario)
```bash
cd D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New\web
npm install
```

#### 2.2. Ejecutar Script de Importación
```bash
npx ts-node scripts/import-inventory-csv.ts
```

Este script:
- Lee los archivos CSV de Japhet y Stafford
- Parsea los códigos de inventario de 16 dígitos
- Busca los IDs correspondientes en los catálogos
- Importa los activos con toda su información
- Maneja casos con y sin código de inventario

**Salida esperada:**
```
========================================
IMPORTACIÓN DE INVENTARIO DESDE CSV
========================================
Proyecto: Proyecto de prueba exclusivo para desarrollo del módulo de inventario
URL: https://rrajmmykivbzzobljqmm.supabase.co
========================================

✅ Organización de prueba encontrada: test-org-001

📂 Importando datos de JAPHET...
   Programa Japhet ID: test-prog-japhet
   Total de filas: 46

📦 Procesando: VIOLA - Ascend 13"
   Código encontrado: 2001010801040035
   ✅ Importado exitosamente (ID: ...)

...

✅ Japhet completado: 46 activos importados

📂 Importando datos de STAFFORD...
   Programa Stafford ID: test-prog-stafford
   Total de filas: 89

...

✅ Stafford completado: 89 activos importados

========================================
✅ IMPORTACIÓN COMPLETADA EXITOSAMENTE
========================================
Total de activos importados: 135
```

---

### Paso 3: Acceder a la Interfaz Web

#### 3.1. Iniciar el Servidor de Desarrollo
```bash
cd D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New\web
npm run dev
```

#### 3.2. Acceder al Módulo de Inventario

Abre tu navegador en: http://localhost:3000

1. Inicia sesión con tus credenciales
2. En el sidebar, verás la nueva opción **"Inventario"** (con icono de caja)
3. Haz clic para acceder al Dashboard de Inventario

---

## 📊 Funcionalidades Disponibles

### Dashboard de Inventario
- **Estadísticas generales**:
  - Total de activos
  - Activos disponibles
  - Activos asignados
  - Activos en reparación
- **Últimos activos registrados**: Tabla con los 5 activos más recientes
- **Accesos rápidos**: Botones para ver listado completo y disponibles

### Listado de Activos
- **Tabla completa** con todos los activos importados
- **Filtros**:
  - Búsqueda por descripción, marca, código, serial
  - Filtro por estado (disponible, asignado, reparación, etc.)
  - Filtro por categoría/grupo
- **Información mostrada**:
  - Código de inventario (16 dígitos)
  - Descripción del activo
  - Marca y modelo
  - Tamaño
  - Estado actual
  - Asignado a (estudiante o texto)
  - Programa
  - Costo estimado

---

## 🔍 Verificación de Datos

### Verificar en Supabase Dashboard

1. Ve a: https://supabase.com/dashboard/project/rrajmmykivbzzobljqmm
2. Selecciona **Table Editor**
3. Verifica las siguientes tablas:

#### Tablas de Catálogos (deben tener datos)
- `asset_locations`: 7 ubicaciones
- `asset_work_areas`: 22 áreas
- `asset_sources`: 3 fuentes
- `asset_groups`: 8 grupos
- `asset_classes`: 3 clases
- `asset_characteristics`: 7 características
- `asset_status`: 5 estados

#### Tabla Principal
- `assets`: ~135 activos (46 de Japhet + 89 de Stafford)

### Consultas SQL de Verificación

```sql
-- Total de activos por programa
SELECT 
  p.name as programa,
  COUNT(a.id) as total_activos
FROM assets a
JOIN programs p ON p.id = a.current_program_id
GROUP BY p.name;

-- Activos por estado
SELECT 
  ast.description as estado,
  COUNT(a.id) as cantidad
FROM assets a
JOIN asset_status ast ON ast.code = a.status_code
GROUP BY ast.description;

-- Activos con código vs sin código
SELECT 
  CASE 
    WHEN full_code IS NOT NULL THEN 'Con código'
    ELSE 'Sin código'
  END as tipo,
  COUNT(*) as cantidad
FROM assets
GROUP BY tipo;
```

---

## 🛡️ Seguridad y Aislamiento

### Garantías de Seguridad

1. **Configuración separada**: El archivo `supabase.inventory.config.ts` contiene las credenciales del proyecto de prueba
2. **Cliente independiente**: Las páginas de inventario usan `createClient()` con las credenciales de prueba
3. **Sin modificación de producción**: El código NO toca el archivo `.env.local` de producción
4. **Advertencias visuales**: Todas las páginas muestran un banner amarillo indicando "Ambiente de prueba"

### Archivos Clave de Configuración

```
web/
├── supabase.inventory.config.ts  ← Configuración del proyecto de prueba
├── src/app/dashboard/inventory/
│   ├── page.tsx                  ← Dashboard (usa config de prueba)
│   └── assets/
│       └── page.tsx              ← Listado (usa config de prueba)
├── migrations/                   ← Scripts SQL
└── scripts/
    └── import-inventory-csv.ts   ← Script de importación
```

---

## 🐛 Solución de Problemas

### Error: "No se encontró la organización de prueba"
**Solución**: Ejecuta primero el script `000_seed_test_data.sql`

### Error: "Could not find a relationship..."
**Solución**: Verifica que las políticas RLS estén configuradas correctamente con `003_inventory_rls_policies.sql`

### Error: "No se encontró programa Stafford/Japhet"
**Solución**: Verifica que el script `000_seed_test_data.sql` haya creado los programas correctamente

### Los activos no aparecen en la interfaz
**Solución**: 
1. Verifica que el script de importación haya terminado exitosamente
2. Revisa la tabla `assets` en Supabase Dashboard
3. Verifica que las políticas RLS permitan lectura

### Error de TypeScript en las páginas
**Nota**: Los errores de tipo relacionados con `asset_status` son conocidos y no afectan la funcionalidad. Se deben a que Supabase devuelve arrays en lugar de objetos únicos en las relaciones. Esto se puede corregir ajustando los tipos de TypeScript.

---

## 📝 Notas Importantes

1. **NO desplegar a producción**: Este módulo está diseñado solo para pruebas y revisión visual
2. **Datos reales**: Los CSV contienen datos reales de instrumentos, pero están en un ambiente aislado
3. **Sin conexión con students.instrument**: Por diseño, este módulo NO modifica ni conecta con el campo `instrument` de la tabla `students` de producción
4. **Preview deployment**: Para mostrar en Vercel, usar un preview deployment, NO production

---

## 🎯 Próximos Pasos (Fuera del Alcance Actual)

Estas funcionalidades NO están implementadas en esta fase:

- ❌ Conexión con `students.instrument`
- ❌ Asignación de instrumentos a estudiantes desde la interfaz
- ❌ Edición de activos
- ❌ Eliminación de activos
- ❌ Registro de mantenimiento
- ❌ Generación de reportes de inventario
- ❌ Exportación a Excel
- ❌ Códigos QR para activos

---

## 📞 Contacto

Para preguntas o problemas con la configuración, contacta al desarrollador.

---

**Última actualización**: 21 de Julio, 2026
**Versión**: 1.0.0 (Primera versión - Solo visualización)
