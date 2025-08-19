import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text, Surface, Icon } from 'react-native-paper';
import { useAppTheme, SPACING, BORDER_RADIUS, THEME_NAMES } from '../theme';

/**
 * Componente MondayStudentItem
 * Versión con diseño Monday.com para mostrar información de un estudiante
 * 
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.item - Datos del estudiante
 * @param {Function} props.onPress - Función a ejecutar al presionar el item
 * @param {Boolean} props.isSelected - Indica si el estudiante está seleccionado
 * @param {String} props.status - Estado de asistencia (si aplica)
 * @param {Boolean} props.attendanceMode - Indica si se está en modo de toma de asistencia
 */
const MondayStudentItem = memo(({ item, onPress, isSelected, status, attendanceMode }) => {
    const { theme, themeType } = useAppTheme();
    const isActive = item.is_active !== false;
    const isMondayTheme = themeType === THEME_NAMES.MONDAY;

    // Determinar colores según el estado de asistencia
    const getStatusColor = (statusCode) => {
        switch (statusCode) {
            case 'A':
                return theme.colors.attendance.present;
            case 'EA':
                return theme.colors.attendance.justified;
            case 'UA':
                return theme.colors.attendance.unexcused;
            default:
                return theme.colors.surfaceDisabled;
        }
    };

    // Handler optimizado para el evento onPress
    const handlePress = useCallback(() => {
        if (onPress) {
            onPress(item);
        }
    }, [item, onPress]);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePress}
            style={{ marginVertical: isMondayTheme ? 0 : 4 }}
        >
            <Surface
                style={{
                    marginHorizontal: SPACING.md,
                    marginVertical: isMondayTheme ? 0 : 6,
                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
                    backgroundColor: isSelected 
                        ? theme.colors.primaryContainer 
                        : theme.colors.surface,
                    overflow: 'hidden',
                    borderWidth: isMondayTheme ? 1 : 0,
                    borderColor: isMondayTheme 
                        ? (isSelected ? theme.colors.primary : theme.colors.outline)
                        : 'transparent',
                    borderBottomWidth: isMondayTheme ? 1 : 0,
                    elevation: isMondayTheme ? 0 : (isSelected ? 3 : 1)
                }}
            >
                <View 
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: SPACING.md
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ 
                            fontSize: 16, 
                            fontWeight: '500',
                            color: isSelected 
                                ? theme.colors.onPrimaryContainer 
                                : theme.colors.onSurface,
                            opacity: isActive ? 1 : 0.6
                        }}>
                            {item.first_name} {item.last_name}
                        </Text>
                        <Text style={{ 
                            fontSize: 14, 
                            color: isSelected 
                                ? theme.colors.onPrimaryContainer 
                                : theme.colors.onSurfaceVariant,
                            opacity: isActive ? 1 : 0.6
                        }}>
                            {item.instrument || 'No asignado'}
                        </Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Indicador de estado de asistencia */}
                        {status && (
                            <View style={{
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: getStatusColor(status),
                                marginRight: 12,
                                borderWidth: isMondayTheme ? 0 : 0.5,
                                borderColor: getStatusColor(status) + '80',
                            }} />
                        )}
                        
                        {!attendanceMode && (
                            <Icon 
                                source="chevron-right" 
                                size={24} 
                                color={theme.colors.onSurfaceVariant}
                                style={{ opacity: 0.6 }}
                            />
                        )}
                        
                        {attendanceMode && (
                            <View
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: isMondayTheme ? 4 : 12,
                                    borderWidth: 2,
                                    borderColor: theme.colors.outline,
                                    backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {isSelected && (
                                    <Icon 
                                        source="check" 
                                        size={16} 
                                        color="white" 
                                    />
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Surface>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Verificación profunda para prevenir re-renderizados innecesarios
    return prevProps.item.id === nextProps.item.id && 
           prevProps.isSelected === nextProps.isSelected &&
           prevProps.status === nextProps.status &&
           prevProps.attendanceMode === nextProps.attendanceMode;
});

export default MondayStudentItem;
