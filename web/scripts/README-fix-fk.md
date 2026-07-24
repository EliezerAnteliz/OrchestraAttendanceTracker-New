# Fix Foreign Key para assigned_student_id

## Problema
Error al cargar el listado de activos:
```
Could not find a relationship between 'assets' and 'students' in the schema cache
```

## Causa Confirmada
La columna `assigned_student_id` existe en la tabla `assets`, pero **falta la foreign key constraint** que la relaciona con `students`. PostgREST necesita esta FK para hacer joins automáticos.

## Solución - Ejecutar en SQL Editor

### Paso 1: Acceder al SQL Editor
1. Ir a: https://supabase.com/dashboard/project/rrajmmykivbzzobljqmm
2. Click en **SQL Editor** en el menú lateral
3. Click en **New query**

### Paso 2: Copiar y ejecutar el script
Copiar **TODO** el contenido del archivo `fix-assigned-student-fk.sql` y pegarlo en el editor.

Click en **Run** (o Ctrl+Enter).

### Paso 3: Verificar los resultados
Deberías ver **4 resultados**:

**Query 1 (Verificar FKs):**
- Si NO aparece ninguna fila con `referencia = students`, confirma que falta la FK

**Query 2 (Crear FK):**
- Mensaje: `ALTER TABLE` (éxito)
- O error: `already exists` (ya estaba creada, no hay problema)

**Query 3 (Refrescar cache):**
- Mensaje: `NOTIFY` (éxito)

**Query 4 (Verificar creación):**
- Deberías ver UNA fila:
  ```
  constraint_name: assets_assigned_student_id_fkey
  tabla: assets
  referencia: students
  ```

### Paso 4: Probar en la aplicación
1. Regresar a la aplicación web
2. Recargar la página del Listado de activos
3. El listado debería cargar normalmente
4. Probar buscar por nombre de estudiante (ej. "Eliezer")

### Si el Listado sigue sin cargar
El cache de PostgREST puede necesitar un reinicio completo:

1. En el dashboard de Supabase, ir a **Settings** → **General**
2. Scroll hasta **Restart project**
3. Click en **Restart project** y confirmar
4. Esperar 1-2 minutos
5. Recargar la página del Listado

## Cambios en el código (ya aplicados)
El código ya usa la sintaxis explícita con hint:
```typescript
assigned_student:students!assigned_student_id(first_name, last_name)
```

El `students!assigned_student_id` le dice a PostgREST exactamente qué tabla y FK usar.

## Notas técnicas
- La FK usa `ON DELETE SET NULL`: si se elimina un estudiante, el activo solo se desasigna (no se elimina)
- El `NOTIFY pgrst, 'reload schema'` fuerza a PostgREST a recargar el schema inmediatamente
- Este es el mismo patrón que otros joins en el proyecto (programs, asset_groups, etc.)
