# Ascend Attendance Tracker

Aplicación para el seguimiento de asistencia de una orquesta, desarrollada con React Native, Expo Router y Supabase.

## Funcionalidades Implementadas

### 1. Gestión de Estudiantes
- Lista completa de estudiantes con filtrado por instrumento
- Visualización de información básica por estudiante
- Navegación al perfil detallado de cada estudiante
- Sistema de caché para mejor rendimiento
- Ordenamiento alfabético por nombre

### 2. Sistema de Asistencia
- Registro de asistencia individual y grupal
- Tres estados de asistencia:
  - Presente (Verde)
  - Falta Justificada (Amarillo)
  - Falta Injustificada (Rojo)
- Modo de selección múltiple para asistencia grupal

### 3. Sistema de Reportes
- Reportes grupales e individuales
- Períodos configurables:
  - Semanal (con comparación de últimas 4 semanas)
  - Mensual
  - Anual
- Visualización gráfica de estadísticas:
  - Gráfico circular SVG nativo con animaciones de aparición
  - Gráfico de barras CSS nativo con animaciones de crecimiento
  - Selector para alternar entre tipos de gráficos
  - Análisis de tendencias con indicadores de cambio
- Filtrado por instrumento

## Estructura del Proyecto

```
├── app/                    # Rutas y navegación (Expo Router)
│   ├── _layout.js         # Layout principal y tema
│   ├── index.js           # Lista de estudiantes
│   ├── reports.js         # Vista de reportes
│   ├── attendance/        # Rutas de asistencia
│   │   └── register.js    # Registro de asistencia
│   └── student/           # Rutas de estudiantes
│       └── [id]/
│           └── index.js   # Perfil de estudiante
│
├── src/
│   ├── components/        # Componentes reutilizables
│   ├── config/           # Configuración (Supabase)
│   ├── screens/          # Pantallas principales
│   ├── services/         # Servicios y lógica
│   └── utils/            # Utilidades
```

## Navegación
- Menú inferior con tres pestañas principales:
  1. Estudiantes
  2. Asistencia
  3. Reportes

## Comandos Importantes

```bash
# Iniciar el proyecto
npx expo start

# Limpiar caché
npx expo start -c

# Construir para producción
eas build --platform android
```

## Mantenimiento

### Antes de Commits
1. Verificar funcionamiento de:
   - Filtros de instrumentos
   - Registro de asistencia
   - Generación de reportes
2. Comprobar navegación entre pantallas
3. Validar caché y rendimiento

### Después de Pull
1. Limpiar caché: `npx expo start -c`
2. Verificar conexión con Supabase
3. Probar flujos principales

## Base de Datos
- Tablas principales:
  - students
  - attendance
  - instruments
- IDs importantes configurados en `src/config/supabase.js`

## Optimizaciones Implementadas
1. Sistema de caché para estudiantes
2. Filtrado optimizado de instrumentos
3. Renderizado eficiente de listas
4. Modo de selección múltiple para asistencia
5. Cálculo eficiente de tendencias y comparaciones
6. Visualización optimizada de datos estadísticos

## Sistema de Backups

La aplicación cuenta con un sistema integrado de backups para proteger tanto el código como los datos.

### Estructura de Directorios de Backup

```
├── backups/                  # Backups de código fuente
│   ├── YYYY-MM-DD/          # Backup por fecha (ejm: 2025-03-17)
│   │   ├── [archivos .js]   # Archivos de pantalla respaldados
│   └── archive/             # Backups históricos anteriores
│
├── backup_data/              # Backups de datos de Supabase
│   ├── YYYY-MM-DD/          # Backup por fecha (ejm: 2025-03-18)
│   │   ├── [archivos .json] # Datos exportados de tablas
│   └── archive/             # Backups de datos anteriores
│
├── tools/
│   └── backup/              # Herramientas de backup
│       ├── schedule-backup.ps1            # Script para backups automáticos
│       └── INSTRUCCIONES_PROGRAMACION.md  # Guía de programación
```

### Tipos de Backup

1. **Backup de Código (`/backups/`)**: 
   - Contiene copias de los archivos de pantalla (`/src/screens/*.js`)
   - Se organiza por fechas en formato YYYY-MM-DD
   - Preserva la evolución del código fuente

2. **Backup de Datos (`/backup_data/`)**: 
   - Contiene exportaciones de las tablas de Supabase en formato JSON
   - Incluye datos de estudiantes, asistencia, estados, organizaciones, etc.
   - Permite recuperar datos en caso de corrupción o pérdida

### Ejecución de Backups

#### Manual

Para ejecutar un backup manualmente:

```bash
# Backup de datos
npm run export-data

# Backup completo (código + datos)
powershell.exe -ExecutionPolicy Bypass -File "./tools/backup/schedule-backup.ps1"
```

#### Automático

Se ha configurado un script para ejecutar backups automáticos. Para programarlo:

1. Sigue las instrucciones en `tools/backup/INSTRUCCIONES_PROGRAMACION.md`
2. Recomendamos una frecuencia semanal para entornos de producción

### Restauración

Para restaurar desde un backup:

1. **Código**: Copia los archivos desde la carpeta de backup a sus ubicaciones originales
2. **Datos**: Utiliza las herramientas de migración en `tools/migration/` para importar los archivos JSON

## Próximas Mejoras Sugeridas
1. Implementar modo offline
2. Mejorar rendimiento de reportes
3. Agregar más tipos de gráficos
4. Exportación de datos
5. Análisis predictivo de tendencias
6. Alertas automáticas basadas en tendencias negativas
7. Comparación entre períodos personalizados

## Licencia
Este proyecto es privado y confidencial.
