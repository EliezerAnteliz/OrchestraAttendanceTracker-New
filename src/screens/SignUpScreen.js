import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../config/supabase';
import { StyledInput, StyledCard } from '../components';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../theme';

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { theme } = useAppTheme();
  
  const handleSignUp = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);

      // Validaciones básicas
      if (!firstName || !lastName || !email || !password) {
        throw new Error('Por favor, completa todos los campos');
      }

      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      // Intento de registro con metadata adicional
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            created_at: new Date().toISOString()
          }
        }
      });

      if (signUpError) {
        console.error('Detailed error:', {
          name: signUpError.name,
          message: signUpError.message,
          status: signUpError.status,
          details: signUpError.details,
          stack: signUpError.stack
        });
        throw signUpError;
      }

      if (data?.user) {
        setSuccess(true);
        // Limpiar los campos después del registro exitoso
        setFirstName('');
        setLastName('');
        setEmail('');
        setPassword('');
      } else {
        throw new Error('Registro fallido: No se devolvieron datos de usuario');
      }
    } catch (error) {
      const errorMessage = error.message || 'Ocurrió un error desconocido';
      console.error('Final error:', {
        message: errorMessage,
        type: error.constructor.name,
        name: error.name
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>Crear Cuenta</Text>
        
        <StyledCard style={styles.card} elevation={2}>
          {success && (
            <View style={[styles.successContainer, { backgroundColor: theme.colors.success, borderColor: theme.colors.onSuccess }]}>
              <Text style={styles.successText}>
                ¡Registro exitoso! Ahora puedes usar estas credenciales para iniciar sesión.
              </Text>
            </View>
          )}

          <StyledInput
            label="Nombre"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            textContentType="givenName"
            error={error && !firstName ? "Nombre es requerido" : ""}
            placeholder="Juan"
          />

          <StyledInput
            label="Apellido"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            textContentType="familyName"
            error={error && !lastName ? "Apellido es requerido" : ""}
            placeholder="Pérez"
          />

          <StyledInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            textContentType="emailAddress"
            keyboardType="email-address"
            error={error && !email ? "Email es requerido" : ""}
            placeholder="juan.perez@ejemplo.com"
          />

          <StyledInput
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            error={error && (!password || password.length < 6) ? 
              (!password ? "Contraseña es requerida" : "Mínimo 6 caracteres") : ""}
            placeholder="••••••••"
          />

          {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Registrarse
          </Button>

          <Button
            mode="text"
            onPress={() => router.replace('/')}
            style={styles.linkButton}
          >
            ¿Ya tienes cuenta? Inicia sesión
          </Button>
        </StyledCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: SPACING.md,
  },
  button: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  linkButton: {
    marginTop: SPACING.sm,
  },
  error: {
    ...TYPOGRAPHY.body2,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  successContainer: {
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  successText: {
    ...TYPOGRAPHY.body2,
    textAlign: 'center',
  }
});
