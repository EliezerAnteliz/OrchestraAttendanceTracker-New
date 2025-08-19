import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, HelperText, Text } from 'react-native-paper';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';

/**
 * Componente de entrada de texto estilizado y consistente con el tema de la aplicación
 * 
 * @param {Object} props - Propiedades del componente
 * @param {string} props.label - Etiqueta del campo
 * @param {string} props.value - Valor actual del campo
 * @param {Function} props.onChangeText - Función para manejar cambios en el texto
 * @param {string} props.mode - Modo del campo (flat, outlined) 
 * @param {string} props.placeholder - Texto de marcador de posición
 * @param {boolean} props.secureTextEntry - Si el campo es para contraseñas
 * @param {boolean} props.disabled - Si el campo está deshabilitado
 * @param {string} props.error - Mensaje de error (si existe)
 * @param {Object} props.style - Estilos adicionales
 * @param {string} props.keyboardType - Tipo de teclado (default, numeric, email-address, etc.)
 * @param {string} props.autoCapitalize - Tipo de capitalización automática (none, sentences, words, characters)
 * @param {Object} props.inputProps - Propiedades adicionales para TextInput de react-native-paper
 */
const StyledInput = ({ 
    label, 
    value, 
    onChangeText, 
    mode = 'outlined', 
    placeholder, 
    secureTextEntry = false,
    disabled = false,
    error,
    style,
    keyboardType = 'default',
    autoCapitalize = 'none',
    ...inputProps
}) => {
    const { theme } = useAppTheme();
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={[styles.container, style]}>
            <TextInput
                label={label}
                value={value}
                onChangeText={onChangeText}
                mode={mode}
                placeholder={placeholder}
                secureTextEntry={secureTextEntry}
                disabled={disabled}
                error={!!error}
                style={styles.input}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                theme={{
                    colors: {
                        primary: theme.colors.primary,
                        background: theme.colors.surface,
                    }
                }}
                {...inputProps}
            />
            {error && (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                    {error}
                </HelperText>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.md,
        width: '100%',
    },
    input: {
        backgroundColor: 'transparent',
    },
    errorText: {
        marginTop: SPACING.xxs,
    }
});

export default StyledInput;
