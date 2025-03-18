# Orchestra Attendance Tracker

Aplicación para el seguimiento de asistencia de una orquesta, desarrollada con React Native y Supabase.

## Estructura del Proyecto

```
├── app/                    # Rutas y navegación (Expo Router)
│   ├── _layout.js         # Layout principal
│   ├── index.js           # Punto de entrada
│   └── student/           # Rutas relacionadas con estudiantes
│       └── [id].js        # Vista de perfil de estudiante
│
├── src/
│   ├── components/        # Componentes reutilizables
│   ├── config/           # Configuración (Supabase, etc.)
│   ├── contexts/         # Contextos de React (Auth, etc.)
│   ├── screens/          # Pantallas principales
│   ├── services/         # Servicios y lógica de negocio
│   └── utils/            # Utilidades y helpers
│
├── assets/               # Recursos estáticos
├── tools/               # Herramientas de mantenimiento
│   └── migration/       # Scripts de migración de datos
│
└── backup_data/         # Respaldos de datos
```

## Características Principales

- Autenticación de usuarios
- Lista de estudiantes con búsqueda
- Perfiles detallados de estudiantes
- Información de contacto de padres
- Diseño moderno y responsivo

## Configuración del Proyecto

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
- Crear archivo `.env` basado en `.env.example`
- Configurar las credenciales de Supabase

3. Iniciar el proyecto:
```bash
npx expo start
```

## Base de Datos

La estructura de la base de datos se encuentra en `scripts/setup-database.sql`

Tablas principales:
- organizations
- programs
- students
- parents
- student_parents
- attendance_status

## Mantenimiento

Los scripts de migración y mantenimiento se encuentran en la carpeta `tools/migration/`. Estos scripts son utilizados para tareas administrativas y no son necesarios para el funcionamiento diario de la aplicación.
