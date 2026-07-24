# Rediseño de Importación de Inventario - 23/07/2026

## Resumen de Cambios

Se rediseñó completamente la pantalla "Importar Inventario" según especificaciones confirmadas con Eliezer, simplificando el flujo y alineándolo con el formato histórico de Excel.

## Cambios Principales

### 1. ✅ Eliminado Modo A / Modo B
**Antes:** Usuario debía elegir entre dos modos antes de subir el archivo
**Ahora:** Un solo flujo unificado - el sistema decide automáticamente por fila según la columna INVENTORY #:
- **INVENTORY # vacío** → Genera código automático (comportamiento Modo B)
- **INVENTORY # lleno** → Usa el código tal cual, validando estructura (comportamiento Modo A)

### 2. ✅ Nuevo Formato de Columnas (Historial)
**Antes:** Formato técnico con columnas como `full_code`, `status_code_or_condition`, etc.
**Ahora:** 13 columnas del formato histórico (Ascend Equipment Inventory.xlsx):

```
SITE, DESCRIPTION, BRAND, SIZE, SERIAL, MODEL, INVENTORY #, OWNER, STATUS, CONDITION, IN COMMODATE TO, OBSERVATIONS, Estimated Cost
```

#### Mapeo de Columnas:

| Columna Excel | Campo BD | Notas |
|---------------|----------|-------|
| SITE | current_program_id | Matching por nombre (ILIKE) |
| DESCRIPTION | description | Obligatorio |
| BRAND | brand | Opcional |
| SIZE | size | Opcional |
| SERIAL | serial_number | Opcional |
| MODEL | model | Opcional |
| INVENTORY # | full_code | Si vacío → genera automático |
| OWNER | owner | TOSA, Academy, Otro |
| STATUS | source_id | Procedencia: Purchased→Comprado, Donated→Donado, Borrowed→Alquilado |
| CONDITION | status_code + is_active | IN USE→assigned, IN CORE→available, In Repair→repair, Retired→retired + is_active=false |
| IN COMMODATE TO | assigned_to_text | Texto libre (en prueba no hay tabla students) |
| OBSERVATIONS | notes | Opcional |
| Estimated Cost | estimated_cost | Opcional |

**Importante sobre STATUS:**
- Es la PROCEDENCIA del activo, no el estado operativo
- Solo se usa para filas que necesitan código nuevo (la procedencia es parte del código)
- Si la fila ya trae INVENTORY #, este valor se ignora (procedencia ya codificada)

**Importante sobre CONDITION:**
- Es el estado operativo del activo
- "Retired" además de asignar status_code, marca is_active = false

### 3. ✅ Grupo de Activo del Lote
**Nuevo:** Selector único "Grupo de activo para este lote" arriba del botón de subir archivo
- Default: 08 - Instrumentos musicales (editable)
- Solo aplica a filas que necesitan código nuevo
- Clase y Característica ocultas en "Opciones avanzadas" con defaults:
  - 01 - Tangible
  - 04 - Forma física tangible

### 4. ✅ Vista Previa Mejorada
**Nuevo:** Columna visual que indica por fila:
- 🟢 "Código nuevo" (badge verde) - se generará automático
- 🔵 "Código existente" (badge azul) - usa el código del Excel

Muestra errores de validación antes de confirmar la importación.

### 5. ✅ Botón "Descargar Plantilla"
**Nuevo botón** que genera un archivo Excel con:

**Pestaña "Instrucciones":**
- Explicación detallada de cada columna
- Ejemplos de valores esperados
- Notas importantes sobre códigos automáticos vs existentes

**Pestaña "Carga de Inventario":**
- 13 columnas del formato histórico
- Fila de ejemplo (marcada para borrar)
- Listas desplegables para: SITE, OWNER, STATUS, CONDITION
- Lista de SITE generada dinámicamente desde programs activos

**Nota:** Usa librería XLSX (ya disponible). Para validaciones de lista completas se necesitaría exceljs, pero la versión actual es funcional.

## Archivos Modificados

### Nuevos:
- `src/app/dashboard/inventory/import/page.tsx` - Versión rediseñada

### Respaldados:
- `src/app/dashboard/inventory/import/page-old.tsx` - Versión anterior (Modo A/B)

## Funcionalidades Mantenidas

✅ Validación de códigos de 16 dígitos
✅ Verificación de duplicados
✅ Validación de estructura de código (XX-XX-XX-XX-XXXXXX)
✅ Matching de sedes por nombre (ILIKE)
✅ Generación automática de secuenciales
✅ Vista previa antes de confirmar
✅ Reporte de errores por fila
✅ Resumen de importación (exitosos/fallidos)

## Nuevas Validaciones

✅ DESCRIPTION obligatorio
✅ SITE obligatorio
✅ Validación de longitud de INVENTORY # (si viene lleno)
✅ Verificación de que existe configuración de lote para códigos nuevos
✅ Mapeo de STATUS a procedencia (Purchased/Donated/Borrowed)
✅ Mapeo de CONDITION a estado operativo (IN USE/IN CORE/In Repair/Retired)

## Flujo de Uso

1. **Descargar plantilla** (opcional pero recomendado)
2. **Llenar Excel** con datos de activos
   - Dejar INVENTORY # vacío para códigos automáticos
   - Llenar INVENTORY # con código de 16 dígitos si ya existe
3. **Seleccionar Grupo de activo** (default: Instrumentos musicales)
4. **Subir archivo**
5. **Revisar vista previa** - verificar que no haya errores
6. **Confirmar importación**
7. **Ver resultados** - resumen de exitosos/fallidos

## Consideraciones Importantes

⚠️ **Ambiente de Prueba:**
- No existe tabla `students` en el proyecto de prueba
- IN COMMODATE TO siempre cae en `assigned_to_text` (texto libre)
- En producción, esto cambiará para buscar estudiantes reales

⚠️ **Validación de Datos Existentes:**
- Confirmar con Eliezer si el ambiente de prueba tiene registros con full_code inválido
- Probar primero con archivo de 3-5 filas antes de usar con los 84 activos históricos reales

⚠️ **Generación de Códigos:**
- Los códigos automáticos se generan basados en:
  - Procedencia (STATUS del Excel)
  - Grupo (selector de lote)
  - Clase y Característica (opciones avanzadas)
  - Sede (SITE del Excel → work_area_id)
  - Secuencial (último código + 1)

## Próximos Pasos

1. ✅ Código implementado y listo para probar
2. ⏳ Probar con archivo de 3-5 filas de prueba
3. ⏳ Verificar que la generación de códigos funciona correctamente
4. ⏳ Probar con archivo histórico real (84 activos)
5. ⏳ Ajustar según feedback de Eliezer

## Notas Técnicas

- Usa librería XLSX para lectura/escritura de Excel
- Mantiene compatibilidad con estructura de BD existente
- Reutiliza funciones de validación de códigos
- No requiere dependencias nuevas
- Código limpio y bien documentado
