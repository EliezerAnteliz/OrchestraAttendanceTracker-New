# Plan de Importación de Datos para Orchestra Attendance Tracker

## Herramienta de Importación: Supabase Studio

**Importante**: Todo el proceso de importación se realizará utilizando **Supabase Studio**, que es un panel de administración que ya viene incluido con tu cuenta de Supabase. No es necesario desarrollar ninguna solución adicional ni pagar por ninguna herramienta externa.

### Ventajas de Supabase Studio:
- **Sin costo adicional**: Ya incluido en tu cuenta Supabase
- **Interfaz intuitiva**: Fácil de usar sin conocimientos técnicos avanzados
- **Acceso seguro**: Solo disponible para administradores con credenciales
- **Importación directa**: Permite cargar CSV/Excel sin procesamiento intermedio
- **Escalable**: Funciona igual para 10 o 10,000 registros

Para acceder: https://app.supabase.io → Selecciona tu proyecto → "Table Editor"

## Estructura de Datos para Importación

### Plantilla de Excel Recomendada

La plantilla debe contener las siguientes columnas (exactamente como se muestra):

| Columna | Tipo | Descripción |
|---------|------|-------------|
| first_name | Texto | Nombre del estudiante |
| last_name | Texto | Apellido del estudiante |
| age | Número | Edad del estudiante |
| current_grade | Texto | Grado actual (1st, 2nd, 3rd, etc.) |
| instrument | Texto | Instrumento (Violin, Viola, Cello, Bass) |
| size | Texto | Tamaño del instrumento (1/2, 3/4, 4/4, etc.) |
| orchestra_position | Texto | Posición en la orquesta (Section) |
| parent_name | Texto | Nombre completo del padre/madre |
| parent_phone | Texto | Número de teléfono (solo números) |
| organization_id | Texto | ID de tu organización (se proporcionará) |
| program_id | Texto | ID del programa/orquesta (se proporcionará) |

### Instrucciones para Formato del Excel

1. **Formato**: Guardar como .xlsx o .csv
2. **Primera fila**: Debe contener exactamente los nombres de columna indicados arriba
3. **Datos**: Cada fila representa un estudiante
4. **Valores vacíos**: Dejar la celda en blanco si no hay información

## Procedimiento para Importación con Supabase Studio

1. **Acceder a Supabase Studio**:
   - Ingresar a https://app.supabase.io
   - Seleccionar tu proyecto

2. **Preparar la tabla**:
   - Ir a "Table Editor" en el menú lateral
   - Seleccionar la tabla "students"

3. **Importar datos**:
   - Hacer clic en "Insert" en la barra superior
   - Seleccionar "Import data from CSV"
   - Arrastrar o seleccionar tu archivo Excel/CSV
   - Verificar el mapeo de columnas (deben coincidir con la estructura de la tabla)
   - Hacer clic en "Import"

4. **Verificar la importación**:
   - Revisar que todos los registros se hayan importado correctamente
   - Verificar posibles errores o duplicados

## Códigos para Instituciones y Programas

Para organizarte desde el principio con múltiples instituciones/orquestas:

### Estructura de Instituciones y Programas

1. **Organización**: Representa una institución completa
   - Asignar un `organization_id` único a cada institución

2. **Programa**: Representa una orquesta o grupo dentro de una institución
   - Asignar un `program_id` único a cada programa/orquesta
   - Cada programa pertenece a una organización

### Ejemplo de Codificación

Para tus actuales datos:

```
organization_id: "a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4"  (Tu organización principal)
program_id: "9d7dc91c-7bbe-49cd-bc64-755467bf91da" (Orquesta principal)
```

Estos IDs son los que utilizamos en la aplicación actual.

## Validación de Datos

Antes de importar, verifica que:

1. No haya datos duplicados (mismos nombres/apellidos)
2. Todos los campos obligatorios estén completos
3. Los formatos sean correctos (teléfonos solo con números, etc.)

## Recomendación para Escalabilidad

A medida que crezca el uso de la aplicación:

1. **Mantener registros claros**: Documentar qué organization_id y program_id corresponde a cada cliente
2. **Plantilla estándar**: Proporcionar la misma plantilla de Excel a todas las instituciones
3. **Tutorial de importación**: Crear una guía paso a paso con capturas de pantalla

## Plantilla de Ejemplo

Así debería verse el archivo Excel de importación:

| first_name | last_name | age | current_grade | instrument | size | orchestra_position | parent_name | parent_phone | organization_id | program_id |
|------------|-----------|-----|---------------|------------|------|-------------------|-------------|--------------|-----------------|------------|
| Aaron | Nahnsen | 9 | 5th | Violin | 1/2 | Section | Jasmine Nahnsen | 2108734543 | a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4 | 9d7dc91c-7bbe-49cd-bc64-755467bf91da |
| Alberto | Morales | 6 | 2nd | Cello | 3/4 | Section | Angelica Lopez | 2107443223 | a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4 | 9d7dc91c-7bbe-49cd-bc64-755467bf91da |
| Alejandro | Rodriguez | 8 | 3rd | Violin | 1/2 | Section | Denise Martinez | 2102557657 | a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4 | 9d7dc91c-7bbe-49cd-bc64-755467bf91da |

## Notas Adicionales

- Los datos de instrumentos deben limitarse preferentemente a: Violin, Viola, Cello, Bass, Not assigned
- Los tamaños deben seguir el formato: 1/4, 1/2, 3/4, 4/4, etc.
- Si una institución tiene múltiples programas/orquestas, se debe asignar un program_id único a cada uno
- Todos los estudiantes deben tener al menos los campos de nombre, apellido e instrumento 