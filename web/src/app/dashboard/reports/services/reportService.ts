import { supabase } from '@/lib/supabase';

// Constantes para IDs de organización y programa
const ORGANIZATION_ID = 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4';
const PROGRAM_ID = '9d7dc91c-7bbe-49cd-bc64-755467bf91da';

// Tipos para los datos de asistencia
export type AttendanceData = {
  date: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
};

export type AttendanceByInstrument = {
  instrument: string;
  present: number;
  absent: number;
  excused: number;
  total: number;
  attendanceRate: number;
};

export type WeeklyStats = {
  weekLabel: string;
  total_attendance: number;
  total_excused_absences: number;
  total_unexcused_absences: number;
  attendance_percentage: number;
  excused_percentage: number;
  unexcused_percentage: number;
};

export type AttendanceTrend = {
  weekLabel: string;
  attendanceChange: number;
  justifiedChange: number;
  unjustifiedChange: number;
};

// Cargar estudiantes activos
export const loadStudents = async (selectedInstrument: string = 'all') => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, instrument, student_id')
      .eq('organization_id', ORGANIZATION_ID)
      .eq('program_id', PROGRAM_ID)
      .eq('is_active', true)
      .order('first_name');

    if (error) {
      console.error('Error al cargar estudiantes:', error);
      return [];
    }

    // Filtrar por instrumento si es necesario
    const filteredData = selectedInstrument === 'all' 
      ? data 
      : data.filter(student => student.instrument === selectedInstrument);

    return filteredData || [];
  } catch (error) {
    console.error('Error inesperado al cargar estudiantes:', error);
    return [];
  }
};

// Cargar instrumentos únicos
export const loadInstruments = async () => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('instrument')
      .not('instrument', 'is', null);

    if (error) {
      console.error('Error al cargar instrumentos:', error);
      return [];
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

    return sortedInstruments;
  } catch (error) {
    console.error('Error inesperado al cargar instrumentos:', error);
    return [];
  }
};

// Cargar estados de asistencia
export const loadAttendanceStatuses = async () => {
  try {
    const { data, error } = await supabase
      .from('attendance_status')
      .select('id, name, color');

    if (error) {
      console.error('Error al cargar estados de asistencia:', error);
      return {};
    }

    // Convertir a un objeto para fácil acceso por ID
    const statusMap: {[key: string]: {name: string, color: string}} = {};
    data.forEach(status => {
      statusMap[status.id] = { name: status.name, color: status.color };
    });

    return statusMap;
  } catch (error) {
    console.error('Error inesperado al cargar estados de asistencia:', error);
    return {};
  }
};

// Calcular estadísticas de asistencia
export const calculateAttendanceStats = async (
  startDate: Date, 
  endDate: Date, 
  studentId: string | null = null,
  selectedInstrument: string = 'all',
  students: any[] = []
) => {
  try {
    // Consultar asistencia sin embebidos de attendance_status para evitar ambigüedades
    // y clasificar usando directamente status_code. No necesitamos unir con students aquí
    // porque los filtros por instrumento llegan vía argumento 'students'.
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
      console.error('Error al calcular estadísticas:', error);
      throw error;
    }

    // Calcular totales
    const totals = data.reduce((acc: {[key: string]: number}, record) => {
      // Clasificar directamente por status_code (A, EA, UA). Fallback a 'UA' si no existe.
      const code = (record.status_code ? String(record.status_code).toUpperCase() : 'UA');
      acc[code] = (acc[code] || 0) + 1;
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
      unexcused_percentage: total > 0 ? (unexcused / total) * 100 : 0,
      total_records: total
    };
  } catch (error) {
    console.error('Error inesperado al calcular estadísticas:', error);
    throw error;
  }
};

// Calcular estadísticas semanales
export const calculateWeeklyStats = async (
  numberOfWeeks = 4,
  studentId: string | null = null,
  selectedInstrument: string = 'all',
  students: any[] = []
) => {
  try {
    const weeks: WeeklyStats[] = [];
    const now = new Date();
    
    // Invertimos el orden del bucle para que Semana 1 sea la más antigua
    for (let i = numberOfWeeks - 1; i >= 0; i--) {
      const endDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      
      const weekStats = await calculateAttendanceStats(
        startDate, 
        endDate, 
        studentId, 
        selectedInstrument, 
        students
      );
      
      // Cambiar el nombre de la semana más reciente (i=0) a "Semana actual"
      const weekLabel = i === 0 ? "Semana actual" : `Semana ${numberOfWeeks - i}`;
      weeks.push({
        weekLabel: weekLabel,
        ...weekStats
      });
    }
    
    return weeks;
  } catch (error) {
    console.error('Error en calculateWeeklyStats:', error);
    throw error;
  }
};

// Calcular tendencias entre semanas
export const calculateTrends = (weeklyData: WeeklyStats[]): AttendanceTrend[] => {
  if (!weeklyData || weeklyData.length === 0) return [];

  const trends: AttendanceTrend[] = [];
  
  // Agregar la Semana 1 con tendencia "N/A" o base cero
  if (weeklyData.length > 0) {
    trends.push({
      weekLabel: weeklyData[0].weekLabel,
      attendanceChange: 0,
      justifiedChange: 0,
      unjustifiedChange: 0
    });
  }
  
  // Calcular cambios porcentuales entre semanas consecutivas
  for (let i = 1; i < weeklyData.length; i++) {
    const currentWeek = weeklyData[i];
    const previousWeek = weeklyData[i-1];
    
    const attendanceChange = ((currentWeek.total_attendance - previousWeek.total_attendance) / 
                             Math.max(previousWeek.total_attendance, 1)) * 100;
    const justifiedChange = ((currentWeek.total_excused_absences - previousWeek.total_excused_absences) / 
                            Math.max(previousWeek.total_excused_absences, 1)) * 100;
    const unjustifiedChange = ((currentWeek.total_unexcused_absences - previousWeek.total_unexcused_absences) / 
                              Math.max(previousWeek.total_unexcused_absences, 1)) * 100;

    trends.push({
      weekLabel: currentWeek.weekLabel,
      attendanceChange: isFinite(attendanceChange) ? attendanceChange : 0,
      justifiedChange: isFinite(justifiedChange) ? justifiedChange : 0,
      unjustifiedChange: isFinite(unjustifiedChange) ? unjustifiedChange : 0
    });
  }

  return trends;
};

// Obtener datos de asistencia por fecha
export const getAttendanceByDate = async (
  startDate: string,
  endDate: string,
  studentId: string | null = null,
  selectedInstrument: string = 'all',
  students: any[] = []
) => {
  try {
    // Seleccionar campos planos para evitar embebidos ambiguos
    let query = supabase
      .from('attendance')
      .select('date, status_code, student_id')
      .gte('date', startDate)
      .lte('date', endDate);

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
      console.error('Error al obtener asistencia por fecha:', error);
      throw error;
    }

    // Agrupar por fecha
    const attendanceByDate: {[key: string]: {present: number, absent: number, excused: number}} = {};
    
    data.forEach(record => {
      if (!attendanceByDate[record.date]) {
        attendanceByDate[record.date] = { present: 0, absent: 0, excused: 0 };
      }
      
      // Clasificar por código directamente
      const code = record.status_code ? String(record.status_code).toUpperCase() : '';
      if (code === 'A') attendanceByDate[record.date].present += 1;
      else if (code === 'EA') attendanceByDate[record.date].excused += 1;
      else if (code === 'UA') attendanceByDate[record.date].absent += 1;
      else attendanceByDate[record.date].absent += 1; // desconocido => ausencia
    });

    // Convertir a array y calcular totales
    const result: AttendanceData[] = Object.keys(attendanceByDate).map(date => {
      const stats = attendanceByDate[date];
      const total = stats.present + stats.absent + stats.excused;
      return {
        date,
        present: stats.present,
        absent: stats.absent,
        excused: stats.excused,
        total
      };
    });

    // Ordenar por fecha
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('Error inesperado al obtener asistencia por fecha:', error);
    throw error;
  }
};

// Obtener datos de asistencia por instrumento
export const getAttendanceByInstrument = async (
  startDate: string,
  endDate: string,
  selectedInstrument: string = 'all'
) => {
  try {
    // Mantener solo el embed de students (necesario para filtrar por instrumento),
    // y quitar el embed de attendance_status. Usar status_code para clasificar.
    let query = supabase
      .from('attendance')
      .select(`
        status_code,
        students(id, first_name, last_name, instrument, is_active)
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('students.is_active', true);

    if (selectedInstrument !== 'all') {
      query = query.eq('students.instrument', selectedInstrument);
    }

    const { data: attendanceByInstrument, error: instrumentError } = await query;
    
    if (instrumentError) {
      console.error('Error al obtener asistencia por instrumento:', instrumentError);
      throw instrumentError;
    }
    
    // Procesar datos por instrumento
    const instrumentMap: {[key: string]: {present: number, absent: number, excused: number}} = {};
    
    attendanceByInstrument?.forEach(record => {
      // Acceder al instrumento de forma segura
      const instrument = record.students && typeof record.students === 'object' && 'instrument' in record.students
        ? record.students.instrument
        : 'No asignado';
      
      if (!instrumentMap[instrument]) {
        instrumentMap[instrument] = { present: 0, absent: 0, excused: 0 };
      }
      
      // Clasificar según status_code
      const code = record.status_code ? String(record.status_code).toUpperCase() : '';
      if (code === 'A') instrumentMap[instrument].present += 1;
      else if (code === 'EA') instrumentMap[instrument].excused += 1;
      else if (code === 'UA') instrumentMap[instrument].absent += 1;
      else instrumentMap[instrument].absent += 1; // desconocido => ausencia
    });

    // Convertir a array y calcular totales
    const result: AttendanceByInstrument[] = Object.keys(instrumentMap).map(instrument => {
      const stats = instrumentMap[instrument];
      const total = stats.present + stats.absent + stats.excused;
      return {
        instrument,
        present: stats.present,
        absent: stats.absent,
        excused: stats.excused,
        total,
        attendanceRate: total > 0 ? (stats.present / total) * 100 : 0
      };
    });

    // Ordenar por tasa de asistencia descendente
    return result.sort((a, b) => b.attendanceRate - a.attendanceRate);
  } catch (error) {
    console.error('Error inesperado al obtener asistencia por instrumento:', error);
    throw error;
  }
};

// Exportar datos a CSV
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;

  // Obtener encabezados
  const headers = Object.keys(data[0]);
  
  // Crear contenido CSV
  const csvContent = [
    headers.join(','), // Encabezados
    ...data.map(row => headers.map(header => {
      // Manejar valores que puedan contener comas
      const value = row[header];
      const valueStr = value === null || value === undefined ? '' : String(value);
      return valueStr.includes(',') ? `"${valueStr}"` : valueStr;
    }).join(','))
  ].join('\n');
  
  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
