import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { StyledInput, StyledCard } from '../components';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn } = useAuth();
  const { theme } = useAppTheme();

  const handleLogin = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { error } = await signIn({
        email,
        password,
      });

      if (error) throw error;
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>Orchestra Attendance</Text>
      
      <StyledCard style={styles.card} elevation={2}>
        {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
        
        <StyledInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          error={error && !email ? "Email es requerido" : ""}
          placeholder="tucorreo@ejemplo.com"
        />
        
        <StyledInput
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={error && !password ? "Contraseña es requerida" : ""}
          placeholder="••••••••"
        />
        
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          style={styles.button}
        >
          Iniciar Sesión
        </Button>

        <Button
          mode="text"
          onPress={() => router.push('/signup')}
          style={styles.button}
        >
          ¿No tienes cuenta? Regístrate
        </Button>
      </StyledCard>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  error: {
    ...TYPOGRAPHY.body2,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
});
