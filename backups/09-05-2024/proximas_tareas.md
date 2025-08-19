# Próximas Tareas - Orchestra Attendance Tracker

## Prioridad 1: Sistema de Gestión de Estudiantes Activos/Inactivos

**Objetivo**: Implementar un sistema para marcar estudiantes como inactivos cuando dejan el programa, sin perder su historial y permitiendo reactivarlos si regresan en el futuro.

### Cambios a realizar:

1. **Interfaz de Usuario**:
   - Añadir botón/switch para activar/desactivar estudiantes en la pantalla de perfil
   - Implementar diálogo de confirmación al desactivar (opcionalmente solicitar motivo)
   - Añadir indicador visual de estado en las listas de estudiantes
   - Implementar filtro para mostrar/ocultar estudiantes inactivos

2. **Lógica de Aplicación**:
   - Modificar consultas para filtrar por defecto solo estudiantes activos
   - Implementar lógica para reactivar estudiantes inactivos
   - Actualizar cálculos de asistencia para considerar solo estudiantes activos

3. **Mejoras en Reportes**:
   - Añadir contadores de estudiantes activos vs. históricos totales
   - Implementar métricas de retención (porcentaje de activos)
   - Actualizar gráficos para reflejar solo datos de estudiantes activos

### Archivos a modificar:

- `src/screens/StudentProfileScreen.js` (añadir control de estado)
- `src/screens/StudentsListScreen.js` (añadir filtros y visualización)
- `src/screens/ReportsScreen.js` (actualizar estadísticas)
- `src/components/StudentItem.js` (indicador visual de estado)

## Prioridad 2: Sistema de Importación de Datos desde Excel

**Objetivo**: Completar la implementación del plan de importación documentado en `plan_de_importacion_de_datos.md`.

### Pasos pendientes:

1. Preparar plantilla Excel de ejemplo con formato correcto
2. Realizar pruebas de importación con Supabase Studio
3. Documentar proceso con capturas de pantalla
4. Crear guía de solución de problemas comunes

## Tareas Futuras

- Implementar panel web administrativo para gestión avanzada
- Mejorar sistema de reportes con exportación a PDF
- Implementar notificaciones a padres
- Optimizar rendimiento en dispositivos de gama baja 