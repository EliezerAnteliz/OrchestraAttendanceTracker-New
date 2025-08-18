/**
 * Configuración de tema para la aplicación Orchestra Attendance Tracker
 * Basado en el tema Monday.com con azul como color principal
 */

export const theme = {
  // Colores principales
  colors: {
    primary: '#0073ea',       // Azul Monday.com
    primaryDark: '#0060c0',   // Versión más oscura para hover
    primaryLight: '#e5f2ff',  // Versión más clara para fondos
    secondary: '#00c875',     // Verde para acciones positivas
    danger: '#e44258',        // Rojo para acciones negativas
    warning: '#fdab3d',       // Naranja para advertencias
    info: '#579bfc',          // Azul claro para información
    success: '#00c875',       // Verde para éxito
    background: '#f6f7fb',    // Fondo gris claro
    text: '#323338',          // Texto principal
    textSecondary: '#676879', // Texto secundario
    border: '#e1e1e1',        // Bordes
  },
  
  // Bordes
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
  },
  
  // Espaciado
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  
  // Sombras
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.05)',
    medium: '0 4px 8px rgba(0, 0, 0, 0.1)',
    large: '0 8px 16px rgba(0, 0, 0, 0.15)',
  },
};

// Función de ayuda para acceder fácilmente a los valores del tema
export const getThemeValue = (path) => {
  const keys = path.split('.');
  return keys.reduce((obj, key) => obj && obj[key], theme);
};

export default theme;
