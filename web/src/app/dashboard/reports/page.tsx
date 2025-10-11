'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { MdPieChart, MdPerson, MdGroups, MdCalendarMonth, MdDownload, MdWarning, MdClose, MdEmail } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { es as esLocale, enUS } from 'date-fns/locale';
import { useProgram } from '@/contexts/ProgramContext';
import { useUserRole } from '@/hooks/useUserRole';

// Registrar locales para react-datepicker (forzar que la semana empiece en lunes)
const enMonday: typeof enUS = {
  ...enUS,
  options: {
    ...(enUS as any).options,
    weekStartsOn: 1,
  },
} as any;
const esMonday: typeof esLocale = {
  ...esLocale,
  options: {
    ...(esLocale as any).options,
    weekStartsOn: 1,
  },
} as any;
registerLocale('es-mon', esMonday);
registerLocale('en-mon', enMonday);

// Componentes básicos
const LoadingIndicator = ({ message }: { message?: string }) => {
  const { t } = useI18n();
  const msg = message ?? t('loading');
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-600">{msg}</p>
    </div>
  );
};

const ErrorDisplay = ({ message, severity = 'error' }: { message: string, severity?: 'error' | 'warning' }) => (
  <div className={`p-4 rounded-md ${severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
    <div className="flex items-center">
      <MdPieChart className="mr-2" />
      <p>{message}</p>
    </div>
  </div>
);

const NoDataDisplay = ({ message }: { message?: string }) => {
  const { t } = useI18n();
  const msg = message ?? t('no_data_available');
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-md">
      <p className="text-gray-500">{msg}</p>
    </div>
  );
};

// Interfaces
interface Student {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  instrument: string;
}

interface AttendanceStats {
  total_attendance: number;
  total_excused_absences: number;
  total_unexcused_absences: number;
  attendance_percentage: number;
  excused_percentage: number;
  unexcused_percentage: number;
  total: number;
}

// Componente principal
export default function ReportsPage() {
  const { t, lang } = useI18n();
  const { activeProgram } = useProgram();
  const { isAdmin } = useUserRole();
  // Estados
  const [unexcusedAbsencesModalVisible, setUnexcusedAbsencesModalVisible] = useState(false);
  const [unexcusedStudents, setUnexcusedStudents] = useState<Array<{student: Student, absences: number, parentInfo: any, dates: string[]}>>([]);
  const [loadingUnexcused, setLoadingUnexcused] = useState(false);
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);
  const [emailPreviewVisible, setEmailPreviewVisible] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState<{to: string, subject: string, body: string, studentItem: any} | null>(null);
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [selectedReportDate, setSelectedReportDate] = useState<Date>(() => {
    // Por defecto, ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'individual' | 'group'>('group');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reportData, setReportData] = useState<AttendanceStats | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [studentModalVisible, setStudentModalVisible] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [period, setPeriod] = useState<'current' | 'previous' | 'custom'>('custom');
  const [granularity, setGranularity] = useState<'monthly' | 'weekly' | 'annual'>('monthly');
  const [customMonth, setCustomMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`; // YYYY-MM
  });
  // Refs for old native inputs are no longer needed after migration to react-datepicker
  const [instrumentFilter, setInstrumentFilter] = useState<string>('all');
  // const weekInputRef = useRef<HTMLInputElement | null>(null);
  // Tendencia semanal (últimas 4 semanas)
  const [weeklyTrend, setWeeklyTrend] = useState<Array<{ week: string; label: string; percentage: number }>>([]);
  const [trendDirection, setTrendDirection] = useState<'up' | 'down' | 'flat'>('flat');
  // Desglose anual por mes (Sep-May)
  const [annualBreakdown, setAnnualBreakdown] = useState<Array<{ key: string; label: string; a: number; ea: number; ua: number; total: number }>>([]);

  // Año académico base (septiembre a mayo). Si estamos en septiembre o después, el año es el actual; de lo contrario, el anterior.
  const defaultAcademicYear = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0=ene ... 8=sep
    return m >= 8 ? y : y - 1;
  })();
  const [academicYear, setAcademicYear] = useState<number>(defaultAcademicYear);

  // Semana ISO actual (YYYY-Www)
  const getISOWeekString = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
    const weekStr = String(weekNo).padStart(2, '0');
    return `${d.getUTCFullYear()}-W${weekStr}`;
  };
  const [customWeek, setCustomWeek] = useState<string>(() => getISOWeekString(new Date()));

  // Rango y etiqueta para Año Académico (septiembre a mayo)
  const getAcademicYearRange = (yearStart: number) => {
    // del 1 de septiembre de yearStart al 31 de mayo de yearStart+1 (inclusive)
    const firstDay = new Date(yearStart, 8, 1); // sep=8
    const lastDay = new Date(yearStart + 1, 4, 31); // may=4
    // Asegurar que lastDay sea el último día de mayo (por si 31 no existe en algún calendario/localidad)
    lastDay.setMonth(5, 0); // mueve a 0 de junio => último día de mayo
    return { firstDay, lastDay };
  };

  const formatAcademicYearLabel = (yearStart: number) => {
    const start = new Date(yearStart, 8, 1); // September 1st
    const end = new Date(yearStart + 1, 4, 31); // May (adjust below)
    end.setMonth(5, 0); // last day of May
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
    const startLabel = start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const endLabel = end.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    // Capitalize first letter for consistency with UI style
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return `${cap(startLabel)} - ${cap(endLabel)}`;
  };

  // Lista de instrumentos únicos a partir de los estudiantes activos
  const instruments = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.instrument && s.instrument.trim()) set.add(s.instrument.trim());
    });
    const locale = lang === 'en' ? 'en' : 'es';
    return Array.from(set).sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }));
  }, [students, lang]);

  // openMonthPicker no es necesario con react-datepicker

  // Rango de una semana ISO (lunes a domingo)
  const getISOWeekRange = (isoWeek: string) => {
    // isoWeek: YYYY-Www
    const [yStr, wStr] = isoWeek.split('-W');
    const year = parseInt(yStr, 10);
    const week = parseInt(wStr, 10);
    // Jueves de la semana ISO 1
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay();
    const ISOweekStart = new Date(simple);
    let diff = dayOfWeek <= 4 ? dayOfWeek - 1 : dayOfWeek - 8; // Lunes=1
    ISOweekStart.setUTCDate(simple.getUTCDate() - diff);
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setUTCDate(ISOweekStart.getUTCDate() + 6);
    // Pasar a fechas locales sin hora para consulta
    const firstDay = new Date(ISOweekStart.getUTCFullYear(), ISOweekStart.getUTCMonth(), ISOweekStart.getUTCDate());
    const lastDay = new Date(ISOweekEnd.getUTCFullYear(), ISOweekEnd.getUTCMonth(), ISOweekEnd.getUTCDate());
    return { firstDay, lastDay };
  };

  const formatWeekLabel = (isoWeek: string) => {
    const { firstDay, lastDay } = getISOWeekRange(isoWeek);
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
    const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    return `${fmt(firstDay)} - ${fmt(lastDay)}`;
  };


  // Utilidades de período
  const getPeriodDates = (p: 'current' | 'previous' | 'custom', monthStr?: string) => {
    const now = new Date();
    if (p === 'current') {
      return {
        firstDay: new Date(now.getFullYear(), now.getMonth(), 1),
        lastDay: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    }
    if (p === 'custom' && monthStr) {
      const [yearStr, monthOnly] = monthStr.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthOnly, 10) - 1; // 0-based
      return {
        firstDay: new Date(year, month, 1),
        lastDay: new Date(year, month + 1, 0),
      };
    }
    // previous month
    return {
      firstDay: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      lastDay: new Date(now.getFullYear(), now.getMonth(), 0),
    };
  };

  const formatMonthLabel = (p: 'current' | 'previous' | 'custom', monthStr?: string) => {
    const { firstDay } = getPeriodDates(p, monthStr);
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
    return firstDay.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  // Cargar estudiantes al inicio
  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        if (!activeProgram?.id) {
          setStudents([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, instrument')
          .eq('is_active', true)
          .eq('program_id', activeProgram.id);

        if (error) throw error;

        const formattedStudents = data.map(student => ({
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          first_name: student.first_name,
          last_name: student.last_name,
          instrument: student.instrument
        }));

        setStudents(formattedStudents);
      } catch (err) {
        console.error('Error al cargar estudiantes:', err);
        setError(t('couldnt_load_students_try_again'));
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [activeProgram?.id]);

  // Generar reporte
  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      setReportError(null);
      if (!activeProgram?.id) {
        setReportError(t('no_active_program') || 'No hay sede activa seleccionada.');
        return;
      }

      // Obtener rango de fechas según granularidad
      const { firstDay, lastDay } =
        granularity === 'monthly'
          ? getPeriodDates(period, customMonth)
          : granularity === 'weekly'
            ? getISOWeekRange(customWeek)
            : getAcademicYearRange(academicYear);
      
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      
      console.log('Generando reporte para período:', { startDate, endDate, granularity });
      
      // Construir la consulta para obtener datos de asistencia sin usar relaciones
      console.log('Consultando datos de asistencia con enfoque simple...');
      
      let attendanceRecords: any[] | null = null;
      
      try {
        // Primero obtenemos los registros de asistencia sin relaciones
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('program_id', activeProgram.id);
        
        if (error) {
          console.error('Error al consultar datos de asistencia:', error);
          throw new Error(`Error al consultar datos: ${error.message || 'Error desconocido'}`);
        }
        
        console.log(`Datos obtenidos: ${data?.length || 0} registros`);
        console.log('Muestra de datos:', data?.slice(0, 2));
        
        // Filtrar por estudiante si es reporte individual
        if (reportType === 'individual' && selectedStudent) {
          attendanceRecords = data?.filter(record => record.student_id === selectedStudent.id) || [];
          console.log(`Datos filtrados para estudiante ${selectedStudent.name}: ${attendanceRecords.length} registros`);
        } else {
          attendanceRecords = data || [];
        }

        // Filtro por instrumento (solo aplica para reporte grupal)
        if (reportType === 'group' && instrumentFilter !== 'all') {
          const allowedIds = new Set(
            students.filter(s => s.instrument?.trim() === instrumentFilter).map(s => s.id)
          );
          const before = attendanceRecords.length;
          attendanceRecords = attendanceRecords.filter(r => allowedIds.has(r.student_id));
          console.log(`Filtro por instrumento '${instrumentFilter}': ${before} -> ${attendanceRecords.length}`);
        }
        
        // Ahora obtenemos los estados de asistencia para mapearlos
        const { data: statusData, error: statusError } = await supabase
          .from('attendance_status')
          .select('*');
          
        if (!statusError && statusData) {
          console.log('Estados de asistencia obtenidos:', statusData);
          
          // Mapeamos los estados a los registros
          attendanceRecords = attendanceRecords.map(record => {
            // Intentamos encontrar el estado por status_code
            const statusMatch = statusData.find(s => s.code === record.status_code);
            return {
              ...record,
              attendance_status: statusMatch || null
            };
          });
        } else {
          console.warn('No se pudieron obtener los estados de asistencia:', statusError);
        }
      } catch (err: any) {
        console.error('Error en la consulta:', err);
        throw new Error(`Error al consultar datos: ${err.message || 'Error desconocido'}`);
      }
      
      console.log(`Datos obtenidos: ${attendanceRecords?.length || 0} registros`);
      
      // Verificar si hay datos
      if (!attendanceRecords || attendanceRecords.length === 0) {
        console.log('No se encontraron registros de asistencia para el período seleccionado');
        setReportData({
          total_attendance: 0,
          total_excused_absences: 0,
          total_unexcused_absences: 0,
          attendance_percentage: 0,
          excused_percentage: 0,
          unexcused_percentage: 0,
          total: 0
        });
        return;
      }
      
      // Función para procesar datos de asistencia
      const processAttendanceData = (records: any[]): AttendanceStats => {
        
        // Inicializar contadores
        let totalAttendance = 0;
        let totalExcused = 0;
        let totalUnexcused = 0;
        
        // Procesar cada registro
        records.forEach(record => {
          // Intentamos obtener el código de estado de varias formas posibles
          let code = '';
          
          if (record.attendance_status && record.attendance_status.code) {
            // Si tenemos el objeto de estado completo
            code = record.attendance_status.code.toUpperCase();
          } else if (record.status_code) {
            // Si tenemos directamente el código de estado
            code = record.status_code.toUpperCase();
          }
          
          console.log(`Registro: ${record.id}, Fecha: ${record.date}, Código: ${code}`);
          
          // Clasificar según el código
          if (code === 'A') {
            totalAttendance++;
          } else if (code === 'EA') {
            totalExcused++;
          } else if (code === 'UA') {
            totalUnexcused++;
          } else {
            // Si no reconocemos el código, asumimos que es asistencia por defecto
            // Esto es para manejar casos donde el código no está en el formato esperado
            console.log(`Código no reconocido: ${code}, asumiendo asistencia`);
            totalAttendance++;
          }
        });
        
        const totalRecords = totalAttendance + totalExcused + totalUnexcused;
        
        // Calcular porcentajes
        const attendancePercentage = totalRecords > 0 ? (totalAttendance / totalRecords) * 100 : 0;
        const excusedPercentage = totalRecords > 0 ? (totalExcused / totalRecords) * 100 : 0;
        const unexcusedPercentage = totalRecords > 0 ? (totalUnexcused / totalRecords) * 100 : 0;
        
        console.log('Estadísticas calculadas:', {
          totalAttendance,
          totalExcused,
          totalUnexcused,
          totalRecords,
          attendancePercentage,
          excusedPercentage,
          unexcusedPercentage
        });
        
        return {
          total_attendance: totalAttendance,
          total_excused_absences: totalExcused,
          total_unexcused_absences: totalUnexcused,
          attendance_percentage: attendancePercentage,
          excused_percentage: excusedPercentage,
          unexcused_percentage: unexcusedPercentage,
          total: totalRecords
        };
      };
      
      // Procesar y guardar datos del período seleccionado
      const attendanceStats = processAttendanceData(attendanceRecords);
      setReportData(attendanceStats);

      // Calcular tendencia (3 semanas previas + semana actual) si aplica
      if (granularity === 'weekly') {
        const selectedRange = getISOWeekRange(customWeek);
        const trendStart = new Date(selectedRange.firstDay);
        trendStart.setDate(trendStart.getDate() - 7 * 3);
        const trendEnd = new Date(selectedRange.lastDay);

        const trendStartStr = trendStart.toISOString().split('T')[0];
        const trendEndStr = trendEnd.toISOString().split('T')[0];

        const { data: allWeeklyData, error: allWeeklyError } = await supabase
          .from('attendance')
          .select('*')
          .gte('date', trendStartStr)
          .lte('date', trendEndStr)
          .eq('program_id', activeProgram.id);
        if (allWeeklyError) throw allWeeklyError;

        let records2 = allWeeklyData || [];
        if (reportType === 'individual' && selectedStudent) {
          records2 = records2.filter(r => r.student_id === selectedStudent.id);
        }
        if (reportType === 'group' && instrumentFilter !== 'all') {
          const allowedIds = new Set(
            students.filter(s => s.instrument?.trim() === instrumentFilter).map(s => s.id)
          );
          records2 = records2.filter(r => allowedIds.has(r.student_id));
        }

        // Agrupar por semana ISO y calcular % asistencia por semana
        const isoOf = (dateStr: string) => getISOWeekString(new Date(dateStr));
        const buckets = new Map<string, any[]>();
        for (const r of records2) {
          const wk = isoOf(r.date);
          if (!buckets.has(wk)) buckets.set(wk, []);
          buckets.get(wk)!.push(r);
        }

        // Construir arreglo: 3 semanas anteriores y la semana actual al final
        const trendWeeks: { week: string; label: string; percentage: number }[] = [];
        const [yearStr, wkStr] = customWeek.split('-W');
        let y = parseInt(yearStr, 10);
        let w = parseInt(wkStr, 10);
        // Agregar 3 semanas previas (de más antigua a más reciente)
        const prevKeys: string[] = [];
        let ty = y, tw = w;
        for (let i = 3; i >= 1; i--) {
          // calcular la semana (customWeek - i)
          let yy = y, ww = w - i;
          while (ww <= 0) {
            yy -= 1;
            const dec28 = new Date(Date.UTC(yy, 11, 28));
            const lastWeek = parseInt(getISOWeekString(dec28).split('-W')[1], 10);
            ww += lastWeek;
          }
          prevKeys.push(`${yy}-W${String(ww).padStart(2, '0')}`);
        }
        for (const wkKey of prevKeys) {
          const stats = processAttendanceData(buckets.get(wkKey) || []);
          trendWeeks.push({ week: wkKey, label: formatWeekLabel(wkKey), percentage: stats.attendance_percentage });
        }
        // Semana actual (usar el cálculo del período actual ya hecho)
        trendWeeks.push({ week: customWeek, label: formatWeekLabel(customWeek), percentage: attendanceStats.attendance_percentage });
        setWeeklyTrend(trendWeeks);

        // Dirección de tendencia usando pendiente (regresión lineal) con 4 puntos
        if (trendWeeks.length === 4) {
          const y = trendWeeks.map(w => w.percentage);
          const x = [0, 1, 2, 3];
          const n = 4;
          const sumX = x.reduce((a,b)=>a+b,0);
          const sumY = y.reduce((a,b)=>a+b,0);
          const sumXY = x.reduce((a,xi,i)=>a+xi*y[i],0);
          const sumX2 = x.reduce((a,xi)=>a+xi*xi,0);
          const denom = n*sumX2 - sumX*sumX;
          const slope = denom !== 0 ? (n*sumXY - sumX*sumY) / denom : 0;
          const slopeThreshold = 0.5; // puntos porcentuales por semana
          setTrendDirection(slope > slopeThreshold ? 'up' : slope < -slopeThreshold ? 'down' : 'flat');
        } else {
          setTrendDirection('flat');
        }
      } else if (granularity === 'annual') {
        // Calcular desglose por mes del año académico seleccionado (Sep -> May)
        const months = [
          { y: academicYear, m: 8, label: 'Sep' },
          { y: academicYear, m: 9, label: 'Oct' },
          { y: academicYear, m: 10, label: 'Nov' },
          { y: academicYear, m: 11, label: 'Dic' },
          { y: academicYear + 1, m: 0, label: 'Ene' },
          { y: academicYear + 1, m: 1, label: 'Feb' },
          { y: academicYear + 1, m: 2, label: 'Mar' },
          { y: academicYear + 1, m: 3, label: 'Abr' },
          { y: academicYear + 1, m: 4, label: 'May' },
        ];

        const map: Record<string, { a: number; ea: number; ua: number; total: number; label: string }> = {};
        for (const item of months) {
          const key = `${item.y}-${String(item.m + 1).padStart(2, '0')}`;
          map[key] = { a: 0, ea: 0, ua: 0, total: 0, label: item.label };
        }

        // Clasificar por código
        for (const record of attendanceRecords) {
          if (!record.date) continue;
          const d = new Date(record.date);
          const ky = d.getFullYear();
          const km = d.getMonth();
          const key = `${ky}-${String(km + 1).padStart(2, '0')}`;
          if (!map[key]) continue; // fuera del rango Sep-May

          let code = '';
          if (record.attendance_status && record.attendance_status.code) {
            code = String(record.attendance_status.code).toUpperCase();
          } else if (record.status_code) {
            code = String(record.status_code).toUpperCase();
          }

          if (code === 'A') map[key].a += 1;
          else if (code === 'EA') map[key].ea += 1;
          else if (code === 'UA') map[key].ua += 1;
          else map[key].a += 1; // por defecto cuenta como asistencia

          map[key].total += 1;
        }

        const breakdown: Array<{ key: string; label: string; a: number; ea: number; ua: number; total: number }> = [];
        for (const item of months) {
          const k = `${item.y}-${String(item.m + 1).padStart(2, '0')}`;
          const v = map[k];
          breakdown.push({ key: k, label: v.label, a: v.a, ea: v.ea, ua: v.ua, total: v.total });
        }

        setAnnualBreakdown(breakdown);
        setWeeklyTrend([]);
        setTrendDirection('flat');
      } else {
        setWeeklyTrend([]);
        setTrendDirection('flat');
        setAnnualBreakdown([]);
      }

    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // Función para obtener estudiantes con faltas injustificadas de una fecha específica
  const handleShowUnexcusedAbsences = async () => {
    if (!activeProgram?.id) return;
    
    setLoadingUnexcused(true);
    try {
      // Usar la fecha seleccionada (formato local para evitar problemas de zona horaria)
      const year = selectedReportDate.getFullYear();
      const month = String(selectedReportDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedReportDate.getDate()).padStart(2, '0');
      const reportDate = `${year}-${month}-${day}`;
      
      // Obtener registros de asistencia de la fecha específica
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('program_id', activeProgram.id)
        .eq('date', reportDate);
      
      if (attendanceError) throw attendanceError;
      
      // Obtener códigos de estado
      const { data: statusData } = await supabase
        .from('attendance_status')
        .select('*');
      
      // Encontrar el código para "Falta Injustificada"
      const unexcusedStatus = statusData?.find(s => 
        s.code === 'UA' || s.name?.toLowerCase().includes('injustificada') || s.name?.toLowerCase().includes('unexcused')
      );
      
      if (!unexcusedStatus) {
        alert(t('no_unexcused_status_found'));
        return;
      }
      
      // Filtrar solo faltas injustificadas de la fecha específica
      const unexcusedByStudent = new Map<string, {count: number, dates: string[]}>();
      attendanceData?.forEach(record => {
        if (record.status_code === unexcusedStatus.code) {
          console.log('Fecha de inasistencia encontrada:', record.date, 'para estudiante:', record.student_id);
          // Solo agregar esta fecha específica
          unexcusedByStudent.set(record.student_id, {
            count: 1,
            dates: [record.date]
          });
        }
      });
      
      // Obtener todos los estudiantes con faltas en esta fecha
      const studentIds = Array.from(unexcusedByStudent.keys());
      
      if (studentIds.length === 0) {
        alert(lang === 'es' 
          ? `No hay estudiantes con faltas injustificadas el ${reportDate}` 
          : `No students with unexcused absences on ${reportDate}`);
        setLoadingUnexcused(false);
        return;
      }
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds);
      
      if (studentsError) throw studentsError;
      
      // Obtener información de padres para cada estudiante
      const studentsWithParents = await Promise.all(
        (studentsData || []).map(async (student) => {
          // Obtener relaciones de padres
          const { data: parentRelations } = await supabase
            .from('student_parents')
            .select('parent_id, is_primary_contact')
            .eq('student_id', student.id);
          
          let parentInfo = null;
          if (parentRelations && parentRelations.length > 0) {
            // Priorizar contacto primario
            const primaryRelation = parentRelations.find(r => r.is_primary_contact) || parentRelations[0];
            
            // Obtener datos del padre
            const { data: parentData } = await supabase
              .from('parents')
              .select('*')
              .eq('id', primaryRelation.parent_id)
              .single();
            
            parentInfo = parentData;
          }
          
          const studentData = unexcusedByStudent.get(student.id);
          
          return {
            student: {
              id: student.id,
              name: `${student.first_name} ${student.last_name}`,
              first_name: student.first_name,
              last_name: student.last_name,
              instrument: student.instrument || 'N/A'
            },
            absences: studentData?.count || 0,
            dates: studentData?.dates || [],
            parentInfo
          };
        })
      );
      
      // Ordenar por número de faltas (mayor a menor)
      studentsWithParents.sort((a, b) => b.absences - a.absences);
      
      setUnexcusedStudents(studentsWithParents);
      setUnexcusedAbsencesModalVisible(true);
      
    } catch (error) {
      console.error('Error fetching unexcused absences:', error);
      alert(t('error_fetching_unexcused'));
    } finally {
      setLoadingUnexcused(false);
    }
  };

  // Función para previsualizar email
  const handlePreviewEmail = (studentItem: typeof unexcusedStudents[0]) => {
    if (!studentItem.parentInfo?.email) {
      alert(t('no_parent_email'));
      return;
    }

    // Formatear las fechas en español (sin conversión de zona horaria)
    const formattedDatesES = studentItem.dates.map(date => {
      // Agregar 'T00:00:00' para evitar problemas de zona horaria
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    }).join('\n');

    // Formatear las fechas en inglés (sin conversión de zona horaria)
    const formattedDatesEN = studentItem.dates.map(date => {
      // Agregar 'T00:00:00' para evitar problemas de zona horaria
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    }).join('\n');

    // Obtener fecha actual en español
    const currentDateES = new Date().toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });

    // Obtener fecha actual en inglés
    const currentDateEN = new Date().toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });

    // Construir el asunto y cuerpo del email BILINGÜE siguiendo formato de la imagen
    const emailSubject = `Reporte de Asistencia / Attendance Report - ${studentItem.student.name}`;

    // Crear tabla de fechas (sin conversión de zona horaria)
    const dateTableES = studentItem.dates.map(d => {
      const date = new Date(d + 'T00:00:00');
      return `${date.toLocaleDateString('es-ES', {day: '2-digit', month: 'long', year: 'numeric'})}     Unexcused`;
    }).join('\n');

    const dateTableEN = studentItem.dates.map(d => {
      const date = new Date(d + 'T00:00:00');
      return `${date.toLocaleDateString('en-US', {day: '2-digit', month: 'long', year: 'numeric'})}     Unexcused`;
    }).join('\n');

    const emailBody = `${currentDateES}

ESPAÑOL:
Estimado Padre/Tutor de ${studentItem.student.name},

El propósito de este reporte de asistencia es para informarle que ${studentItem.student.name} fue marcado(a) unexcused de Ascend el día ${formattedDatesES}. La asistencia es importante para nosotros y unexcused causará que el/la estudiante pierda oportunidades significativas de instrucción y aprendizaje. Por favor llame a la Coordinadora de sede de Ascend, Alyssa Pequeño al 210 665 - 4449 o arequejo@theorchestra-sa.org para justificar esta ausencia.

Atentamente,
La Oficina de Asistencia
Ascend

Fecha          Descripción
${dateTableES}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${currentDateEN}

ENGLISH:
Dear Parent/Guardian of ${studentItem.student.name},

The purpose of this attendance report is to inform you that ${studentItem.student.name} was marked unexcused in the Ascend Program on ${formattedDatesEN}. Attendance is important to us and unexcused will cause the student to miss significant opportunities for instruction and learning. Please call the Ascend Site Coordinator, Alyssa Pequeño at 210 665 - 4449 or arequejo@theorchestra-sa.org to justify this absence.

Sincerely,
The Attendance Office
Ascend

Date          Description
${dateTableEN}`;

    // Guardar datos para previsualización (usar email del padre/tutor)
    setEmailPreviewData({
      to: studentItem.parentInfo.email,
      subject: emailSubject,
      body: emailBody,
      studentItem
    });
    setEmailPreviewVisible(true);
  };

  // Función para enviar el email después de la previsualización
  const handleConfirmSendEmail = () => {
    if (!emailPreviewData) return;

    try {
      let emailUrl = '';
      
      if (emailProvider === 'gmail') {
        // Gmail web compose URL
        emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailPreviewData.to)}&su=${encodeURIComponent(emailPreviewData.subject)}&body=${encodeURIComponent(emailPreviewData.body)}`;
      } else {
        // Outlook web compose URL
        emailUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(emailPreviewData.to)}&subject=${encodeURIComponent(emailPreviewData.subject)}&body=${encodeURIComponent(emailPreviewData.body)}`;
      }
      
      // Abrir en nueva pestaña
      window.open(emailUrl, '_blank');
      
      // Cerrar modales
      setEmailPreviewVisible(false);
      setEmailPreviewData(null);
      
      // Mostrar mensaje de éxito después de un breve delay
      setTimeout(() => {
        alert(lang === 'es' ? 'Email abierto en ' + (emailProvider === 'gmail' ? 'Gmail' : 'Outlook') : 'Email opened in ' + (emailProvider === 'gmail' ? 'Gmail' : 'Outlook'));
      }, 500);
      
    } catch (error) {
      console.error('Error sending email:', error);
      alert(t('error_sending_email'));
    }
  };

  // Exportar a CSV
  const exportReportToCSV = () => {
    if (!reportData) return;
    
    const title = reportType === 'individual' && selectedStudent 
      ? t('report_of', { name: selectedStudent.name }) 
      : t('group_report');
    const periodLabel = granularity === 'monthly' ? formatMonthLabel(period, customMonth) : formatWeekLabel(customWeek);
      
    const csvData = [
      [t('report_type'), reportType === 'individual' ? t('individual') : t('group')],
      [t('period'), `${granularity === 'monthly' ? t('monthly') : t('weekly')} (${periodLabel})`],
      [t('student'), reportType === 'individual' && selectedStudent ? selectedStudent.name : t('all')],
      [t('instrument_label'), reportType === 'group' ? (instrumentFilter === 'all' ? t('all') : instrumentFilter) : (selectedStudent?.instrument || '—')],
      [''],
      [t('statistics'), ''],
      [t('total_attendances'), reportData.total_attendance],
      [t('total_excused_absences'), reportData.total_excused_absences],
      [t('total_unexcused_absences'), reportData.total_unexcused_absences],
      [t('attendance_percentage_label'), `${reportData.attendance_percentage.toFixed(1)}%`],
      [t('excused_percentage_label'), `${reportData.excused_percentage.toFixed(1)}%`],
      [t('unexcused_percentage_label'), `${reportData.unexcused_percentage.toFixed(1)}%`]
    ];

    if (granularity === 'weekly' && weeklyTrend.length === 4) {
      csvData.push([''], [t('weekly_trend_title'), '']);
      for (const w of weeklyTrend) {
        csvData.push([w.label, `${w.percentage.toFixed(1)}%`]);
      }
      const dirText = trendDirection === 'up' ? t('trend_up') : trendDirection === 'down' ? t('trend_down') : t('trend_flat');
      csvData.push([t('trend_direction'), dirText]);
    }
    
    // Convertir a CSV
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Manejar selección de estudiante
  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentModalVisible(false);
  };

  // Componente de gráfico de torta nativo con SVG
  const PieChart = ({ data }: { data: AttendanceStats }) => {
    const total = data.total;
    const presentPercentage = data.attendance_percentage;
    const excusedPercentage = data.excused_percentage;
    const unexcusedPercentage = data.unexcused_percentage;

    const pieData = [
      { name: t('total_attendances'), value: data.total_attendance, color: '#4ade80' },
      { name: t('total_excused_absences'), value: data.total_excused_absences, color: '#fbbf24' },
      { name: t('total_unexcused_absences'), value: data.total_unexcused_absences, color: '#f87171' },
    ];

    // Detectar casos de 100% en una sola categoría
    const isAllAttendance = total > 0 && data.total_attendance === total;
    const isAllExcused = total > 0 && data.total_excused_absences === total;
    const isAllUnexcused = total > 0 && data.total_unexcused_absences === total;

    // Calcular ángulos para el gráfico de torta
    const calculateSectors = (data: { value: number }[]) => {
      const total = data.reduce((sum, entry) => sum + entry.value, 0);
      let startAngle = 0;
      
      return data.map(entry => {
        // Calcular el ángulo para este sector
        const angle = (entry.value / total) * 360;
        const sector = {
          startAngle,
          endAngle: startAngle + angle,
          value: entry.value,
        };
        startAngle += angle;
        return sector;
      });
    };

    // Filtrar sectores con valor 0 para no mostrar etiquetas 0%
    const filteredPieData = pieData.filter(d => d.value > 0);
    const sectors = calculateSectors(filteredPieData);

    // Función para convertir ángulos a coordenadas SVG
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
      const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
      return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
      };
    };

    // Función para crear el path de un sector
    const createArc = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
      const start = polarToCartesian(centerX, centerY, radius, endAngle);
      const end = polarToCartesian(centerX, centerY, radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

      return [
        "M", centerX, centerY,
        "L", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "Z"
      ].join(" ");
    };
    
    // Aumentamos las dimensiones del gráfico
    const centerX = 150;
    const centerY = 150;
    const radius = 120;
    
    // Componente para renderizar un sector con animación moderna
    const AnimatedSector = ({ startAngle, endAngle, color, index }: { 
      startAngle: number; 
      endAngle: number; 
      color: string;
      index: number;
    }) => {
      const path = createArc(centerX, centerY, radius, startAngle, endAngle);
      const midAngle = (startAngle + endAngle) / 2;
      const labelPos = polarToCartesian(centerX, centerY, radius * 0.65, midAngle);
      const percentage = ((sectors[index].value / total) * 100).toFixed(0);
      
      // Calcular la rotación inicial para que el sector empiece desde la línea vertical
      const sectorRotation = midAngle - 90;
      
      // Añadir un pequeño retraso aleatorio para un efecto más orgánico
      const animationDelay = index * 0.1;
      
      return (
        <g>
          <path 
            d={path} 
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
            style={{
              transformOrigin: `${centerX}px ${centerY}px`,
              transform: 'rotate(0deg)',
              opacity: 0,
              animation: `fanEffect 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${animationDelay}s forwards`,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              transformBox: 'fill-box'
            }}
          />
          <text 
            x={labelPos.x} 
            y={labelPos.y} 
            textAnchor="middle" 
            dominantBaseline="middle"
            fill="white"
            fontSize="16"
            fontWeight="bold"
            className="opacity-0"
            style={{ 
              animation: 'fadeIn 0.5s ease-out forwards',
              animationDelay: `${animationDelay + 0.4}s`,
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}
          >
            {percentage}%
          </text>
        </g>
      );
    };

    return (
      <div className="flex flex-col h-[350px] w-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full h-[250px] flex justify-center">
            <svg width="300" height="300" viewBox="0 0 300 300">
              {/* Capa de fondo */}
              <circle cx={centerX} cy={centerY} r={radius} fill="#f0f0f0" />
              
              {/* Si 100% pertenece a una categoría, pintar círculo completo con su color */}
              {isAllAttendance || isAllExcused || isAllUnexcused ? (
                <>
                  <circle cx={centerX} cy={centerY} r={radius} fill={isAllAttendance ? '#4ade80' : isAllExcused ? '#fbbf24' : '#f87171'} />
                  <text 
                    x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle"
                    fill="#ffffff" fontSize="28" fontWeight="bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    100%
                  </text>
                </>
              ) : (
                // Renderizar sectores con animación de abanico (sin los de 0%)
                sectors.map((sector, index) => (
                  <AnimatedSector
                    key={`sector-${index}`}
                    startAngle={sector.startAngle}
                    endAngle={sector.endAngle}
                    color={filteredPieData[index].color}
                    index={index}
                  />
                ))
              )}
            </svg>
          </div>
        </div>
        
        {/* Leyenda unificada */}
        <div className="mt-8 grid grid-cols-3 gap-2 px-4">
          <div className="flex items-center bg-white p-2 rounded-md shadow-sm border border-gray-200">
            <div className="w-4 h-4 bg-green-500 mr-2 rounded-sm"></div>
            <span className="text-xs text-gray-800">{t('total_attendances')}: {data.total_attendance} ({presentPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-white p-2 rounded-md shadow-sm border border-gray-200">
            <div className="w-4 h-4 bg-yellow-500 mr-2 rounded-sm"></div>
            <span className="text-xs text-gray-800">{t('total_excused_absences')}: {data.total_excused_absences} ({excusedPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-white p-2 rounded-md shadow-sm border border-gray-200">
            <div className="w-4 h-4 bg-red-500 mr-2 rounded-sm"></div>
            <span className="text-xs text-gray-800">{t('total_unexcused_absences')}: {data.total_unexcused_absences} ({unexcusedPercentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>
    );
  };

  // Componente de gráfico de barras con animación moderna
  const BarChart = ({ data }: { data: AttendanceStats }) => {
    const maxValue = Math.max(data.total_attendance, data.total_excused_absences, data.total_unexcused_absences);
    const barWidth = 50; // Ancho de las barras
    const gap = 30; // Espacio entre barras
    const chartHeight = 200; // Altura fija para el gráfico
    const labelHeight = 20; // Altura para las etiquetas
    const totalWidth = (barWidth + gap) * 3 - gap; // Ancho total del gráfico
    
    // Función para calcular la altura de la barra
    const getBarHeight = (value: number) => {
      return (value / maxValue) * (chartHeight - labelHeight - 20);
    };

    // Datos para las barras
    const bars = [
      { 
        value: data.total_attendance, 
        label: t('attendance_label'), 
        color: 'bg-green-500',
        percentage: data.total_attendance > 0 ? 
          Math.round((data.total_attendance / (data.total_attendance + data.total_excused_absences + data.total_unexcused_absences)) * 100) : 0
      },
      { 
        value: data.total_excused_absences, 
        label: t('excused_absences_short'), 
        color: 'bg-yellow-500',
        percentage: data.total_excused_absences > 0 ? 
          Math.round((data.total_excused_absences / (data.total_attendance + data.total_excused_absences + data.total_unexcused_absences)) * 100) : 0
      },
      { 
        value: data.total_unexcused_absences, 
        label: t('unexcused_absences_short'), 
        color: 'bg-red-500',
        percentage: data.total_unexcused_absences > 0 ? 
          Math.round((data.total_unexcused_absences / (data.total_attendance + data.total_excused_absences + data.total_unexcused_absences)) * 100) : 0
      }
    ];

    return (
      <div className="relative w-full h-full flex flex-col justify-end">
        <div className="flex items-end justify-center mb-8 md:mb-10" style={{ height: `${chartHeight}px`, gap: `${gap}px` }}>
          {bars.map((bar, index) => {
            const height = getBarHeight(bar.value);
            return (
              <div 
                key={bar.label} 
                className="flex flex-col items-center relative"
                style={{
                  width: `${barWidth}px`,
                  height: `${chartHeight}px`,
                  paddingBottom: '16px',
                }}
              >
                {/* Barra con animación (anclada abajo) */}
                <div 
                  className={`${bar.color} rounded-t-lg shadow-md overflow-hidden`}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${height}px`,
                    transformOrigin: 'bottom center',
                    animation: `barGrow 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.15}s both`,
                    willChange: 'transform, opacity',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {/* Efecto de gradiente sutil */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
                </div>
                
                {/* Valor numérico */}
                <div 
                  className="absolute text-sm font-semibold text-gray-800 whitespace-nowrap transition-all duration-300 opacity-0"
                  style={{
                    bottom: `${height + 14}px`,
                    animation: `fadeIn 0.5s ease-out ${index * 0.15 + 0.4}s forwards`,
                    textShadow: '0 1px 2px rgba(255,255,255,0.8)'
                  }}
                >
                  {bar.value}
                </div>
                
                {/* Etiqueta */}
                <div 
                  className="absolute -bottom-10 text-sm font-medium text-gray-800 text-center transition-all duration-300 opacity-0"
                  style={{
                    animation: `fadeIn 0.5s ease-out ${index * 0.15 + 0.3}s forwards`
                  }}
                >
                  {bar.label}
                </div>
              </div>
            );
          })}
        </div>
        {/* Leyenda unificada (mismo formato que el gráfico circular) */}
        <div className="mt-4 grid grid-cols-3 gap-2 px-4">
          <div className="flex items-center bg-white p-2 rounded-md shadow-sm border border-gray-200">
            <div className="w-4 h-4 bg-green-500 mr-2 rounded-sm"></div>
            <span className="text-xs text-gray-800">{t('attendance_label')}: {data.total_attendance} ({data.attendance_percentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-white p-2 rounded-md shadow-sm border border-gray-200">
            <div className="w-4 h-4 bg-yellow-500 mr-2 rounded-sm"></div>
            <span className="text-xs text-gray-800">{t('excused_absences_short')}: {data.total_excused_absences} ({data.excused_percentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-white p-2 rounded-md shadow-sm border border-gray-200">
            <div className="w-4 h-4 bg-red-500 mr-2 rounded-sm"></div>
            <span className="text-xs text-gray-800">{t('unexcused_absences_short')}: {data.total_unexcused_absences} ({data.unexcused_percentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>
    );
  };

  // Modal de selección de estudiante
  const StudentModal = ({ visible, onClose, students, onSelect }: { 
    visible: boolean; 
    onClose: () => void; 
    students: Student[]; 
    onSelect: (student: Student) => void;
  }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (!visible) return;
      // Auto-focus search input when opening
      const t = setTimeout(() => inputRef.current?.focus(), 50);

      // Close on Escape
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        clearTimeout(t);
      };
    }, [visible, onClose]);

    if (!visible) return null;

    const filtered = students
      .filter(s => {
        const text = `${s.first_name} ${s.last_name} ${s.instrument}`.toLowerCase();
        return text.includes(query.toLowerCase());
      })
      .sort((a, b) => a.first_name.localeCompare(b.first_name, 'es', { sensitivity: 'base' }));
    
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="student-modal-title"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm"></div>
        
        {/* Dialog */}
        <div 
          className="relative bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-[#0073ea] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <MdPerson size={20} />
                </div>
                <div>
                  <h2 id="student-modal-title" className="text-xl font-semibold">
                    {t('select_student_title')}
                  </h2>
                  <p className="text-sm text-blue-100">
                    {lang === 'es' ? 'Selecciona un estudiante para ver su reporte individual' : 'Select a student to view their individual report'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                aria-label={t('close')}
              >
                <MdClose size={20} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 pt-4">
            <div className="relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'es' ? 'Buscar por nombre o instrumento...' : 'Search by name or instrument...'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-[#0073ea]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">ESC</span>
            </div>
          </div>

          {/* List */}
          <div className="px-6 pb-4 pt-2 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                {lang === 'es' ? 'No se encontraron estudiantes' : 'No students found'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered.map((student) => (
                  <li key={student.id}>
                    <button
                      onClick={() => onSelect(student)}
                      className="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none rounded-md transition-colors"
                    >
                      {/* Avatar iniciales */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0073ea] bg-opacity-10 text-[#0073ea] flex items-center justify-center font-semibold text-sm">
                        {student.first_name?.[0]}{student.last_name?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 leading-tight">{student.first_name} {student.last_name}</p>
                        <p className="text-xs text-gray-500">{student.instrument}</p>
                      </div>
                      <span className="text-xs text-white bg-[#0073ea] px-3 py-1 rounded-md font-medium hover:bg-[#0060c0] transition-colors">
                        {t('select')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <LoadingIndicator message="Cargando datos de reportes..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-2 sm:px-4">
      {/* Sección de Reportes de Asistencia */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 shadow-sm w-full">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-blue-100 rounded-lg mr-3">
            <MdPieChart className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {lang === 'es' ? 'Reportes de Asistencia' : 'Attendance Reports'}
            </h2>
            <p className="text-sm text-gray-600">
              {lang === 'es' ? 'Genera estadísticas y análisis de asistencia' : 'Generate attendance statistics and analysis'}
            </p>
          </div>
        </div>

        {/* Selector de tipo de reporte */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{t('report_type_title')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setReportType('group');
                setSelectedStudent(null);
                setReportData(null);
              }}
              className={`flex items-center justify-center px-3 py-2.5 rounded-md text-sm font-medium ${
                reportType === 'group'
                  ? 'bg-[#0073ea] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <MdGroups className="mr-2" /> {t('group')}
            </button>
            <button
              onClick={() => {
                setReportType('individual');
                setReportData(null);
                setStudentModalVisible(true);
              }}
              className={`flex items-center justify-center px-3 py-2.5 rounded-md text-sm font-medium ${
                reportType === 'individual'
                  ? 'bg-[#0073ea] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <MdPerson className="mr-2" /> {t('individual')}
            </button>
          </div>
        </div>

        {/* Información del período */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
        <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-xl font-medium text-gray-800 flex items-center">
            <MdCalendarMonth className="mr-2" /> {t('period')} {granularity === 'monthly' ? t('monthly') : granularity === 'weekly' ? t('weekly') : t('annual')}
          </h2>
          
          {/* Toggle granularidad - Mobile first */}
          <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-md overflow-hidden p-1">
            <button
              className={`px-2 py-2 text-sm font-medium rounded transition-colors ${
                granularity === 'monthly' ? 'bg-[#0073ea] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => { setGranularity('monthly'); setReportData(null); }}
            >
              {t('monthly')}
            </button>
            <button
              className={`px-2 py-2 text-sm font-medium rounded transition-colors ${
                granularity === 'weekly' ? 'bg-[#0073ea] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => { setGranularity('weekly'); setReportData(null); }}
            >
              {t('weekly')}
            </button>
            <button
              className={`px-2 py-2 text-sm font-medium rounded transition-colors ${
                granularity === 'annual' ? 'bg-[#0073ea] text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => { setGranularity('annual'); setReportData(null); }}
            >
              {t('annual')}
            </button>
          </div>
          
          {/* Controles de período */}
          <div className="flex flex-col gap-2 sm:gap-3">

            {granularity === 'monthly' ? (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="monthPicker"
                  className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                >
                  {t('month')}
                </label>
                <DatePicker
                  id="monthPicker"
                  selected={(() => {
                    const [y, m] = customMonth.split('-').map(Number);
                    return new Date(y, (m || 1) - 1, 1);
                  })()}
                  onChange={(date: Date | null) => {
                    if (!date) return;
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    setCustomMonth(`${y}-${m}`);
                    setPeriod('custom');
                    setReportData(null);
                  }}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  locale={lang === 'en' ? 'en-mon' : 'es-mon'}
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-black bg-white font-normal"
                />
              </div>
            ) : granularity === 'weekly' ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="weekPicker" className="text-sm font-medium text-gray-700">{t('week')}</label>
                <DatePicker
                  id="weekPicker"
                  selected={(() => {
                    const { firstDay } = getISOWeekRange(customWeek);
                    return firstDay;
                  })()}
                  onChange={(date: Date | null) => {
                    if (!date) return;
                    const isoWeek = getISOWeekString(date);
                    setCustomWeek(isoWeek);
                    setReportData(null);
                  }}
                  dateFormat="wo yyyy"
                  locale={lang === 'en' ? 'en-mon' : 'es-mon'}
                  showWeekNumbers
                  showWeekPicker
                  onWeekSelect={(date: Date, weekNumber?: number) => {
                    const isoWeek = getISOWeekString(date);
                    setCustomWeek(isoWeek);
                    setReportData(null);
                  }}
                  ariaLabelledBy="weekPicker"
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-black bg-white font-normal"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="academicYear" className="text-sm font-medium text-gray-700">{t('academic_year')}</label>
                <select
                  id="academicYear"
                  value={academicYear}
                  onChange={(e) => { setAcademicYear(parseInt(e.target.value, 10)); setReportData(null); }}
                  aria-label={t('academic_year')}
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 bg-white"
                >
                  {Array.from({ length: 7 }).map((_, idx) => {
                    const y = defaultAcademicYear - 3 + idx;
                    return (
                      <option key={y} value={y}>{formatAcademicYearLabel(y)}</option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Filtro por instrumento (solo para reporte grupal) */}
            {reportType === 'group' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="instrumentFilter">{t('instrument_label')}</label>
                <select
                  id="instrumentFilter"
                  value={instrumentFilter}
                  onChange={(e) => { setInstrumentFilter(e.target.value); setReportData(null); }}
                  className="w-full px-2 sm:px-3 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 bg-white"
                >
                  <option value="all">{t('all')}</option>
                  {instruments.map(inst => (
                    <option key={inst} value={inst}>{inst}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {t('showing_data_of', {
            label: (granularity === 'monthly'
              ? formatMonthLabel(period, customMonth)
              : granularity === 'weekly'
              ? formatWeekLabel(customWeek)
              : formatAcademicYearLabel(academicYear))
          })}
        </p>
        </div>

        {/* Selección de estudiante (solo para reporte individual) */}
        {reportType === 'individual' && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t('selected_student')}</h3>
            {selectedStudent ? (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-800 leading-snug">{selectedStudent.name}</p>
                  <p className="text-sm text-gray-600">{selectedStudent.instrument}</p>
                </div>
                <button
                  onClick={() => setStudentModalVisible(true)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium w-full sm:w-auto"
                >
                  {t('change')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setStudentModalVisible(true)}
                className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {t('select_student_title')}
              </button>
            )}
          </div>
        )}

        {/* Botón para generar reporte */}
        <div className="flex justify-center">
        <button
          onClick={handleGenerateReport}
          disabled={generating || (reportType === 'individual' && !selectedStudent)}
          className={`w-full sm:w-auto px-6 py-3 rounded-md flex items-center justify-center font-medium ${
            generating || (reportType === 'individual' && !selectedStudent)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#0073ea] text-white hover:bg-[#0060c0] shadow-sm'
          }`}
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              {t('generating')}
            </>
          ) : (
            <>
              <MdPieChart className="mr-2" /> {t('generate_report')}
            </>
          )}
        </button>
        </div>
      </div>
        
      {/* Sección separada para notificaciones de faltas (solo admin) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6 shadow-sm w-full">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-red-100 rounded-lg mr-3">
                <MdEmail className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {lang === 'es' ? 'Notificaciones de Inasistencias' : 'Absence Notifications'}
                </h3>
                <p className="text-sm text-gray-600">
                  {lang === 'es' ? 'Enviar correos a padres sobre faltas injustificadas' : 'Send emails to parents about unexcused absences'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {lang === 'es' ? 'Seleccione el día para ver las faltas injustificadas:' : 'Select the day to view unexcused absences:'}
                </label>
                <DatePicker
                  selected={selectedReportDate}
                  onChange={(date: Date | null) => date && setSelectedReportDate(date)}
                  dateFormat="dd/MM/yyyy"
                  locale={lang === 'es' ? 'es-mon' : 'en-mon'}
                  maxDate={new Date()}
                  className="px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 font-medium w-full text-center"
                  placeholderText={lang === 'es' ? 'Seleccionar fecha' : 'Select date'}
                  wrapperClassName="w-full"
                />
              </div>
              <button
                onClick={handleShowUnexcusedAbsences}
                disabled={loadingUnexcused}
                className="w-full sm:w-auto px-6 py-2.5 rounded-md flex items-center justify-center font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm whitespace-nowrap"
              >
                {loadingUnexcused ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    {t('loading_unexcused')}
                  </>
                ) : (
                  <>
                    <MdWarning className="mr-2" /> {lang === 'es' ? 'Ver Faltas del Día' : 'View Absences for Day'}
                  </>
                )}
              </button>
            </div>
        </div>
      )}

      {/* Error al generar reporte */}
      {reportError && <ErrorDisplay message={reportError} />}

      {/* Resultados del reporte */}
      {reportData && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-medium text-gray-800">
              {reportType === 'individual' && selectedStudent
                ? t('report_for_name', { name: selectedStudent.name })
                : t('group_report_title')}
            </h2>
            <button
              onClick={exportReportToCSV}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm font-medium text-white bg-[#0073ea] rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center"
            >
              <MdDownload className="mr-2" /> {t('export_csv')}
            </button>
          </div>

          <div className="space-y-6">
            {/* Estadísticas */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700 text-lg">{t('statistics')}</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-green-50 p-3 sm:p-4 rounded-md border border-green-100">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">{t('attendance_label')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-700">{reportData.total_attendance}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{reportData.attendance_percentage.toFixed(1)}%</p>
                </div>
                
                <div className="bg-yellow-50 p-3 sm:p-4 rounded-md border border-yellow-100">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">{t('excused_absences_short')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-700">{reportData.total_excused_absences}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{reportData.excused_percentage.toFixed(1)}%</p>
                </div>
                
                <div className="bg-red-50 p-3 sm:p-4 rounded-md border border-red-100">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">{t('unexcused_absences_short')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-700">{reportData.total_unexcused_absences}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{reportData.unexcused_percentage.toFixed(1)}%</p>
                </div>
                
                <div className="bg-blue-50 p-3 sm:p-4 rounded-md border border-blue-100">
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">{t('total_records')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-700">{reportData.total}</p>
                </div>
              </div>
            </div>
            
            {/* Gráfico */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <h3 className="font-medium text-gray-700 text-base sm:text-lg">{t('attendance_distribution')}</h3>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                  <button 
                    onClick={() => setChartType('pie')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      chartType === 'pie' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    {t('pie')}
                  </button>
                  <button 
                    onClick={() => setChartType('bar')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    {t('bars')}
                  </button>
                </div>
              </div>
              <div className="h-[300px] sm:h-[350px] w-full">
                {chartType === 'pie' ? (
                  <PieChart data={reportData} />
                ) : (
                  <BarChart data={reportData} />
                )}
              </div>
              {/* Tendencia semanal: últimas 4 semanas */}
              {granularity === 'weekly' && weeklyTrend.length > 0 && (
                <div className="mt-20 sm:mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-700">{t('weekly_trend_title')}</h3>
                    <span className={`${trendDirection === 'up' ? 'text-green-600' : trendDirection === 'down' ? 'text-red-600' : 'text-gray-600'} text-sm font-medium`}>
                      {trendDirection === 'up' ? `▲ ${t('trend_up')}` : trendDirection === 'down' ? `▼ ${t('trend_down')}` : `▬ ${t('trend_flat')}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {weeklyTrend.map((w) => {
                    const isCurrent = w.week === customWeek;
                    return (
                      <div key={w.week} className={`p-2 sm:p-3 rounded-md border flex flex-col items-center ${isCurrent ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="w-full h-20 sm:h-24 flex items-end">
                          <div
                            className={`w-full rounded-t-md ${isCurrent ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-blue-500'}`}
                            style={{ height: `${Math.max(4, Math.min(100, Math.round(w.percentage)))}%` }}
                            title={`${w.percentage.toFixed(1)}%`}
                          />
                        </div>
                        <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-800 font-medium">{Math.round(w.percentage)}%</div>
                        <div className="text-[10px] sm:text-xs text-gray-600 text-center leading-tight">{w.label}</div>
                        {isCurrent && (
                          <span className="mt-1 text-[8px] sm:text-[10px] px-1 sm:px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">Actual</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                  {/* Deltas semana a semana */}
                  {weeklyTrend.length === 4 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {Array.from({ length: 3 }).map((_, i) => {
                        const a = weeklyTrend[i].percentage;
                        const b = weeklyTrend[i + 1].percentage;
                        const diff = b - a;
                        const sign = diff > 0 ? '+' : '';
                        const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600';
                        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '▬';
                        return (
                          <div key={`delta-${i}`} className="text-sm font-medium text-center bg-white border border-gray-200 rounded-md py-2">
                            <span className={`${color}`}>{arrow} {sign}{diff.toFixed(1)} pp</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Desglose mensual apilado (modo anual) - compacto */}
              {granularity === 'annual' && annualBreakdown.length > 0 && (
                <div className="mt-20 sm:mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-700">{t('monthly_breakdown_title')}</h3>
                    <div className="hidden sm:flex items-center gap-3 text-xs text-gray-700">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> {t('attendance_label')}</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" /> {t('excused_absences_short')}</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> {t('unexcused_absences_short')}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-5">
                    {annualBreakdown.map((m) => {
                      const total = m.total || 0;
                      const aW = total ? (m.a / total) * 100 : 0;
                      const eaW = total ? (m.ea / total) * 100 : 0;
                      const uaW = total ? (m.ua / total) * 100 : 0;
                      const hasData = total > 0;
                      return (
                        <div key={m.key} className="group p-3 rounded-lg border border-gray-200 bg-white hover:shadow transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-900">{m.label}</div>
                            <div className="text-[10px] text-gray-500 group-hover:opacity-100 opacity-70 transition-opacity">{total} reg.</div>
                          </div>
                          <div className="w-full h-4 rounded-full bg-gray-100 overflow-hidden">
                            {hasData ? (
                              <div className="w-full h-full flex">
                                {aW > 0 && <div className="h-full bg-emerald-500" style={{ width: `${aW}%` }} title={`${t('attendance_label')}: ${m.a} (${Math.round(aW)}%)`} />}
                                {eaW > 0 && <div className="h-full bg-yellow-400" style={{ width: `${eaW}%` }} title={`${t('excused_absences_short')}: ${m.ea} (${Math.round(eaW)}%)`} />}
                                {uaW > 0 && <div className="h-full bg-red-500" style={{ width: `${uaW}%` }} title={`${t('unexcused_absences_short')}: ${m.ua} (${Math.round(uaW)}%)`} />}
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gray-200" title={t('no_data_available')} />
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">A:{m.a}</span>
                            <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700">EA:{m.ea}</span>
                            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700">UA:{m.ua}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 sm:hidden flex items-center gap-3 text-xs text-gray-700">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> A</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" /> EA</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> UA</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de selección de estudiante */}
      <StudentModal
        visible={studentModalVisible}
        onClose={() => setStudentModalVisible(false)}
        students={students}
        onSelect={handleSelectStudent}
      />

      {/* Modal de previsualización de email */}
      {emailPreviewVisible && emailPreviewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#0073ea] text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center">
                <MdEmail className="mr-2" size={24} />
                <h2 className="text-xl font-bold">{t('email_preview')}</h2>
              </div>
              <button
                onClick={() => {
                  setEmailPreviewVisible(false);
                  setEmailPreviewData(null);
                }}
                className="hover:bg-[#0060c0] rounded-full p-2 transition-colors"
              >
                <MdClose size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Email headers */}
                <div className="border-b border-gray-200 pb-4 space-y-2">
                  <div className="flex items-start">
                    <span className="font-semibold text-gray-700 min-w-[80px]">{t('email_to')}</span>
                    <span className="text-gray-600">{emailPreviewData.to}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-semibold text-gray-700 min-w-[80px]">{t('email_subject')}</span>
                    <span className="text-gray-600">{emailPreviewData.subject}</span>
                  </div>
                </div>

                {/* Email body */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
                    {emailPreviewData.body}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              {/* Selector de proveedor de email */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {lang === 'es' ? 'Enviar desde:' : 'Send from:'}
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEmailProvider('gmail')}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium ${
                      emailProvider === 'gmail'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-lg mr-2">📧</span>
                      Gmail
                    </div>
                  </button>
                  <button
                    onClick={() => setEmailProvider('outlook')}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium ${
                      emailProvider === 'outlook'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="text-lg mr-2">📨</span>
                      Outlook
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Botones de acción */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEmailPreviewVisible(false);
                    setEmailPreviewData(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleConfirmSendEmail}
                  className="px-4 py-2 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors font-medium flex items-center"
                >
                  <MdEmail className="mr-2" size={18} />
                  {t('send_email')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de faltas injustificadas */}
      {unexcusedAbsencesModalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center">
                <MdWarning className="mr-2" size={24} />
                <h2 className="text-xl font-bold">
                  {lang === 'es' ? 'Faltas Injustificadas' : 'Unexcused Absences'} - {selectedReportDate.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <button
                onClick={() => setUnexcusedAbsencesModalVisible(false)}
                className="hover:bg-red-700 rounded-full p-2 transition-colors"
              >
                <MdClose size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {unexcusedStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {t('no_students_unexcused_this_week')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    {t('total_students_with_unexcused')} <span className="font-bold text-red-600">{unexcusedStudents.length}</span>
                  </div>
                  
                  {unexcusedStudents.map((item, index) => (
                    <div key={item.student.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                        {/* Información del estudiante */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded">
                              #{index + 1}
                            </span>
                            <h3 className="text-lg font-semibold text-gray-800">
                              {item.student.name}
                            </h3>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">{t('instrument_label')}:</span> {item.student.instrument}</p>
                            <p><span className="font-medium">{t('unexcused_count')}</span> 
                              <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                                {item.absences}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Información del padre/madre */}
                        <div className="bg-gray-50 rounded-lg p-3 sm:w-64">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('parent_contact_label')}</h4>
                          {item.parentInfo ? (
                            <>
                              <div className="text-sm text-gray-600 space-y-1 mb-3">
                                <p><span className="font-medium">{t('parent_name')}:</span> {item.parentInfo.full_name || 'N/A'}</p>
                                <p><span className="font-medium">{t('parent_phone')}:</span> {item.parentInfo.phone_number || 'N/A'}</p>
                                <p><span className="font-medium">{t('parent_email')}:</span> {item.parentInfo.email || 'N/A'}</p>
                              </div>
                              
                              {/* Botón para previsualizar email */}
                              {item.parentInfo.email && (
                                <button
                                  onClick={() => handlePreviewEmail(item)}
                                  className="w-full px-3 py-2 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors flex items-center justify-center text-sm font-medium"
                                >
                                  <MdEmail className="mr-2" size={16} />
                                  {t('preview_email')}
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 italic">{t('no_contact_info')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
              <button
                onClick={() => setUnexcusedAbsencesModalVisible(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                {t('close_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
