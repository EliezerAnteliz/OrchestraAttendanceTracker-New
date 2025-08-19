import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme, SPACING, BORDER_RADIUS, SHADOWS } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Botón para alternar entre el tema claro y oscuro
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.style - Estilos adicionales para el botón
 * @param {number} props.size - Tamaño del icono (por defecto: 24)
 * @param {Function} props.onPress - Función opcional a ejecutar además de alternar el tema
 */
const ThemeToggleButton = ({ style, size = 24, onPress }) => {
    const { isDark, toggleTheme, theme } = useAppTheme();
    
    const handlePress = () => {
        toggleTheme();
        if (onPress) {
            onPress();
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button, 
                { backgroundColor: theme.colors.surface },
                style
            ]}
            onPress={handlePress}
            accessibilityLabel={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            accessibilityRole="button"
            activeOpacity={0.7}
        >
            <MaterialCommunityIcons
                name={isDark ? 'weather-sunny' : 'weather-night'}
                size={size}
                color={theme.colors.primary}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.small,
    },
});

export default ThemeToggleButton;