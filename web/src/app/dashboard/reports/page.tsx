'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { MdPieChart, MdPerson, MdGroups, MdCalendarMonth, MdDownload, MdWarning, MdClose, MdEmail, MdInsertChart, MdCheckCircle, MdEventBusy, MdAssessment } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { es as esLocale, enUS } from 'date-fns/locale';
import { useProgram } from '@/contexts/ProgramContext';
import { useUserRole } from '@/hooks/useUserRole';

// Registrar locales para react-datepicker (forzar que la semana empiece en
// lunes, y que la semana 1 del año sea la que contiene el primer jueves —
// regla ISO-8601, firstWeekContainsDate: 4). Sin esto, el número de semana
// que muestra el calendario (selector "wo") se calcula con la convención de
// EE.UU. (firstWeekContainsDate: 1) y puede no coincidir con el número de
// semana ISO real que usa el resto de la app (getISOWeekString más abajo)
// para consultar los datos — el rango de fechas consultado siempre es
// correcto porque se calcula del día exacto que se hace clic, pero la
// etiqueta en pantalla podía mostrar un número de semana distinto.
const enMonday: typeof enUS = {
  ...enUS,
  options: {
    ...(enUS as any).options,
    weekStartsOn: 1,
    firstWeekContainsDate: 4,
  },
} as any;
const esMonday: typeof esLocale = {
  ...esLocale,
  options: {
    ...(esLocale as any).options,
    weekStartsOn: 1,
    firstWeekContainsDate: 4,
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
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C2492B] mb-4"></div>
      <p className="text-[#6E675E]">{msg}</p>
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
    <div className="flex flex-col items-center justify-center p-8 bg-[#FAF7F2] rounded-md">
      <p className="text-[#8A8177]">{msg}</p>
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
  orchestra_position: string;
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

// "Notificaciones de Inasistencias" (envío de emails a padres) no se usó en
// el ciclo 2025-2026 — se deja el código completo (queda apagado, no se
// borra) por si más adelante se retoma. Para volver a mostrarlo, poner esto
// en `true`.
const SHOW_ABSENCE_NOTIFICATIONS = false;

// Supabase/PostgREST devuelve máximo 1000 filas por consulta si no se pagina
// explícitamente con .range(). El reporte de asistencia puede fácilmente
// superar eso (un solo mes de un programa activo ya llegó a ~940 registros
// reales) — sin paginar, esto corta los datos en silencio y las estadísticas
// quedan incompletas (ej. el reporte Anual solo mostraba los primeros 1-2
// meses del año académico). Esta función trae TODAS las filas del rango,
// pidiendo de a `PAGE_SIZE` hasta que una página vuelve incompleta.
const ATTENDANCE_FETCH_PAGE_SIZE = 1000;
async function fetchAllAttendanceRecords(programId: string, startDate: string, endDate: string) {
  const all: any[] = [];
  let from = 0;
  // Límite de seguridad para no quedar en un loop infinito ante algo inesperado.
  for (let page = 0; page < 200; page++) {
    const to = from + ATTENDANCE_FETCH_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('program_id', programId)
      .order('date', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < ATTENDANCE_FETCH_PAGE_SIZE) break; // última página
    from += ATTENDANCE_FETCH_PAGE_SIZE;
  }
  return all;
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
  // Pendiente numérica (puntos porcentuales por semana) de la regresión de
  // las 4 semanas — se usa para la línea de tendencia y el texto de apoyo
  // junto a la flecha (ej. "-2.4 pp/semana"), para que quede claro que la
  // flecha resume las 4 semanas y no solo el cambio de la última.
  const [trendSlope, setTrendSlope] = useState<number>(0);
  // Desglose anual por mes (Sep-May)
  const [annualBreakdown, setAnnualBreakdown] = useState<Array<{ key: string; label: string; a: number; ea: number; ua: number; total: number }>>([]);

  // --- Métricas nuevas (pedidas por Eliezer tras revisar Reportes) ---
  // Top 5 estudiantes con mejor % de asistencia en el período (solo reporte
  // grupal). "rank" es un rank denso por % redondeado: varios estudiantes
  // empatados en el mismo % comparten el mismo rank (ver handleGenerateReport).
  const [topAttendance, setTopAttendance] = useState<Array<{ id: string; name: string; instrument: string; percentage: number; total: number; rank: number }>>([]);
  // Cuando un empate en el 5º lugar deja fuera más estudiantes de los que
  // se alcanzan a mostrar, esto guarda cuántos y con qué % para el aviso
  // "+N más con X%" debajo de la lista.
  const [topAttendanceMoreTied, setTopAttendanceMoreTied] = useState<{ count: number; percentage: number } | null>(null);
  // Comparación vs. el período anterior (Mensual y Anual — Semanal ya tiene
  // su propia tendencia de 4 semanas, así que no se duplica aquí).
  const [periodComparison, setPeriodComparison] = useState<{ previousLabel: string; previousPercentage: number; deltaPct: number } | null>(null);
  // Desglose de % de asistencia por instrumento y por posición (solo reporte grupal).
  const [instrumentBreakdown, setInstrumentBreakdown] = useState<Array<{ label: string; percentage: number; total: number }>>([]);
  const [positionBreakdown, setPositionBreakdown] = useState<Array<{ label: string; percentage: number; total: number }>>([]);

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

  // Mes calendario inmediatamente anterior al mes elegido (customMonth),
  // usado para "comparación vs. período anterior" en el reporte Mensual.
  // new Date(year, month - 1, ...) resuelve solo el rollover de año
  // (ej. enero -> diciembre del año anterior).
  const getPreviousMonthRange = (monthStr: string) => {
    const [yearStr, monthOnly] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthOnly, 10) - 1; // 0-based
    const prevMonthDate = new Date(year, month - 1, 1);
    const firstDay = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const lastDay = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  // Directorio de estudiantes por id (incluye INACTIVOS) — solo para
  // resolver nombre/instrumento/posición al armar el Top 5 y los
  // desgloses. Un reporte Anual cubre 9 meses; un estudiante que se dio
  // de baja a mitad de año sigue teniendo registros de asistencia
  // históricos válidos, pero no aparecía en `students` (que solo trae
  // activos) y salía como "Unknown student" en el ranking. `students`
  // (activos) se deja intacto para no afectar el selector de estudiante
  // ni el filtro de instrumento, que sí deben mostrar solo activos.
  const [studentDirectory, setStudentDirectory] = useState<Map<string, { name: string; instrument: string; orchestra_position: string }>>(new Map());

  // Cargar estudiantes al inicio
  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        if (!activeProgram?.id) {
          setStudents([]);
          setStudentDirectory(new Map());
          setLoading(false);
          return;
        }
        // Activos y directorio completo (activos + inactivos, para resolver
        // nombres en reportes de rango largo como el Anual) son consultas
        // independientes — se piden en paralelo en vez de una tras otra.
        const [activeRes, allRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, first_name, last_name, instrument, orchestra_position')
            .eq('is_active', true)
            .eq('program_id', activeProgram.id),
          supabase
            .from('students')
            .select('id, first_name, last_name, instrument, orchestra_position')
            .eq('program_id', activeProgram.id),
        ]);

        const { data, error } = activeRes;
        const { data: allData, error: allError } = allRes;

        if (error) throw error;

        const formattedStudents = data.map(student => ({
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          first_name: student.first_name,
          last_name: student.last_name,
          instrument: student.instrument,
          orchestra_position: student.orchestra_position || ''
        }));

        setStudents(formattedStudents);

        if (!allError && allData) {
          const dir = new Map(
            allData.map((s) => [
              s.id,
              { name: `${s.first_name} ${s.last_name}`, instrument: s.instrument || '', orchestra_position: s.orchestra_position || '' },
            ])
          );
          setStudentDirectory(dir);
        } else if (allError) {
          console.warn('No se pudo cargar el directorio completo de estudiantes (activos+inactivos):', allError.message);
        }
      } catch (err) {
        console.error('Error al cargar estudiantes:', err);
        setError(t('couldnt_load_students_try_again'));
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [activeProgram?.id]);

  // Al cambiar de sede (programa activo) limpiar cualquier reporte ya
  // generado — antes se quedaba visible el reporte de la sede anterior
  // (estadísticas, gráfico, Top 5, desgloses, estudiante seleccionado...)
  // hasta que el usuario generaba uno nuevo a mano, lo cual se podía
  // confundir con datos de la sede recién seleccionada.
  useEffect(() => {
    setReportData(null);
    setReportError(null);
    setSelectedStudent(null);
    setInstrumentFilter('all');
    setTopAttendance([]);
    setTopAttendanceMoreTied(null);
    setPeriodComparison(null);
    setInstrumentBreakdown([]);
    setPositionBreakdown([]);
    setWeeklyTrend([]);
    setAnnualBreakdown([]);
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
        // Traemos TODOS los registros de asistencia del rango (paginado, ver
        // fetchAllAttendanceRecords) — antes esto se cortaba en 1000 filas.
        const data = await fetchAllAttendanceRecords(activeProgram.id, startDate, endDate);

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
        // Sin esto, un período vacío dejaba en pantalla el desglose
        // mensual/tendencia semanal del último reporte CON datos (el
        // "return" de abajo se saltaba el bloque que normalmente los
        // limpia según la granularidad).
        setWeeklyTrend([]);
        setTrendDirection('flat');
        setTrendSlope(0);
        setAnnualBreakdown([]);
        setTopAttendance([]);
        setTopAttendanceMoreTied(null);
        setInstrumentBreakdown([]);
        setPositionBreakdown([]);
        setPeriodComparison(null);
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

      // --- Top 5 asistencia, y desglose por instrumento/posición ---
      // Solo tiene sentido en el reporte grupal (el individual ya es un solo
      // estudiante). Usamos el listado de estudiantes activos del programa
      // (cargado al inicio) para resolver nombre/instrumento/posición de
      // cada student_id de los registros de asistencia.
      if (reportType === 'group') {
        // studentDirectory incluye activos + inactivos (ver arriba) — un
        // reporte Anual puede incluir estudiantes que ya se dieron de baja
        // a mitad de año; con solo `students` (activos) salían como
        // "Unknown student" aunque sus registros de asistencia fueran
        // válidos.
        const studentInfoMap = studentDirectory;

        // Agrupar registros por estudiante para el ranking
        const perStudent = new Map<string, any[]>();
        for (const r of attendanceRecords) {
          if (!perStudent.has(r.student_id)) perStudent.set(r.student_id, []);
          perStudent.get(r.student_id)!.push(r);
        }
        const fullRanking = Array.from(perStudent.entries())
          .map(([studentId, records]) => {
            const stats = processAttendanceData(records);
            const info = studentInfoMap.get(studentId);
            return {
              id: studentId,
              name: info?.name || (lang === 'es' ? 'Estudiante no encontrado' : 'Unknown student'),
              instrument: info?.instrument || '',
              percentage: stats.attendance_percentage,
              total: stats.total,
            };
          })
          // Exigimos al menos 2 registros en el período para que el % no
          // sea solo un día suelto con 100%/0%.
          .filter(s => s.total >= 2)
          // Desempate: más registros primero, y de ahí alfabético — solo
          // para tener un orden estable dentro de un mismo % (el "rank"
          // real de abajo no depende de este orden interno).
          .sort((a, b) => b.percentage - a.percentage || b.total - a.total || a.name.localeCompare(b.name, lang === 'en' ? 'en' : 'es'));

        // Rank "denso" sobre el % REDONDEADO (el mismo número que se
        // muestra en pantalla): si 5 estudiantes muestran "90%", todos
        // comparten el lugar 1 en vez de que el orden interno los reparta
        // arbitrariamente entre el 1º y el 5º cuando en realidad están
        // empatados.
        let rank = 0;
        let lastRounded: number | null = null;
        const rankedAll = fullRanking.map((s) => {
          const rounded = Math.round(s.percentage);
          if (lastRounded === null || rounded !== lastRounded) {
            rank += 1;
            lastRounded = rounded;
          }
          return { ...s, rank };
        });

        // Mostramos todos los que caen en los primeros 5 LUGARES (puede
        // ser más de 5 filas si hay empates), con un tope para no inundar
        // la pantalla si hay una cantidad enorme de empatados; el resto se
        // resume con un contador "+N más".
        const MAX_TOP_ROWS = 10;
        const withinTop5Places = rankedAll.filter(s => s.rank <= 5);
        const shownTop = withinTop5Places.slice(0, MAX_TOP_ROWS);
        const hiddenCount = withinTop5Places.length - shownTop.length;
        setTopAttendance(shownTop);
        setTopAttendanceMoreTied(
          hiddenCount > 0 ? { count: hiddenCount, percentage: shownTop[shownTop.length - 1].percentage } : null
        );

        // Agrupar por instrumento y por posición para comparar categorías
        const byInstrument = new Map<string, any[]>();
        const byPosition = new Map<string, any[]>();
        for (const r of attendanceRecords) {
          const info = studentInfoMap.get(r.student_id);
          const instLabel = info?.instrument?.trim() || (lang === 'es' ? 'Sin instrumento' : 'No instrument');
          const posLabel = info?.orchestra_position?.trim() || (lang === 'es' ? 'Sin posición' : 'No position');
          if (!byInstrument.has(instLabel)) byInstrument.set(instLabel, []);
          byInstrument.get(instLabel)!.push(r);
          if (!byPosition.has(posLabel)) byPosition.set(posLabel, []);
          byPosition.get(posLabel)!.push(r);
        }
        const toBreakdown = (map: Map<string, any[]>) =>
          Array.from(map.entries())
            .map(([label, records]) => {
              const stats = processAttendanceData(records);
              return { label, percentage: stats.attendance_percentage, total: stats.total };
            })
            .sort((a, b) => b.percentage - a.percentage);
        setInstrumentBreakdown(toBreakdown(byInstrument));
        setPositionBreakdown(toBreakdown(byPosition));
      } else {
        setTopAttendance([]);
        setTopAttendanceMoreTied(null);
        setInstrumentBreakdown([]);
        setPositionBreakdown([]);
      }

      // --- Comparación vs. el período anterior (Mensual y Anual) ---
      // Semanal ya tiene su propia tendencia de 4 semanas más abajo, así
      // que no se duplica aquí para no saturar la pantalla.
      if (granularity === 'monthly' || granularity === 'annual') {
        const prevRange = granularity === 'monthly'
          ? getPreviousMonthRange(customMonth)
          : getAcademicYearRange(academicYear - 1);
        const prevStartDate = prevRange.firstDay.toISOString().split('T')[0];
        const prevEndDate = prevRange.lastDay.toISOString().split('T')[0];

        const prevData = await fetchAllAttendanceRecords(activeProgram.id, prevStartDate, prevEndDate);
        let prevRecords = prevData || [];
        if (reportType === 'individual' && selectedStudent) {
          prevRecords = prevRecords.filter(r => r.student_id === selectedStudent.id);
        }
        if (reportType === 'group' && instrumentFilter !== 'all') {
          const allowedIds = new Set(
            students.filter(s => s.instrument?.trim() === instrumentFilter).map(s => s.id)
          );
          prevRecords = prevRecords.filter(r => allowedIds.has(r.student_id));
        }
        const prevStats = processAttendanceData(prevRecords);

        if (prevStats.total > 0) {
          const prevLabel = granularity === 'monthly'
            ? formatMonthLabel('custom', `${prevRange.firstDay.getFullYear()}-${String(prevRange.firstDay.getMonth() + 1).padStart(2, '0')}`)
            : formatAcademicYearLabel(academicYear - 1);
          setPeriodComparison({
            previousLabel: prevLabel,
            previousPercentage: prevStats.attendance_percentage,
            deltaPct: attendanceStats.attendance_percentage - prevStats.attendance_percentage,
          });
        } else {
          // Sin datos del período anterior para comparar (ej. es el primer
          // mes/año con registros) — no mostramos la comparación.
          setPeriodComparison(null);
        }
      } else {
        setPeriodComparison(null);
      }

      // Calcular tendencia (3 semanas previas + semana actual) si aplica
      if (granularity === 'weekly') {
        const selectedRange = getISOWeekRange(customWeek);
        const trendStart = new Date(selectedRange.firstDay);
        trendStart.setDate(trendStart.getDate() - 7 * 3);
        const trendEnd = new Date(selectedRange.lastDay);

        const trendStartStr = trendStart.toISOString().split('T')[0];
        const trendEndStr = trendEnd.toISOString().split('T')[0];

        const allWeeklyData = await fetchAllAttendanceRecords(activeProgram.id, trendStartStr, trendEndStr);

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
          setTrendSlope(slope);
        } else {
          setTrendDirection('flat');
          setTrendSlope(0);
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
        setTrendSlope(0);
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
              instrument: student.instrument || 'N/A',
              orchestra_position: student.orchestra_position || ''
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

    // Mismos colores que las Barras y la leyenda (Tailwind green/yellow/red-500)
    // — antes la torta usaba tonos -400 (#4ade80/#fbbf24/#f87171), más
    // pálidos que las barras y que los cuadritos de la leyenda, por eso se
    // veían "menos vivos" al lado del gráfico de Barras.
    const pieData = [
      { name: t('total_attendances'), value: data.total_attendance, color: '#5F7A57' },
      { name: t('total_excused_absences'), value: data.total_excused_absences, color: '#8A6A22' },
      { name: t('total_unexcused_absences'), value: data.total_unexcused_absences, color: '#A8402A' },
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
    
    // radius subido de 120 a 142 (de un círculo que dejaba ~20% de margen
    // vacío dentro de su propio lienzo 300x300, a solo ~5%) — junto con el
    // recorte de padding/max-width de abajo, hace que la torta se vea con
    // el mismo "peso" visual que las Barras, que sí llegan hasta el borde.
    const centerX = 150;
    const centerY = 150;
    const radius = 142;
    
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
      const percentageValue = (sectors[index].value / total) * 100;
      const percentage = percentageValue.toFixed(0);
      // Una porción angosta (ej. 1%) es más angosta que el propio texto del
      // "1%", así que el label se sale del gajo y se solapa con el gajo
      // vecino. La leyenda de abajo ya muestra el número exacto de cada
      // categoría, así que para gajos muy chicos simplemente no dibujamos
      // el número adentro (el color del gajo + la leyenda ya lo explican).
      const showInlineLabel = percentageValue >= 6;

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
          {showInlineLabel && (
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
          )}
        </g>
      );
    };

    return (
      // h-full (antes h-[350px] fijo) para que ocupe exactamente el mismo
      // espacio que le da el contenedor padre (300px en móvil, 350px en
      // escritorio) — igual que ahora hace el gráfico de Barras.
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 min-h-0 flex items-center justify-center">
          {/* w-full h-full + viewBox cuadrado (preserveAspectRatio por
              defecto es "meet", así que el círculo nunca se deforma): el
              SVG usa TODO el espacio que le da el flex-1 en vez de un
              tamaño fijo en píxeles o un max-width que lo topaba antes de
              llegar al borde — así se ve con el mismo tamaño/peso que las
              Barras, que también llegan hasta el borde de su contenedor. */}
          <svg viewBox="0 0 300 300" className="w-full h-full">
            {/* Capa de fondo */}
            <circle cx={centerX} cy={centerY} r={radius} fill="#F1EDE4" />

            {/* Si 100% pertenece a una categoría, pintar círculo completo con su color */}
            {isAllAttendance || isAllExcused || isAllUnexcused ? (
              <>
                <circle cx={centerX} cy={centerY} r={radius} fill={isAllAttendance ? '#5F7A57' : isAllExcused ? '#8A6A22' : '#A8402A'} />
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

        {/* Leyenda unificada (mt-4 para calzar con la del gráfico de Barras) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 px-4">
          <div className="flex items-center bg-[#FFFDFA] p-2 rounded-md border border-[#EAE3D6]">
            <div className="w-4 h-4 bg-[#5F7A57] mr-2 rounded-sm"></div>
            <span className="text-xs text-[#1B1917]">{t('total_attendances')}: {data.total_attendance} ({presentPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-[#FFFDFA] p-2 rounded-md border border-[#EAE3D6]">
            <div className="w-4 h-4 bg-[#8A6A22] mr-2 rounded-sm"></div>
            <span className="text-xs text-[#1B1917]">{t('total_excused_absences')}: {data.total_excused_absences} ({excusedPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-[#FFFDFA] p-2 rounded-md border border-[#EAE3D6]">
            <div className="w-4 h-4 bg-[#A8402A] mr-2 rounded-sm"></div>
            <span className="text-xs text-[#1B1917]">{t('total_unexcused_absences')}: {data.total_unexcused_absences} ({unexcusedPercentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>
    );
  };

  // Componente de gráfico de barras con animación moderna
  const BarChart = ({ data }: { data: AttendanceStats }) => {
    // Math.max(1, ...) evita dividir por 0 (NaN en la altura de las barras)
    // cuando el período no tiene ningún registro de asistencia.
    const maxValue = Math.max(1, data.total_attendance, data.total_excused_absences, data.total_unexcused_absences);

    // Datos para las barras
    const bars = [
      {
        value: data.total_attendance,
        label: t('attendance_label'),
        color: 'bg-[#5F7A57]',
        percentage: data.total_attendance > 0 ?
          Math.round((data.total_attendance / (data.total_attendance + data.total_excused_absences + data.total_unexcused_absences)) * 100) : 0
      },
      {
        value: data.total_excused_absences,
        label: t('excused_absences_short'),
        color: 'bg-[#8A6A22]',
        percentage: data.total_excused_absences > 0 ?
          Math.round((data.total_excused_absences / (data.total_attendance + data.total_excused_absences + data.total_unexcused_absences)) * 100) : 0
      },
      {
        value: data.total_unexcused_absences,
        label: t('unexcused_absences_short'),
        color: 'bg-[#A8402A]',
        percentage: data.total_unexcused_absences > 0 ?
          Math.round((data.total_unexcused_absences / (data.total_attendance + data.total_excused_absences + data.total_unexcused_absences)) * 100) : 0
      }
    ];

    return (
      <div className="relative w-full h-full flex flex-col">
        {/* Área de barras: antes tenía un alto fijo en píxeles (200px) sin
            importar el alto real del contenedor (300px en móvil, 350px en
            escritorio) — dejaba un espacio vacío arriba y las barras se
            veían chicas comparadas con el gráfico de torta, que sí llena
            el espacio disponible. Ahora la altura de cada barra es un
            porcentaje de "flex-1" (el espacio que realmente hay), igual
            que el gráfico de torta y las mini-barras de tendencia semanal. */}
        <div className="flex-1 flex items-end justify-center gap-4 sm:gap-14 px-4 pb-2 min-h-0">
          {bars.map((bar, index) => {
            const heightPct = Math.max(4, Math.round((bar.value / maxValue) * 100));
            return (
              <div key={bar.label} className="flex flex-col items-center justify-end h-full w-16 sm:w-20">
                {/* Valor numérico */}
                <div
                  className="text-sm font-semibold text-[#1B1917] mb-2 whitespace-nowrap opacity-0"
                  style={{
                    animation: `fadeIn 0.5s ease-out ${index * 0.15 + 0.4}s forwards`,
                    textShadow: '0 1px 2px rgba(255,255,255,0.8)'
                  }}
                >
                  {bar.value}
                </div>

                {/* Barra con animación (anclada abajo, alto en % del espacio disponible) */}
                <div
                  className={`${bar.color} rounded-t-lg shadow-md overflow-hidden relative w-full`}
                  style={{
                    height: `${heightPct}%`,
                    transformOrigin: 'bottom center',
                    animation: `barGrow 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.15}s both`,
                    willChange: 'transform, opacity',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {/* Efecto de gradiente sutil */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Etiquetas debajo de cada barra. gap-4 en móvil (antes gap-8): con
            3 barras de w-16 (64px) + los padding de las tarjetas que las
            envuelven, gap-8 (32px) se quedaba sin espacio en pantallas
            angostas (~360px, común en Android) y podía recortar la tercera
            barra. gap-4 deja margen de sobra sin afectar el diseño de
            escritorio (sm:gap-14 no cambia). */}
        <div className="flex items-start justify-center gap-4 sm:gap-14 px-4 pt-1 mb-6 sm:mb-8">
          {bars.map((bar, index) => (
            <div
              key={bar.label}
              className="w-16 sm:w-20 text-sm font-medium text-[#1B1917] text-center opacity-0"
              style={{ animation: `fadeIn 0.5s ease-out ${index * 0.15 + 0.3}s forwards` }}
            >
              {bar.label}
            </div>
          ))}
        </div>
        {/* Leyenda unificada (mismo formato que el gráfico circular) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 px-4">
          <div className="flex items-center bg-[#FFFDFA] p-2 rounded-md border border-[#EAE3D6]">
            <div className="w-4 h-4 bg-[#5F7A57] mr-2 rounded-sm"></div>
            <span className="text-xs text-[#1B1917]">{t('attendance_label')}: {data.total_attendance} ({data.attendance_percentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-[#FFFDFA] p-2 rounded-md border border-[#EAE3D6]">
            <div className="w-4 h-4 bg-[#8A6A22] mr-2 rounded-sm"></div>
            <span className="text-xs text-[#1B1917]">{t('excused_absences_short')}: {data.total_excused_absences} ({data.excused_percentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center bg-[#FFFDFA] p-2 rounded-md border border-[#EAE3D6]">
            <div className="w-4 h-4 bg-[#A8402A] mr-2 rounded-sm"></div>
            <span className="text-xs text-[#1B1917]">{t('unexcused_absences_short')}: {data.total_unexcused_absences} ({data.unexcused_percentage.toFixed(1)}%)</span>
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
        <div className="absolute inset-0 bg-black/50"></div>

        {/* Dialog */}
        <div
          className="relative bg-[#FAF7F2] rounded-lg sm:rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden border border-[#E3DDD1]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — mismo patrón que el resto de los modales (título
              Newsreader sin caja de ícono, botón de cerrar cuadrado). */}
          <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px]">
            <div>
              <h2
                id="student-modal-title"
                className="text-2xl leading-none text-[#1B1917]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
              >
                {t('select_student_title')}
              </h2>
              <p className="text-[12.5px] text-[#8A8177] mt-1.5">
                {lang === 'es' ? 'Selecciona un estudiante para ver su reporte individual' : 'Select a student to view their individual report'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
              aria-label={t('close')}
            >
              <MdClose size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 sm:px-[30px] pt-4">
            <div className="relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'es' ? 'Buscar por nombre o instrumento...' : 'Search by name or instrument...'}
                className="w-full rounded-[9px] border border-[#E3DDD1] bg-[#FFFDFA] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B]"
              />
            </div>
          </div>

          {/* List */}
          <div className="px-4 sm:px-[30px] pb-4 pt-2 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-[#8A8177] text-sm">
                {lang === 'es' ? 'No se encontraron estudiantes' : 'No students found'}
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((student) => (
                  <li key={student.id}>
                    {/* Ficha completa clicable — mismo patrón de tarjeta
                        plana (bg-[#FFFDFA] border) que el resto de las
                        listas de estudiantes de la app, sin avatar ni
                        botón "Select". */}
                    <button
                      onClick={() => onSelect(student)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-[#EAE3D6] bg-[#FFFDFA] hover:border-[#C2492B] focus:outline-none focus:border-[#C2492B] transition-colors"
                    >
                      <p className="text-[15px] font-medium text-[#1B1917] leading-tight truncate">{student.first_name} {student.last_name}</p>
                      {student.instrument && (
                        <p className="text-[12.5px] text-[#8A8177] mt-0.5">{student.instrument}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer — botón "fantasma" (sin fondo, solo hover), mismo
              patrón que el Cancelar del modal de Nuevo Estudiante; antes
              tenía un gris sólido distinto (bg-[#EAE3D6]) que no coincidía
              con el resto de la app. */}
          <div className="px-4 sm:px-[30px] py-4 border-t border-[#E3DDD1] bg-[#FAF7F2] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#56504A] hover:bg-[#EAE3D6] rounded-lg transition-colors font-medium"
            >
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full">
        <LoadingIndicator message="Cargando datos de reportes..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full">
        <ErrorDisplay message={error} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full">
    <div className="max-w-[1420px] mx-auto">
      <div className="pb-5 sm:pb-[22px] border-b border-[#E3DDD1]">
        <h1
          className="text-[28px] sm:text-[40px] text-[#1B1917] leading-[1.05]"
          style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
        >
          {lang === 'es' ? 'Reportes' : 'Reports'}
        </h1>
        <p className="text-[13px] sm:text-[14px] text-[#8A8177] mt-1.5">
          {lang === 'es' ? 'Genera estadísticas y análisis de asistencia' : 'Generate attendance statistics and analysis'}
        </p>
      </div>

      {/* Layout de 2 columnas: filtros a la izquierda, resultados a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5 mt-6 items-start">

      {/* Panel de filtros (izquierda) */}
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-5 flex flex-col gap-5 lg:sticky lg:top-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1B1917]">
            {lang === 'es' ? 'Reportes de Asistencia' : 'Attendance Reports'}
          </h2>
        </div>

        {/* Selector de tipo de reporte */}
        <div>
          <h3 className="text-[11.5px] uppercase tracking-[0.09em] font-medium text-[#8A8177] mb-2">{t('report_type_title')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setReportType('group');
                setSelectedStudent(null);
                setReportData(null);
              }}
              className={`flex items-center justify-center px-3 py-2.5 rounded-md text-sm font-medium ${
                reportType === 'group'
                  ? 'bg-[#C2492B] text-white'
                  : 'bg-[#FFFDFA] text-[#56504A] hover:bg-[#F4F0E8] border border-[#EAE3D6]'
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
                  ? 'bg-[#C2492B] text-white'
                  : 'bg-[#FFFDFA] text-[#56504A] hover:bg-[#F4F0E8] border border-[#EAE3D6]'
              }`}
            >
              <MdPerson className="mr-2" /> {t('individual')}
            </button>
          </div>
        </div>

        {/* Información del período */}
        <div>
        <div className="flex flex-col gap-3">
          <h3 className="text-[11.5px] uppercase tracking-[0.09em] font-medium text-[#8A8177] flex items-center gap-1.5">
            <MdCalendarMonth size={13} /> {t('period')} {granularity === 'monthly' ? t('monthly') : granularity === 'weekly' ? t('weekly') : t('annual')}
          </h3>

          {/* Toggle granularidad - Mobile first */}
          <div className="grid grid-cols-3 gap-1 bg-[#F4F0E8] rounded-md overflow-hidden p-1">
            <button
              className={`px-2 py-2 text-sm font-medium rounded transition-colors ${
                granularity === 'monthly' ? 'bg-[#C2492B] text-white shadow-sm' : 'text-[#56504A] hover:bg-[#EAE3D6]'
              }`}
              onClick={() => { setGranularity('monthly'); setReportData(null); }}
            >
              {t('monthly')}
            </button>
            <button
              className={`px-2 py-2 text-sm font-medium rounded transition-colors ${
                granularity === 'weekly' ? 'bg-[#C2492B] text-white shadow-sm' : 'text-[#56504A] hover:bg-[#EAE3D6]'
              }`}
              onClick={() => { setGranularity('weekly'); setReportData(null); }}
            >
              {t('weekly')}
            </button>
            <button
              className={`px-2 py-2 text-sm font-medium rounded transition-colors ${
                granularity === 'annual' ? 'bg-[#C2492B] text-white shadow-sm' : 'text-[#56504A] hover:bg-[#EAE3D6]'
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
                  className="text-[12.5px] text-[#8A8177] cursor-pointer select-none"
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
                  className="w-full px-[14px] py-3 text-sm border border-[#E3DDD1] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917] bg-[#FFFDFA] font-normal"
                />
              </div>
            ) : granularity === 'weekly' ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="weekPicker" className="text-[12.5px] text-[#8A8177]">{t('week')}</label>
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
                  dateFormat={lang === 'en' ? "'Week' wo, yyyy" : "'Semana' wo 'de' yyyy"}
                  locale={lang === 'en' ? 'en-mon' : 'es-mon'}
                  showWeekNumbers
                  showWeekPicker
                  onWeekSelect={(date: Date, weekNumber?: number) => {
                    const isoWeek = getISOWeekString(date);
                    setCustomWeek(isoWeek);
                    setReportData(null);
                  }}
                  ariaLabelledBy="weekPicker"
                  className="w-full px-[14px] py-3 text-sm border border-[#E3DDD1] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917] bg-[#FFFDFA] font-normal"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="academicYear" className="text-[12.5px] text-[#8A8177]">{t('academic_year')}</label>
                <select
                  id="academicYear"
                  value={academicYear}
                  onChange={(e) => { setAcademicYear(parseInt(e.target.value, 10)); setReportData(null); }}
                  aria-label={t('academic_year')}
                  className="w-full appearance-none px-[14px] py-3 text-sm border border-[#E3DDD1] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917] bg-[#FFFDFA]"
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
                <label className="text-[12.5px] text-[#8A8177]" htmlFor="instrumentFilter">{t('instrument_label')}</label>
                <select
                  id="instrumentFilter"
                  value={instrumentFilter}
                  onChange={(e) => { setInstrumentFilter(e.target.value); setReportData(null); }}
                  className="w-full appearance-none px-[14px] py-3 text-sm border border-[#E3DDD1] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917] bg-[#FFFDFA]"
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
        <p className="text-[12px] text-[#8A8177] mt-3">
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
          <div>
            <h3 className="text-[11.5px] uppercase tracking-[0.09em] font-medium text-[#8A8177] mb-2">{t('selected_student')}</h3>
            {selectedStudent ? (
              <div className="flex flex-col gap-2">
                <div className="border border-[#EAE3D6] rounded-lg px-3.5 py-2.5">
                  <p className="text-sm font-medium text-[#1B1917] leading-snug">{selectedStudent.name}</p>
                  <p className="text-[12.5px] text-[#8A8177]">{selectedStudent.instrument}</p>
                </div>
                <button
                  onClick={() => setStudentModalVisible(true)}
                  className="px-3.5 py-2 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] text-sm font-medium w-full transition-colors"
                >
                  {t('change')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setStudentModalVisible(true)}
                className="w-full px-3.5 py-2.5 text-sm font-medium text-[#56504A] border border-[#DED7C9] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
              >
                {t('select_student_title')}
              </button>
            )}
          </div>
        )}

        {/* Botón para generar reporte */}
        <button
          onClick={handleGenerateReport}
          disabled={generating || (reportType === 'individual' && !selectedStudent)}
          className={`w-full px-6 py-3 rounded-lg flex items-center justify-center font-medium transition-all duration-200 ${
            generating || (reportType === 'individual' && !selectedStudent)
              ? 'bg-[#DED7C9] text-[#8A8177] cursor-not-allowed'
              : 'bg-[#C2492B] text-white hover:bg-[#A83A20]'
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

      {/* Resultados (columna derecha) */}
      <div className="flex flex-col gap-5 min-w-0">

      {/* Sección separada para notificaciones de faltas (solo admin) — apagada
          este ciclo (SHOW_ABSENCE_NOTIFICATIONS, ver arriba), código intacto
          para retomarla más adelante */}
      {SHOW_ABSENCE_NOTIFICATIONS && isAdmin && (
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-6 w-full">
            <div className="mb-4">
              <h3 className="text-[15px] font-semibold text-[#1B1917]">
                {lang === 'es' ? 'Notificaciones de Inasistencias' : 'Absence Notifications'}
              </h3>
              <p className="text-sm text-[#8A8177]">
                {lang === 'es' ? 'Enviar correos a padres sobre faltas injustificadas' : 'Send emails to parents about unexcused absences'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="text-[12.5px] text-[#8A8177] mb-2 block">
                  {lang === 'es' ? 'Seleccione el día para ver las faltas injustificadas:' : 'Select the day to view unexcused absences:'}
                </label>
                <DatePicker
                  selected={selectedReportDate}
                  onChange={(date: Date | null) => date && setSelectedReportDate(date)}
                  dateFormat="dd/MM/yyyy"
                  locale={lang === 'es' ? 'es-mon' : 'en-mon'}
                  maxDate={new Date()}
                  className="px-4 py-2.5 border border-[#E3DDD1] rounded-[9px] focus:outline-none focus:ring-2 focus:ring-red-500/30 text-[#1B1917] font-medium w-full text-center bg-[#FFFDFA]"
                  placeholderText={lang === 'es' ? 'Seleccionar fecha' : 'Select date'}
                  wrapperClassName="w-full"
                />
              </div>
              <button
                onClick={handleShowUnexcusedAbsences}
                disabled={loadingUnexcused}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg flex items-center justify-center font-medium bg-[#A8402A] text-white hover:bg-[#8f3421] shadow-sm whitespace-nowrap"
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
        <div className="bg-[#FFFDFA] p-5 rounded-xl border border-[#EAE3D6]">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h2
              className="text-xl sm:text-2xl text-[#1B1917]"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400 }}
            >
              {reportType === 'individual' && selectedStudent
                ? t('report_for_name', { name: selectedStudent.name })
                : t('group_report_title')}
            </h2>
            <button
              onClick={exportReportToCSV}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm font-medium text-white bg-[#C2492B] rounded-lg hover:bg-[#A83A20] transition-colors flex items-center justify-center"
            >
              <MdDownload className="mr-2" /> {t('export_csv')}
            </button>
          </div>

          <div className="space-y-6">
            {/* Estadísticas */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-[11.5px] uppercase tracking-[0.09em] font-medium text-[#8A8177]">{t('statistics')}</h3>
                {/* Comparación vs. el período anterior (Mensual/Anual — Semanal
                    ya tiene su propia tendencia de 4 semanas más abajo). Solo
                    aparece si hay datos del período anterior para comparar. */}
                {periodComparison && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span
                      className={`font-semibold ${
                        periodComparison.deltaPct > 0.5 ? 'text-green-600' : periodComparison.deltaPct < -0.5 ? 'text-red-600' : 'text-[#8A8177]'
                      }`}
                    >
                      {periodComparison.deltaPct > 0.5 ? '▲' : periodComparison.deltaPct < -0.5 ? '▼' : '▬'}{' '}
                      {periodComparison.deltaPct >= 0 ? '+' : ''}{periodComparison.deltaPct.toFixed(1)} pp
                    </span>
                    <span className="text-[#8A8177]">
                      {lang === 'es'
                        ? `vs. ${periodComparison.previousLabel} (${periodComparison.previousPercentage.toFixed(1)}%)`
                        : `vs. ${periodComparison.previousLabel} (${periodComparison.previousPercentage.toFixed(1)}%)`}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#FFFDFA] rounded-xl p-3 sm:p-4 border border-[#EAE3D6] border-l-4 border-l-[#5F7A57]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs sm:text-sm text-[#6E675E] font-medium">{t('attendance_label')}</p>
                    <div className="bg-[#EDF1E9] p-1.5 rounded-full flex-shrink-0">
                      <MdCheckCircle className="text-[#5F7A57]" size={16} />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-[#1B1917]">{reportData.total_attendance}</p>
                  <p className="text-xs sm:text-sm text-[#8A8177]">{reportData.attendance_percentage.toFixed(1)}%</p>
                </div>

                <div className="bg-[#FFFDFA] rounded-xl p-3 sm:p-4 border border-[#EAE3D6] border-l-4 border-l-[#8A6A22]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs sm:text-sm text-[#6E675E] font-medium">{t('excused_absences_short')}</p>
                    <div className="bg-[#F6EFDF] p-1.5 rounded-full flex-shrink-0">
                      <MdEventBusy className="text-[#8A6A22]" size={16} />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-[#1B1917]">{reportData.total_excused_absences}</p>
                  <p className="text-xs sm:text-sm text-[#8A8177]">{reportData.excused_percentage.toFixed(1)}%</p>
                </div>

                <div className="bg-[#FFFDFA] rounded-xl p-3 sm:p-4 border border-[#EAE3D6] border-l-4 border-l-[#A8402A]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs sm:text-sm text-[#6E675E] font-medium">{t('unexcused_absences_short')}</p>
                    <div className="bg-[#F8E9E4] p-1.5 rounded-full flex-shrink-0">
                      <MdWarning className="text-[#A8402A]" size={16} />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-[#1B1917]">{reportData.total_unexcused_absences}</p>
                  <p className="text-xs sm:text-sm text-[#8A8177]">{reportData.unexcused_percentage.toFixed(1)}%</p>
                </div>

                <div className="bg-[#FFFDFA] rounded-xl p-3 sm:p-4 border border-[#EAE3D6] border-l-4 border-l-[#DED7C9]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs sm:text-sm text-[#6E675E] font-medium">{t('total_records')}</p>
                    <div className="bg-[#F4F0E8] p-1.5 rounded-full flex-shrink-0">
                      <MdAssessment className="text-[#56504A]" size={16} />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-[#1B1917]">{reportData.total}</p>
                </div>
              </div>
            </div>
            
            {/* Gráfico */}
            <div className="bg-[#FFFDFA] p-3 sm:p-4 rounded-xl border border-[#EAE3D6]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <h3 className="font-medium text-[#1B1917] text-base sm:text-lg">{t('attendance_distribution')}</h3>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                  <button 
                    onClick={() => setChartType('pie')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      chartType === 'pie' ? 'bg-[#C2492B] text-white' : 'bg-[#EAE3D6] hover:bg-[#DED7C9]'
                    }`}
                  >
                    {t('pie')}
                  </button>
                  <button 
                    onClick={() => setChartType('bar')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      chartType === 'bar' ? 'bg-[#C2492B] text-white' : 'bg-[#EAE3D6] hover:bg-[#DED7C9]'
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

              {/* Attendance by Instrument / Top 5 / Attendance by Position
                  (solo reporte grupal) — tarjetas independientes en 2
                  columnas (como el mockup): Instrumento y Posición apiladas
                  del lado izquierdo, Top 5 sola del lado derecho, para
                  ahorrar espacio vertical sin dejar huecos entre tarjetas de
                  distinta altura. El de Instrumento solo aparece si el
                  filtro está en "Todos" y si hay más de una categoría real
                  con datos. Top 5 pide al menos 2 registros por estudiante
                  para que el % no sea un solo día suelto. */}
              {reportType === 'group' && (
                topAttendance.length > 0 ||
                (instrumentFilter === 'all' && instrumentBreakdown.length > 1) ||
                positionBreakdown.length > 1
              ) && (
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  <div className="flex flex-col gap-5">
                  {instrumentFilter === 'all' && instrumentBreakdown.length > 1 && (
                    <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 sm:p-5">
                      <h3 className="font-medium text-[#1B1917] mb-3">
                        {lang === 'es' ? 'Asistencia por Instrumento' : 'Attendance by Instrument'}
                      </h3>
                      <div className="space-y-2">
                        {instrumentBreakdown.map((b) => (
                          <div key={b.label}>
                            <div className="flex justify-between text-xs text-[#6E675E] mb-0.5">
                              <span className="truncate">{b.label}</span>
                              <span className="font-medium flex-shrink-0 ml-2">{Math.round(b.percentage)}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-[#F4F0E8] overflow-hidden">
                              <div className="h-full bg-[#C2492B] rounded-full" style={{ width: `${Math.max(2, Math.round(b.percentage))}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {positionBreakdown.length > 1 && (
                    <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 sm:p-5">
                      <h3 className="font-medium text-[#1B1917] mb-3">
                        {lang === 'es' ? 'Asistencia por Posición' : 'Attendance by Position'}
                      </h3>
                      <div className="space-y-2">
                        {positionBreakdown.map((b) => (
                          <div key={b.label}>
                            <div className="flex justify-between text-xs text-[#6E675E] mb-0.5">
                              <span className="truncate">{b.label}</span>
                              <span className="font-medium flex-shrink-0 ml-2">{Math.round(b.percentage)}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-[#F4F0E8] overflow-hidden">
                              <div className="h-full bg-[#7A8B6F] rounded-full" style={{ width: `${Math.max(2, Math.round(b.percentage))}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>

                  {topAttendance.length > 0 && (
                    <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 sm:p-5">
                      <h3 className="font-medium text-[#C2492B] mb-3">
                        {lang === 'es' ? 'Top 5 — Mejor Asistencia' : 'Top 5 — Best Attendance'}
                      </h3>
                      <div className="space-y-2">
                        {(() => {
                          // Cuántas filas comparten cada "rank" (empate real, no
                          // solo posición en la lista) — para mostrar "(empate)"
                          // junto al % cuando aplica.
                          const rankCounts = new Map<number, number>();
                          topAttendance.forEach(s => rankCounts.set(s.rank, (rankCounts.get(s.rank) || 0) + 1));
                          return topAttendance.map((s) => {
                            const isTied = (rankCounts.get(s.rank) || 0) > 1;
                            return (
                              <div key={s.id} className="flex items-center gap-3 border-b border-[#EFE9DD] last:border-b-0 pb-2 last:pb-0">
                                <span
                                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    s.rank === 1 ? 'text-[#8A6A22]' : s.rank === 2 ? 'text-[#8A8177]' : s.rank === 3 ? 'text-[#A83A20]' : 'text-[#A29889]'
                                  }`}
                                  title={isTied ? (lang === 'es' ? `Empatado en el lugar ${s.rank}` : `Tied for place ${s.rank}`) : undefined}
                                >
                                  {s.rank}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#1B1917] truncate">{s.name}</p>
                                  <p className="text-xs text-[#8A8177] truncate">{s.instrument || (lang === 'es' ? 'Sin instrumento' : 'No instrument')}</p>
                                </div>
                                <span className="text-right flex-shrink-0">
                                  <span className="text-sm font-semibold text-[#1B1917]">{Math.round(s.percentage)}%</span>
                                  {isTied && (
                                    <span className="block text-[10px] text-[#A29889] leading-tight">
                                      {lang === 'es' ? 'empate' : 'tied'}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      {topAttendanceMoreTied && (
                        <p className="text-xs text-[#8A8177] mt-2">
                          {lang === 'es'
                            ? `+${topAttendanceMoreTied.count} estudiante(s) más también con ${Math.round(topAttendanceMoreTied.percentage)}%.`
                            : `+${topAttendanceMoreTied.count} more student(s) also at ${Math.round(topAttendanceMoreTied.percentage)}%.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tendencia semanal: últimas 4 semanas */}
              {granularity === 'weekly' && weeklyTrend.length > 0 && (
                <div className="mt-20 sm:mt-6">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h3 className="font-medium text-[#1B1917]">{t('weekly_trend_title')}</h3>
                      <p className="text-[11px] text-[#8A8177]">
                        {lang === 'es' ? 'Según la pendiente de las 4 semanas, no solo la última' : 'Based on the 4-week slope, not just the latest week'}
                      </p>
                    </div>
                    <span
                      className={`${trendDirection === 'up' ? 'text-[#5F7A57]' : trendDirection === 'down' ? 'text-[#A8402A]' : 'text-[#6E675E]'} text-sm font-medium whitespace-nowrap`}
                      title={
                        lang === 'es'
                          ? `Pendiente promedio: ${trendSlope >= 0 ? '+' : ''}${trendSlope.toFixed(1)} pp por semana (calculada con las 4 semanas)`
                          : `Average slope: ${trendSlope >= 0 ? '+' : ''}${trendSlope.toFixed(1)} pp per week (calculated across all 4 weeks)`
                      }
                    >
                      {trendDirection === 'up' ? `▲ ${t('trend_up')}` : trendDirection === 'down' ? `▼ ${t('trend_down')}` : `▬ ${t('trend_flat')}`}
                    </span>
                  </div>

                  {/* Mini-gráfico: valor real de cada semana vs. la línea de
                      tendencia (pendiente de las 4 semanas) — para que se
                      entienda de un vistazo por qué la flecha puede decir
                      "Downward" aunque la última semana haya subido fuerte:
                      la línea punteada resume las 4 semanas, no solo la
                      última. */}
                  {weeklyTrend.length === 4 && (() => {
                    const yVals = weeklyTrend.map(w => Math.max(0, Math.min(100, w.percentage)));
                    const meanX = 1.5;
                    const meanY = yVals.reduce((a, b) => a + b, 0) / 4;
                    const intercept = meanY - trendSlope * meanX;
                    const trendVals = [0, 1, 2, 3].map(x => Math.max(0, Math.min(100, intercept + trendSlope * x)));
                    // viewBox 400x120 pensado para calzar con el ancho máximo
                    // del contenedor (max-w-md, 448px) y la altura (h-24,
                    // 96px) de abajo — en pantallas anchas el gráfico antes
                    // se estiraba a todo el ancho de la tarjeta (~700-900px)
                    // sobre solo 56px de alto, y una línea tan aplastada se
                    // ve prácticamente plana aunque los datos varíen mucho.
                    // Limitar el ancho máximo y subir el alto lo arregla.
                    const padX = 40;
                    const padY = 15;
                    const vbW = 400;
                    const vbH = 120;
                    const xPos = (i: number) => padX + i * ((vbW - 2 * padX) / 3);
                    const yPos = (v: number) => (vbH - padY) - v * ((vbH - 2 * padY) / 100);
                    return (
                      <div className="mb-3 p-3 bg-[#FFFDFA] border border-[#EAE3D6] rounded-lg max-w-md mx-auto">
                        <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-24" preserveAspectRatio="none">
                          <polyline
                            points={trendVals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
                            fill="none"
                            stroke="#A29889"
                            strokeWidth="2"
                            strokeDasharray="5,4"
                          />
                          <polyline
                            points={yVals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
                            fill="none"
                            stroke="#C2492B"
                            strokeWidth="2"
                          />
                          {yVals.map((v, i) => (
                            <circle key={weeklyTrend[i].week} cx={xPos(i)} cy={yPos(v)} r="3" fill="#C2492B" />
                          ))}
                        </svg>
                        <div className="flex items-center gap-4 mt-1 text-[10px] text-[#8A8177]">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-0.5 bg-[#C2492B]" />
                            {lang === 'es' ? 'Real' : 'Actual'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-3 border-t-2 border-dashed border-[#A29889]" />
                            {lang === 'es' ? 'Tendencia (4 semanas)' : 'Trend (4 weeks)'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {weeklyTrend.map((w) => {
                    const isCurrent = w.week === customWeek;
                    return (
                      <div key={w.week} className={`p-2 sm:p-3 rounded-lg border flex flex-col items-center ${isCurrent ? 'bg-[#FBF2ED] border-[#C2492B]' : 'bg-[#FAF7F2] border-[#EAE3D6]'}`}>
                        <div className="w-full h-20 sm:h-24 flex items-end">
                          <div
                            className={`w-full rounded-t-md ${isCurrent ? 'bg-[#C2492B]' : 'bg-[#D9CBB8]'}`}
                            style={{ height: `${Math.max(4, Math.min(100, Math.round(w.percentage)))}%` }}
                            title={`${w.percentage.toFixed(1)}%`}
                          />
                        </div>
                        <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-[#1B1917] font-medium">{Math.round(w.percentage)}%</div>
                        <div className="text-[10px] sm:text-xs text-[#6E675E] text-center leading-tight">{w.label}</div>
                        {isCurrent && (
                          <span className="mt-1 text-[8px] sm:text-[10px] px-1 sm:px-2 py-0.5 rounded-full bg-[#EFE9DD] text-[#A83A20] font-medium">Actual</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                  {/* Deltas semana a semana */}
                  {weeklyTrend.length === 4 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {Array.from({ length: 3 }).map((_, i) => {
                        // Redondeamos ANTES de restar, con los mismos enteros
                        // que se muestran en cada tarjeta (Math.round arriba)
                        // — si no, dos semanas que se ven iguales en pantalla
                        // (ej. "19%" y "19%") podían mostrar un delta que no
                        // era exactamente 0 (ej. "-0.4 pp"), por diferencias
                        // de menos de un punto que no se ven en la etiqueta.
                        const a = Math.round(weeklyTrend[i].percentage);
                        const b = Math.round(weeklyTrend[i + 1].percentage);
                        const diff = b - a;
                        const sign = diff > 0 ? '+' : '';
                        const color = diff > 0 ? 'text-[#5F7A57]' : diff < 0 ? 'text-[#A8402A]' : 'text-[#6E675E]';
                        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '▬';
                        return (
                          <div key={`delta-${i}`} className="text-sm font-medium text-center bg-[#FFFDFA] border border-[#EAE3D6] rounded-lg py-2">
                            <span className={`${color}`}>{arrow} {sign}{diff} pp</span>
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
                    <h3 className="font-medium text-[#1B1917]">{t('monthly_breakdown_title')}</h3>
                    <div className="hidden sm:flex items-center gap-3 text-xs text-[#56504A]">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#5F7A57]" /> {t('attendance_label')}</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#8A6A22]" /> {t('excused_absences_short')}</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#A8402A]" /> {t('unexcused_absences_short')}</span>
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
                        <div key={m.key} className="group p-3 rounded-lg border border-[#EAE3D6] bg-[#FFFDFA] hover:shadow transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-[#1B1917]">{m.label}</div>
                            <div className="text-[10px] text-[#8A8177] group-hover:opacity-100 opacity-70 transition-opacity">{total} reg.</div>
                          </div>
                          <div className="w-full h-4 rounded-full bg-[#F4F0E8] overflow-hidden">
                            {hasData ? (
                              <div className="w-full h-full flex">
                                {aW > 0 && <div className="h-full bg-[#5F7A57]" style={{ width: `${aW}%` }} title={`${t('attendance_label')}: ${m.a} (${Math.round(aW)}%)`} />}
                                {eaW > 0 && <div className="h-full bg-[#8A6A22]" style={{ width: `${eaW}%` }} title={`${t('excused_absences_short')}: ${m.ea} (${Math.round(eaW)}%)`} />}
                                {uaW > 0 && <div className="h-full bg-[#A8402A]" style={{ width: `${uaW}%` }} title={`${t('unexcused_absences_short')}: ${m.ua} (${Math.round(uaW)}%)`} />}
                              </div>
                            ) : (
                              <div className="w-full h-full bg-[#EAE3D6]" title={t('no_data_available')} />
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-[#6E675E]">
                            <span className="px-1.5 py-0.5 rounded bg-[#EDF1E9] text-[#5F7A57]">A:{m.a}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#F6EFDF] text-[#8A6A22]">EA:{m.ea}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#F8E9E4] text-[#A8402A]">UA:{m.ua}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 sm:hidden flex items-center gap-3 text-xs text-[#56504A]">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#5F7A57]" /> A</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#8A6A22]" /> EA</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-[#A8402A]" /> UA</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      </div>
      {/* fin columna de resultados */}
      </div>
      {/* fin grid de 2 columnas */}
      </div>
      {/* fin max-w-[1420px] mx-auto */}

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
          <div className="bg-[#FAF7F2] rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#EFE9DD] rounded-lg">
                  <MdEmail className="text-[#C2492B]" size={20} />
                </div>
                <h2 className="text-xl font-bold text-[#1B1917]">{t('email_preview')}</h2>
              </div>
              <button
                onClick={() => {
                  setEmailPreviewVisible(false);
                  setEmailPreviewData(null);
                }}
                className="text-[#A29889] hover:text-[#6E675E] hover:bg-[#F4F0E8] rounded-full p-2 transition-colors"
              >
                <MdClose size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Email headers */}
                <div className="border-b border-[#EAE3D6] pb-4 space-y-2">
                  <div className="flex items-start">
                    <span className="font-semibold text-[#56504A] min-w-[80px]">{t('email_to')}</span>
                    <span className="text-[#6E675E]">{emailPreviewData.to}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-semibold text-[#56504A] min-w-[80px]">{t('email_subject')}</span>
                    <span className="text-[#6E675E]">{emailPreviewData.subject}</span>
                  </div>
                </div>

                {/* Email body */}
                <div className="bg-[#FAF7F2] rounded-lg p-4 border border-[#EAE3D6]">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-[#1B1917] leading-relaxed">
                    {emailPreviewData.body}
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#FAF7F2] px-6 py-4 border-t border-[#EAE3D6]">
              {/* Selector de proveedor de email */}
              <div className="mb-4">
                <label className="text-sm font-medium text-[#56504A] mb-2 block">
                  {lang === 'es' ? 'Enviar desde:' : 'Send from:'}
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEmailProvider('gmail')}
                    className={`flex-1 px-4 py-2 rounded-md border-2 transition-all font-medium ${
                      emailProvider === 'gmail'
                        ? 'border-red-500 bg-[#F8E9E4] text-[#8f3421]'
                        : 'border-[#DED7C9] bg-[#FAF7F2] text-[#56504A] hover:border-[#C2492B]'
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
                        : 'border-[#DED7C9] bg-[#FAF7F2] text-[#56504A] hover:border-[#C2492B]'
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
                  className="px-4 py-2 bg-[#EAE3D6] text-[#56504A] rounded-md hover:bg-[#DED7C9] transition-colors font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleConfirmSendEmail}
                  className="px-4 py-2 bg-[#C2492B] text-white rounded-md hover:bg-[#A83A20] transition-colors font-medium flex items-center"
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
          <div className="bg-[#FAF7F2] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#FAF7F2] border-b border-[#EAE3D6] px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#F8E9E4] rounded-lg">
                  <MdWarning className="text-[#A8402A]" size={20} />
                </div>
                <h2 className="text-xl font-bold text-[#1B1917]">
                  {lang === 'es' ? 'Faltas Injustificadas' : 'Unexcused Absences'} - {selectedReportDate.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <button
                onClick={() => setUnexcusedAbsencesModalVisible(false)}
                className="text-[#A29889] hover:text-[#6E675E] hover:bg-[#F4F0E8] rounded-full p-2 transition-colors"
              >
                <MdClose size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {unexcusedStudents.length === 0 ? (
                <div className="text-center py-8 text-[#8A8177]">
                  {t('no_students_unexcused_this_week')}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-[#6E675E] mb-4">
                    {t('total_students_with_unexcused')} <span className="font-bold text-[#A8402A]">{unexcusedStudents.length}</span>
                  </div>
                  
                  {unexcusedStudents.map((item, index) => (
                    <div key={item.student.id} className="border border-[#EAE3D6] rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                        {/* Información del estudiante */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-[#F8E9E4] text-[#8f3421] text-xs font-bold px-2 py-1 rounded">
                              #{index + 1}
                            </span>
                            <h3 className="text-lg font-semibold text-[#1B1917]">
                              {item.student.name}
                            </h3>
                          </div>
                          <div className="text-sm text-[#6E675E] space-y-1">
                            <p><span className="font-medium">{t('instrument_label')}:</span> {item.student.instrument}</p>
                            <p><span className="font-medium">{t('unexcused_count')}</span> 
                              <span className="ml-2 bg-[#A8402A] text-white px-2 py-0.5 rounded font-bold">
                                {item.absences}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Información del padre/madre */}
                        <div className="bg-[#FAF7F2] rounded-lg p-3 sm:w-64">
                          <h4 className="text-sm font-semibold text-[#56504A] mb-2">{t('parent_contact_label')}</h4>
                          {item.parentInfo ? (
                            <>
                              <div className="text-sm text-[#6E675E] space-y-1 mb-3">
                                <p><span className="font-medium">{t('parent_name')}:</span> {item.parentInfo.full_name || 'N/A'}</p>
                                <p><span className="font-medium">{t('parent_phone')}:</span> {item.parentInfo.phone_number || 'N/A'}</p>
                                <p><span className="font-medium">{t('parent_email')}:</span> {item.parentInfo.email || 'N/A'}</p>
                              </div>
                              
                              {/* Botón para previsualizar email */}
                              {item.parentInfo.email && (
                                <button
                                  onClick={() => handlePreviewEmail(item)}
                                  className="w-full px-3 py-2 bg-[#C2492B] text-white rounded-md hover:bg-[#A83A20] transition-colors flex items-center justify-center text-sm font-medium"
                                >
                                  <MdEmail className="mr-2" size={16} />
                                  {t('preview_email')}
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-[#8A8177] italic">{t('no_contact_info')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#FAF7F2] px-6 py-4 flex justify-end gap-3 border-t border-[#EAE3D6]">
              <button
                onClick={() => setUnexcusedAbsencesModalVisible(false)}
                className="px-4 py-2 bg-[#EAE3D6] text-[#56504A] rounded-md hover:bg-[#DED7C9] transition-colors font-medium"
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
