import React, { useCallback, memo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Surface, Text, Badge } from 'react-native-paper';
import { useAppTheme } from '../theme';

const getStatusColor = (status, theme) => {
    switch (status) {
        case 'A':
            return theme.colors.attendance.present;
        case 'EA':
            return theme.colors.attendance.justified;
        case 'UA':
            return theme.colors.attendance.unexcused;
        default:
            return theme.colors.disabled;
    }
};

const StudentItem = memo(({ item, onPress, isSelected, status, attendanceMode }) => {
    // Usar el hook para el tema (corrige el error de acceso al tema)
    const { theme, isDark } = useAppTheme();
    const statusColor = getStatusColor(status, theme);
    const isActive = item.is_active !== false; // Si no hay propiedad is_active o es true
    
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
            style={styles.touchableContainer}
            testID={`student-item-${item.id}`}
        >
            <Surface 
                style={[
                    styles.container, 
                    {
                        borderLeftColor: statusColor,
                        borderLeftWidth: 4,
                        backgroundColor: isDark ? theme.colors.surfaceVariant : '#FFFFFF',
                        borderColor: isSelected ? theme.colors.primary : 'transparent',
                        borderWidth: isSelected ? 2 : 0,
                        elevation: isSelected ? 4 : 2,
                    },
                    !isActive && styles.inactive
                ]}
            >
                <View style={styles.infoContainer}>
                    <Text 
                        style={[
                            styles.name, 
                            { color: isDark ? theme.colors.onSurface : '#000000' }
                        ]} 
                        numberOfLines={1}
                    >
                        {item.first_name} {item.last_name}
                    </Text>
                    <Text 
                        style={[
                            styles.details, 
                            { color: isDark ? theme.colors.onSurfaceVariant : '#555555' }
                        ]} 
                        numberOfLines={1}
                    >
                        {item.instrument || 'Sin instrumento'} 
                        {item.current_grade ? ` - ${item.current_grade}° Grado` : ''}
                    </Text>
                </View>
                
                <View style={styles.rightContainer}>
                    {status && (
                        <Badge 
                            style={[styles.statusBadge, { backgroundColor: statusColor }]}
                            size={22}
                        >
                            {status}
                        </Badge>
                    )}
                    {attendanceMode && isSelected && (
                        <Badge 
                            size={12} 
                            style={[
                                styles.selectionBadge,
                                { backgroundColor: theme.colors.primary }
                            ]} 
                        />
                    )}
                </View>
            </Surface>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    touchableContainer: {
        width: '100%',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        marginBottom: 4,
    },
    infoContainer: {
        flex: 1,
        marginRight: 8,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    details: {
        fontSize: 14,
        marginTop: 2,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        marginLeft: 4,
    },
    selectionBadge: {
        marginLeft: 8,
    },
    inactive: {
        opacity: 0.6,
    }
});

export default StudentItem;
