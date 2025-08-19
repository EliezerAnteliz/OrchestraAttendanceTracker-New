import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Surface, Avatar, Divider } from 'react-native-paper';
import { supabase } from '../../../src/config/supabase';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, THEME_NAMES } from '../../../src/theme';

export default function StudentProfile() {
  const { id } = useLocalSearchParams();
  const { theme, themeType } = useAppTheme();
  const isMondayTheme = themeType === THEME_NAMES.MONDAY;
  
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Cargar datos del estudiante
  useEffect(() => {
    async function loadStudent() {
      if (!id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Consultar datos del estudiante
        const { data, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .single();
        
        if (studentError) {
          setError('No se pudo cargar la información del estudiante');
          setLoading(false);
          return;
        }
        
        // Consultar relación con padres
        const { data: parentsRelation, error: parentsError } = await supabase
          .from('student_parents')
          .select(`
            *,
            parents(*)
          `)
          .eq('student_id', id);
        
        // Si hay datos de padres, añadirlos al objeto estudiante
        if (parentsRelation && parentsRelation.length > 0) {
          data.parents = parentsRelation;
        }
        
        setStudent(data);
        setLoading(false);
      } catch (error) {
        setError('Error inesperado al cargar datos');
        setLoading(false);
      }
    }
    
    loadStudent();
  }, [id]);
  
  // Configurar opciones de Stack.Screen
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen 
        options={{
          title: student ? `${student.first_name} ${student.last_name}` : 'Perfil del Estudiante',
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.onSurface,
          headerShadowVisible: isMondayTheme ? false : true,
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
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {/* Información Básica */}
          <Surface style={[styles.card, { 
            elevation: isMondayTheme ? 0 : 2,
            borderWidth: isMondayTheme ? 1 : 0,
            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
          }]}>
            <View style={styles.headerRow}>
              <Avatar.Text 
                size={60} 
                label={`${student.first_name?.charAt(0) || ''}${student.last_name?.charAt(0) || ''}`} 
                backgroundColor={theme.colors.primary}
                color={theme.colors.onPrimary}
              />
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
                  {student.first_name} {student.last_name}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {student.instrument || 'Sin instrumento'}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  {student.is_active ? 'Estudiante Activo' : 'Estudiante Inactivo'}
                </Text>
              </View>
            </View>
          </Surface>
          
          {/* Información Académica */}
          <Surface style={[styles.card, { 
            elevation: isMondayTheme ? 0 : 2,
            borderWidth: isMondayTheme ? 1 : 0,
            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
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
          
          {/* Información de Contacto */}
          <Surface style={[styles.card, { 
            elevation: isMondayTheme ? 0 : 2,
            borderWidth: isMondayTheme ? 1 : 0,
            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
          }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
              Información de Contacto
            </Text>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: theme.colors.primary }]}>Teléfono:</Text>
              <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                {student.phone_number || 'No especificado'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: theme.colors.primary }]}>Correo:</Text>
              <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                {student.email || 'No especificado'}
              </Text>
            </View>
          </Surface>
          
          {/* Información de Padres */}
          {student.parents && student.parents.length > 0 && (
            <Surface style={[styles.card, { 
              elevation: isMondayTheme ? 0 : 2,
              borderWidth: isMondayTheme ? 1 : 0,
              borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
            }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Información de Padres
              </Text>
              <Divider style={styles.divider} />
              
              {student.parents.map((relation, index) => 
                relation.parents && (
                  <View key={index} style={styles.parentContainer}>
                    {index > 0 && <Divider style={[styles.divider, { marginVertical: SPACING.md }]} />}
                    
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: theme.colors.primary }]}>Nombre:</Text>
                      <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                        {relation.parents.first_name} {relation.parents.last_name}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: theme.colors.primary }]}>Teléfono:</Text>
                      <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                        {relation.parents.phone_number || 'No especificado'}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: theme.colors.primary }]}>Correo:</Text>
                      <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                        {relation.parents.email || 'No especificado'}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: theme.colors.primary }]}>Relación:</Text>
                      <Text style={[styles.value, { color: theme.colors.onSurface }]}>
                        {relation.relation_type || 'No especificada'}
                      </Text>
                    </View>
                  </View>
                )
              )}
            </Surface>
          )}
        </ScrollView>
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
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  headerText: {
    fontSize: TYPOGRAPHY.fontSizeLg,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMd,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
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
  },
  parentContainer: {
    marginBottom: SPACING.xs,
  }
});
