# Guía de Estilos y Reglas del Proyecto

Este documento define los estándares de codificación y las mejores prácticas para el proyecto Orchestra Attendance Tracker.

## Reglas Generales del Proyecto

### 1. Estructura de Archivos
- Mantener una estructura de archivos clara y organizada.
- Utilizar convenciones de nomenclatura consistentes para archivos y carpetas.

### 2. Configuración de Dependencias
- Siempre verificar la compatibilidad de las dependencias antes de actualizar.
- Documentar cualquier cambio en las versiones de las dependencias.

### 3. Navegación
- Utilizar `expo-router` para la navegación y asegurarse de que todas las rutas estén correctamente definidas.
- Evitar duplicaciones en la configuración de rutas y títulos.

## Temas y Estilos (Actualizado)

### 0. Pantalla de Referencia: Asistencia

La **pantalla de Asistencia** es la referencia oficial de diseño para toda la aplicación. Todos los componentes deben seguir los patrones establecidos en esta pantalla para mantener la coherencia visual.

#### Elementos clave que definen la identidad visual:

1. **Navegación Inferior**:
   - Altura de la barra: 80px para interacción táctil cómoda
   - Iconos de tamaño medio (28px) con texto descriptivo debajo
   - Separación clara entre iconos y texto
   - Indicación visual clara del elemento seleccionado mediante color primario
   - Bordes superiores delgados en color primario (tema Monday)

   ```javascript
   <Tabs screenOptions={{
     headerShown: false,
     tabBarActiveTintColor: theme.colors.primary,
     tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
     tabBarStyle: {
       height: 80,
       paddingBottom: 15,
       paddingTop: 10,
       borderTopColor: isMondayTheme ? theme.colors.primary : theme.colors.outline,
       borderTopWidth: isMondayTheme ? 2 : 1,
       backgroundColor: theme.colors.surface,
       elevation: 8,
     },
     tabBarLabelStyle: {
       fontSize: 12,
       marginTop: 4,
     },
     tabBarIconStyle: {
       marginBottom: 0,
     },
   }}>
   ```

2. **Tarjetas y Elementos de Lista**:
   - Filas de estudiantes claramente separadas
   - Iconos de acción de tamaño adecuado para táctil
   - Colores distintivos para estados (verde para presente, naranja para tardanza, rojo para ausencia)
   - Información relevante (nombre e instrumento) visible claramente
   - Elementos táctiles suficientemente grandes (mínimo 44px)

3. **Cabecera y Filtros**:
   - Información numérica destacada (contador de estudiantes activos)
   - Filtros accesibles y visualmente distinguibles
   - Fecha visible y opción de acceso rápido al día actual
   - Espaciado generoso entre elementos para facilitar la interacción

4. **Tema y Colores**:
   - Tema Monday con bordes delgados en color primario
   - Uso consistente de colores para estados (verde: presente, naranja: tardanza, rojo: ausente)
   - Fondo claro para maximizar la legibilidad
   - Tonos azules del tema primario para elementos interactivos principales

**IMPORTANTE**: Esta guía debe aplicarse consistentemente en todas las pantallas. Cualquier desviación de estos estándares debe ser justificada y documentada.

### 1. Organización de Estilos

#### 1.1 Separación de Estilos Estáticos y Dinámicos
- **Estilos Estáticos**: Deben definirse en `StyleSheet.create()` y no dependen del tema.
  ```javascript
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: SPACING.md,
    },
    text: {
      fontSize: TYPOGRAPHY.fontSizeMd,
    }
  });
  ```

- **Estilos Dinámicos**: Aquellos que cambian con el tema deben aplicarse inline o a través de funciones.
  ```javascript
  // INCORRECTO - No usar variables de componente en StyleSheet.create
  const styles = StyleSheet.create({
    card: {
      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
    }
  });
  
  // CORRECTO - Aplicar estilos dinámicos inline
  <View style={[
    styles.card, 
    { 
      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md 
    }
  ]} />
  ```

#### 1.2 Funciones de Estilo Temático
Para componentes complejos, definir funciones de estilo que reciben el tema o el estado:

```javascript
// En un archivo de estilos o componente
const getCardStyle = (theme, isMondayTheme) => ({
  backgroundColor: theme.colors.surface,
  borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
  elevation: isMondayTheme ? 0 : 2,
  borderWidth: isMondayTheme ? 1 : 0,
  borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
});

// En el componente
<Surface style={[styles.card, getCardStyle(theme, isMondayTheme)]} />
```

### 2. Implementación del Tema Monday

#### 2.1 Estilos Específicos del Tema Monday
- Bordes cuadrados (BORDER_RADIUS.xs)
- Sin elevaciones, usar bordes en su lugar
- Colores específicos definidos en el tema Monday

```javascript
// Implementación correcta para un componente con tema Monday
<Surface style={[
  styles.card, 
  { 
    elevation: isMondayTheme ? 0 : 2,
    borderWidth: isMondayTheme ? 1 : 0,
    borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
  }
]} />
```

#### 2.2 Padrones de Diseño para Componentes Comunes

**Tarjetas**:
```javascript
// Tarjeta con estilo Monday
<Surface style={[
  styles.card, 
  { 
    elevation: isMondayTheme ? 0 : 2,
    borderWidth: isMondayTheme ? 1 : 0,
    borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
  }
]} />
```

**Botones**:
```javascript
// Botón con estilo Monday
<Button 
  mode="contained"
  style={[
    styles.button, 
    { 
      backgroundColor: theme.colors.primary,
      borderRadius: isMondayTheme ? BORDER_RADIUS.sm : BORDER_RADIUS.md 
    }
  ]}
/>
```

**Inputs**:
```javascript
// Input con estilo Monday
<TextInput 
  style={[
    styles.input,
    {
      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
      borderColor: isMondayTheme ? theme.colors.outline : '#ddd',
      backgroundColor: isMondayTheme ? theme.colors.surfaceVariant : '#fafafa',
    }
  ]}
/>
```

### 3. Acceso al Tema

#### 3.1 Uso Correcto del Hook useAppTheme
```javascript
import { useAppTheme, THEME_NAMES } from '../theme';

const Component = () => {
  const { theme, themeType } = useAppTheme();
  const isMondayTheme = themeType === THEME_NAMES.MONDAY;
  
  // Ahora puedes usar theme y isMondayTheme en tu componente
};
```

#### 3.2 Referencias a Colores del Tema
Siempre usar referencias al tema para colores:
```javascript
// INCORRECTO - Hardcodear colores
<Text style={{ color: '#0073ea' }} />

// CORRECTO - Usar colores del tema
<Text style={{ color: theme.colors.primary }} />
```

## Manejo de Estado

### 1. Estados Locales y Globales
- Utilizar contextos para manejar el estado global, como la autenticación.
- Usar useState para estados locales específicos de un componente.

### 2. Manejo de Estados de Carga y Error
- Implementar estados de carga y error en todas las consultas a la API.
- Proporcionar feedback visual adecuado durante los estados de carga.

```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// En operaciones asíncronas
try {
  setLoading(true);
  // Operación asíncrona
} catch (error) {
  console.error("Error:", error);
  setError('Mensaje de error');
} finally {
  setLoading(false);
}
```

## Pruebas y Validaciones

### 1. Pruebas de Componentes
- Realizar pruebas exhaustivas después de cada cambio significativo.
- Validar la UI en diferentes tamaños de pantalla.

### 2. Validación de Datos
- Validar la entrada del usuario antes de enviar datos al backend.
- Manejar errores adecuadamente y mostrar mensajes claros al usuario.

## Documentación

### 1. Comentarios de Código
- Documentar funciones y componentes complejos.
- Usar comentarios claros para explicar la lógica de negocio.

### 2. Registro de Cambios
- Mantener un registro de las decisiones de diseño y arquitectura.
- Documentar los cambios importantes en el proyecto.

---

Estas reglas actualizadas deben seguirse para mantener la consistencia, calidad y mantenibilidad del código en el proyecto Orchestra Attendance Tracker.
