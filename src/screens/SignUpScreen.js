import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Menu, ActivityIndicator, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../config/supabase';
import { StyledInput, StyledCard } from '../components';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../theme';

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [showProgramMenu, setShowProgramMenu] = useState(false);
  const [selectedRole, setSelectedRole] = useState('viewer'); // 'staff' | 'viewer'
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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
  
  const handleSignUp = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);

      // Validaciones básicas
      if (!firstName || !lastName || !email || !password || !confirmPassword || !selectedOrganization || !selectedProgram || !selectedRole) {
        throw new Error('Por favor, completa todos los campos');
      }

      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      if (password !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // Intento de registro con metadata adicional
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            email: email.trim(),
            organization_id: selectedOrganization.id,
            organization_name: selectedOrganization.name,
            program_id: selectedProgram.id,
            program_name: selectedProgram.name,
            role: selectedRole,
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
        // Crear perfil de usuario en la tabla user_profiles
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            email: email.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            organization_id: selectedOrganization.id,
            role: selectedRole,
            is_active: true
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          Alert.alert('Advertencia', 'Usuario creado pero hubo un problema configurando el perfil. Contacta al administrador.');
        }

        // Crear membership del usuario en el programa seleccionado
        if (selectedProgram?.id) {
          const { error: membershipError } = await supabase
            .from('user_program_memberships')
            .insert({
              user_id: data.user.id,
              program_id: selectedProgram.id,
              role: selectedRole,
            });
          if (membershipError) {
            // Ignorar conflicto de duplicado si ya existe por trigger
            if (membershipError.code !== '23505') {
              console.error('Error creating program membership:', membershipError);
            }
          }
        }

        setSuccess(true);
        // Limpiar los campos después del registro exitoso
        setFirstName('');
        setLastName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setSelectedOrganization(null);
        setSelectedProgram(null);
        setSelectedRole('viewer');
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

          {/* Organization Selector */}
          <View style={styles.organizationContainer}>
            <Text style={[styles.organizationLabel, { color: theme.colors.onSurface }]}> 
              Sede/Organización
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
                    {selectedOrganization ? selectedOrganization.name : 'Selecciona tu sede...'}
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
                Selecciona una sede
              </Text>
            )}
          </View>

          {/* Program Selector */}
          <View style={styles.organizationContainer}>
            <Text style={[styles.organizationLabel, { color: theme.colors.onSurface }]}>Programa</Text>
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
                    {selectedProgram ? selectedProgram.name : (selectedOrganization ? 'Selecciona un programa...' : 'Selecciona una sede primero')}
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
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            error={error && (!password || password.length < 6) ? 
              (!password ? "Contraseña es requerida" : "Mínimo 6 caracteres") : ""}
            placeholder="••••••••"
          />

          <StyledInput
            label="Confirmar Contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            error={error && (!confirmPassword || password !== confirmPassword) ? 
              (!confirmPassword ? "Confirma tu contraseña" : "Las contraseñas no coinciden") : ""}
            placeholder="••••••••"
          />

          {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading || organizationsLoading || programsLoading}
            style={styles.button}
          >
            Create Account
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
  inputIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
});
