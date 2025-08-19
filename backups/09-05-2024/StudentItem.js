import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAppTheme } from '../theme';

const StudentItem = memo(({ item, onPress, isSelected, status, attendanceMode }) => {
    const { theme } = useAppTheme();
    
    // Determinar el color de estado de asistencia - memoizado para evitar recálculos
    const statusColor = useMemo(() => {
        switch (status) {
            case 'A':
                return theme.colors.attendance.present;
            case 'EA':
                return theme.colors.attendance.justified;
            case 'UA':
                return theme.colors.attendance.unexcused;
            default:
                return 'transparent';
        }
    }, [status, theme.colors.attendance]);
    
    // Determinar el texto de estado de asistencia - memoizado para evitar recálculos
    const statusText = useMemo(() => {
        switch (status) {
            case 'A':
                return 'Presente';
            case 'EA':
                return 'Justificada';
            case 'UA':
                return 'Injustificada';
            default:
                return '';
        }
    }, [status]);

    // Memoizar el handler de onPress para evitar recreación en cada render
    const handlePress = useCallback(() => {
        onPress(item);
    }, [onPress, item]);

    // Memoizar los estilos que cambian basados en props
    const containerStyle = useMemo(() => [
        styles.container,
        isSelected && styles.selectedContainer,
        attendanceMode && styles.attendanceContainer
    ], [isSelected, attendanceMode]);

    const textStyle = useMemo(() => [
        styles.name,
        {
            color: theme.colors.text,
            flex: 1
        }
    ], [theme.colors.text]);

    const descriptionStyle = useMemo(() => [
        styles.description,
        {
            color: theme.colors.backdrop
        }
    ], [theme.colors.backdrop]);

    // Solo renderizar el componente si realmente es necesario
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePress}
            style={containerStyle}
        >
            <View style={styles.textContainer}>
                <Text style={textStyle} numberOfLines={1}>
                    {item.first_name} {item.last_name}
                </Text>
                <Text style={descriptionStyle} numberOfLines={1}>
                    {item.instrument || 'Sin instrumento'}
                </Text>
            </View>
            
            {status ? (
                <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusText}</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Control manual de re-renderizado para máxima eficiencia
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.status === nextProps.status &&
        prevProps.attendanceMode === nextProps.attendanceMode
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 8,
        marginVertical: 4,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: 'white',
        elevation: 2,
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
    },
    selectedContainer: {
        backgroundColor: 'rgba(103, 80, 164, 0.08)',
        borderColor: '#6750A4',
        borderWidth: 1
    },
    attendanceContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    textContainer: {
        flex: 1,
        marginRight: 8,
        justifyContent: 'center'
    },
    name: {
        ...TYPOGRAPHY.subtitle1,
        fontWeight: '500',
        marginBottom: 2
    },
    description: {
        ...TYPOGRAPHY.body2,
        opacity: 0.6
    },
    statusIndicator: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80
    },
    statusText: {
        color: 'white',
        fontWeight: '500',
        fontSize: 12
    }
});

export default StudentItem;
