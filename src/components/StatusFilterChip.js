import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Icon } from 'react-native-paper';

// Componente para los chips de filtro por estado
const StatusFilterChip = ({ label, selected, onPress, theme, isMondayTheme, icon, isError = false }) => {
    return (
        <TouchableOpacity
            style={{
                backgroundColor: selected 
                    ? (isMondayTheme ? (isError ? theme.colors.errorContainer : '#E8DEF8') : (isError ? theme.colors.errorContainer : theme.colors.primary + '15'))
                    : (isMondayTheme ? '#F4F0FF' : 'transparent'),
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginRight: 8,
                minWidth: 80,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0, // Completamente cuadrado para Monday
                borderWidth: 1,
                borderColor: selected 
                    ? (isMondayTheme ? (isError ? theme.colors.error : theme.colors.primary) : 'transparent')
                    : (isMondayTheme ? theme.colors.outline : theme.colors.outline + '80'),
                elevation: isMondayTheme ? 0 : (selected ? 2 : 0),
                flexDirection: 'row',
            }}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {icon && (
                <Icon 
                    source={icon} 
                    size={16} 
                    color={selected ? (isError ? theme.colors.error : theme.colors.primary) : theme.colors.onSurfaceVariant} 
                    style={{ marginRight: 6 }}
                />
            )}
            <Text style={{
                color: selected ? (isError ? theme.colors.error : theme.colors.primary) : theme.colors.onSurfaceVariant,
                fontWeight: selected ? '600' : '400',
                fontSize: 14,
                textAlign: 'center'
            }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};

export default StatusFilterChip; 