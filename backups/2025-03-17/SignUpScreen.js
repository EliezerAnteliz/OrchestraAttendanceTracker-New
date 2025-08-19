import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../config/supabase';

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const handleSignUp = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);

      // Validaciones básicas
      if (!firstName || !lastName || !email || !password) {
        throw new Error('Please fill in all fields');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
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
        throw new Error('Registration failed: No user data returned');
      }
    } catch (error) {
      const errorMessage = error.message || 'An unknown error occurred';
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
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Create Account</Text>
      
      {success && (
        <Text style={styles.success}>
          Registration successful! You can now use these credentials to log in.
        </Text>
      )}

      <TextInput
        label="First Name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        textContentType="givenName"
        style={styles.input}
      />

      <TextInput
        label="Last Name"
        value={lastName}
        onChangeText={setLastName}
        autoCapitalize="words"
        textContentType="familyName"
        style={styles.input}
      />

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCompleteType="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCompleteType="password"
        textContentType="password"
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        mode="contained"
        onPress={handleSignUp}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Sign Up
      </Button>

      <Button
        mode="text"
        onPress={() => router.replace('/')}
        style={styles.linkButton}
      >
        Already have an account? Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 8,
  },
  linkButton: {
    marginTop: 8,
  },
  error: {
    color: '#B00020',
    marginBottom: 16,
    textAlign: 'center',
  },
  success: {
    color: '#4CAF50',
    marginBottom: 16,
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
  }
});
