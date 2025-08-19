import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';

/**
 * Componente de tarjeta estilizado que sigue el tema unificado de la aplicación
 * 
 * @param {Object} props - Propiedades del componente
 * @param {string} props.title - Título de la tarjeta
 * @param {string} props.subtitle - Subtítulo opcional
 * @param {React.ReactNode} props.children - Contenido de la tarjeta
 * @param {Function} props.onPress - Función opcional para manejar pulsaciones
 * @param {Object} props.style - Estilos adicionales para la tarjeta
 * @param {Object} props.contentStyle - Estilos para el contenido de la tarjeta
 * @param {boolean} props.elevation - Nivel de elevación (0, 1, 2, 3)
 */
const StyledCard = ({
    title,
    subtitle,
    children,
    onPress,
    style,
    contentStyle,
    elevation = 1,
    ...cardProps
}) => {
    const { theme } = useAppTheme();
    
    // Mapear niveles de elevación a valores de sombra
    const elevationMap = {
        0: SHADOWS.none,
        1: SHADOWS.small,
        2: SHADOWS.medium,
        3: SHADOWS.large
    };
    
    // Determinar la sombra basada en la elevación
    const shadowStyle = elevationMap[elevation] || SHADOWS.small;

    return (
        <Card
            style={[
                styles.card,
                shadowStyle,
                { backgroundColor: theme.colors.surface },
                style
            ]}
            onPress={onPress}
            {...cardProps}
        >
            {(title || subtitle) && (
                <Card.Title
                    title={title}
                    subtitle={subtitle}
                    titleStyle={styles.title}
                    subtitleStyle={[
                        styles.subtitle,
                        { color: theme.colors.onSurfaceVariant }
                    ]}
                />
            )}
            <Card.Content style={[styles.content, contentStyle]}>
                {children}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.md,
        overflow: 'hidden',
    },
    title: {
        ...TYPOGRAPHY.h3,
    },
    subtitle: {
        ...TYPOGRAPHY.body2,
    },
    content: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
    },
});

export default StyledCard;
