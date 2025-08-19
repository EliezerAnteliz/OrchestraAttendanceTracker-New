# Programación de Backups Automáticos

Este documento explica cómo configurar la ejecución automática de backups en Windows.

## Configuración de una Tarea Programada

### Paso 1: Abrir el Programador de Tareas
1. Presiona `Win + R` para abrir el cuadro "Ejecutar"
2. Escribe `taskschd.msc` y presiona Enter

### Paso 2: Crear una Nueva Tarea
1. En el panel derecho, haz clic en "Crear tarea básica..."
2. Asigna un nombre como "OrchestraAttendanceBackup" y una descripción
3. Haz clic en "Siguiente"

### Paso 3: Configurar el Desencadenador
1. Selecciona la frecuencia (Recomendado: Semanalmente)
2. Elige el día de la semana y la hora para ejecutar el backup
3. Haz clic en "Siguiente"

### Paso 4: Configurar la Acción
1. Selecciona "Iniciar un programa"
2. Haz clic en "Siguiente"
3. En "Programa/script", escribe: `powershell.exe`
4. En "Agregar argumentos": `-ExecutionPolicy Bypass -File "D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New\tools\backup\schedule-backup.ps1"`
   (Ajusta la ruta según la ubicación de tu proyecto)
5. En "Iniciar en": `D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New`
   (Ajusta la ruta según la ubicación de tu proyecto)
6. Haz clic en "Siguiente"

### Paso 5: Finalizar
1. Revisa el resumen de la tarea
2. Marca "Abrir el diálogo Propiedades para esta tarea cuando haga clic en Finalizar"
3. Haz clic en "Finalizar"

### Paso 6: Configuración Adicional
1. En la pestaña "General", marca "Ejecutar con privilegios más altos"
2. En la pestaña "Condiciones", ajusta según sea necesario
3. En la pestaña "Configuración", marca "Ejecutar la tarea lo antes posible después de no haberse iniciado en la programación"
4. Haz clic en "Aceptar" para guardar la tarea

## Ejecución Manual

Si deseas ejecutar el backup manualmente:

1. Abre PowerShell como administrador
2. Navega hasta la carpeta del proyecto: `cd "D:\Proyectos Aplicaciones\Attendance\OrchestraAttendanceTracker-New"`
3. Ejecuta el script: `.\tools\backup\schedule-backup.ps1` 