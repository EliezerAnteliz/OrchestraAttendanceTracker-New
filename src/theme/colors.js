// Paleta de colores base
export const PALETTE = {
    // Colores primarios con variantes
    primary: {
        light: '#B39DDB',
        main: '#673AB7',
        dark: '#4527A0',
        contrast: '#FFFFFF'
    },
    
    // Colores secundarios
    secondary: {
        light: '#90CAF9',
        main: '#2196F3',
        dark: '#1565C0',
        contrast: '#FFFFFF'
    },
    
    // Grises funcionales
    neutral: {
        50: '#FAFAFA',
        100: '#F5F5F5',
        200: '#EEEEEE',
        300: '#E0E0E0',
        400: '#BDBDBD',
        500: '#9E9E9E',
        600: '#757575',
        700: '#616161',
        800: '#424242',
        900: '#212121'
    },

    // Estados y feedback
    status: {
        success: {
            light: '#81C784',
            main: '#4CAF50',
            dark: '#388E3C'
        },
        warning: {
            light: '#FFB74D',
            main: '#FF9800',
            dark: '#F57C00'
        },
        error: {
            light: '#E57373',
            main: '#F44336',
            dark: '#D32F2F'
        },
        info: {
            light: '#64B5F6',
            main: '#2196F3',
            dark: '#1976D2'
        }
    },

    // Colores de asistencia
    attendance: {
        present: '#4CAF50',
        justified: '#FF9800',
        unexcused: '#F44336'
    },

    // Efectos y superposiciones
    effects: {
        overlay: 'rgba(0, 0, 0, 0.5)',
        glass: 'rgba(255, 255, 255, 0.1)',
        shadow: 'rgba(0, 0, 0, 0.1)',
        highlight: 'rgba(255, 255, 255, 0.1)'
    }
};

// Temas
export const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        background: PALETTE.neutral[50],
        surface: '#FFFFFF',
        surfaceVariant: PALETTE.neutral[100],
        primary: PALETTE.primary.main,
        primaryVariant: PALETTE.primary.dark,
        secondary: PALETTE.secondary.main,
        secondaryVariant: PALETTE.secondary.dark,
        error: PALETTE.status.error.main,
        onBackground: PALETTE.neutral[900],
        onSurface: PALETTE.neutral[900],
        onPrimary: PALETTE.primary.contrast,
        onSecondary: PALETTE.secondary.contrast,
        border: PALETTE.neutral[300],
        divider: PALETTE.neutral[200],
        elevation: {
            level1: '#FFFFFF',
            level2: PALETTE.neutral[50],
            level3: PALETTE.neutral[100],
        },
        attendance: {
            present: PALETTE.status.success.main,
            justified: PALETTE.status.warning.main,
            unexcused: PALETTE.status.error.main
        }
    }
};

export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        background: PALETTE.neutral[900],
        surface: PALETTE.neutral[800],
        surfaceVariant: PALETTE.neutral[700],
        primary: PALETTE.primary.light,
        primaryVariant: PALETTE.primary.main,
        secondary: PALETTE.secondary.light,
        secondaryVariant: PALETTE.secondary.main,
        error: PALETTE.status.error.light,
        onBackground: PALETTE.neutral[50],
        onSurface: PALETTE.neutral[50],
        onPrimary: PALETTE.neutral[900],
        onSecondary: PALETTE.neutral[900],
        border: PALETTE.neutral[700],
        divider: PALETTE.neutral[800],
        elevation: {
            level1: PALETTE.neutral[800],
            level2: PALETTE.neutral[700],
            level3: PALETTE.neutral[600],
        },
        attendance: {
            present: PALETTE.status.success.light,
            justified: PALETTE.status.warning.light,
            unexcused: PALETTE.status.error.light
        }
    }
}; 