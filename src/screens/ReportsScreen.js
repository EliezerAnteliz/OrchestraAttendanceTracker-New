import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  SafeAreaView, 
  TouchableOpacity, 
  Platform, 
  StatusBar 
} from 'react-native';
import { 
  Text, 
  Card, 
  Chip, 
  Button, 
  SegmentedButtons, 
  Portal, 
  Modal, 
  List, 
  Appbar, 
  Surface, 
  Icon 
} from 'react-native-paper';
import { supabase } from '../config/supabase';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { 
  COLORS, 
  SPACING, 
  TYPOGRAPHY, 
  BORDER_RADIUS, 
  SHADOWS, 
  THEME_NAMES, 
  mondayStyles 
} from '../theme';
import { useAppTheme } from '../theme';

const screenWidth = Dimensions.get('window').width;

// IDs correctos de la base de datos
const ORGANIZATION_ID = 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4';
const PROGRAM_ID = '9d7dc91c-7bbe-49cd-bc64-755467bf91da';

// Colores de asistencia para los gráficos
const ATTENDANCE_COLORS = {
  present: '#4CAF50',    // Verde
  justified: '#FF9800',  // Naranja
  unexcused: '#F44336'   // Rojo
};

export default function ReportsScreen() {
  const { theme, isDark, themeType } = useAppTheme();
  const isMondayTheme = themeType === THEME_NAMES.MONDAY;
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
    if (reportType === 'individual' && !selectedStudent) {
      // Si es un reporte individual y no hay estudiante seleccionado, mostrar error
      alert('Por favor seleccione un estudiante para generar el reporte individual');
      return;
    }

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
        reportType === 'individual' ? selectedStudent.id : null
      );

      // Actualizar el estado con los resultados
      setReportData({
        report_type: reportType,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        report_scope: reportType === 'individual' ? 'student' : 'group',
        student_id: reportType === 'individual' ? selectedStudent.id : null,
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
  const formatPercentage = (percentage) => {
    const rounded = Math.round(percentage * 10) / 10;
    return rounded.toFixed(1);
  };

  // Datos para el gráfico circular modificado
  const getPieChartData = (data) => {
    if (!data) return [];
    
    return [
        {
            name: 'Presentes',
            population: data.total_attendance || 0,
            color: ATTENDANCE_COLORS.present,
            legendFontColor: theme.colors.text
        },
        {
            name: 'Faltas Justificadas',
            population: data.total_excused_absences || 0,
            color: ATTENDANCE_COLORS.justified,
            legendFontColor: theme.colors.text
        },
        {
            name: 'Faltas Injustificadas',
            population: data.total_unexcused_absences || 0,
            color: ATTENDANCE_COLORS.unexcused,
            legendFontColor: theme.colors.text
        }
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
    backgroundGradientFrom: isMondayTheme ? theme.colors.surface : theme.colors.surface,
    backgroundGradientTo: isMondayTheme ? theme.colors.surface : theme.colors.surface,
    color: (opacity = 1) => isMondayTheme 
      ? `rgba(${parseInt(theme.colors.primary.slice(1, 3), 16)}, ${parseInt(theme.colors.primary.slice(3, 5), 16)}, ${parseInt(theme.colors.primary.slice(5, 7), 16)}, ${opacity})`
      : `rgba(33, 150, 243, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    labelColor: (opacity = 1) => theme.colors.text,
    decimalPlaces: 1,
    propsForLabels: {
      fontWeight: isMondayTheme ? '600' : '500',
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xl,
    },
    appBar: {
      backgroundColor: isMondayTheme ? theme.colors.surface : theme.colors.elevation.level1,
      elevation: isMondayTheme ? 0 : 4,
      shadowOpacity: isMondayTheme ? 0 : 0.3,
      borderBottomWidth: isMondayTheme ? 1 : 0,
      borderBottomColor: isMondayTheme ? theme.colors.outline : 'transparent'
    },
    card: {
      marginVertical: SPACING.xs,
      marginHorizontal: SPACING.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: isMondayTheme ? BORDER_RADIUS.sm : BORDER_RADIUS.md,
      ...(isMondayTheme ? {} : SHADOWS.md),
    },
    chartCard: {
      marginVertical: SPACING.xs,
      marginHorizontal: SPACING.xs,
      backgroundColor: theme.colors.surface,
      borderRadius: isMondayTheme ? BORDER_RADIUS.sm : BORDER_RADIUS.md,
      padding: SPACING.sm,
      ...(isMondayTheme ? {} : SHADOWS.md),
    },
    studentButton: {
      borderColor: theme.colors.outline,
      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
      marginTop: SPACING.xs,
    },
    studentButtonContent: {
      height: 48,
      justifyContent: 'flex-start',
    },
    section: {
      marginVertical: SPACING.xs,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: SPACING.xs,
      color: theme.colors.primary,
    },
    segmentedButtons: {
      marginTop: SPACING.xs,
      height: 40,
    },
    filterChip: {
      margin: SPACING.xs / 2,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
    },
    filtersContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      margin: -SPACING.xs / 2,
    },
    statCard: {
      flex: 1,
      marginVertical: SPACING.xxs,
      marginHorizontal: SPACING.xxs,
      backgroundColor: theme.colors.surface,
      borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
      elevation: isMondayTheme ? 0 : 2,
      borderWidth: isMondayTheme ? 1 : 0,
      borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
      padding: SPACING.xs,
    },
    statTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: 4,
      textAlign: 'center',
    },
    statValue: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginVertical: 4,
    },
    percentageValue: {
      fontSize: 16,
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      fontWeight: '500',
    },
    chartContainer: {
      width: '100%',
      marginVertical: SPACING.md,
    },
    chartContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingHorizontal: SPACING.sm,
    },
    pieContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 180,
      width: '50%',
      paddingRight: SPACING.xs,
    },
    legendContainer: {
      flexDirection: 'column',
      justifyContent: 'center',
      width: '50%',
      paddingLeft: SPACING.sm,
      alignItems: 'flex-start',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    legendColor: {
      width: 14,
      height: 14,
      borderRadius: isMondayTheme ? 2 : 7,
      marginRight: SPACING.sm,
    },
    legendText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: isMondayTheme ? '500' : '400',
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
    studentList: {
      maxHeight: 350,
    },
    studentItem: {
      paddingVertical: SPACING.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme => theme.colors.outlineVariant,
    },
    studentName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme => theme.colors.text,
    },
    studentDescription: {
      fontSize: 14,
      color: theme => theme.colors.onSurfaceVariant,
    },
    modalContainer: {
      backgroundColor: 'white',
      width: '80%',
      alignSelf: 'center',
      maxHeight: '80%',
      borderRadius: 0,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      overflow: 'hidden'
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '500',
      color: theme.colors.primary,
      marginBottom: SPACING.md,
      textAlign: 'center'
    },
    generateButton: {
      marginVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
    },
    filterSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: isMondayTheme ? 0 : BORDER_RADIUS.md,
      borderWidth: isMondayTheme ? 1 : 0,
      borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
      elevation: isMondayTheme ? 0 : 1,
      overflow: 'hidden',
      marginBottom: SPACING.md,
    },
    filterTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xs,
    },
  });

  // Estilos para los chips de filtro
  const getChipStyle = (isSelected) => [
    styles.filterChip,
    isMondayTheme && {
      backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.surface,
      borderWidth: 1,
      borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
      borderRadius: BORDER_RADIUS.xs
    }
  ];

  // Obtiene el estilo del texto para los chips
  const getChipTextStyle = (isSelected) => ({ 
    color: isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant,
    fontWeight: isSelected && isMondayTheme ? '600' : '400'
  });

  // Renderizar la sección de selección de estudiante
  const renderStudentSelector = () => (
    <Surface 
      style={{
        width: '100%',
        marginBottom: SPACING.md,
        borderRadius: 0,
        borderWidth: 1,
        borderColor: theme.colors.outline,
        elevation: 0,
        overflow: 'hidden'
      }}
    >
      <View
        style={{
          height: 56,
          width: '100%',
          flexDirection: 'row',
        }}
      >
        {/* Área izquierda - Reporte Individual */}
        <TouchableOpacity
          onPress={() => {
            setReportType('individual');
            setSelectedStudent(null);
            setReportData(null);
          }}
          style={{
            width: '33%',
            backgroundColor: reportType === 'individual' ? theme.colors.primary : '#f0f0f5',
            justifyContent: 'center',
            alignItems: 'center',
            borderRightWidth: 1,
            borderRightColor: theme.colors.outline,
          }}
        >
          <Icon 
            source="account" 
            size={22} 
            color={reportType === 'individual' ? 'white' : theme.colors.primary} 
            style={{marginBottom: 2}} 
          />
          <Text style={{
            color: reportType === 'individual' ? 'white' : theme.colors.primary,
            fontSize: 13,
            fontWeight: '500'
          }}>
            Individual
          </Text>
        </TouchableOpacity>

        {/* Área central - Icono de Reporte */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            paddingHorizontal: 12,
            backgroundColor: 'white',
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderLeftColor: theme.colors.outline,
            borderRightColor: theme.colors.outline,
          }}
        >
          <Icon 
            source="file-chart" 
            size={28} 
            color={theme.colors.primary} 
          />
          <Text style={{ 
            color: theme.colors.primary,
            fontSize: 16,
            fontWeight: '500',
            marginLeft: 8
          }}>
            Reportes
          </Text>
        </View>
        
        {/* Área derecha - Reporte Grupal */}
        <TouchableOpacity
          onPress={() => {
            setReportType('group');
            setReportData(null);
          }}
          style={{
            width: '33%',
            backgroundColor: reportType === 'group' ? theme.colors.primary : '#f0f0f5',
            justifyContent: 'center',
            alignItems: 'center',
            borderLeftWidth: 1,
            borderLeftColor: theme.colors.outline,
          }}
        >
          <Icon 
            source="account-group" 
            size={22} 
            color={reportType === 'group' ? 'white' : theme.colors.primary} 
            style={{marginBottom: 2}} 
          />
          <Text style={{
            color: reportType === 'group' ? 'white' : theme.colors.primary,
            fontSize: 13,
            fontWeight: '500'
          }}>
            Grupal
          </Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );

  const renderStatCard = (title, value, percentage, color) => (
    <Card 
      style={[
        styles.statCard, 
        isMondayTheme && mondayStyles.card(theme)
      ]} 
      elevation={isMondayTheme ? 0 : 2}
    >
      <Card.Content style={{ padding: SPACING.sm, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statValue, { color: color || theme.colors.primary }]}>
          {value}
        </Text>
        {percentage !== undefined && (
          <Text style={[styles.percentageValue, { color: color || theme.colors.onSurfaceVariant }]}>
            {percentage}%
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  // Renderizar el modal de selección de estudiante
  const renderStudentModal = () => (
    <Portal>
      <Modal
        visible={studentModalVisible}
        onDismiss={() => setStudentModalVisible(false)}
        contentContainerStyle={{
          backgroundColor: 'white',
          width: '80%',
          alignSelf: 'center',
          maxHeight: '80%',
          borderRadius: 0, 
          borderWidth: 1,
          borderColor: theme.colors.outline,
          overflow: 'hidden'
        }}
      >
        <ScrollView style={{ paddingTop: 8 }}>
          {students.map(student => (
            <TouchableOpacity
              key={student.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f5',
                backgroundColor: selectedStudent && selectedStudent.id === student.id ? `${theme.colors.primary}15` : 'transparent'
              }}
              onPress={() => {
                setSelectedStudent(student);
                setStudentModalVisible(false);
                setReportData(null);
              }}
            >
              <Icon 
                source="account" 
                size={24} 
                color={theme.colors.primary} 
                style={{ marginRight: 12 }} 
              />
              <View style={{ paddingLeft: 20 }}>
                <Text style={{ 
                  fontWeight: '500',
                  fontSize: 16,
                  color: theme.colors.text
                }}>
                  {student.first_name} {student.last_name}
                </Text>
                <Text style={{ 
                  fontSize: 14,
                  color: theme.colors.outline,
                  marginTop: 2
                }}>
                  {student.instrument || 'Not assigned'}
                </Text>
              </View>
              {selectedStudent && selectedStudent.id === student.id && (
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Icon 
                    source="check-circle" 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <TouchableOpacity
          style={{
            padding: 16,
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: theme.colors.outline,
          }}
          onPress={() => setStudentModalVisible(false)}
        >
          <Text style={{ 
            color: theme.colors.primary,
            fontWeight: '500'
          }}>
            Cancelar
          </Text>
        </TouchableOpacity>
      </Modal>
    </Portal>
  );

  // Renderizar la sección de reportes de grupo
  const renderGroupFilters = () => (
    <Card 
      style={[
        styles.card, 
        isMondayTheme && mondayStyles.card(theme)
      ]} 
      elevation={isMondayTheme ? 0 : 1}
    >
      <Card.Content>
        <Text style={[styles.sectionTitle, isMondayTheme && { color: theme.colors.primary }]}>
          Filtros de Grupo
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          <Chip 
            selected={selectedInstrument === 'all'} 
            onPress={() => setSelectedInstrument('all')}
            style={[
              styles.filterChip,
              isMondayTheme && {
                backgroundColor: selectedInstrument === 'all' 
                  ? theme.colors.primary + '20' : theme.colors.surface
              }
            ]}
            textStyle={{ 
              color: selectedInstrument === 'all' ? 
                theme.colors.primary : theme.colors.onSurfaceVariant 
            }}
          >
            Todos
          </Chip>
          
          {instruments.map(instrument => (
            <Chip
              key={instrument}
              selected={selectedInstrument === instrument}
              onPress={() => setSelectedInstrument(instrument)}
              style={[
                styles.filterChip,
                isMondayTheme && {
                  backgroundColor: selectedInstrument === instrument ? 
                    theme.colors.primary + '20' : theme.colors.surface
                }
              ]}
              textStyle={{ 
                color: selectedInstrument === instrument ? 
                  theme.colors.primary : theme.colors.onSurfaceVariant 
              }}
            >
              {instrument}
            </Chip>
          ))}
        </ScrollView>
      </Card.Content>
    </Card>
  );

  // Renderizar la sección de gráficos
  const renderChart = () => {
    // Solo renderizar si tenemos datos
    if (!reportData) return null;
    
    const chartData = getPieChartData(reportData);
    
    return (
      <Card 
        style={[
          styles.chartCard, 
          isMondayTheme && mondayStyles.card(theme)
        ]} 
        elevation={isMondayTheme ? 0 : 2}
      >
        <Card.Title
          title="Resumen de Asistencia"
          titleStyle={{
            color: theme.colors.primary,
            fontWeight: isMondayTheme ? '600' : '500',
            fontSize: 16
          }}
        />
        <Card.Content>
          <View style={styles.chartContainer}>
            <View style={styles.chartContent}>
              <View style={[
                styles.pieContainer, 
                isMondayTheme && { borderRadius: BORDER_RADIUS.sm }
              ]}>
                <PieChart
                  data={chartData}
                  width={screenWidth * 0.45}
                  height={180}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => theme.colors.text,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  absolute={false}
                  hasLegend={false}
                  paddingLeft={screenWidth * 0.06}
                />
              </View>
              
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: ATTENDANCE_COLORS.present }]} />
                  <Text style={styles.legendText}>{reportData.total_attendance} Asistencias</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: ATTENDANCE_COLORS.justified }]} />
                  <Text style={styles.legendText}>{reportData.total_excused_absences} Faltas Justificadas</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: ATTENDANCE_COLORS.unexcused }]} />
                  <Text style={styles.legendText}>{reportData.total_unexcused_absences} Faltas Injustificadas</Text>
                </View>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Renderizar el botón de generación de reporte
  const renderGenerateButton = () => (
    <Button
      mode={isMondayTheme ? "outlined" : "contained"}
      icon="chart-bar"
      onPress={generateReport}
      style={[
        styles.generateButton,
        isMondayTheme ? {
          borderColor: theme.colors.primary,
          borderWidth: 2,
          backgroundColor: 'transparent',
          elevation: 0
        } : {
          backgroundColor: theme.colors.primary,
          elevation: 2
        }
      ]}
      contentStyle={{ height: 48 }}
      labelStyle={{ 
        fontSize: 16, 
        fontWeight: '600',
        color: isMondayTheme ? theme.colors.primary : theme.colors.onPrimary
      }}
      loading={loading}
      disabled={loading || (reportType === 'individual' && !selectedStudent)}
    >
      Generar Reporte
    </Button>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Cabecera con tipo de reporte - estructura como AttendanceRegistrationScreen */}
        <Surface
          style={{
            width: '100%',
            marginBottom: SPACING.md,
            marginTop: Platform.OS === 'ios' ? 35 : 45,
            borderRadius: 0,
            borderWidth: 1,
            borderColor: theme.colors.outline,
            elevation: 0,
            overflow: 'hidden'
          }}
        >
          <View
            style={{
              height: 56,
              width: '100%',
              flexDirection: 'row',
            }}
          >
            {/* Área izquierda - Reporte Individual */}
            <TouchableOpacity
              onPress={() => {
                setReportType('individual');
                setSelectedStudent(null);
                setReportData(null);
              }}
              style={{
                width: '33%',
                backgroundColor: reportType === 'individual' ? theme.colors.primary : '#f0f0f5',
                justifyContent: 'center',
                alignItems: 'center',
                borderRightWidth: 1,
                borderRightColor: theme.colors.outline,
              }}
            >
              <Icon 
                source="account" 
                size={22} 
                color={reportType === 'individual' ? 'white' : theme.colors.primary} 
                style={{marginBottom: 2}} 
              />
              <Text style={{
                color: reportType === 'individual' ? 'white' : theme.colors.primary,
                fontSize: 13,
                fontWeight: '500'
              }}>
                Individual
              </Text>
            </TouchableOpacity>

            {/* Área central - Icono de Reporte */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                paddingHorizontal: 12,
                backgroundColor: 'white',
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderLeftColor: theme.colors.outline,
                borderRightColor: theme.colors.outline,
              }}
            >
              <Icon 
                source="file-chart" 
                size={28} 
                color={theme.colors.primary} 
              />
              <Text style={{ 
                color: theme.colors.primary,
                fontSize: 16,
                fontWeight: '500',
                marginLeft: 8
              }}>
                Reportes
              </Text>
            </View>
            
            {/* Área derecha - Reporte Grupal */}
            <TouchableOpacity
              onPress={() => {
                setReportType('group');
                setReportData(null);
              }}
              style={{
                width: '33%',
                backgroundColor: reportType === 'group' ? theme.colors.primary : '#f0f0f5',
                justifyContent: 'center',
                alignItems: 'center',
                borderLeftWidth: 1,
                borderLeftColor: theme.colors.outline,
              }}
            >
              <Icon 
                source="account-group" 
                size={22} 
                color={reportType === 'group' ? 'white' : theme.colors.primary} 
                style={{marginBottom: 2}} 
              />
              <Text style={{
                color: reportType === 'group' ? 'white' : theme.colors.primary,
                fontSize: 13,
                fontWeight: '500'
              }}>
                Grupal
              </Text>
            </TouchableOpacity>
          </View>
        </Surface>
        
        {reportType === 'individual' && (
          <Surface 
            style={{
              width: '100%',
              marginBottom: SPACING.md,
              borderRadius: 0,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              elevation: 0,
              overflow: 'hidden'
            }}
          >
            <View
              style={{
                height: 56,
                width: '100%',
                flexDirection: 'row',
                backgroundColor: theme.colors.primary, // Color azul
              }}
            >
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '500',
                }}>
                  Estudiante
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              onPress={() => setStudentModalVisible(true)}
              style={{
                height: 56,
                paddingHorizontal: SPACING.md,
                justifyContent: 'flex-start',
                alignItems: 'center',
                backgroundColor: '#f0f0f5',
                flexDirection: 'row',
                borderTopWidth: 1,
                borderTopColor: theme.colors.outline,
              }}
            >
              <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Icon 
                  source={selectedStudent ? "account-check" : "account-plus"} 
                  size={22} 
                  color={theme.colors.primary} 
                />
              </View>
              <Text style={{ 
                color: selectedStudent ? theme.colors.text : '#666666',
                fontSize: 15,
                fontWeight: selectedStudent ? '500' : '400',
                marginLeft: 16
              }}>
                {selectedStudent ? 
                  `${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : 'Seleccionar Estudiante'
                }
              </Text>
            </TouchableOpacity>
          </Surface>
        )}
        
        {/* Selector de período - Estilo similar a la cabecera */}
        <Surface 
          style={{
            width: '100%',
            marginBottom: SPACING.md,
            borderRadius: 0,
            borderWidth: 1,
            borderColor: theme.colors.outline,
            elevation: 0,
            overflow: 'hidden'
          }}
        >
          <View
            style={{
              height: 56,
              width: '100%',
              flexDirection: 'row',
            }}
          >
            {/* Período Semanal */}
            <TouchableOpacity
              onPress={() => {
                setPeriodType('week');
                setReportData(null);
              }}
              style={{
                flex: 1,
                backgroundColor: periodType === 'week' ? theme.colors.primary : '#f0f0f5',
                justifyContent: 'center',
                alignItems: 'center',
                borderRightWidth: 1,
                borderRightColor: theme.colors.outline,
              }}
            >
              <Icon 
                source="calendar-week" 
                size={22} 
                color={periodType === 'week' ? 'white' : theme.colors.primary} 
                style={{marginBottom: 2}} 
              />
              <Text style={{
                color: periodType === 'week' ? 'white' : theme.colors.primary,
                fontSize: 13,
                fontWeight: '500'
              }}>
                Semanal
              </Text>
            </TouchableOpacity>

            {/* Período Mensual */}
            <TouchableOpacity
              onPress={() => {
                setPeriodType('month');
                setReportData(null);
              }}
              style={{
                flex: 1,
                backgroundColor: periodType === 'month' ? theme.colors.primary : '#f0f0f5',
                justifyContent: 'center',
                alignItems: 'center',
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderLeftColor: theme.colors.outline,
                borderRightColor: theme.colors.outline,
              }}
            >
              <Icon 
                source="calendar-month" 
                size={22} 
                color={periodType === 'month' ? 'white' : theme.colors.primary} 
                style={{marginBottom: 2}} 
              />
              <Text style={{
                color: periodType === 'month' ? 'white' : theme.colors.primary,
                fontSize: 13,
                fontWeight: '500'
              }}>
                Mensual
              </Text>
            </TouchableOpacity>
            
            {/* Período Anual */}
            <TouchableOpacity
              onPress={() => {
                setPeriodType('year');
                setReportData(null);
              }}
              style={{
                flex: 1,
                backgroundColor: periodType === 'year' ? theme.colors.primary : '#f0f0f5',
                justifyContent: 'center',
                alignItems: 'center',
                borderLeftWidth: 1,
                borderLeftColor: theme.colors.outline,
              }}
            >
              <Icon 
                source="calendar-today" 
                size={22} 
                color={periodType === 'year' ? 'white' : theme.colors.primary} 
                style={{marginBottom: 2}} 
              />
              <Text style={{
                color: periodType === 'year' ? 'white' : theme.colors.primary,
                fontSize: 13,
                fontWeight: '500'
              }}>
                Anual
              </Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {/* Filtro de instrumentos - con diseño mejorado */}
        <Surface 
          style={{
            width: '100%',
            marginBottom: SPACING.md,
            borderRadius: 0,
            borderWidth: 1,
            borderColor: theme.colors.outline,
            elevation: 0,
            overflow: 'hidden'
          }}
        >
          <View style={{
            paddingHorizontal: SPACING.md,
            paddingTop: SPACING.sm,
            paddingBottom: SPACING.xs
          }}>
            <Text style={{ 
              color: theme.colors.onSurfaceVariant,
              fontSize: 15,
              fontWeight: '500'
            }}>
              Filtrar por Instrumento
            </Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ 
              paddingHorizontal: SPACING.md, 
              paddingBottom: SPACING.sm,
              paddingTop: SPACING.xs
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: selectedInstrument === 'all' 
                  ? '#e8e0ff' : '#F5F5F5',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginRight: 10,
                minWidth: 80,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0,
                borderWidth: 1,
                borderColor: selectedInstrument === 'all' 
                  ? theme.colors.primary
                  : theme.colors.outline,
                elevation: 0,
              }}
              onPress={() => setSelectedInstrument('all')}
              activeOpacity={0.7}
            >
              <Text style={{
                color: selectedInstrument === 'all' ? theme.colors.primary : theme.colors.onSurfaceVariant,
                fontWeight: selectedInstrument === 'all' ? '600' : '400',
                fontSize: 14,
                textAlign: 'center'
              }}>
                Todos
              </Text>
            </TouchableOpacity>
            
            {instruments.map(instrument => (
              <TouchableOpacity
                key={instrument}
                style={{
                  backgroundColor: selectedInstrument === instrument 
                    ? '#e8e0ff' : '#F5F5F5',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  marginRight: 10,
                  minWidth: 80,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 0,
                  borderWidth: 1,
                  borderColor: selectedInstrument === instrument 
                    ? theme.colors.primary
                    : theme.colors.outline,
                  elevation: 0,
                }}
                onPress={() => setSelectedInstrument(instrument)}
                activeOpacity={0.7}
              >
                <Text style={{
                  color: selectedInstrument === instrument ? theme.colors.primary : theme.colors.onSurfaceVariant,
                  fontWeight: selectedInstrument === instrument ? '600' : '400',
                  fontSize: 14,
                  textAlign: 'center'
                }}>
                  {instrument}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Surface>

        {/* Botón de Generar Reporte */}
        <View style={{
          alignItems: 'center',
          marginBottom: SPACING.md
        }}>
          <Button
            mode="outlined"
            icon="chart-bar"
            onPress={generateReport}
            style={{
              height: 50,
              borderRadius: 0,
              borderWidth: 2,
              borderColor: theme.colors.primary,
              backgroundColor: 'transparent',
              width: '60%'
            }}
            contentStyle={{
              height: 50
            }}
            labelStyle={{ 
              fontSize: 16, 
              fontWeight: '600',
              color: theme.colors.primary
            }}
            loading={loading}
            disabled={loading || (reportType === 'individual' && !selectedStudent)}
          >
            Generar Reporte
          </Button>
        </View>

        {/* Área para mostrar el reporte */}
        {reportData && (
          <Card style={[styles.card, { marginTop: SPACING.md }]} mode="elevated">
            <Card.Content style={{ padding: SPACING.md }}>
              {/* Período del reporte */}
              <Text style={[styles.periodText, { fontSize: 18, fontWeight: '500', textAlign: 'center' }]}>
                Período: {formatDate(reportData.start_date)} - {formatDate(reportData.end_date)}
              </Text>

              {/* Totales en cards individuales */}
              <View style={[styles.statsGrid, { marginVertical: SPACING.md }]}>
                {renderStatCard(
                  'Asistencias', 
                  reportData.total_attendance, 
                  formatPercentage(reportData.attendance_percentage),
                  ATTENDANCE_COLORS.present
                )}
                {renderStatCard(
                  'Faltas Justificadas', 
                  reportData.total_excused_absences,
                  formatPercentage(reportData.excused_percentage),
                  ATTENDANCE_COLORS.justified
                )}
                {renderStatCard(
                  'Faltas Injustificadas', 
                  reportData.total_unexcused_absences,
                  formatPercentage(reportData.unexcused_percentage),
                  ATTENDANCE_COLORS.unexcused
                )}
              </View>

              {/* Gráfico circular */}
              <View style={styles.chartContainer}>
                {/* Implementación personalizada del gráfico y leyenda */}
                <View style={styles.chartContent}>
                  {/* Gráfico a la izquierda */}
                  <View style={[
                    styles.pieContainer, 
                    isMondayTheme && { borderRadius: BORDER_RADIUS.sm }
                  ]}>
                    <PieChart
                      data={getPieChartData(reportData)}
                      width={screenWidth * 0.45}
                      height={180}
                      chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => theme.colors.text,
                      }}
                      accessor="population"
                      backgroundColor="transparent"
                      absolute={false}
                      hasLegend={false}
                      paddingLeft={screenWidth * 0.06}
                    />
                  </View>
                  
                  {/* Leyenda a la derecha */}
                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: ATTENDANCE_COLORS.present }]} />
                      <Text style={styles.legendText}>{reportData.total_attendance} Asistencias</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: ATTENDANCE_COLORS.justified }]} />
                      <Text style={styles.legendText}>{reportData.total_excused_absences} Faltas Justificadas</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: ATTENDANCE_COLORS.unexcused }]} />
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
                                  backgroundColor: ATTENDANCE_COLORS.present,
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
                                      color: isDark ? '#ffffff' : ATTENDANCE_COLORS.present,
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
                                  backgroundColor: ATTENDANCE_COLORS.justified,
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
                                      color: isDark ? '#ffffff' : ATTENDANCE_COLORS.justified,
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
                                  backgroundColor: ATTENDANCE_COLORS.unexcused,
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
                                      color: isDark ? '#ffffff' : ATTENDANCE_COLORS.unexcused,
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
                        <View style={{width: 12, height: 12, backgroundColor: ATTENDANCE_COLORS.present, marginRight: 5, borderRadius: 2}} />
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}>Asistencias</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 5}}>
                        <View style={{width: 12, height: 12, backgroundColor: ATTENDANCE_COLORS.justified, marginRight: 5, borderRadius: 2}} />
                        <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}>Justificadas</Text>
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
                        <View style={{width: 12, height: 12, backgroundColor: ATTENDANCE_COLORS.unexcused, marginRight: 5, borderRadius: 2}} />
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
                        return value > 0 ? ATTENDANCE_COLORS.present : value < 0 ? ATTENDANCE_COLORS.unexcused : 
                          isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
                      } else if (type === 'justified') {
                        return value <= 0 ? ATTENDANCE_COLORS.present : ATTENDANCE_COLORS.justified;
                      } else { // unjustified
                        return value <= 0 ? ATTENDANCE_COLORS.present : ATTENDANCE_COLORS.unexcused;
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
                                    <Text variant="titleLarge" style={[styles.statValue, { 
                                      color: ATTENDANCE_COLORS.present,
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {week1Data ? week1Data.total_attendance : 0}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statTitle, {marginBottom: 4}]}>Asistencias</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: ATTENDANCE_COLORS.present,
                                      marginBottom: 10
                                    }]}>
                                      %
                                    </Text>
                                  </>
                                ) : (
                                  // Para el resto de semanas mostrar tendencia
                                  <>
                                    <Text variant="titleLarge" style={[styles.statValue, { 
                                      color: getTrendColor('attendance', trend.attendanceChange),
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {trend.attendanceChange > 0 ? '+' : ''}
                                      {Math.abs(limitPercentage(trend.attendanceChange)).toFixed(1)}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statTitle, {marginBottom: 4}]}>Asistencias</Text>
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
                                    <Text variant="titleLarge" style={[styles.statValue, { 
                                      color: ATTENDANCE_COLORS.justified,
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {week1Data ? week1Data.total_excused_absences : 0}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statTitle, {marginBottom: 4}]}>Justificadas</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: ATTENDANCE_COLORS.justified,
                                      marginBottom: 10
                                    }]}>
                                      %
                                    </Text>
                                  </>
                                ) : (
                                  // Para el resto de semanas mostrar tendencia
                                  <>
                                    <Text variant="titleLarge" style={[styles.statValue, { 
                                      color: getTrendColor('justified', trend.justifiedChange),
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {trend.justifiedChange > 0 ? '+' : ''}
                                      {Math.abs(limitPercentage(trend.justifiedChange)).toFixed(1)}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statTitle, {marginBottom: 4}]}>Justificadas</Text>
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
                                    <Text variant="titleLarge" style={[styles.statValue, { 
                                      color: ATTENDANCE_COLORS.unexcused,
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {week1Data ? week1Data.total_unexcused_absences : 0}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statTitle, {marginBottom: 4}]}>Injustificadas</Text>
                                    <Text style={[styles.percentageValue, { 
                                      color: ATTENDANCE_COLORS.unexcused,
                                      marginBottom: 10
                                    }]}>
                                      %
                                    </Text>
                                  </>
                                ) : (
                                  // Para el resto de semanas mostrar tendencia
                                  <>
                                    <Text variant="titleLarge" style={[styles.statValue, { 
                                      color: getTrendColor('unjustified', trend.unjustifiedChange),
                                      fontSize: 24,
                                      marginTop: 10,
                                      marginBottom: 4
                                    }]}>
                                      {trend.unjustifiedChange > 0 ? '+' : ''}
                                      {Math.abs(limitPercentage(trend.unjustifiedChange)).toFixed(1)}
                                    </Text>
                                    <Text variant="bodyMedium" style={[styles.statTitle, {marginBottom: 4}]}>Injustificadas</Text>
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
        {renderStudentModal()}
      </ScrollView>
    </SafeAreaView>
  );
}