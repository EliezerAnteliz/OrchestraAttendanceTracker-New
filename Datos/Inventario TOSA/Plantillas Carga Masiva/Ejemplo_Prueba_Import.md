# Archivo de Prueba para Importación de Inventario

## Datos de Ejemplo (3-5 filas)

Crear un archivo Excel con estas filas para probar la importación:

### Fila 1: Código automático - Violín disponible
```
SITE: Stafford
DESCRIPTION: Violín 4/4 estudiante
BRAND: Yamaha
SIZE: 4/4
SERIAL: YV123456
MODEL: V5SC
INVENTORY #: (vacío)
OWNER: TOSA
STATUS: Purchased
CONDITION: IN CORE
IN COMMODATE TO: (vacío)
OBSERVATIONS: Activo de prueba - código automático
Estimated Cost: 500
```

### Fila 2: Código automático - Flauta asignada
```
SITE: Japhet
DESCRIPTION: Flauta traversa
BRAND: Pearl
SIZE: (vacío)
SERIAL: PF789012
MODEL: PF-505E
INVENTORY #: (vacío)
OWNER: Academy
STATUS: Donated
CONDITION: IN USE
IN COMMODATE TO: David Ramirez
OBSERVATIONS: Donado en 2024
Estimated Cost: 350
```

### Fila 3: Código existente - Clarinete en reparación
```
SITE: Stafford
DESCRIPTION: Clarinete Bb
BRAND: Buffet Crampon
SIZE: (vacío)
SERIAL: BC345678
MODEL: E11
INVENTORY #: 01-08-01-0401001
OWNER: TOSA
STATUS: Purchased
CONDITION: In Repair
IN COMMODATE TO: (vacío)
OBSERVATIONS: En reparación - embocadura dañada
Estimated Cost: 800
```

### Fila 4: Código automático - Trompeta retirada
```
SITE: Japhet
DESCRIPTION: Trompeta Bb
BRAND: Bach
SIZE: (vacío)
SERIAL: BT901234
MODEL: TR300H2
INVENTORY #: (vacío)
OWNER: TOSA
STATUS: Purchased
CONDITION: Retired
IN COMMODATE TO: (vacío)
OBSERVATIONS: Dado de baja por daños irreparables
Estimated Cost: 600
```

### Fila 5: Código existente - Saxofón en comodato
```
SITE: Stafford
DESCRIPTION: Saxofón Alto Eb
BRAND: Selmer
SIZE: (vacío)
SERIAL: SS567890
MODEL: AS42
INVENTORY #: 01-08-01-0401002
OWNER: Otro
STATUS: Borrowed
CONDITION: IN USE
IN COMMODATE TO: Terranova Music School
OBSERVATIONS: En comodato hasta diciembre 2026
Estimated Cost: 1200
```

## Resultados Esperados

### Fila 1:
- ✅ Código generado automático (ej. 01-08-01-0401003)
- ✅ status_code: available
- ✅ is_active: true
- ✅ source_id: Comprado
- ✅ current_program_id: Stafford

### Fila 2:
- ✅ Código generado automático (ej. 02-08-01-0402001)
- ✅ status_code: assigned
- ✅ is_active: true
- ✅ source_id: Donado
- ✅ current_program_id: Japhet
- ✅ assigned_to_text: "David Ramirez"

### Fila 3:
- ✅ Usa código existente: 01-08-01-0401001
- ✅ Valida estructura del código
- ✅ Verifica que no esté duplicado
- ✅ status_code: repair
- ✅ is_active: true

### Fila 4:
- ✅ Código generado automático (ej. 01-08-01-0402002)
- ✅ status_code: retired
- ✅ **is_active: false** (dado de baja)
- ✅ source_id: Comprado

### Fila 5:
- ✅ Usa código existente: 01-08-01-0401002
- ✅ Valida estructura del código
- ✅ status_code: assigned
- ✅ assigned_to_text: "Terranova Music School"
- ✅ owner: "Otro"

## Casos de Error a Probar

### Error 1: DESCRIPTION vacío
```
SITE: Stafford
DESCRIPTION: (vacío)
...
```
**Resultado esperado:** ❌ Error: "DESCRIPTION es obligatorio"

### Error 2: SITE vacío
```
SITE: (vacío)
DESCRIPTION: Violín 4/4
...
```
**Resultado esperado:** ❌ Error: "SITE es obligatorio"

### Error 3: INVENTORY # con longitud incorrecta
```
SITE: Stafford
DESCRIPTION: Violín 4/4
INVENTORY #: 12345 (solo 5 dígitos)
...
```
**Resultado esperado:** ❌ Error: "INVENTORY # debe tener 16 dígitos"

### Error 4: INVENTORY # duplicado
```
SITE: Stafford
DESCRIPTION: Violín 4/4
INVENTORY #: 01-08-01-0401001 (ya existe en BD)
...
```
**Resultado esperado:** ❌ Error: "Código duplicado - ya existe en la base de datos"

### Error 5: SITE no encontrado
```
SITE: Sede Inexistente
DESCRIPTION: Violín 4/4
INVENTORY #: (vacío)
...
```
**Resultado esperado:** ❌ Error: "Sede 'Sede Inexistente' no encontrada"

## Configuración Requerida

Antes de probar, asegurarse de:

1. ✅ Seleccionar "Grupo de activo": 08 - Instrumentos musicales
2. ✅ Verificar que existen las sedes "Stafford" y "Japhet" en programs
3. ✅ Verificar que existen work_areas asociadas a esas sedes
4. ✅ Verificar que existen los códigos de procedencia (01, 02, 03)

## Notas

- Las filas 1, 2, 4 generarán códigos automáticos
- Las filas 3, 5 usarán códigos existentes
- La fila 4 se marcará como inactiva (Retired)
- La vista previa debe mostrar claramente qué filas generan código nuevo vs existente
