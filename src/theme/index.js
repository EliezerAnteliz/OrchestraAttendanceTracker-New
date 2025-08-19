import { DefaultTheme } from 'react-native-paper';
import { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import React from 'react';

// Crear el contexto del tema
const ThemeContext = createContext();

// Hook personalizado para usar el tema
export const useAppTheme = () => useContext(ThemeContext);

// Definiciones de estilos del tema
export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxs: 2,
    xxl: 40,
};

export const TYPOGRAPHY = {
    h1: {
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 0.25,
    },
    h2: {
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 0,
    },
    h3: {
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.15,
    },
    h4: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.15,
    },
    subtitle1: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.15,
    },
    subtitle2: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    body1: {
        fontSize: 16,
        fontWeight: 'normal',
        letterSpacing: 0.5,
    },
    body2: {
        fontSize: 14,
        fontWeight: 'normal',
        letterSpacing: 0.25,
    },
    button: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1.25,
        textTransform: 'uppercase',
    },
    caption: {
        fontSize: 12,
        fontWeight: 'normal',
        letterSpacing: 0.4,
    },
    overline: {
        fontSize: 10,
        fontWeight: 'normal',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    // Definiciones explícitas de tamaños de fuente para uso en estilos
    fontSizeXs: 12,
    fontSizeSm: 14,
    fontSizeMd: 16,
    fontSizeLg: 18,
    fontSizeXl: 22,
    fontSizeXxl: 26,
};

export const BORDER_RADIUS = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
};

export const SHADOWS = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
};

export const TRANSITIONS = {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
};

export const GLASS_EFFECTS = {
    light: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
    },
    dark: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        backdropFilter: 'blur(10px)',
    },
};

// Definir temas básicos
export const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#6200ee',
        accent: '#03dac4',
        background: '#f6f6f6',
        surface: '#ffffff',
        error: '#B00020',
        text: '#000000',
        onSurface: '#000000',
        disabled: '#939393',
        placeholder: '#939393',
        backdrop: '#000000',
        notification: '#f50057',
        outline: '#939393',
        onSurfaceVariant: '#939393',
        // Estados de asistencia
        attendance: {
            present: '#4CAF50',     // Verde para Presente (A)
            justified: '#FFC107',    // Amarillo para Ausencia Justificada (EA)
            unexcused: '#F44336',    // Rojo para Ausencia Injustificada (UA)
        },
    },
    roundness: 8,
    fonts: DefaultTheme.fonts,
    animation: DefaultTheme.animation,
    spacing: SPACING,
    typography: {
        title: {
            fontSize: 20,
            fontWeight: 'bold',
        },
        subtitle: {
            fontSize: 16,
            fontWeight: '500',
        },
        body: {
            fontSize: 14,
        },
        caption: {
            fontSize: 12,
            color: '#666666',
        }
    },
    elevation: {
        level0: 0,
        level1: 2,
        level2: 4,
        level3: 6,
        level4: 8,
        level5: 10,
        small: 2,
        medium: 4,
        large: 8,
    }
};

// Crear tema oscuro basado en el tema claro
const darkTheme = {
    ...theme,
    dark: true,
    mode: 'adaptive',
    colors: {
        ...theme.colors,
        background: '#121212',
        surface: '#121212',
        text: '#ffffff',
        onSurface: '#ffffff',
    }
};

// Definir tema Monday.com
export const MONDAY_THEME = {
  light: {
    // Colores primarios
    primary: '#0073ea',         // Azul Monday principal
    accent: '#00c875',          // Verde para acciones secundarias
    background: '#f6f7fb',      // Fondo principal claro
    surface: '#ffffff',         // Superficie de tarjetas
    error: '#e44258',           // Rojo para errores y eliminación
    text: '#323338',            // Texto principal
    onSurface: '#323338',       // Texto sobre superficie
    disabled: '#c5c7d0',        // Elementos deshabilitados
    placeholder: '#c5c7d0',     // Placeholder
    backdrop: 'rgba(0, 0, 0, 0.4)', // Fondo modal
    notification: '#0073ea',    // Notificaciones
    outline: '#c3c6d4',         // Contornos
    onSurfaceVariant: '#676879', // Texto secundario
    
    // Colores adicionales Monday
    secondary: '#00c875',       // Verde para acciones positivas
    warning: '#fdab3d',         // Naranja para advertencias
    success: '#00c875',         // Verde para éxito
    info: '#0086c0',            // Azul información
    divider: '#edeef0',         // Divisores
    surfaceVariant: '#f6f7fb',  // Variante de superficie
    cardBackground: '#ffffff',  // Fondo de tarjetas
    
    // Colores de estado (compatibles con la app)
    attendance: {
      present: '#00c875',       // Verde - Presente
      justified: '#fdab3d',     // Naranja - Ausencia justificada
      unexcused: '#e44258',     // Rojo - Ausencia injustificada
    }
  },
  dark: {
    // Colores primarios en modo oscuro
    primary: '#0073ea',         // Se mantiene el azul principal
    accent: '#00a36c',          // Verde más oscuro
    background: '#1c1f3b',      // Fondo principal oscuro
    surface: '#2a2e52',         // Superficie de tarjetas
    error: '#d73a4e',           // Rojo más oscuro
    text: '#ffffff',            // Texto principal
    onSurface: '#ffffff',       // Texto sobre superficie
    disabled: '#9395a5',        // Elementos deshabilitados
    placeholder: '#9395a5',     // Placeholder
    backdrop: 'rgba(0, 0, 0, 0.6)', // Fondo modal
    notification: '#0073ea',    // Notificaciones
    outline: '#494c7d',         // Contornos
    onSurfaceVariant: '#c5c7d0', // Texto secundario
    
    // Colores adicionales Monday
    secondary: '#00a36c',       // Verde más oscuro
    warning: '#e5982f',         // Naranja más oscuro
    success: '#00a36c',         // Verde más oscuro
    info: '#0079af',            // Azul información
    divider: '#3e4166',         // Divisores
    surfaceVariant: '#252849',  // Variante de superficie
    cardBackground: '#2a2e52',  // Fondo de tarjetas
    
    // Colores de estado (compatibles con la app)
    attendance: {
      present: '#00a36c',       // Verde - Presente
      justified: '#e5982f',     // Naranja - Ausencia justificada
      unexcused: '#d73a4e',     // Rojo - Ausencia injustificada
    }
  }
};

// Crear temas Monday basados en MONDAY_THEME
export const mondayLightTheme = {
  ...theme,
  colors: {
    ...theme.colors,
    ...MONDAY_THEME.light,
  },
  monday: true, // Indicador para saber que estamos usando el tema Monday
  dark: false,
};

export const mondayDarkTheme = {
  ...darkTheme,
  colors: {
    ...darkTheme.colors,
    ...MONDAY_THEME.dark,
  },
  monday: true, // Indicador para saber que estamos usando el tema Monday
  dark: true,
};

// Utilidades para el estilo Monday
export const mondayStyles = {
  // Sombras de tarjetas
  cardShadow: (theme) => ({
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  }),
  
  // Estilo de tarjeta Monday
  card: (theme) => ({
    backgroundColor: theme.colors.cardBackground || theme.colors.surface,
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
    borderBottomColor: theme.colors.divider || theme.colors.outline,
  }),
  
  // Estilo para indicador de estado
  statusIndicator: (color) => ({
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color,
    marginRight: SPACING.sm,
  }),
  
  // Contenedor de tarjeta con borde izquierdo coloreado
  borderedCard: (theme, color) => ({
    ...mondayStyles.card(theme),
    borderLeftWidth: 4,
    borderLeftColor: color,
    paddingLeft: SPACING.md - 4, // Compensar el borde
  })
};

// Nombres de los temas disponibles
export const THEME_NAMES = {
  DEFAULT: 'default',
  MONDAY: 'monday'
};

// Definir los temas MD3 para compatibilidad con expo-router
global.MD3LightTheme = theme;
global.MD3DarkTheme = darkTheme;

// Añadir ThemeProvider con soporte para múltiples temas
export const ThemeProvider = ({ children }) => {
    const colorScheme = useColorScheme();
    const [isDark, setIsDark] = useState(colorScheme === 'dark');
    const [themeType, setThemeType] = useState(THEME_NAMES.DEFAULT);
    
    // Función para obtener el tema actual basado en tipo y modo oscuro
    const getCurrentTheme = () => {
      if (themeType === THEME_NAMES.MONDAY) {
        return isDark ? mondayDarkTheme : mondayLightTheme;
      } else {
        return isDark ? darkTheme : theme;
      }
    };
    
    const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());

    // Actualizar el tema cuando cambia el modo oscuro/claro
    useEffect(() => {
        setIsDark(colorScheme === 'dark');
    }, [colorScheme]);

    // Actualizar el tema cuando cambia isDark o themeType
    useEffect(() => {
        setCurrentTheme(getCurrentTheme());
    }, [isDark, themeType]);
    
    // Función para cambiar manualmente entre temas oscuro/claro
    const toggleTheme = () => {
        setIsDark(!isDark);
    };
    
    // Función para cambiar el tipo de tema (default, monday)
    const setTheme = (themeName) => {
      if (Object.values(THEME_NAMES).includes(themeName)) {
        setThemeType(themeName);
      }
    };

    return (
        <ThemeContext.Provider 
          value={{ 
            theme: currentTheme, 
            isDark, 
            toggleTheme, 
            themeType,
            setTheme 
          }}
        >
            {children}
        </ThemeContext.Provider>
    );
};
