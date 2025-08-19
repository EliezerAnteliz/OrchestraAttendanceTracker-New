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
                size={50} 
                label={`${student.first_name?.charAt(0) || ''}${student.last_name?.charAt(0) || ''}`} 
                backgroundColor={theme.colors.primary}
              />
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
                  {student.first_name} {student.last_name}
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {student.instrument || 'Sin instrumento'}
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
            <Divider />
            <View style={styles.infoRow}>
              <Text style={styles.label}>Grado:</Text>
              <Text style={styles.value}>{student.current_grade || 'No especificado'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Edad:</Text>
              <Text style={styles.value}>{student.age || 'No especificada'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Instrumento:</Text>
              <Text style={styles.value}>{student.instrument || 'No especificado'}</Text>
            </View>
          </Surface>
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
  },
  headerText: {
    fontSize: TYPOGRAPHY.fontSizeLg,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
  },
  value: {
    flex: 1,
  },
});