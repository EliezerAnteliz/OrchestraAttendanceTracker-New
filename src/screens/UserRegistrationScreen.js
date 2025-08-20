import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Menu, ActivityIndicator, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../config/supabase';
import { StyledInput, StyledCard } from '../components';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../theme';

export default function UserRegistrationScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [showProgramMenu, setShowProgramMenu] = useState(false);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const { theme } = useAppTheme();

  // Load organizations on component mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setOrganizationsLoading(true);
      console.log('Loading organizations...');
      
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error loading organizations:', error);
        Alert.alert('Error', 'No se pudieron cargar las organizaciones disponibles');
        return;
      }

      console.log('Organizations loaded:', data);
      setOrganizations(data || []);
      
      if (data && data.length === 0) {
        Alert.alert('Información', 'No hay organizaciones disponibles en este momento');
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      Alert.alert('Error', 'No se pudieron cargar las organizaciones disponibles');
    } finally {
      setOrganizationsLoading(false);
    }
  };

  // Load programs when organization changes
  useEffect(() => {
    const fetchPrograms = async () => {
      if (!selectedOrganization) {
        setPrograms([]);
        setSelectedProgram(null);
        return;
      }
      try {
        setProgramsLoading(true);
        const { data, error } = await supabase
          .from('programs')
          .select('id, name')
          .eq('organization_id', selectedOrganization.id)
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('Error loading programs:', error);
          Alert.alert('Error', 'No se pudieron cargar los programas');
          return;
        }
        setPrograms(data || []);
        setSelectedProgram(null);
      } catch (err) {
        console.error('Error loading programs:', err);
        Alert.alert('Error', 'No se pudieron cargar los programas');
      } finally {
        setProgramsLoading(false);
      }
    };
    fetchPrograms();
  }, [selectedOrganization]);

  const validateForm = () => {
    if (!email.trim()) return 'El email es requerido';
    if (!password) return 'La contraseña es requerida';
    if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    if (!confirmPassword) return 'Confirma tu contraseña';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    if (!selectedOrganization) return 'Selecciona una organización';
    if (!selectedProgram) return 'Selecciona un programa';
    if (!selectedRole) return 'Selecciona un rol';
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Formato de email inválido';
    
    return null;
  };

  const handleSignUp = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);

      // Validate form
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      console.log('Starting user registration...');

      // Register user with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            organization_id: selectedOrganization.id,
            organization_name: selectedOrganization.name,
            program_id: selectedProgram.id,
            program_name: selectedProgram.name,
            role: selectedRole
          }
        }
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        throw signUpError;
      }

      if (data?.user) {
        console.log('User created successfully:', data.user.id);
        
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            email: email.trim().toLowerCase(),
            organization_id: selectedOrganization.id,
            role: selectedRole,
            is_active: true
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          Alert.alert(
            'Advertencia', 
            'Usuario creado exitosamente, pero hubo un problema configurando el perfil. Contacta al administrador si tienes problemas para acceder.'
          );
        } else {
          console.log('User profile created successfully');
        }

        // Create program membership
        if (selectedProgram?.id) {
          const { error: membershipError } = await supabase
            .from('user_program_memberships')
            .insert({
              user_id: data.user.id,
              program_id: selectedProgram.id,
              role: selectedRole,
            });
          if (membershipError && membershipError.code !== '23505') {
            console.error('Error creating program membership:', membershipError);
          }
        }

        setSuccess(true);
        
        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setSelectedOrganization(null);
        setSelectedProgram(null);
        setSelectedRole('viewer');
        
        // Show success message and redirect after delay
        setTimeout(() => {
          router.replace('/');
        }, 3000);
        
      } else {
        throw new Error('Registro fallido: No se devolvieron datos de usuario');
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMessage = error.message || 'Ocurrió un error desconocido';
      
      // Handle specific Supabase errors
      if (error.message?.includes('User already registered')) {
        errorMessage = 'Este email ya está registrado. Intenta iniciar sesión.';
      } else if (error.message?.includes('Invalid email')) {
        errorMessage = 'El formato del email no es válido.';
      } else if (error.message?.includes('Password should be at least 6 characters')) {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.iconText}>♪</Text>
          </View>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Únete a la comunidad musical
          </Text>
        </View>
        
        <StyledCard style={styles.card} elevation={2}>
          {success && (
            <View style={[styles.successContainer, { backgroundColor: theme.colors.primaryContainer }]}> 
              <Text style={[styles.successText, { color: theme.colors.onPrimaryContainer }]}> 
                ¡Registro exitoso! Redirigiendo al inicio de sesión...
              </Text>
            </View>
          )}

          <StyledInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            textContentType="emailAddress"
            keyboardType="email-address"
            error={error && !email.trim() ? "Email es requerido" : ""}
            placeholder="prueba@gmail.com"
            left={<Text style={styles.inputIcon}>✉</Text>}
          />

          {/* Organization Selector */}
          <View style={styles.organizationContainer}>
            <Text style={[styles.organizationLabel, { color: theme.colors.onSurface }]}> 
              Organización
            </Text>
            {organizationsLoading ? (
              <View style={[styles.organizationSelector, { 
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface 
              }]}> 
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.organizationText, { color: theme.colors.onSurfaceVariant }]}> 
                  Cargando sedes...
                </Text>
              </View>
            ) : (
              <Menu
                visible={showOrgMenu}
                onDismiss={() => setShowOrgMenu(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setShowOrgMenu(true)}
                    style={[styles.organizationSelector, { 
                      borderColor: theme.colors.outline,
                      backgroundColor: theme.colors.surface 
                    }]}
                    contentStyle={styles.organizationSelectorContent}
                    labelStyle={[styles.organizationText, { 
                      color: selectedOrganization ? theme.colors.onSurface : theme.colors.onSurfaceVariant 
                    }]}
                    icon={() => (
                      <Text style={styles.inputIcon}>🏢</Text>
                    )}
                  >
                    {selectedOrganization ? selectedOrganization.name : 'Selecciona tu organización...'}
                  </Button>
                }
              >
                {organizations.map((org) => (
                  <Menu.Item
                    key={org.id}
                    onPress={() => {
                      setSelectedOrganization(org);
                      setShowOrgMenu(false);
                    }}
                    title={org.name}
                  />
                ))}
                {organizations.length === 0 && (
                  <Menu.Item
                    title="No hay organizaciones disponibles"
                    disabled
                  />
                )}
              </Menu>
            )}
            {error && !selectedOrganization && (
              <Text style={[styles.fieldError, { color: theme.colors.error }]}> 
                Selecciona una organización
              </Text>
            )}
            {!organizationsLoading && organizations.length === 0 && (
              <Text style={[styles.fieldError, { color: theme.colors.onSurfaceVariant }]}> 
                No hay organizaciones activas. Contacta al administrador.
              </Text>
            )}
          </View>

          {/* Program Selector */}
          <View style={styles.organizationContainer}>
            <Text style={[styles.organizationLabel, { color: theme.colors.onSurface }]}>Sede/Programa</Text>
            {programsLoading ? (
              <View style={[styles.organizationSelector, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}> 
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.organizationText, { color: theme.colors.onSurfaceVariant }]}>Cargando programas...</Text>
              </View>
            ) : (
              <Menu
                visible={showProgramMenu}
                onDismiss={() => setShowProgramMenu(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setShowProgramMenu(true)}
                    style={[styles.organizationSelector, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}
                    contentStyle={styles.organizationSelectorContent}
                    labelStyle={[styles.organizationText, { color: selectedProgram ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}
                    icon={() => (<Text style={styles.inputIcon}>🎼</Text>)}
                    disabled={!selectedOrganization}
                  >
                    {selectedProgram ? selectedProgram.name : (selectedOrganization ? 'Selecciona una sede...' : 'Selecciona una organización primero')}
                  </Button>
                }
              >
                {programs.map((p) => (
                  <Menu.Item
                    key={p.id}
                    onPress={() => {
                      setSelectedProgram(p);
                      setShowProgramMenu(false);
                    }}
                    title={p.name}
                  />
                ))}
                {selectedOrganization && programs.length === 0 && (
                  <Menu.Item title="No hay programas activos" disabled />
                )}
              </Menu>
            )}
            {error && !selectedProgram && selectedOrganization && (
              <Text style={[styles.fieldError, { color: theme.colors.error }]}>Selecciona un programa</Text>
            )}
          </View>

          {/* Role Selector */}
          <View style={styles.organizationContainer}>
            <Text style={[styles.organizationLabel, { color: theme.colors.onSurface }]}>Rol</Text>
            <Menu
              visible={showRoleMenu}
              onDismiss={() => setShowRoleMenu(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setShowRoleMenu(true)}
                  style={[styles.organizationSelector, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}
                  contentStyle={styles.organizationSelectorContent}
                  labelStyle={[styles.organizationText, { color: theme.colors.onSurface }]}
                  icon={() => (<Text style={styles.inputIcon}>👤</Text>)}
                >
                  {selectedRole === 'staff' ? 'Staff' : 'Viewer'}
                </Button>
              }
            >
              <Menu.Item title="Viewer" onPress={() => { setSelectedRole('viewer'); setShowRoleMenu(false); }} />
              <Menu.Item title="Staff" onPress={() => { setSelectedRole('staff'); setShowRoleMenu(false); }} />
            </Menu>
          </View>

          <StyledInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textContentType="password"
            error={error && (!password || password.length < 6) ? 
              (!password ? "Contraseña es requerida" : "Mínimo 6 caracteres") : ""}
            placeholder="••••••••"
            left={<Text style={styles.inputIcon}>🔒</Text>}
            right={
              <IconButton
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
                size={20}
              />
            }
          />

          <StyledInput
            label="Confirmar Contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            textContentType="password"
            error={error && (!confirmPassword || password !== confirmPassword) ? 
              (!confirmPassword ? "Confirma tu contraseña" : "Las contraseñas no coinciden") : ""}
            placeholder="••••••••"
            left={<Text style={styles.inputIcon}>🔒</Text>}
            right={
              <IconButton
                icon={showConfirmPassword ? "eye-off" : "eye"}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                size={20}
              />
            }
          />

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading || organizationsLoading || programsLoading}
            style={styles.button}
          >
            Create Account
          </Button>

          <Text style={[styles.loginText, { color: theme.colors.onSurfaceVariant }]}>
            Already have an account?{' '}
            <Text 
              style={[styles.loginLink, { color: theme.colors.primary }]}
              onPress={() => router.replace('/')}
            >
              Sign in here
            </Text>
          </Text>

          <Button
            mode="text"
            onPress={() => router.back()}
            style={styles.backButton}
            icon="arrow-left"
          >
            ← Volver al inicio
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
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconText: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
  },
  title: {
    ...TYPOGRAPHY.h1,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body1,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: SPACING.lg,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  organizationContainer: {
    marginBottom: SPACING.md,
  },
  organizationLabel: {
    ...TYPOGRAPHY.body1,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  organizationSelector: {
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationSelectorContent: {
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationText: {
    ...TYPOGRAPHY.body1,
    textAlign: 'left',
    flex: 1,
  },
  fieldError: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
  },
  button: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  backButton: {
    marginTop: SPACING.sm,
  },
  error: {
    ...TYPOGRAPHY.body2,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  successContainer: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  successText: {
    ...TYPOGRAPHY.body2,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginText: {
    ...TYPOGRAPHY.body2,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  loginLink: {
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
