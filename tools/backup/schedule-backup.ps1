# Script para programar backups automáticos
# Este script puede ser agregado como una tarea programada de Windows

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

# Crear un backup de código
$date = Get-Date -Format "yyyy-MM-dd"
$backupCodePath = Join-Path $projectRoot "backups\$date"

# Crear directorio si no existe
if (-not (Test-Path $backupCodePath)) {
    New-Item -Path $backupCodePath -ItemType Directory -Force | Out-Null
    Write-Host "Creado directorio para backup de código: $backupCodePath"
}

# Copiar archivos de pantallas
Copy-Item -Path ".\src\screens\*.js" -Destination $backupCodePath -Force
Write-Host "Backup de código completado en: $backupCodePath"

# Ejecutar el script de exportación de datos
Write-Host "Iniciando exportación de datos..."
npm run export-data

Write-Host "Proceso de backup completado exitosamente." 