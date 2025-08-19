import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, SafeAreaView } from 'react-native';
import { Text, Card, Chip, Button, SegmentedButtons, Portal, Modal, List, Appbar } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAppTheme } from '../theme';

const screenWidth = Dimensions.get('window').width;

// IDs correctos de la base de datos
const ORGANIZATION_ID = 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4';
const PROGRAM_ID = '9d7dc91c-7bbe-49cd-bc64-755467bf91da';

export default function ReportsScreen() {
  const { theme, isDark } = useAppTheme();
  const [reportType, setReportType] = useState('group');
  const [periodType, setPeriodType] = useState('week');
  const [selectedInstrument, setSelectedInstrument] = useState('all');
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [students, setStudents] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);

  // Cargar estudiantes
  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, instrument, student_id')
        .eq('organization_id', ORGANIZATION_ID)
        .eq('program_id', PROGRAM_ID)
        .eq('is_active', true)
        .order('first_name');

      if (error) {
        return;
      }

      // Filtrar por instrumento si es necesario
      const filteredData = selectedInstrument === 'all' 
        ? data 
        : data.filter(student => student.instrument === selectedInstrument);

      setStudents(filteredData || []);
    } catch (error) {
      // Manejar error silenciosamente
    }
  };

  // Cargar instrumentos
  const loadInstruments = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('instrument')
        .not('instrument', 'is', null);

      if (error) {
        return;
      }

      const instrumentOrder = ['Violin', 'Viola', 'Cello', 'Bass', 'Not assigned'];
      const uniqueInstruments = [...new Set(data.map(item => item.instrument))];
      const sortedInstruments = uniqueInstruments.sort((a, b) => {
        const indexA = instrumentOrder.indexOf(a);
        const indexB = instrumentOrder.indexOf(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      setInstruments(sortedInstruments);
    } catch (error) {
      // Manejar error silenciosamente
    }
  };

  // Calcular estadísticas de asistencia
  const calculateAttendanceStats = async (startDate, endDate, studentId = null) => {
    try {
      let query = supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (studentId) {
        query = query.eq('student_id', studentId);
      } else if (selectedInstrument !== 'all') {
        const studentIds = students
          .filter(s => s.instrument === selectedInstrument)
          .map(s => s.id);
        if (studentIds.length > 0) {
          query = query.in('student_id', studentIds);
        }
      }

      const { data, error } = await query;
      
      if (error) {
        throw error;
      }

      // Calcular totales
      const totals = data.reduce((acc, record) => {
        acc[record.status_code] = (acc[record.status_code] || 0) + 1;
        return acc;
      }, {});

      const total = data.length || 0;
      const present = totals['A'] || 0;
      const excused = totals['EA'] || 0;
      const unexcused = totals['UA'] || 0;

      return {
        total_attendance: present,
        total_excused_absences: excused,
        total_unexcused_absences: unexcused,
        attendance_percentage: total > 0 ? (present / total) * 100 : 0,
        excused_percentage: total > 0 ? (excused / total) * 100 : 0,
        unexcused_percentage: total > 0 ? (unexcused / total) * 100 : 0
      };
    } catch (error) {
      throw error;
    }
  };

  // Después de calculateAttendanceStats, agregar:
  const calculateWeeklyStats = async (numberOfWeeks = 4) => {
    try {
      const weeks = [];
      const now = new Date();
      
      // Invertimos el orden del bucle para que Semana 1 sea la más antigua
      for (let i = numberOfWeeks - 1; i >= 0; i--) {
        const endDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const weekStats = await calculateAttendanceStats(startDate, endDate);
        // Cambiar el nombre de la semana más reciente (i=0) a "Semana actual"
        const weekLabel = i === 0 ? "Semana actual" : `Semana ${numberOfWeeks - i}`;
        weeks.push({
          weekLabel: weekLabel,
          ...weekStats
        });
      }
      
      return weeks;
    } catch (error) {
      console.error("Error en calculateWeeklyStats:", error);
      throw error;
    }
  };

  // Generar reporte
  const generateReport = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate, endDate;
      
      // Calcular fechas según el período
      switch (periodType) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = now;
          // Obtener datos de las últimas 4 semanas
          const weeklyStats = await calculateWeeklyStats(4);
          setWeeklyData(weeklyStats);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          endDate = now;
          setWeeklyData(null);
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          endDate = now;
          setWeeklyData(null);
          break;
      }

      // Calcular estadísticas
      const stats = await calculateAttendanceStats(
        startDate,
        endDate,
        reportType === 'individual' ? selectedStudent : null
      );

      // Actualizar el estado con los resultados
      setReportData({
        report_type: reportType,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        report_scope: reportType === 'individual' ? 'student' : 'group',
        student_id: reportType === 'individual' ? selectedStudent : null,
        instrument_filter: selectedInstrument === 'all' ? null : selectedInstrument,
        ...stats
      });

    } catch (error) {
      setWeeklyData(null);
    } finally {
      setLoading(false);
    }
  };

  // Inicializar datos
  useEffect(() => {
    loadInstruments();
    loadStudents();
  }, []);

  // Efecto para recargar estudiantes cuando cambia el instrumento seleccionado
  useEffect(() => {
    loadStudents();
  }, [selectedInstrument]);

  // Función para formatear fechas
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Función para formatear porcentajes
  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  // Datos para el gráfico circular modificado
  const getPieChartData = (data) => {
    if (!data) return [];

    return [
      {
        name: `${data.total_attendance} Asistencias`,
        population: data.total_attendance || 0.1,
        color: COLORS.attendance.present,
        legendFontColor: theme.colors.text,
        legendFontSize: 16,
      },
      {
        name: `${data.total_excused_absences} Faltas Justificadas`,
        population: data.total_excused_absences || 0.1,
        color: COLORS.attendance.justified,
        legendFontColor: theme.colors.text,
        legendFontSize: 16,
      },
      {
        name: `${data.total_unexcused_absences} Faltas Injustificadas`, 
        population: data.total_unexcused_absences || 0.1,
        color: COLORS.attendance.unexcused,
        legendFontColor: theme.colors.text,
        legendFontSize: 16,
      },
    ];
  };

  // Después de getPieChartData, modificar:
  const getWeeklyComparisonData = (weeklyData) => {
    // Verificar que weeklyData sea un array válido
    if (!weeklyData || !Array.isArray(weeklyData) || weeklyData.length === 0) {
      return {
        weeks: ['S1', 'S2', 'S3', 'S4'],
        attendance: [0, 0, 0, 0],
        justified: [0, 0, 0, 0],
        unexcused: [0, 0, 0, 0],
        maxValue: 10 // Para escalar las barras correctamente
      };
    }

    const weeks = weeklyData.map((week, index) => `S${index + 1}`);
    const attendance = weeklyData.map(week => week.total_attendance || 0);
    const justified = weeklyData.map(week => week.total_excused_absences || 0);
    const unexcused = weeklyData.map(week => week.total_unexcused_absences || 0);
    
    // Calcular el valor máximo para escalar correctamente
    const allValues = [...attendance, ...justified, ...unexcused];
    const maxValue = Math.max(...allValues, 10); // Mínimo 10 para evitar divisiones por cero
    
    return {
      weeks,
      attendance,
      justified,
      unexcused,
      maxValue
    };
  };

  // Modificar la función calculateTrends para incluir también la semana 1
  const calculateTrends = (weeklyData) => {
    if (!weeklyData || weeklyData.length === 0) return [];

    const trends = [];
    
    // Agregar la Semana 1 con tendencia "N/A" o base cero
    // No podemos calcular una tendencia real para la primera semana ya que no hay datos previos
    if (weeklyData.length > 0) {
      trends.push({
        weekLabel: weeklyData[0].weekLabel, // "Semana 1"
        attendanceChange: 0,  // Valor neutral para la primera semana
        justifiedChange: 0,   // Valor neutral para la primera semana
        unjustifiedChange: 0  // Valor neutral para la primera semana
      });
    }
    
    // Calcular cambios porcentuales entre semanas consecutivas (orden progresivo)
    for (let i = 1; i < weeklyData.length; i++) {
      const currentWeek = weeklyData[i];
      const previousWeek = weeklyData[i-1]; // Semana anterior en orden cronológico
      
      const attendanceChange = ((currentWeek.total_attendance - previousWeek.total_attendance) / Math.max(previousWeek.total_attendance, 1)) * 100;
      const justifiedChange = ((currentWeek.total_excused_absences - previousWeek.total_excused_absences) / Math.max(previousWeek.total_excused_absences, 1)) * 100;
      const unjustifiedChange = ((currentWeek.total_unexcused_absences - previousWeek.total_unexcused_absences) / Math.max(previousWeek.total_unexcused_absences, 1)) * 100;

      trends.push({
        weekLabel: currentWeek.weekLabel,
        attendanceChange: isFinite(attendanceChange) ? attendanceChange : 0,
        justifiedChange: isFinite(justifiedChange) ? justifiedChange : 0,
        unjustifiedChange: isFinite(unjustifiedChange) ? unjustifiedChange : 0
      });
    }

    return trends;
  };

  // Configuración común para los gráficos
  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => theme.colors.text,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: SPACING.md,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.xl,
    },
    header: {
      backgroundColor: theme.colors.surface,
      elevation: 1,
    },
    card: {
      marginVertical: SPACING.xs,
      backgroundColor: theme.colors.surface,
      ...SHADOWS.small,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      elevation: 1,
    },
    section: {
      marginBottom: SPACING.sm,
    },
    sectionTitle: {
      marginBottom: SPACING.xs,
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    chip: {
      margin: SPACING.xs / 2,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      paddingHorizontal: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedChip: {
      backgroundColor: 'rgba(103, 80, 164, 0.08)',
      borderColor: theme.colors.primary,
    },
    chipLabel: {
      fontSize: 15,
      fontWeight: '500',
      paddingHorizontal: 2,
      textAlign: 'center',
      lineHeight: 20,
    },
    selectedChipLabel: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    generateButton: {
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
      borderRadius: 28,
      height: 52,
      ...SHADOWS.medium,
      elevation: 3,
    },
    generateButtonContent: {
      height: 52,
      paddingHorizontal: SPACING.md,
    },
    generateButtonLabel: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    segmentedButtons: {
      marginVertical: SPACING.xs,
      height: 40,
    },
    reportCard: {
      minHeight: 200,
      backgroundColor: theme.colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      margin: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      ...SHADOWS.medium,
      elevation: 3,
      maxWidth: 350,
      alignSelf: 'center',
      width: '90%',
    },
    modalTitle: {
      marginBottom: SPACING.md,
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: 0.25,
    },
    studentList: {
      maxHeight: 350,
    },
    studentItem: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.06)',
      paddingVertical: SPACING.xs,
    },
    studentName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    studentDescription: {
      fontSize: 14,
      color: theme.colors.text,
      opacity: 0.7,
    },
    studentButton: {
      borderRadius: BORDER_RADIUS.lg,
      borderColor: theme.colors.outline,
      height: 48,
    },
    studentButtonContent: {
      height: 48,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    statCard: {
      flex: 1,
      marginHorizontal: SPACING.xxs,
      backgroundColor: theme.colors.surface,
      ...SHADOWS.medium,
      borderRadius: BORDER_RADIUS.md,
      padding: 0,
      elevation: 4,
      borderWidth: 0.5,
      borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    statNumber: {
      ...TYPOGRAPHY.title1,
      textAlign: 'center',
      marginBottom: 0,
      marginTop: SPACING.xs,
      fontSize: 30,
      fontWeight: '700',
    },
    statLabel: {
      textAlign: 'center',
      color: theme.colors.text,
      fontSize: 15,
      marginBottom: 2,
      fontWeight: '500',
    },
    percentageValue: {
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '600',
      marginBottom: SPACING.xs,
    },
    chartContainer: {
      marginTop: SPACING.sm,
      marginBottom: SPACING.md,
      alignItems: 'center',
      paddingHorizontal: 0,
    },
    chartContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.sm,
    },
    pieContainer: {
      width: '42%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 150,
    },
    legendContainer: {
      width: '58%',
      justifyContent: 'center',
      paddingLeft: SPACING.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    legendColor: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginRight: SPACING.sm,
    },
    legendText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      flexShrink: 1,
    },
    chartTitle: {
      marginBottom: SPACING.sm,
      textAlign: 'center',
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    percentagesContainer: {
      marginTop: SPACING.md,
      padding: SPACING.md,
      backgroundColor: theme.colors.surface,
      borderRadius: BORDER_RADIUS.sm,
      display: 'none',
    },
    reportTitle: {
      ...TYPOGRAPHY.subtitle1,
      marginBottom: SPACING.md,
      color: theme.colors.text,
    },
    periodText: {
      ...TYPOGRAPHY.body1,
      marginBottom: SPACING.md,
      color: theme.colors.secondary,
    },
    trendContainer: {
      marginBottom: SPACING.md,
      padding: SPACING.md,
      backgroundColor: theme.colors.surface,
      borderRadius: BORDER_RADIUS.sm,
    },
    trendWeekLabel: {
      ...TYPOGRAPHY.subtitle1,
      marginBottom: SPACING.sm,
      color: theme.colors.primary,
    },
    trendItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.xs + 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    trendLabel: {
      ...TYPOGRAPHY.body2,
      color: theme.colors.text,
    },
    trendValue: {
      ...TYPOGRAPHY.body2,
      fontWeight: 'bold',
    },
    filtersContainer: {
      marginVertical: SPACING.xs,
      width: '100%',
    },
    filtersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      marginVertical: SPACING.xxs,
      gap: 8,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header style={[styles.header, { elevation: 0, height: 48 }]}>
        <Appbar.Content title="Reportes y Estadísticas" titleStyle={{ fontWeight: '500', fontSize: 18 }} />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={{ padding: SPACING.sm, paddingBottom: SPACING.xs }}>
            {/* Selector de Tipo de Reporte */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Reporte</Text>
              <SegmentedButtons
                value={reportType}
                onValueChange={(value) => {
                  setReportType(value);
                  setSelectedStudent(null);
                  setReportData(null);
                }}
                buttons={[
                  { value: 'group', label: 'Grupal', icon: 'account-group' },
                  { value: 'individual', label: 'Individual', icon: 'account' },
                ]}
                style={styles.segmentedButtons}
                theme={{
                  colors: {
                    secondaryContainer: 'rgba(103, 80, 164, 0.15)',
                    onSecondaryContainer: theme.colors.primary,
                    outline: 'rgba(121, 116, 126, 0.12)'
                  }
                }}
                density="medium"
              />
            </View>

            {/* Selector de Estudiante para reportes individuales */}
            {reportType === 'individual' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Estudiante</Text>
                <Button
                  mode="outlined"
                  onPress={() => setStudentModalVisible(true)}
                  style={styles.studentButton}
                  contentStyle={styles.studentButtonContent}
                  labelStyle={{ fontSize: 15 }}
                  icon="account"
                >
                  {selectedStudent ? 
                    (() => {
                      const student = students.find(s => s.id === selectedStudent);
                      return student ? `${student.first_name} ${student.last_name}` : 'Seleccionar Estudiante';
                    })()
                    : 'Seleccionar Estudiante'}
                </Button>
              </View>
            )}

            {/* Selector de Período */}
            <View style={[styles.section, {marginBottom: SPACING.xs}]}>
              <Text style={styles.sectionTitle}>Período</Text>
              <SegmentedButtons
                value={periodType}
                onValueChange={(value) => {
                  setPeriodType(value);
                  setReportData(null);
                }}
                buttons={[
                  { value: 'week', label: 'Semanal' },
                  { value: 'month', label: 'Mensual' },
                  { value: 'year', label: 'Anual' },
                ]}
                style={styles.segmentedButtons}
                theme={{
                  colors: {
                    secondaryContainer: 'rgba(103, 80, 164, 0.15)',
                    onSecondaryContainer: theme.colors.primary,
                    outline: 'rgba(121, 116, 126, 0.12)'
                  },
                  fonts: {
                    labelMedium: { fontSize: 14 }
                  },
                  icon: {
                    size: 24
                  }
                }}
                density="medium"
              />
            </View>

            {/* Filtro de Instrumentos */}
            <View style={[styles.filtersContainer, {marginTop: SPACING.xs}]}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Instrumento
                </Text>
              </View>
              
              {/* Primera fila: Violin, Viola, Cello, Bass */}
              <View style={styles.filtersRow}>
                <Chip
                  selected={selectedInstrument === 'Violin'}
                  onPress={() => setSelectedInstrument('Violin')}
                  style={[
                    styles.chip,
                    selectedInstrument === 'Violin' && { 
                      backgroundColor: 'rgba(103, 80, 164, 0.08)',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  mode="outlined"
                  selectedColor={theme.colors.primary}
                >
                  Violin
                </Chip>
                
                <Chip
                  selected={selectedInstrument === 'Viola'}
                  onPress={() => setSelectedInstrument('Viola')}
                  style={[
                    styles.chip,
                    selectedInstrument === 'Viola' && { 
                      backgroundColor: 'rgba(103, 80, 164, 0.08)',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  mode="outlined"
                  selectedColor={theme.colors.primary}
                >
                  Viola
                </Chip>
                
                <Chip
                  selected={selectedInstrument === 'Cello'}
                  onPress={() => setSelectedInstrument('Cello')}
                  style={[
                    styles.chip,
                    selectedInstrument === 'Cello' && { 
                      backgroundColor: 'rgba(103, 80, 164, 0.08)',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  mode="outlined"
                  selectedColor={theme.colors.primary}
                >
                  Cello
                </Chip>
                
                <Chip
                  selected={selectedInstrument === 'Bass'}
                  onPress={() => setSelectedInstrument('Bass')}
                  style={[
                    styles.chip,
                    selectedInstrument === 'Bass' && { 
                      backgroundColor: 'rgba(103, 80, 164, 0.08)',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  mode="outlined"
                  selectedColor={theme.colors.primary}
                >
                  Bass
                </Chip>
              </View>
              
              {/* Segunda fila: Todos y Not Assigned */}
              <View style={[styles.filtersRow, { marginTop: 8 }]}>
                <Chip
                  selected={selectedInstrument === 'all'}
                  onPress={() => setSelectedInstrument('all')}
                  style={[
                    styles.chip,
                    selectedInstrument === 'all' && { 
                      backgroundColor: 'rgba(103, 80, 164, 0.08)',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  mode="outlined"
                  selectedColor={theme.colors.primary}
                  icon={selectedInstrument === 'all' ? 'check' : null}
                >
                  Todos
                </Chip>
                
                <Chip
                  selected={selectedInstrument === 'Not assigned'}
                  onPress={() => setSelectedInstrument('Not assigned')}
                  style={[
                    styles.chip,
                    selectedInstrument === 'Not assigned' && { 
                      backgroundColor: 'rgba(103, 80, 164, 0.08)',
                      borderColor: theme.colors.primary
                    }
                  ]}
                  mode="outlined"
                  selectedColor={theme.colors.primary}
                >
                  Not Assigned
                </Chip>
              </View>
            </View>

            {/* Botón Generar Reporte */}
            <Button
              mode="contained"
              onPress={generateReport}
              style={[styles.generateButton, {marginTop: SPACING.md}]}
              contentStyle={styles.generateButtonContent}
              loading={loading}
              disabled={reportType === 'individual' && !selectedStudent}
              icon="chart-box"
              labelStyle={styles.generateButtonLabel}
            >
              Generar Reporte
            </Button>
          </Card.Content>
        </Card>

        {/* Área para mostrar el reporte */}
        {reportData && (
          <Card style={[styles.reportCard, { marginTop: SPACING.md }]} mode="elevated">
            <Card.Content style={{ padding: SPACING.md }}>
              {/* Período del reporte */}
              <Text style={[styles.periodText, { fontSize: 18, fontWeight: '500', textAlign: 'center' }]}>
                Período: {formatDate(reportData.start_date)} - {formatDate(reportData.end_date)}
              </Text>

              {/* Totales en cards individuales */}
              <View style={[styles.statsGrid, { marginVertical: SPACING.md }]}>
                <Card style={styles.statCard}>
                  <Card.Content style={{ padding: SPACING.sm }}>
                    <Text variant="titleLarge" style={[styles.statNumber, { color: COLORS.attendance.present }]}>
                      {reportData.total_attendance}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 0}]}>Asistencias</Text>
                    <Text style={[styles.percentageValue, { color: COLORS.attendance.present }]}>
                      {formatPercentage(reportData.attendance_percentage)}
                    </Text>
                  </Card.Content>
                </Card>

                <Card style={styles.statCard}>
                  <Card.Content style={{ padding: SPACING.sm }}>
                    <Text variant="titleLarge" style={[styles.statNumber, { color: COLORS.attendance.justified }]}>
                      {reportData.total_excused_absences}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 0}]}>Justificadas</Text>
                    <Text style={[styles.percentageValue, { color: COLORS.attendance.justified }]}>
                      {formatPercentage(reportData.excused_percentage)}
                    </Text>
                  </Card.Content>
                </Card>

                <Card style={styles.statCard}>
                  <Card.Content style={{ padding: SPACING.sm }}>
                    <Text variant="titleLarge" style={[styles.statNumber, { color: COLORS.attendance.unexcused }]}>
                      {reportData.total_unexcused_absences}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 0}]}>Injustificadas</Text>
                    <Text style={[styles.percentageValue, { color: COLORS.attendance.unexcused }]}>
                      {formatPercentage(reportData.unexcused_percentage)}
                    </Text>
                  </Card.Content>
                </Card>
              </View>

              {/* Gráfico circular */}
              <View style={styles.chartContainer}>
                {/* Implementación personalizada del gráfico y leyenda */}
                <View style={styles.chartContent}>
                  {/* Gráfico a la izquierda */}
                  <View style={styles.pieContainer}>
                    <PieChart
                      data={getPieChartData(reportData)}
                      width={screenWidth * 0.80}
                      height={180}
                      chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => theme.colors.text,
                      }}
                      accessor="population"
                      backgroundColor="transparent"
                      absolute={false}
                      hasLegend={false}
                    />
                  </View>
                  
                  {/* Leyenda a la derecha */}
                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: COLORS.attendance.present }]} />
                      <Text style={styles.legendText}>{reportData.total_attendance} Asistencias</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: COLORS.attendance.justified }]} />
                      <Text style={styles.legendText}>{reportData.total_excused_absences} Faltas Justificadas</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: COLORS.attendance.unexcused }]} />
                      <Text style={styles.legendText}>{reportData.total_unexcused_absences} Faltas Injustificadas</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Comparación semanal (solo si es reporte semanal) */}
              {weeklyData && periodType === 'week' && (
                <Card style={[styles.card, {marginTop: SPACING.md}]}>
                  <Card.Content style={{padding: SPACING.md}}>
                    <Text style={[styles.sectionTitle, {color: '#9C27B0', fontSize: 18, marginBottom: SPACING.md}]}>
                      Comparación Últimas 4 Semanas
                    </Text>
                    
                    {(() => {
                      const chartData = getWeeklyComparisonData(weeklyData);
                      const chartHeight = 200; // Altura del gráfico
                      
                      return (
                        <View style={{marginVertical: SPACING.md}}>
                          {/* Área del gráfico */}
                          <View style={{
                            height: chartHeight,
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            alignItems: 'flex-end',
                            borderBottomWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                            paddingHorizontal: 10,
                            backgroundColor: isDark ? '#333333' : 'white',
                            borderRadius: 8,
                          }}>
                            {chartData.weeks.map((week, weekIndex) => (
                              <View key={weekIndex} style={{
                                flexDirection: 'row',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                height: '100%',
                                width: `${100 / chartData.weeks.length}%`,
                              }}>
                                {/* Barra de asistencias */}
                                <View style={{
                                  width: 20,
                                  height: `${(chartData.attendance[weekIndex] / chartData.maxValue) * 80}%`,
                                  backgroundColor: COLORS.attendance.present,
                                  borderRadius: 3,
                                  marginHorizontal: 2,
                                  minHeight: 4,
                                  opacity: isDark ? 1 : 0.9,
                                  alignItems: 'center'
                                }}>
                                  {chartData.attendance[weekIndex] > 0 && (
                                    <Text style={{
                                      position: 'absolute',
                                      top: -16,
                                      fontSize: 10,
                                      fontWeight: 'bold',
                                      color: isDark ? '#ffffff' : COLORS.attendance.present,
                                      backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'transparent',
                                      paddingHorizontal: isDark ? 3 : 0,
                                      borderRadius: isDark ? 2 : 0
                                    }}>
                                      {chartData.attendance[weekIndex]}
                                    </Text>
                                  )}
                                </View>
                                
                                {/* Barra de justificadas */}
                                <View style={{
                                  width: 20,
                                  height: `${(chartData.justified[weekIndex] / chartData.maxValue) * 80}%`,
                                  backgroundColor: COLORS.attendance.justified,
                                  borderRadius: 3,
                                  marginHorizontal: 2,
                                  minHeight: 4,
                                  opacity: isDark ? 1 : 0.9,
                                  alignItems: 'center'
                                }}>
                                  {chartData.justified[weekIndex] > 0 && (
                                    <Text style={{
                                      position: 'absolute',
                                      top: -16,
                                      fontSize: 10,
                                      fontWeight: 'bold',
                                      color: isDark ? '#ffffff' : COLORS.attendance.justified,
                                      backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'transparent',
                                      paddingHorizontal: isDark ? 3 : 0,
                                      borderRadius: isDark ? 2 : 0
                                    }}>
                                      {chartData.justified[weekIndex]}
                                    </Text>
                                  )}
                                </View>
                                
                                {/* Barra de injustificadas */}
                                <View style={{
                                  width: 20,
                                  height: `${(chartData.unexcused[weekIndex] / chartData.maxValue) * 80}%`,
                                  backgroundColor: COLORS.attendance.unexcused,
                                  borderRadius: 3,
                                  marginHorizontal: 2,
                                  minHeight: 4,
                                  opacity: isDark ? 1 : 0.9,
                                  alignItems: 'center'
                                }}>
                                  {chartData.unexcused[weekIndex] > 0 && (
                                    <Text style={{
                                      position: 'absolute',
                                      top: -16,
                                      fontSize: 10,
                                      fontWeight: 'bold',
                                      color: isDark ? '#ffffff' : COLORS.attendance.unexcused,
                                      backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'transparent',
                                      paddingHorizontal: isDark ? 3 : 0,
                                      borderRadius: isDark ? 2 : 0
                                    }}>
                                      {chartData.unexcused[weekIndex]}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            ))}
                          </View>
                          
                          {/* Etiquetas de las semanas */}
                          <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-around',
                            marginTop: 6,
                          }}>
                            {chartData.weeks.map((week, index) => (
                              <Text key={index} style={{
                                textAlign: 'center',
                                fontSize: 14,
                                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                                width: `${100 / chartData.weeks.length}%`
                              }}>
                                {week}
                              </Text>
                            ))}
                          </View>
                          
                          {/* Líneas de la cuadrícula (horizontales) */}
                          <View style={{
                            position: 'absolute',
                            top: 0,
                            left: 10,
                            right: 10,
                            height: chartHeight,
                          }}>
                            {[0.25, 0.5, 0.75].map((position, index) => (
                              <View key={index} style={{
                                position: 'absolute',
                                top: chartHeight - (chartHeight * position),
                                left: 0,
                                right: 0,
                                height: 1,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                borderStyle: 'dashed',
                              }} />
                            ))}
                          </View>
                        </View>
                      );
                    })()}
                    
                    {/* Leyenda */}
                    <View style={{flexDirection: 'row', justifyContent: 'center', marginTop: 16, flexWrap: 'wrap'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 5}}>
                        <View style={{width: 12, height: 12, backgroundColor: COLORS.attendance.present, marginRight: 5, borderRadius: 2}} />
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}>Asistencias</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 5}}>
                        <View style={{width: 12, height: 12, backgroundColor: COLORS.attendance.justified, marginRight: 5, borderRadius: 2}} />
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}>Justificadas</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
                        <View style={{width: 12, height: 12, backgroundColor: COLORS.attendance.unexcused, marginRight: 5, borderRadius: 2}} />
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}>Injustificadas</Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              )}

              {/* Tendencias de asistencia (solo si es reporte semanal) */}
              {weeklyData && periodType === 'week' && (
                <>
                  <Text style={[styles.sectionTitle, {
                    color: theme.colors.primary, 
                    fontSize: 20, 
                    marginTop: SPACING.lg,
                    marginBottom: SPACING.md, 
                    fontWeight: '600', 
                    letterSpacing: 0.5,
                    textAlign: 'center',
                    paddingTop: SPACING.md,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  }]}>
                    Tendencias de Asistencia
                  </Text>
                  
                  {/* Renderizar las tendencias */}
                  {(() => {
                    // Obtener las tendencias y verificar el resultado
                    const trends = calculateTrends(weeklyData);
                    
                    // Invertir orden para mostrar desde la más reciente a la más antigua
                    const reversedTrends = [...trends].reverse();
                    
                    // Función para limitar valores extremos
                    const limitPercentage = (value) => {
                      // Limitar a un máximo de 999.9% para mantener la presentación visual
                      if (value > 999.9) return 999.9;
                      if (value < -999.9) return -999.9;
                      return value;
                    };
                    
                    // Función para determinar el color según el tipo y valor
                    const getTrendColor = (type, value) => {
                      if (type === 'attendance') {
                        return value > 0 ? COLORS.attendance.present : value < 0 ? COLORS.attendance.unexcused : 
                          isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
                      } else if (type === 'justified') {
                        return value <= 0 ? COLORS.attendance.present : COLORS.attendance.justified;
                      } else { // unjustified
                        return value <= 0 ? COLORS.attendance.present : COLORS.attendance.unexcused;
                      }
                    };
                    
                    return reversedTrends.map((trend, index) => {
                      // Encontrar los datos de asistencia originales para la semana 1
                      const isWeek1 = trend.weekLabel === "Semana 1";
                      // Si es semana 1, buscar los datos originales
                      const week1Data = isWeek1 ? 
                        weeklyData.find(week => week.weekLabel === "Semana 1") : null;
                      
                      return (
                        <View key={index} style={{
                          marginBottom: index === reversedTrends.length - 1 ? 0 : SPACING.sm,
                        }}>
                          {/* Encabezado de la semana */}
                          <Text style={{
                            fontSize: 17,
                            fontWeight: '600',
                            color: theme.colors.primary,
                            letterSpacing: 0.4,
                            marginTop: index === 0 ? SPACING.xs : SPACING.md,
                            marginBottom: SPACING.sm,
                            paddingHorizontal: SPACING.md,
                            opacity: 0.95,
                          }}>
                            {trend.weekLabel}
                          </Text>
                          
                          {/* Tarjetas de estadísticas */}
                          <View style={[styles.statsGrid, { marginBottom: SPACING.xs, paddingHorizontal: SPACING.xs }]}>
                            {/* Tarjeta de Asistencias */}
                            <Card style={[styles.statCard, { 
                              elevation: 3, 
                              minHeight: 115,
                              borderRadius: 8
                            }]}>
                              <Card.Content style={{ 
                                padding: SPACING.sm,
                                height: '100%',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flex: 1
                              }}>
                                {isWeek1 ? (
                                  // Para Semana 1 mostrar valores reales con porcentaje simplificado (estilo consistente)
                                  <>
                                    <Text variant="titleLarge" style={[styles.statNumber, { 
                                      color: COLORS.attendance.present,
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {week1Data ? week1Data.total_attendance : 0}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 4}]}>Asistencias</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: COLORS.attendance.present,
                                      marginBottom: 10
                                    }]}>
                                      %
                                    </Text>
                                  </>
                                ) : (
                                  // Para el resto de semanas mostrar tendencia
                                  <>
                                    <Text variant="titleLarge" style={[styles.statNumber, { 
                                      color: getTrendColor('attendance', trend.attendanceChange),
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {trend.attendanceChange > 0 ? '+' : ''}
                                      {Math.abs(limitPercentage(trend.attendanceChange)).toFixed(1)}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 4}]}>Asistencias</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: getTrendColor('attendance', trend.attendanceChange),
                                      marginBottom: 10
                                    }]}>
                                      %{trend.attendanceChange !== 0 ? (trend.attendanceChange > 0 ? ' ↑' : ' ↓') : ''}
                                    </Text>
                                  </>
                                )}
                              </Card.Content>
                            </Card>
                            
                            {/* Tarjeta de Justificadas */}
                            <Card style={[styles.statCard, { 
                              elevation: 3, 
                              minHeight: 115,
                              borderRadius: 8
                            }]}>
                              <Card.Content style={{ 
                                padding: SPACING.sm,
                                height: '100%',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flex: 1
                              }}>
                                {isWeek1 ? (
                                  // Para Semana 1 mostrar valores reales con porcentaje simplificado (estilo consistente)
                                  <>
                                    <Text variant="titleLarge" style={[styles.statNumber, { 
                                      color: COLORS.attendance.justified,
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {week1Data ? week1Data.total_excused_absences : 0}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 4}]}>Justificadas</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: COLORS.attendance.justified,
                                      marginBottom: 10
                                    }]}>
                                      %
                                    </Text>
                                  </>
                                ) : (
                                  // Para el resto de semanas mostrar tendencia
                                  <>
                                    <Text variant="titleLarge" style={[styles.statNumber, { 
                                      color: getTrendColor('justified', trend.justifiedChange),
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {trend.justifiedChange > 0 ? '+' : ''}
                                      {Math.abs(limitPercentage(trend.justifiedChange)).toFixed(1)}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 4}]}>Justificadas</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: getTrendColor('justified', trend.justifiedChange),
                                      marginBottom: 10
                                    }]}>
                                      %{trend.justifiedChange !== 0 ? (trend.justifiedChange > 0 ? ' ↑' : ' ↓') : ''}
                                    </Text>
                                  </>
                                )}
                              </Card.Content>
                            </Card>
                            
                            {/* Tarjeta de Injustificadas */}
                            <Card style={[styles.statCard, { 
                              elevation: 3, 
                              minHeight: 115,
                              borderRadius: 8
                            }]}>
                              <Card.Content style={{ 
                                padding: SPACING.sm,
                                height: '100%',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flex: 1
                              }}>
                                {isWeek1 ? (
                                  // Para Semana 1 mostrar valores reales con porcentaje simplificado (estilo consistente)
                                  <>
                                    <Text variant="titleLarge" style={[styles.statNumber, { 
                                      color: COLORS.attendance.unexcused,
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {week1Data ? week1Data.total_unexcused_absences : 0}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 4}]}>Injustificadas</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: COLORS.attendance.unexcused,
                                      marginBottom: 10
                                    }]}>
                                      %
                                    </Text>
                                  </>
                                ) : (
                                  // Para el resto de semanas mostrar tendencia
                                  <>
                                    <Text variant="titleLarge" style={[styles.statNumber, { 
                                      color: getTrendColor('unjustified', trend.unjustifiedChange),
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {trend.unjustifiedChange > 0 ? '+' : ''}
                                      {Math.abs(limitPercentage(trend.unjustifiedChange)).toFixed(1)}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statLabel, {marginBottom: 4}]}>Injustificadas</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: getTrendColor('unjustified', trend.unjustifiedChange),
                                      marginBottom: 10
                                    }]}>
                                      %{trend.unjustifiedChange !== 0 ? (trend.unjustifiedChange > 0 ? ' ↑' : ' ↓') : ''}
                                    </Text>
                                  </>
                                )}
                              </Card.Content>
                            </Card>
                          </View>
                        </View>
                      );
                    });
                  })()}
                  
                  {/* Nota de porcentajes - diseño más sutil */}
                  <Text style={{
                    fontSize: 12,
                    color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
                    textAlign: 'center',
                    marginTop: SPACING.xs,
                    marginBottom: SPACING.sm,
                    fontStyle: 'italic',
                    letterSpacing: 0.2,
                    paddingHorizontal: SPACING.md
                  }}>
                    Porcentajes de cambio respecto a la semana anterior
                  </Text>
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Modal de selección de estudiante */}
        <Portal>
          <Modal
            visible={studentModalVisible}
            onDismiss={() => setStudentModalVisible(false)}
            contentContainerStyle={styles.modalContainer}
            dismissableBackButton={true}
            theme={{ colors: { backdrop: 'transparent' } }}
          >
            <Card elevation={0} style={{borderRadius: BORDER_RADIUS.lg, overflow: 'hidden'}}>
              <Card.Content style={{padding: SPACING.md}}>
                <Text style={styles.modalTitle}>Seleccionar Estudiante</Text>
                <ScrollView style={styles.studentList}>
                  {students.length > 0 ? (
                    students.map((student) => (
                      <List.Item
                        key={student.id}
                        title={`${student.first_name} ${student.last_name}`}
                        description={`${student.instrument || 'Sin instrumento'}`}
                        onPress={() => {
                          setSelectedStudent(student.id);
                          setStudentModalVisible(false);
                          setReportData(null);
                        }}
                        titleStyle={styles.studentName}
                        descriptionStyle={styles.studentDescription}
                        style={styles.studentItem}
                        left={props => <List.Icon {...props} icon="account" color={theme.colors.primary} />}
                      />
                    ))
                  ) : (
                    <Text style={{ color: theme.colors.text, textAlign: 'center', padding: SPACING.md }}>
                      No hay estudiantes disponibles
                    </Text>
                  )}
                </ScrollView>
              </Card.Content>
            </Card>
          </Modal>
        </Portal>
      </ScrollView>
    </SafeAreaView>
  );
} 