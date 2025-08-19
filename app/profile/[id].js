import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Linking, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Surface, Avatar, Divider, IconButton, Button, Switch, Dialog, Portal, Menu } from 'react-native-paper';
import { supabase } from '../../src/config/supabase';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, THEME_NAMES } from '../../src/theme';

// Lista de instrumentos disponibles
const INSTRUMENTS = [
  'Violin', 'Viola', 'Cello', 'Bass', 'Not assigned'
];

// Lista de posiciones en la orquesta
const POSITIONS = [
  'Concert Master', 'Principal', 'Associate Principal', 'Section'
];

export default function StudentProfile() {
  const { id } = useLocalSearchParams();
  const { theme, themeType } = useAppTheme();
  const router = useRouter();
  const isMondayTheme = themeType === THEME_NAMES.MONDAY;
  
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para edición
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [ageValue, setAgeValue] = useState('');
  const [instrumentValue, setInstrumentValue] = useState('');
  const [positionValue, setPositionValue] = useState('');
  const [instrumentMenuVisible, setInstrumentMenuVisible] = useState(false);
  const [positionMenuVisible, setPositionMenuVisible] = useState(false);
  
  // Estados para activación/desactivación
  const [isActive, setIsActive] = useState(true);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  
  // Cargar datos del estudiante
  useEffect(() => {
    async function loadStudent() {
      if (!id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Consultar datos del estudiante y padres en una sola consulta
        const { data, error: studentError } = await supabase
          .from('students')
          .select(`
            *,
            student_parents (
              *,
              parents (*)
            )
          `)
          .eq('id', id)
          .single();
        
        if (studentError) {
          setError('No se pudo cargar la información del estudiante');
          setLoading(false);
          return;
        }
        
        setStudent(data);
        setIsActive(data.is_active);
        loadFormData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar datos:", error);
        setError('Error inesperado al cargar datos');
        setLoading(false);
      }
    }
    
    loadStudent();
  }, [id]);
  
  // Función para cargar datos en el formulario
  const loadFormData = useCallback((studentData) => {
    if (!studentData) return;
    
    setFirstName(studentData.first_name || '');
    setLastName(studentData.last_name || '');
    setGrade(studentData.current_grade || '');
    setAgeValue(studentData.age ? studentData.age.toString() : '');
    setInstrumentValue(studentData.instrument || '');
    setPositionValue(studentData.orchestra_position || '');
  }, []);
  
  // Función para gestionar el estado activo/inactivo
  const handleToggleActive = useCallback(() => {
    if (isActive) {
      setShowDeactivateDialog(true);
    } else {
      setShowReactivateDialog(true);
    }
  }, [isActive]);
  
  // Función para desactivar estudiante
  const deactivateStudent = useCallback(async () => {
    if (!student || !student.id) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('students')
        .update({ 
          is_active: false,
          deactivation_reason: deactivationReason || null
        })
        .eq('id', student.id);
      
      if (error) throw error;
      
      setIsActive(false);
      setShowDeactivateDialog(false);
      setDeactivationReason('');
      
      setStudent(prev => prev ? {
        ...prev,
        is_active: false,
        deactivation_reason: deactivationReason || null
      } : null);
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo desactivar el estudiante');
    } finally {
      setLoading(false);
    }
  }, [student, deactivationReason]);
  
  // Función para reactivar estudiante
  const reactivateStudent = useCallback(async () => {
    if (!student || !student.id) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('students')
        .update({ 
          is_active: true
        })
        .eq('id', student.id);
      
      if (error) throw error;
      
      setIsActive(true);
      setShowReactivateDialog(false);
      
      setStudent(prev => prev ? {
        ...prev,
        is_active: true,
        deactivation_reason: null
      } : null);
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo reactivar el estudiante');
    } finally {
      setLoading(false);
    }
  }, [student]);
  
  // Función para actualizar estudiante
  const handleUpdate = useCallback(async () => {
    try {
      setLoading(true);
      
      // Recopilar todos los valores actualizados
      const updatedValues = {
        first_name: firstName,
        last_name: lastName,
        current_grade: grade,
        age: ageValue ? parseInt(ageValue, 10) : null,
        instrument: instrumentValue,
        orchestra_position: positionValue
      };
      
      // Enviar actualización a Supabase
      const { error } = await supabase
        .from('students')
        .update(updatedValues)
        .eq('id', student.id);
      
      if (error) throw error;
      
      // Actualizar el estado local con los nuevos valores
      setStudent(prev => ({
        ...prev,
        ...updatedValues
      }));
      
      setIsEditing(false);
      Alert.alert('Éxito', 'Información actualizada correctamente');
      
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la información del estudiante');
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, grade, ageValue, instrumentValue, positionValue, student]);
  
  // Función para realizar llamadas
  const handleCall = useCallback(() => {
    if (!student) return;

    let phoneNumber = student.phone_number;

    // Si hay padre con teléfono, ofrecer opciones
    if (student.student_parents && 
        student.student_parents.length > 0 && 
        student.student_parents[0].parents &&
        student.student_parents[0].parents.phone_number) {

        Alert.alert(
            'Llamar a',
            '¿A quién deseas llamar?',
            [
                {
                    text: `Estudiante (${student.phone_number || 'No disponible'})`,
                    onPress: () => student.phone_number ? 
                        Linking.openURL(`tel:${student.phone_number}`) : 
                        Alert.alert('Error', 'Número no disponible')
                },
                {
                    text: `Padre/Madre (${student.student_parents[0].parents.phone_number})`,
                    onPress: () => Linking.openURL(`tel:${student.student_parents[0].parents.phone_number}`)
                },
                {
                    text: 'Cancelar',
                    style: 'cancel'
                },
            ]
        );
        return;
    }

    // Si solo hay número del estudiante
    if (phoneNumber) {
        Linking.openURL(`tel:${phoneNumber}`);
    } else {
        Alert.alert('Error', 'No hay número de teléfono disponible');
    }
  }, [student]);

  // Función para enviar mensajes
  const handleMessage = useCallback(() => {
    if (!student) return;

    let phoneNumber = student.phone_number;

    // Si hay padre con teléfono, ofrecer opciones
    if (student.student_parents && 
        student.student_parents.length > 0 && 
        student.student_parents[0].parents &&
        student.student_parents[0].parents.phone_number) {

        Alert.alert(
            'Enviar mensaje a',
            '¿A quién deseas enviar un mensaje?',
            [
                {
                    text: `Estudiante (${student.phone_number || 'No disponible'})`,
                    onPress: () => student.phone_number ? 
                        Linking.openURL(`sms:${student.phone_number}`) : 
                        Alert.alert('Error', 'Número no disponible')
                },
                {
                    text: `Padre/Madre (${student.student_parents[0].parents.phone_number})`,
                    onPress: () => Linking.openURL(`sms:${student.student_parents[0].parents.phone_number}`)
                },
                {
                    text: 'Cancelar',
                    style: 'cancel'
                },
            ]
        );
        return;
    }

    // Si solo hay número del estudiante
    if (phoneNumber) {
        Linking.openURL(`sms:${phoneNumber}`);
    } else {
        Alert.alert('Error', 'No hay número de teléfono disponible');
    }
  }, [student]);
  
  // Configurar opciones de Stack.Screen
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={{ color: theme.colors.error }}>{error}</Text>
        </View>
      ) : student ? (
        <View style={{flex: 1}}>
          <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Información Básica */}
            <Surface style={[styles.card, { 
              elevation: isMondayTheme ? 0 : 2,
              borderWidth: isMondayTheme ? 1 : 0,
              borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
              borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
            }]}>
              <View style={styles.headerRow}>
                <Avatar.Text 
                  size={56} 
                  label={`${student.first_name?.charAt(0) || ''}${student.last_name?.charAt(0) || ''}`} 
                  backgroundColor={theme.colors.primary}
                  color={theme.colors.onPrimary}
                  style={isMondayTheme ? { borderRadius: BORDER_RADIUS.sm } : {}}
                />
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
                    {student.first_name} {student.last_name}
                  </Text>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
                    <View style={[styles.statusIndicator, { 
                      backgroundColor: theme.colors.primary
                    }]} />
                    <Text style={{ 
                      color: theme.colors.primary,
                      fontSize: TYPOGRAPHY.fontSizeSm,
                      fontWeight: '600'
                    }}>
                      {student.instrument || 'Sin instrumento'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ 
                      color: theme.colors.onSurfaceVariant,
                      fontSize: TYPOGRAPHY.fontSizeSm
                    }}>
                      {student.is_active ? 'Estudiante Activo' : 'Estudiante Inactivo'}
                    </Text>
                    <Switch
                      value={isActive}
                      onValueChange={handleToggleActive}
                      color={theme.colors.primary}
                    />
                  </View>
                </View>
              </View>
              
              {/* Estado de activación */}
              {!student.is_active && student.deactivation_reason && (
                <View style={styles.deactivationContainer}>
                  <Text style={{ color: theme.colors.error, fontWeight: '500', marginTop: SPACING.sm }}>
                    Razón de desactivación:
                  </Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic', marginTop: 4 }}>
                    {student.deactivation_reason}
                  </Text>
                </View>
              )}
            </Surface>
            
            {/* Información Académica */}
            <Surface style={[styles.card, { 
              elevation: isMondayTheme ? 0 : 2,
              borderWidth: isMondayTheme ? 1 : 0,
              borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
              borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
            }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Información Académica
              </Text>
              <Divider style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.primary }]}>Grado:</Text>
                <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                  {student.current_grade || 'No especificado'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.primary }]}>Edad:</Text>
                <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                  {student.age || 'No especificada'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.primary }]}>Instrumento:</Text>
                <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                  {student.instrument || 'No especificado'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.colors.primary }]}>Posición:</Text>
                <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                  {student.orchestra_position || 'No especificada'}
                </Text>
              </View>
            </Surface>
            
            {/* Información de Padres */}
            {student.student_parents && student.student_parents.length > 0 && (
              <Surface style={[styles.card, { 
                elevation: isMondayTheme ? 0 : 2,
                borderWidth: isMondayTheme ? 1 : 0,
                borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
              }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                  Información de Padres
                </Text>
                <Divider style={styles.divider} />
                
                {student.student_parents.map((relation, index) => {
                  // Extraer datos del padre/representante de forma segura
                  let parentData = relation.parents || {};
                  return (
                    <View key={index} style={styles.parentContainer}>
                      {index > 0 && <Divider style={[styles.divider, { marginVertical: SPACING.md }]} />}
                      
                      <View style={styles.infoRow}>
                        <Text style={[styles.label, { color: theme.colors.primary }]}>Nombre:</Text>
                        <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                          {parentData.full_name || parentData.name || ''}
                        </Text>
                      </View>
                      
                      <View style={styles.infoRow}>
                        <Text style={[styles.label, { color: theme.colors.primary }]}>Teléfono:</Text>
                        <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                          {parentData.phone_number || parentData.phone || 'No especificado'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Surface>
            )}
          </ScrollView>
          
          {/* Botones de acción */}
          <View style={[styles.actionButtonsContainer]}>
            <View style={styles.actionButtonsGroup}>
              <View style={styles.actionButtonWrapper}>
                <IconButton
                    icon="phone"
                    mode="contained"
                    size={28}
                    iconColor={theme.colors.onPrimary}
                    style={[
                      styles.actionButton, 
                      { 
                        backgroundColor: theme.colors.primary,
                        borderRadius: isMondayTheme ? BORDER_RADIUS.sm : 32,
                      }
                    ]}
                    onPress={handleCall}
                />
              </View>
              
              <View style={styles.actionButtonWrapper}>
                <IconButton
                    icon="pencil"
                    mode="contained"
                    size={28}
                    iconColor={theme.colors.onPrimary}
                    style={[
                      styles.actionButton, 
                      { 
                        backgroundColor: theme.colors.primary,
                        borderRadius: isMondayTheme ? BORDER_RADIUS.sm : 32,
                      }
                    ]}
                    onPress={() => setIsEditing(true)}
                />
              </View>
              
              <View style={styles.actionButtonWrapper}>
                <IconButton
                    icon="message"
                    mode="contained"
                    size={28}
                    iconColor={theme.colors.onPrimary}
                    style={[
                      styles.actionButton, 
                      { 
                        backgroundColor: theme.colors.primary,
                        borderRadius: isMondayTheme ? BORDER_RADIUS.sm : 32,
                      }
                    ]}
                    onPress={handleMessage}
                />
              </View>
            </View>
          </View>
          
          {/* Diálogo de edición */}
          <Portal>
            <Dialog
              visible={isEditing}
              onDismiss={() => setIsEditing(false)}
              style={[
                styles.dialog,
                { 
                  backgroundColor: theme.colors.surface,
                  borderWidth: isMondayTheme ? 1 : 0,
                  borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                  borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
                  padding: SPACING.sm,
                }
              ]}
            >
              <Dialog.Title style={{ color: theme.colors.primary }}>
                Editar Estudiante
              </Dialog.Title>
              <Dialog.Content>
                <ScrollView style={{ maxHeight: 350 }}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                        borderColor: isMondayTheme ? theme.colors.outline : '#ddd',
                        backgroundColor: isMondayTheme ? theme.colors.surfaceVariant : '#fafafa',
                      }
                    ]}
                    placeholder="Nombre"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                  
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                        borderColor: isMondayTheme ? theme.colors.outline : '#ddd',
                        backgroundColor: isMondayTheme ? theme.colors.surfaceVariant : '#fafafa',
                      }
                    ]}
                    placeholder="Apellido"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                  
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                        borderColor: isMondayTheme ? theme.colors.outline : '#ddd',
                        backgroundColor: isMondayTheme ? theme.colors.surfaceVariant : '#fafafa',
                      }
                    ]}
                    placeholder="Grado"
                    value={grade}
                    onChangeText={setGrade}
                    keyboardType="numeric"
                  />
                  
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                        borderColor: isMondayTheme ? theme.colors.outline : '#ddd',
                        backgroundColor: isMondayTheme ? theme.colors.surfaceVariant : '#fafafa',
                      }
                    ]}
                    placeholder="Edad"
                    value={ageValue}
                    onChangeText={setAgeValue}
                    keyboardType="numeric"
                  />
                  
                  {/* Selector de instrumento */}
                  <Menu
                    visible={instrumentMenuVisible}
                    onDismiss={() => setInstrumentMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setInstrumentMenuVisible(true)}
                        style={[
                          styles.menuButton,
                          { 
                            backgroundColor: theme.colors.surfaceVariant,
                            borderWidth: 1,
                            borderColor: theme.colors.outline,
                            borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                          }
                        ]}
                      >
                        {instrumentValue || 'Seleccionar Instrumento'}
                      </Button>
                    }
                  >
                    {INSTRUMENTS.map((item) => (
                      <Menu.Item
                        key={item}
                        onPress={() => {
                          setInstrumentValue(item);
                          setInstrumentMenuVisible(false);
                        }}
                        title={item}
                      />
                    ))}
                  </Menu>
                  
                  {/* Selector de posición */}
                  <Menu
                    visible={positionMenuVisible}
                    onDismiss={() => setPositionMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setPositionMenuVisible(true)}
                        style={[
                          styles.menuButton,
                          { 
                            backgroundColor: theme.colors.surfaceVariant,
                            borderWidth: 1,
                            borderColor: theme.colors.outline,
                            borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                          }
                        ]}
                      >
                        {positionValue || 'Seleccionar Posición'}
                      </Button>
                    }
                  >
                    {POSITIONS.map((item) => (
                      <Menu.Item
                        key={item}
                        onPress={() => {
                          setPositionValue(item);
                          setPositionMenuVisible(false);
                        }}
                        title={item}
                      />
                    ))}
                  </Menu>
                </ScrollView>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setIsEditing(false)}>Cancelar</Button>
                <Button onPress={handleUpdate}>Guardar</Button>
              </Dialog.Actions>
            </Dialog>
            
            {/* Diálogo de desactivación */}
            <Dialog
              visible={showDeactivateDialog}
              onDismiss={() => setShowDeactivateDialog(false)}
              style={[
                styles.dialog,
                { 
                  backgroundColor: theme.colors.surface,
                  borderWidth: isMondayTheme ? 1 : 0,
                  borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                  borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
                }
              ]}
            >
              <Dialog.Title style={{ color: theme.colors.primary }}>
                Desactivar Estudiante
              </Dialog.Title>
              <Dialog.Content>
                <Text style={{ marginBottom: 16 }}>
                  ¿Estás seguro de que deseas desactivar a este estudiante?
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                      borderColor: isMondayTheme ? theme.colors.outline : '#ddd',
                      backgroundColor: isMondayTheme ? theme.colors.surfaceVariant : '#fafafa',
                    }
                  ]}
                  placeholder="Razón de desactivación (opcional)"
                  value={deactivationReason}
                  onChangeText={setDeactivationReason}
                  multiline
                  numberOfLines={3}
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setShowDeactivateDialog(false)}>Cancelar</Button>
                <Button 
                  onPress={deactivateStudent} 
                  mode="contained"
                  style={{ 
                    backgroundColor: theme.colors.error,
                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                  }}
                >
                  Desactivar
                </Button>
              </Dialog.Actions>
            </Dialog>
            
            {/* Diálogo de reactivación */}
            <Dialog
              visible={showReactivateDialog}
              onDismiss={() => setShowReactivateDialog(false)}
              style={[
                styles.dialog,
                { 
                  backgroundColor: theme.colors.surface,
                  borderWidth: isMondayTheme ? 1 : 0,
                  borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                  borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
                }
              ]}
            >
              <Dialog.Title style={{ color: theme.colors.primary }}>
                Reactivar Estudiante
              </Dialog.Title>
              <Dialog.Content>
                <Text>
                  ¿Estás seguro de que deseas reactivar a este estudiante?
                </Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setShowReactivateDialog(false)}>Cancelar</Button>
                <Button 
                  onPress={reactivateStudent} 
                  mode="contained"
                  style={{ 
                    backgroundColor: theme.colors.primary,
                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                  }}
                >
                  Reactivar
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <Text>No se encontró información del estudiante</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.md + 70, // Espacio extra para los botones
    paddingTop: SPACING.xl + SPACING.lg, // Aumentar más el espacio superior
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  headerTextContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  headerText: {
    fontSize: TYPOGRAPHY.fontSizeXl,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMd,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    paddingVertical: 3,
  },
  label: {
    width: 100,
    fontWeight: '600',
  },
  value: {
    flex: 1,
  },
  divider: {
    marginVertical: SPACING.xs,
    height: 1.5,
    opacity: 0.7,
  },
  parentContainer: {
    marginBottom: SPACING.xs,
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    padding: SPACING.md,
    height: 80,
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    width: 56,
    height: 56,
  },
  actionButtonWrapper: {
    alignItems: 'center',
  },
  deactivationContainer: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: 'rgba(229, 66, 88, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme => theme.colors.error,
  },
  dialog: {
    padding: SPACING.xs,
  },
  input: {
    height: 45,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  menuButton: {
    marginBottom: 15,
    width: '100%',
  }
});
