# Plan de Implementación: Diseño Monday.com para Orchestra Attendance Tracker

## Índice
1. [Introducción y Objetivos](#introducción-y-objetivos)
2. [Análisis Previo](#análisis-previo)
3. [Fases de Implementación](#fases-de-implementación)
4. [Sistema de Temas](#sistema-de-temas)
5. [Componentes Básicos](#componentes-básicos)
6. [Pantallas](#pantallas)
7. [Pruebas y Validación](#pruebas-y-validación)
8. [Referencias y Recursos](#referencias-y-recursos)
9. [Plan de Contingencia](#plan-de-contingencia)

## Introducción y Objetivos

### Objetivo Principal
Implementar un diseño moderno inspirado en Monday.com para el Orchestra Attendance Tracker, manteniendo toda la funcionalidad existente y mejorando la experiencia visual del usuario.

### Principios Rectores
- **Preservar Funcionalidad**: No alterar la lógica de negocio, solo mejorar la presentación visual
- **Implementación Gradual**: Enfoque por etapas para garantizar estabilidad
- **Consistencia Visual**: Mantener coherencia en toda la aplicación
- **Rendimiento Óptimo**: Asegurar que los cambios visuales no afecten negativamente el rendimiento

### Resultado Esperado
Una aplicación visualmente moderna con estilo Monday.com que mantenga todas las funcionalidades actuales.

## Análisis Previo

### Estado Actual
- La aplicación utiliza React Native con Expo
- El sistema de temas se encuentra en `src/theme/index.js`
- Se utilizan componentes de React Native Paper
- La navegación se maneja con expo-router
- Los datos se gestionan con Supabase y AsyncStorage

### Características del Estilo Monday.com
- Sistema de tarjetas con estados visuales por color
- Estructura de fila/columna para organización de datos
- Elementos interactivos con retroalimentación visual clara
- Tipografía clara y legible
- Espaciado generoso entre elementos

## Fases de Implementación

### Fase 1: Preparación y Sistema de Temas
- Crear sistema de temas basado en Monday.com
- Implementar mecanismo de cambio de tema
- Preparar componentes básicos reutilizables

### Fase 2: Componentes Básicos
- Actualizar tarjetas, botones, entradas de texto y otros elementos UI
- Conservar funcionalidad original y parámetros

### Fase 3: Pantallas Principales
- Implementar nuevos estilos en cada pantalla
- Mantener toda la lógica de negocio intacta

### Fase 4: Pruebas y Refinamiento
- Pruebas de regresión para asegurar funcionalidad
- Ajustes finales de diseño para coherencia visual

## Sistema de Temas

### Modificación de `theme/index.js`

#### Paso 1: Crear tema Monday
Añadir un nuevo objeto de tema para Monday.com dentro de `theme/index.js`:

```javascript
export const MONDAY_THEME = {
  light: {
    // Colores primarios
    primary: '#0073ea',         // Azul Monday principal
    primaryLight: '#cce5ff',    // Azul claro para fondos
    secondary: '#00c875',       // Verde para acciones positivas
    error: '#e44258',           // Rojo para errores y eliminación
    warning: '#fdab3d',         // Naranja para advertencias
    success: '#00c875',         // Verde para éxito
    info: '#0086c0',            // Azul información
    
    // Colores de fondo
    background: '#f6f7fb',      // Fondo principal claro
    surface: '#ffffff',         // Superficie de tarjetas
    cardBackground: '#ffffff',  // Fondo de tarjetas
    
    // Colores de texto
    textPrimary: '#323338',     // Texto principal
    textSecondary: '#676879',   // Texto secundario
    textHint: '#c5c7d0',        // Texto de ayuda
    
    // Colores de estado (conservando compatibilidad con estados de asistencia)
    present: '#00c875',         // Verde - Presente
    excused: '#fdab3d',         // Naranja - Ausencia justificada
    absent: '#e44258',          // Rojo - Ausencia injustificada
    
    // Elementos de interfaz
    divider: '#edeef0',         // Divisores
    outline: '#c3c6d4',         // Contornos
    disabled: '#e6e9ef',        // Elementos deshabilitados
    
    // Sombras
    shadowLight: 'rgba(0, 0, 0, 0.05)',
    shadowMedium: 'rgba(0, 0, 0, 0.08)'
  },
  dark: {
    // Colores primarios en modo oscuro
    primary: '#0073ea',         // Se mantiene el azul principal
    primaryLight: '#1f2f48',    // Azul oscuro para fondos
    secondary: '#00a36c',       // Verde más oscuro
    error: '#d73a4e',           // Rojo más oscuro
    warning: '#e5982f',         // Naranja más oscuro
    success: '#00a36c',         // Verde más oscuro
    info: '#0079af',            // Azul información
    
    // Colores de fondo
    background: '#1c1f3b',      // Fondo principal oscuro
    surface: '#2a2e52',         // Superficie de tarjetas
    cardBackground: '#2a2e52',  // Fondo de tarjetas
    
    // Colores de texto
    textPrimary: '#ffffff',     // Texto principal
    textSecondary: '#c5c7d0',   // Texto secundario
    textHint: '#9395a5',        // Texto de ayuda
    
    // Colores de estado (conservando compatibilidad)
    present: '#00a36c',         // Verde - Presente
    excused: '#e5982f',         // Naranja - Ausencia justificada
    absent: '#d73a4e',          // Rojo - Ausencia injustificada
    
    // Elementos de interfaz
    divider: '#3e4166',         // Divisores
    outline: '#494c7d',         // Contornos
    disabled: '#383b5c',        // Elementos deshabilitados
    
    // Sombras
    shadowLight: 'rgba(0, 0, 0, 0.15)',
    shadowMedium: 'rgba(0, 0, 0, 0.24)'
  }
};
```

#### Paso 2: Añadir utilidades de estilo Monday
Crear funciones de utilidad específicas para el estilo Monday:

```javascript
// Utilidades para el estilo Monday
export const mondayStyles = {
  // Sombras de tarjetas
  cardShadow: (theme) => ({
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  }),
  
  // Estilo de tarjeta Monday
  card: (theme) => ({
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
    ...mondayStyles.cardShadow(theme),
  }),
  
  // Estilo de botón Monday
  button: (theme) => ({
    borderRadius: 4,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  }),
  
  // Estilo de elemento de lista Monday
  listItem: (theme) => ({
    borderRadius: 6,
    padding: SPACING.sm,
    marginVertical: 4,
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 4,
  }),
  
  // Estilo para fila de datos Monday
  dataRow: (theme) => ({
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  }),
  
  // Estilo para indicador de estado
  statusIndicator: (color) => ({
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color,
    marginRight: SPACING.sm,
  })
};
```

#### Paso 3: Extender tema existente para compatibilidad
Modificar el mecanismo de tema existente para incluir Monday:

```javascript
// En src/theme/index.js
export const themeNames = {
  DEFAULT: 'default',
  MONDAY: 'monday',
};

// Función para obtener tema según nombre
export const getThemeByName = (themeName) => {
  switch (themeName) {
    case themeNames.MONDAY:
      return {
        ...DefaultTheme,
        colors: MONDAY_THEME.light,
        dark: false,
        // Integrar estilos Monday
        monday: true
      };
    default:
      return DefaultTheme;
  }
};
```

### Creación del Toggle de Tema
Crear o modificar un componente para cambiar entre temas:

```javascript
// src/components/ThemeToggleButton.js
import React from 'react';
import { IconButton, Menu } from 'react-native-paper';
import { useAppTheme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeToggleButton = () => {
  const { setTheme, themeType } = useAppTheme();
  const [visible, setVisible] = React.useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    await AsyncStorage.setItem('themeType', newTheme);
    closeMenu();
  };

  return (
    <>
      <IconButton
        icon="palette"
        size={24}
        onPress={openMenu}
      />
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={{ x: 150, y: 50 }}
      >
        <Menu.Item 
          title="Tema Original" 
          onPress={() => handleThemeChange('default')} 
          leadingIcon={themeType === 'default' ? "check" : undefined}
        />
        <Menu.Item 
          title="Tema Monday" 
          onPress={() => handleThemeChange('monday')} 
          leadingIcon={themeType === 'monday' ? "check" : undefined}
        />
      </Menu>
    </>
  );
};

export default ThemeToggleButton;
```

## Componentes Básicos

### Tarjetas de Estudiante
Modificar `StudentItem.js` o crear un nuevo componente `MondayStudentItem.js`:

```javascript
// src/components/MondayStudentItem.js
import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useAppTheme, SPACING, mondayStyles } from '../theme';

const MondayStudentItem = memo(({
  student,
  attendanceStatus,
  onPress,
  isSelected,
  selectionMode
}) => {
  const { theme, isDark } = useAppTheme();
  const { first_name, last_name, instrument } = student;
  
  // Determinar color de estado según asistencia
  const getStatusColor = () => {
    switch (attendanceStatus) {
      case 'present':
        return theme.colors.present;
      case 'excused':
        return theme.colors.excused;
      case 'absent':
        return theme.colors.absent;
      default:
        return theme.colors.outline;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Surface style={[
        styles.card,
        mondayStyles.card(theme),
        isSelected && styles.selectedCard,
        { borderLeftColor: getStatusColor(), borderLeftWidth: 4 }
      ]}>
        <View style={styles.contentContainer}>
          <View style={styles.mainContent}>
            <Text style={styles.name}>
              {first_name} {last_name}
            </Text>
            {instrument && (
              <Text style={styles.instrument}>
                {instrument}
              </Text>
            )}
          </View>
          <View style={styles.statusContainer}>
            <View 
              style={[
                styles.statusIndicator, 
                { backgroundColor: getStatusColor() }
              ]} 
            />
            <Text style={styles.statusText}>
              {attendanceStatus === 'present' ? 'Presente' : 
               attendanceStatus === 'excused' ? 'Justificado' : 
               attendanceStatus === 'absent' ? 'Ausente' : 'No registrado'}
            </Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedCard: {
    backgroundColor: 'rgba(0, 115, 234, 0.1)',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  mainContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  instrument: {
    fontSize: 14,
    marginTop: 2,
    opacity: 0.7,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  }
});

export default MondayStudentItem;
```

### Botones de Acción
Crear un componente de botón con estilo Monday:

```javascript
// src/components/MondayButton.js
import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useAppTheme, SPACING, mondayStyles } from '../theme';

const MondayButton = ({
  mode = 'contained',
  color,
  children,
  style,
  ...props
}) => {
  const { theme } = useAppTheme();

  // Determinar color según el tipo
  const getButtonColor = () => {
    if (color) return color;
    
    switch (props.type) {
      case 'success':
        return theme.colors.success;
      case 'danger':
        return theme.colors.error;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  };

  return (
    <Button
      mode={mode}
      color={getButtonColor()}
      style={[
        styles.button,
        mondayStyles.button(theme),
        style
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
  }
});

export default MondayButton;
```

## Pantallas

### 1. Lista de Estudiantes (StudentsListScreen)

#### Modificaciones Principal:
- Implementar diseño inspirado en Monday con filas y columnas
- Mejorar la visualización de los filtros
- Añadir nuevos estilos de tarjetas y botones

#### Pasos detallados:
1. Modificar el componente `FlatList` para usar el nuevo `MondayStudentItem`
2. Actualizar el diseño de los filtros con chips al estilo Monday
3. Mejorar la visualización de carga y estados vacíos
4. Implementar el nuevo estilo para botones de acciones

### 2. Perfil de Estudiante (StudentProfileScreen)

#### Modificaciones Principales:
- Rediseñar la estructura de la información para mayor claridad
- Implementar tarjetas de sección con estilos Monday
- Mejorar la visualización de los datos de contacto y asistencia

#### Pasos detallados:
1. Reorganizar la información en secciones más claras
2. Aplicar estilos Monday a todas las tarjetas y componentes
3. Mejorar la visualización de estados y acciones
4. Optimizar la interfaz para datos de contacto

### 3. Registro de Asistencia (AttendanceRegistrationScreen)

#### Modificaciones Principales:
- Implementar visualización más clara del calendario
- Mejorar la interfaz de selección de asistencia
- Aplicar estilos Monday a la lista de estudiantes

#### Pasos detallados:
1. Rediseñar el selector de fechas al estilo Monday
2. Mejorar la visualización de estados de asistencia
3. Optimizar la interfaz para selección múltiple
4. Implementar diseño Monday para botones y acciones

### 4. Reportes (ReportsScreen)

#### Modificaciones Principales:
- Mejorar la visualización de gráficos con estética Monday
- Optimizar la presentación de datos estadísticos
- Aplicar nuevo diseño a filtros y controles

#### Pasos detallados:
1. Aplicar estilos Monday a gráficos y visualizaciones
2. Rediseñar la estructura de filtros y controles
3. Mejorar la presentación de datos estadísticos
4. Implementar transiciones y animaciones para datos

## Pruebas y Validación

### Estrategia de Pruebas
1. **Pruebas de componentes individuales**:
   - Verificar que cada componente mantiene su funcionalidad
   - Probar en diferentes tamaños de pantalla

2. **Pruebas de integración**:
   - Verificar flujos completos de trabajo (ej. registrar asistencia)
   - Comprobar navegación entre pantallas

3. **Pruebas de temas**:
   - Verificar consistencia entre tema original y Monday
   - Probar cambio de tema en tiempo real

4. **Pruebas de rendimiento**:
   - Comprobar que no haya degradación de rendimiento
   - Verificar tiempo de carga de pantallas

### Lista de Verificación 
- [ ] Todos los componentes mantienen su funcionalidad
- [ ] La navegación funciona correctamente
- [ ] La gestión de datos no se ha visto afectada
- [ ] El rendimiento es óptimo
- [ ] La interfaz es consistente en todos los dispositivos
- [ ] El nuevo tema respeta la accesibilidad (contraste, tamaño)

## Referencias y Recursos

### Inspiración de Diseño
- **Monday.com UI**: [Monday.com](https://monday.com/)
- **Mobbin - Monday App**: [Mobbin Monday Examples](https://mobbin.com/browse/ios/apps/monday-com)

### Recursos Gráficos
- **Paleta de Colores Monday**: [Monday Brand](https://monday.com/static/img/monday-logo-x2.png)
- **Sistema de Iconos**: [Material Design Icons](https://materialdesignicons.com/)

### Documentación Técnica
- **React Native Paper**: [Documentación](https://callstack.github.io/react-native-paper/)
- **React Native Animations**: [Documentación Animated](https://reactnative.dev/docs/animated)
- **Expo**: [Documentación](https://docs.expo.dev/)

### Herramientas Adicionales
- No se requiere instalar paquetes adicionales ya que se utilizarán los componentes existentes con estilos modificados

## Plan de Contingencia

### Problemas Potenciales y Soluciones
1. **Problema**: Incompatibilidad con componentes actuales
   **Solución**: Mantener componentes originales y crear versiones alternativas

2. **Problema**: Degradación de rendimiento
   **Solución**: Reducir complejidad visual o implementar optimizaciones

3. **Problema**: Inconsistencia visual 
   **Solución**: Implementar sistema de auditoría de diseño para mantener coherencia

### Plan de Reversión
1. Mantener respaldo del tema original
2. Implementar sistema de cambio de tema para poder volver a la versión anterior
3. Documentar todos los cambios para facilitar reversión si es necesario

## Plan de Implementación para el Tema Monday

## Objetivos

1. **Unificar la experiencia visual** de toda la aplicación cuando se utiliza el tema Monday
2. **Eliminar inconsistencias** en la aplicación de estilos y componentes
3. **Mejorar la usabilidad** manteniendo la coherencia visual en todas las interacciones
4. **Documentar** el uso correcto del tema para futuras ampliaciones

## Priorización de Tareas

Las tareas están priorizadas en tres niveles:
- 🔴 **Alta**: Problemas críticos que afectan significativamente la experiencia de usuario
- 🟠 **Media**: Inconsistencias visuales importantes pero no críticas
- 🟢 **Baja**: Refinamientos y mejoras menores

## Plan de Acción por Pantalla

### 1. StudentProfileScreen.js (🔴 Alta)

#### Navegación
- Actualizar la configuración del header para que utilice los colores del tema activo
- Eliminar los colores fijos en las líneas 640-644 y reemplazar con referencias a `theme.colors`
- Implementar la lógica condicional para aplicar estilos específicos del tema Monday

```javascript
// Ejemplo de implementación
navigation.setOptions({
  headerStyle: {
    backgroundColor: isMondayTheme 
      ? theme.colors.surface 
      : theme.colors.elevation.level1,
    elevation: isMondayTheme ? 0 : 2,
    shadowOpacity: isMondayTheme ? 0 : 0.3,
  },
  headerTitleStyle: {
    color: theme.colors.text,
    fontWeight: isMondayTheme ? '600' : '500',
  },
  headerTintColor: theme.colors.text,
});
```

#### Tarjetas de Información
- Aplicar `mondayStyles.card` a todas las tarjetas de información del estudiante
- Actualizar los estilos de texto y elementos internos según la paleta del tema activo
- Asegurar que la elevación y bordes sean consistentes con el estilo Monday

```javascript
<Card
  style={[
    styles.infoCard, 
    isMondayTheme ? mondayStyles.card(theme) : null,
    { backgroundColor: theme.colors.surface }
  ]} 
  elevation={isMondayTheme ? 0 : 2}
>
  {/* Contenido de la tarjeta */}
</Card>
```

#### Diálogos y Formularios
- Actualizar los diálogos de edición para que respeten el tema Monday
- Aplicar estilos específicos del tema a todos los campos de entrada
- Adaptar los botones del formulario según los estilos Monday

### 2. ReportsScreen.js (🟠 Media)

#### Navegación
- Actualizar la barra de navegación para usar correctamente los colores del tema
- Aplicar estilos consistentes a los botones de acción en la barra

#### Tarjetas de Reportes
- Aplicar `mondayStyles.card` a todas las tarjetas de estadísticas
- Asegurar que los colores de texto y fondos respeten la paleta del tema

#### Gráficos
- Actualizar la configuración de colores de los gráficos para utilizar la paleta del tema actual
- Asegurar que las leyendas y textos respeten los colores del tema
- Utilizar colores condicionales basados en el tema activo

#### Controles de Filtro
- Actualizar los chips y botones de filtro para usar consistentemente los estilos del tema Monday
- Aplicar estilos condicionales a los controles segmentados

### 3. AttendanceRegistrationScreen.js (🟠 Media)

#### Navegación
- Verificar la correcta implementación del tema en la barra de navegación
- Asegurar que todos los botones de acción respeten los colores y estilos del tema

#### Controles de Filtro
- Actualizar los chips de filtro para usar consistentemente el estilo Monday
- Aplicar estilos condicionales basados en el tema activo

#### Diálogos
- Asegurar que los diálogos de confirmación respeten el tema Monday
- Aplicar estilos consistentes a todos los elementos de los diálogos

### 4. Otros Componentes (🟢 Baja)

#### Implementar Componentes Reutilizables
- Crear versiones Monday de componentes comunes como:
  - MondayFormField
  - MondayDialog
  - MondayFilterChip
- Estos componentes deben detectar automáticamente el tema y aplicar los estilos correspondientes

#### Refactorizar Estilos Comunes
- Crear estilos reutilizables para elementos comunes como:
  - Headers
  - Tarjetas de información
  - Botones de acción
  - Campos de formulario

## Enfoque Técnico

### 1. Detección de Tema

Utilizar consistentemente el hook `useAppTheme()` para obtener:
- `theme`: Objeto con todos los colores y propiedades del tema
- `isDark`: Indica si el tema actual es oscuro
- `themeType`: Indica el tipo de tema (DEFAULT, MONDAY)

```javascript
const { theme, isDark, themeType } = useAppTheme();
const isMondayTheme = themeType === THEME_NAMES.MONDAY;
```

### 2. Aplicación de Estilos

Utilizar el operador lógico para aplicar condicionalmente los estilos:

```javascript
style={[
  baseStyles.element, 
  isMondayTheme && mondayStyles.element,
  { backgroundColor: theme.colors.surface }
]}
```

### 3. Propiedades Condicionales

Utilizar el operador ternario para propiedades que dependen del tema:

```javascript
elevation={isMondayTheme ? 0 : 2}
mode={isMondayTheme ? "outlined" : "elevated"}
```

## Configuración de Pruebas

### 1. Escenarios de Prueba
- Cambiar entre temas Default y Monday en cada pantalla
- Verificar la consistencia visual durante la navegación
- Comprobar que todos los componentes respeten el tema activo

### 2. Criterios de Éxito
- No hay colores fijos o hardcodeados en ninguna parte de la interfaz
- Todos los componentes respetan la paleta de colores del tema activo
- Las transiciones entre temas son suaves y consistentes

## Documentación

### 1. Guía de Estilo Monday
- Crear un documento con ejemplos de uso del tema Monday
- Incluir capturas de pantalla de componentes correctamente estilizados
- Proporcionar snippets de código reutilizables

### 2. Comentarios en el Código
- Documentar adecuadamente todos los cambios realizados
- Explicar la lógica de los estilos condicionales
- Proporcionar ejemplos de uso para componentes personalizados

## Cronograma Estimado

1. **Fase 1 (Alta Prioridad)**
   - Corrección de StudentProfileScreen
   - Tiempo estimado: 1 día

2. **Fase 2 (Media Prioridad)**
   - Actualización de ReportsScreen
   - Revisión de AttendanceRegistrationScreen
   - Tiempo estimado: 2 días

3. **Fase 3 (Baja Prioridad)**
   - Implementación de componentes reutilizables
   - Refactorización de estilos comunes
   - Tiempo estimado: 1 día

4. **Fase 4 (Documentación y Pruebas)**
   - Creación de guía de estilo
   - Pruebas completas
   - Tiempo estimado: 1 día

## Consideraciones Futuras

- Evaluar el impacto de rendimiento de los estilos condicionales
- Considerar el uso de un sistema de diseño más estructurado
- Planificar la adaptación para nuevos componentes o pantallas futuras
