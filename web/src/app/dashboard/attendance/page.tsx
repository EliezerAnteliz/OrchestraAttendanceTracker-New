"use client";

import React, { useState, useEffect } from 'react';
import AttendanceStatusIndicator from '@/components/AttendanceStatusIndicator';
import { supabase } from '../../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';

// Define types for our data structures
type Student = {
  id: string;
  first_name: string;
  last_name: string;
  selected?: boolean;
  attendance_status?: string | null;
  [key: string]: any; // For other properties that might exist
};

type AttendanceStatus = {
  code: string;
  description?: string;
  [key: string]: any; // For other properties
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status_code?: string;
  status_id?: string;
  attendance_status_id?: string;
  status?: string;
  attendance_status?: string;
  code?: string;
  updated_at?: string;
  [key: string]: any; // For other properties
};

export default function AttendancePage() {
  const { t, lang } = useI18n();
  const { activeProgram } = useProgram();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [attendanceStatuses, setAttendanceStatuses] = useState<AttendanceStatus[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentDate, setCurrentDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [selectedStudentCount, setSelectedStudentCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all');
  const [availableInstruments, setAvailableInstruments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);


  // Función para obtener los datos de asistencia para una fecha específica
  const fetchAttendanceData = async (date: string) => {
    try {
      // Normalizar la fecha a YYYY-MM-DD sin provocar desfase por zona horaria
      let day = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : format(new Date(date), 'yyyy-MM-dd');
      
      // Defensa adicional: si el input es YYYY-MM-DD pero por alguna razón el cálculo difiere, forzar el input
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && day !== date) {
        console.warn('[fetchAttendanceData] Corrección defensiva de fecha. input=', date, 'calc=', day);
        day = date;
      }
      console.log('[fetchAttendanceData] input=', date, 'day=', day, 'tz=', Intl.DateTimeFormat().resolvedOptions().timeZone);

      // 1) Intentar con JOIN usando status_code (basado en las memorias)
      try {
        const withJoin = await supabase
          .from('attendance')
          .select(`
            *,
            attendance_status:status_code(id, code, name, color)
          `)
          .eq('program_id', activeProgram?.id as string)
          .eq('date', day);

        if (!withJoin.error && withJoin.data?.length) {
          const dates = Array.from(new Set(withJoin.data.map((r: any) => r.date)));
          console.log('[Attendance] JOIN con status_code OK para date=', day, 'rows=', withJoin.data.length, 'dates_in_rows=', dates);
          return withJoin.data as any[];
        }
        
        if (withJoin.error) {
          console.log('[Attendance] JOIN con status_code error:', withJoin.error.message);
        }
      } catch (joinError) {
        console.log('[Attendance] JOIN con status_code falló:', joinError);
      }

      // 2) Fallback: intentar JOIN con status
      try {
        const withStatusJoin = await supabase
          .from('attendance')
          .select(`
            *,
            attendance_status:status(id, code, name, color)
          `)
          .eq('program_id', activeProgram?.id as string)
          .eq('date', day);

        if (!withStatusJoin.error && withStatusJoin.data?.length) {
          const dates = Array.from(new Set(withStatusJoin.data.map((r: any) => r.date)));
          console.log('[Attendance] JOIN con status OK para date=', day, 'rows=', withStatusJoin.data.length, 'dates_in_rows=', dates);
          return withStatusJoin.data as any[];
        }
        
        if (withStatusJoin.error) {
          console.log('[Attendance] JOIN con status error:', withStatusJoin.error.message);
        }
      } catch (joinError) {
        console.log('[Attendance] JOIN con status falló:', joinError);
      }

      // 3) Consulta sin JOIN - datos planos
      const main = await supabase
        .from('attendance')
        .select('*')
        .eq('program_id', activeProgram?.id as string)
        .eq('date', day);

      if (!main.error && main.data?.length) {
        const dates = Array.from(new Set(main.data.map((r: any) => r.date)));
        console.log('[Attendance] Filtrado por date=', day, 'rows=', main.data.length, 'dates_in_rows=', dates);
        return main.data as any[];
      }

      console.log('[Attendance] JOIN error, intentando fallback:', main.error?.message || 'No data');

      // 4) Fallback sin program_id
      const fb = await supabase
        .from('attendance')
        .select('*')
        .eq('date', day);
        
      if (!fb.error && fb.data?.length) {
        const dates = Array.from(new Set(fb.data.map((r: any) => r.date)));
        console.log('[Attendance] Fallback sin program_id OK para date=', day, 'rows=', fb.data.length, 'dates_in_rows=', dates);
        return fb.data as any[];
      }

      if (fb.error) console.error('[Attendance] Fallback error:', fb.error.message);
      return [];
    } catch (error: any) {
      console.error('Error al obtener datos de asistencia:', error?.message || error);
      return [];
    }
  };
  
  // Función para cargar y actualizar los datos de asistencia
  const loadAttendanceData = async (date: string) => {
    try {
      // Obtener datos de asistencia para la fecha seleccionada
      const attendanceData = await fetchAttendanceData(date);
      
      console.log(`Datos de asistencia obtenidos para la fecha ${date}:`, {
        cantidad: attendanceData?.length || 0,
        primerosTres: attendanceData?.slice(0, 3) || []
      });
      
      // Actualizar los estudiantes con sus estados de asistencia
      setStudents(prevStudents => {
        const updatedStudents = prevStudents.map(student => {
          const attendanceRecord = attendanceData?.find(
            record => record.student_id === student.id && record.date === date
          );
          
          if (!attendanceRecord) {
            console.log(`No se encontró registro de asistencia para estudiante ${student.id} (${student.first_name} ${student.last_name}) en la fecha seleccionada. Estableciendo estado como no registrado (null).`);
            // Mostrar exactamente lo que hay en DB: si no hay registro, no hay estado
            return {
              ...student,
              attendance_status: null
            };
          }
          
          // DEPURACIÓN: Mostrar el registro completo para ver todas las propiedades
          console.log(`Registro de asistencia para estudiante ${student.id}:`, attendanceRecord);
          
          // Simplificar: usar exactamente lo que diga la base de datos en status_code
          // y dejar que el componente lo traduzca a etiqueta/colores
          const attendanceStatus = attendanceRecord.status_code ?? null;
          
          console.log('Actualizando estado de asistencia para estudiante:', { 
            studentId: student.id, 
            nombre: `${student.first_name} ${student.last_name}`,
            attendanceStatus,
            tieneRelacion: !!attendanceRecord.attendance_status
          });
          
          return {
            ...student,
            attendance_status: attendanceStatus
          };
        });
        
        console.log(`Estados de asistencia actualizados para ${updatedStudents.length} estudiantes`);
        // Mostrar algunos ejemplos para depuración
        updatedStudents.slice(0, 3).forEach((student, index) => {
          console.log(`Estudiante ${index + 1} (${student.first_name} ${student.last_name}): Estado = ${student.attendance_status || 'No registrado'}`);
        });
        
        return updatedStudents;
      });
      
      // Actualizar también los estudiantes filtrados
      setFilteredStudents(prevFiltered => {
        const updatedFiltered = prevFiltered.map(student => {
          const attendanceRecord = attendanceData?.find(
            record => record.student_id === student.id && record.date === date
          );
          
          if (!attendanceRecord) {
            // Si no hay registro devuelto para la fecha/programa, reflejar "no registrado"
            return {
              ...student,
              attendance_status: null
            };
          }
          
          // Simplificar: usar exactamente status_code desde la DB
          const attendanceStatus = attendanceRecord.status_code ?? null;
          
          return {
            ...student,
            attendance_status: attendanceStatus
          };
        });
        
        return updatedFiltered;
      });
      
      return attendanceData;
    } catch (err) {
      console.error('Error al cargar datos de asistencia:', err);
      return null;
    }
  };


  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        if (!activeProgram?.id) {
          setStudents([]);
          setFilteredStudents([]);
          setAttendanceStatuses([]);
          return;
        }
        
        // Cargar estudiantes
        console.log('Iniciando carga de estudiantes...');
        console.log(`Fecha actual seleccionada: ${currentDate}`);
        
        // Verificar la conexión a Supabase
        console.log('Verificando conexión a Supabase...');
        const { data: connectionTest, error: connectionError } = await supabase
          .from('students')
          .select('count')
          .limit(1);
          
        if (connectionError) {
          console.error('Error de conexión a Supabase:', connectionError);
          throw new Error(`Error de conexión a Supabase: ${connectionError.message}`);
        }
        
        console.log('Conexión a Supabase exitosa');
        // Depuración: mostrar usuario autenticado y programa activo
        const ures = await supabase.auth.getUser();
        console.log('[Auth] Usuario actual:', {
          error: ures.error?.message,
          userId: ures.data?.user?.id,
          email: ures.data?.user?.email,
          activeProgramId: activeProgram?.id
        });
        
        // Cargar estudiantes activos
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('is_active', true)
          .eq('program_id', activeProgram.id)
          .order('first_name', { ascending: true })
          .order('last_name', { ascending: true });
        
        console.log('Respuesta de estudiantes:', { 
          data: studentsData, 
          cantidad: studentsData?.length || 0,
          error: studentsError 
        });
        
        if (studentsError) {
          console.error('Error al cargar estudiantes:', studentsError);
          throw studentsError;
        }
        
        if (!studentsData || studentsData.length === 0) {
          console.warn('No se encontraron estudiantes activos en la base de datos');
        }
        
        // Cargar estados de asistencia
        const { data: statusesData, error: structureError } = await supabase
          .from('attendance_status')
          .select('*');
        
        console.log('Estados de asistencia cargados:', statusesData);
        
        if (structureError) {
          console.error('Error al cargar estados de asistencia:', structureError);
          throw structureError;
        }
        
        // Cargar datos de asistencia para la fecha actual
        console.log(`Cargando datos de asistencia para la fecha: ${currentDate}`);
        const attendanceData = await fetchAttendanceData(currentDate);
        console.log('[Attendance] student_ids devueltos:', attendanceData?.map(r => r.student_id));
        
        // Mapear los estados de asistencia a los estudiantes
        const studentsWithAttendance = studentsData?.map(student => {
          const attendanceRecord = attendanceData?.find(
            record => record.student_id === student.id && record.date === currentDate
          );
          
          let attendanceStatus = null;
          
          if (attendanceRecord) {
            // Si tenemos la relación con attendance_status (del JOIN)
            if (attendanceRecord.attendance_status && typeof attendanceRecord.attendance_status === 'object') {
              // Usar el código del estado relacionado
              attendanceStatus = attendanceRecord.attendance_status.code;
              console.log(`Usando estado de la relación para ${student.first_name} ${student.last_name}:`, attendanceRecord.attendance_status);
            } 
            // Si no tenemos la relación, buscar en los campos directos
            else {
              // Priorizar status_code ya que es el campo que usamos para guardar
              if (attendanceRecord.status_code !== undefined && attendanceRecord.status_code !== null) {
                attendanceStatus = attendanceRecord.status_code;
              } else if (attendanceRecord.status_id !== undefined && attendanceRecord.status_id !== null) {
                attendanceStatus = attendanceRecord.status_id;
              } else if (attendanceRecord.attendance_status_id !== undefined && attendanceRecord.attendance_status_id !== null) {
                attendanceStatus = attendanceRecord.attendance_status_id;
              } else if (attendanceRecord.status !== undefined && attendanceRecord.status !== null) {
                attendanceStatus = attendanceRecord.status;
              } else if (typeof attendanceRecord.attendance_status === 'string' && attendanceRecord.attendance_status !== null) {
                attendanceStatus = attendanceRecord.attendance_status;
              } else if (attendanceRecord.code !== undefined && attendanceRecord.code !== null) {
                attendanceStatus = attendanceRecord.code;
              }
            }
          }
          
          console.log('Estado de asistencia para estudiante:', { 
            studentId: student.id, 
            nombre: `${student.first_name} ${student.last_name}`,
            fecha: currentDate,
            attendanceStatus,
            tieneRegistro: !!attendanceRecord
          });
          
          return {
            ...student,
            selected: false,
            attendance_status: attendanceStatus
          };
        }) || [];
        
        console.log(`Procesados ${studentsWithAttendance.length} estudiantes con sus estados de asistencia para la fecha ${currentDate}`);
        
        // Extraer instrumentos únicos para el filtro
        const instruments = Array.from(new Set(
          studentsWithAttendance
            .map(student => student.instrument)
            .filter(instrument => instrument && instrument.trim() !== '')
            .sort()
        ));
        
        setStudents(studentsWithAttendance);
        setFilteredStudents(studentsWithAttendance);
        setAttendanceStatuses(statusesData || []);
        setAvailableInstruments(instruments as string[]);
        
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [currentDate, activeProgram?.id]);

  // Suscripción en tiempo real a cambios en la tabla attendance para la fecha/programa actuales
  useEffect(() => {
    if (!activeProgram?.id || !currentDate) return;
    console.log('[Realtime] Subscribing to attendance changes for', { program_id: activeProgram.id, date: currentDate });
    const channel = supabase
      .channel(`attendance-${activeProgram.id}-${currentDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `program_id=eq.${activeProgram.id}`
        },
        (payload: any) => {
          const changedDate = (payload.new?.date || payload.old?.date || '') as string;
          // Solo recargar si el cambio corresponde al día actual mostrado
          if (changedDate && changedDate.startsWith(currentDate)) {
            console.log('[Realtime] Cambio detectado en attendance, recargando datos...', payload);
            loadAttendanceData(currentDate);
          }
        }
      )
      .subscribe((status: any) => {
        console.log('[Realtime] Channel status:', status);
      });

    return () => {
      try {
        console.log('[Realtime] Removing channel');
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('[Realtime] Error removing channel', e);
      }
    };
  }, [activeProgram?.id, currentDate]);

  // Refrescar al volver a la pestaña/ventana
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && activeProgram?.id && currentDate) {
        console.log('[Visibility] Tab visible, recargando datos de asistencia');
        loadAttendanceData(currentDate);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeProgram?.id, currentDate]);
  
  // Función para filtrar estudiantes
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    applyFilters(term, selectedInstrument);
  };
  
  // Función para manejar el cambio de instrumento seleccionado
  const handleInstrumentChange = (instrument: string) => {
    setSelectedInstrument(instrument);
    applyFilters(searchTerm, instrument);
  };
  
  // Función para aplicar todos los filtros
  const applyFilters = (searchTerm: string, instrument: string) => {
    let filtered = students;
    
    // Filtrar por término de búsqueda
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(student => 
        student.first_name.toLowerCase().includes(searchTerm) || 
        student.last_name.toLowerCase().includes(searchTerm) || 
        (student.instrument && student.instrument.toLowerCase().includes(searchTerm))
      );
    }
    
    // Filtrar por instrumento
    if (instrument !== 'all') {
      filtered = filtered.filter(student => 
        student.instrument && student.instrument.toLowerCase() === instrument.toLowerCase()
      );
    }
    
    setFilteredStudents(filtered);
  };
  
  const toggleAttendanceMode = () => {
    setAttendanceMode(!attendanceMode);
    
    // Resetear selecciones al cambiar de modo
    setStudents(prevStudents => 
      prevStudents.map(student => ({ ...student, selected: false }))
    );
    
    setFilteredStudents(prevFiltered => 
      prevFiltered.map(student => ({ ...student, selected: false }))
    );
    
    setSelectedStudentCount(0);
  };
  
  // Función para seleccionar/deseleccionar un estudiante
  const toggleStudentSelection = (studentId: string) => {
    if (!attendanceMode) return;
    
    // Encontrar el estudiante actual para determinar su estado de selección
    const currentStudent = students.find(s => s.id === studentId);
    const isCurrentlySelected = currentStudent?.selected || false;
    
    // Calcular el nuevo estado de selección (invertir el actual)
    const newSelectionState = !isCurrentlySelected;
    
    // Actualizar la lista principal de estudiantes
    setStudents(prevStudents => 
      prevStudents.map(student => 
        student.id === studentId 
          ? { ...student, selected: newSelectionState } 
          : student
      )
    );
    
    // Actualizar la lista filtrada de estudiantes
    setFilteredStudents(prevFiltered => 
      prevFiltered.map(student => 
        student.id === studentId 
          ? { ...student, selected: newSelectionState } 
          : student
      )
    );
    
    // Actualizar contador de estudiantes seleccionados
    // Incrementar si estamos seleccionando, decrementar si estamos deseleccionando
    setSelectedStudentCount(prev => 
      newSelectionState ? prev + 1 : prev - 1
    );
    
    console.log(`Estudiante ${studentId} ${newSelectionState ? 'seleccionado' : 'deseleccionado'}. Total seleccionados: ${newSelectionState ? selectedStudentCount + 1 : selectedStudentCount - 1}`);
  };
  
  // Función para seleccionar todos los estudiantes visibles (filtrados)
  const selectAllStudents = () => {
    if (!attendanceMode) return;
    
    // Actualizar la lista principal de estudiantes
    setStudents(prevStudents => 
      prevStudents.map(student => {
        // Solo seleccionar si el estudiante está en la lista filtrada
        const isInFilteredList = filteredStudents.some(s => s.id === student.id);
        return isInFilteredList ? { ...student, selected: true } : student;
      })
    );
    
    // Actualizar la lista filtrada de estudiantes
    setFilteredStudents(prevFiltered => 
      prevFiltered.map(student => ({ ...student, selected: true }))
    );
    
    // Actualizar el contador de estudiantes seleccionados
    setSelectedStudentCount(filteredStudents.length);
    
    console.log(`Todos los estudiantes seleccionados. Total: ${filteredStudents.length}`);
  };
  
  // Función para deseleccionar todos los estudiantes
  const deselectAllStudents = () => {
    // Deseleccionar todos los estudiantes en el estado local
    setStudents(prevStudents => 
      prevStudents.map(student => ({ ...student, selected: false }))
    );
    
    // Deseleccionar todos los estudiantes en la lista filtrada
    setFilteredStudents(prevFiltered => 
      prevFiltered.map(student => ({ ...student, selected: false }))
    );
    
    // Actualizar el contador de estudiantes seleccionados
    setSelectedStudentCount(0);
    
    console.log('Todos los estudiantes deseleccionados');
  };

  // Función para limpiar la asistencia de los estudiantes seleccionados
  const clearAttendanceForDate = async () => {
    if (!activeProgram?.id) {
      alert('No hay programa activo seleccionado.');
      return;
    }

    // Obtener estudiantes seleccionados
    const selectedStudents = filteredStudents.filter(student => student.selected);
    
    if (selectedStudents.length === 0) {
      alert('No hay estudiantes seleccionados para limpiar la asistencia.');
      return;
    }

    const confirmMessage = `¿Estás seguro de que quieres limpiar la asistencia de ${selectedStudents.length} estudiante(s) seleccionado(s) para el ${currentDate}? Esta acción no se puede deshacer.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Obtener los IDs de los estudiantes seleccionados
      const selectedStudentIds = selectedStudents.map(student => student.id);
      
      // Eliminar registros de asistencia solo para los estudiantes seleccionados
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('date', currentDate)
        .eq('program_id', activeProgram.id)
        .in('student_id', selectedStudentIds);

      if (error) {
        console.error('Error clearing attendance for selected students:', error);
        alert(t('clear_attendance_error', { error: error.message }));
        return;
      }

      // Mostrar mensaje de éxito
      const successMsg = `Asistencia limpiada exitosamente para ${selectedStudents.length} estudiante(s) en ${currentDate}`;
      setSuccessMessage(successMsg);
      setShowSuccessMessage(true);
      
      // Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);

      // Recargar los datos de asistencia
      await loadAttendanceData(currentDate);
      
      console.log(`Attendance cleared for ${selectedStudents.length} selected students on date: ${currentDate}`);
    } catch (error: any) {
      console.error('Unexpected error clearing attendance:', error);
      alert(t('clear_attendance_error', { error: error.message || 'Error inesperado' }));
    } finally {
      setIsLoading(false);
    }
  };
  
  
  // Función para marcar asistencia
  // Helper function to find the correct attendance status code - similar to Android version
  const findAttendanceStatusCode = (statusName: string) => {
    console.log('Finding status code for:', statusName);
    console.log('Available statuses:', attendanceStatuses);
    
    if (!attendanceStatuses || attendanceStatuses.length === 0) {
      console.warn('No attendance statuses available');
      return 'A'; // Valor por defecto si no hay estados disponibles
    }
    
    // Normalize the status name for comparison
    const normalizedName = statusName.toLowerCase();
    
    // Define possible matches for each status type - same as Android
    const presentMatches = ['a', 'presente', 'present', 'asistió', 'asistio', 'attendance'];
    const justifiedMatches = ['ea', 'falta justificada', 'justified absence', 'excused', 'excused absence'];
    const unjustifiedMatches = ['ua', 'falta injustificada', 'unjustified absence', 'unexcused', 'unexcused absence'];
    
    // Find the status based on code or description
    let status = null;
    
    // Check which type of status we're looking for
    if (presentMatches.includes(normalizedName)) {
      // Look for present status
      status = attendanceStatuses.find(s => 
        (s.code && presentMatches.includes(s.code.toLowerCase())) || 
        (s.description && presentMatches.includes(s.description.toLowerCase()))
      );
      
      // If not found, use the first status as fallback
      if (!status && attendanceStatuses.length > 0) {
        status = attendanceStatuses[0];
        console.log('Using first status as fallback for Present:', status);
      }
    } else if (justifiedMatches.includes(normalizedName)) {
      // Look for justified absence status
      status = attendanceStatuses.find(s => 
        (s.code && justifiedMatches.includes(s.code.toLowerCase())) || 
        (s.description && justifiedMatches.includes(s.description.toLowerCase()))
      );
      
      // If not found, use the third status as fallback (if available)
      if (!status && attendanceStatuses.length > 2) {
        status = attendanceStatuses[2];
        console.log('Using third status as fallback for Justified Absence:', status);
      }
    } else if (unjustifiedMatches.includes(normalizedName)) {
      // Look for unjustified absence status
      status = attendanceStatuses.find(s => 
        (s.code && unjustifiedMatches.includes(s.code.toLowerCase())) || 
        (s.description && unjustifiedMatches.includes(s.description.toLowerCase()))
      );
      
      // If not found, use the second status as fallback (if available)
      if (!status && attendanceStatuses.length > 1) {
        status = attendanceStatuses[1];
        console.log('Using second status as fallback for Unjustified Absence:', status);
      }
    }
    
    if (status) {
      console.log(`Found status for ${statusName}:`, status);
      // CORRECCIÓN: Usar el código (code) en lugar del ID para la columna status_code
      if (status.code) {
        console.log(`Usando código: ${status.code} para el estado de asistencia`);
        return status.code; // Usar el código para la columna status_code
      } else {
        // Si no hay código, usar un valor predeterminado basado en el tipo
        if (presentMatches.includes(normalizedName)) {
          return 'A';
        } else if (justifiedMatches.includes(normalizedName)) {
          return 'EA';
        } else if (unjustifiedMatches.includes(normalizedName)) {
          return 'UA';
        } else {
          return 'A'; // Valor por defecto
        }
      }
    } else {
      console.warn(`No status found for ${statusName}, using default code`);
      // Si no se encuentra ningún estado, usar un código predeterminado basado en el tipo
      if (presentMatches.includes(normalizedName)) {
        return 'A';
      } else if (justifiedMatches.includes(normalizedName)) {
        return 'EA';
      } else if (unjustifiedMatches.includes(normalizedName)) {
        return 'UA';
      } else {
        return 'A'; // Valor por defecto
      }
    }
  };

  const markAttendance = async (statusCode: string) => {
    try {
      const selectedStudentIds = students
        .filter(student => student.selected)
        .map(student => student.id);
      
      if (selectedStudentIds.length === 0) {
        console.log('No hay estudiantes seleccionados');
        alert(t('no_students_selected'));
        return;
      }
      
      console.log(`Marcando asistencia para ${selectedStudentIds.length} estudiantes con estado: ${statusCode}`);
      console.log('IDs de estudiantes seleccionados:', selectedStudentIds);
      
      // Usar la función de mapeo de estados igual que en Android
      let statusCodeToUse = findAttendanceStatusCode(statusCode);
      console.log(`Código de estado mapeado: ${statusCode} -> ${statusCodeToUse}`);
      
      // CORRECCIÓN: Asegurar que siempre tengamos un código válido
      if (!statusCodeToUse) {
        console.warn('No se encontró un código de estado, usando el valor por defecto');
        // Usar el código original como fallback si es uno de los códigos estándar
        if (['A', 'EA', 'UA'].includes(statusCode.toUpperCase())) {
          statusCodeToUse = statusCode.toUpperCase();
        } else {
          // Si no es un código estándar, usar 'A' como valor por defecto
          statusCodeToUse = 'A';
        }
        console.log(`Usando código por defecto: ${statusCodeToUse}`);
      }
      
      // Mostrar información de depuración
      console.log('Marcando asistencia:', {
        selectedStudentIds,
        originalStatusCode: statusCode,
        mappedStatusCode: statusCodeToUse,
        currentDate
      });
      
      // Verificar que el código de estado existe en la tabla attendance_status
      // Primero obtener todos los estados disponibles para depuración
      const { data: allStatuses } = await supabase
        .from('attendance_status')
        .select('*');
      
      console.log('Estados de asistencia disponibles en la base de datos:', allStatuses);
      
      // CORRECCIÓN: Asegurar que statusCodeToUse sea un código válido (no un ID)
      // Si aún es undefined o null después de las verificaciones anteriores
      if (statusCodeToUse === undefined || statusCodeToUse === null) {
        if (allStatuses && allStatuses.length > 0) {
          console.log('Usando el primer estado disponible como fallback:', allStatuses[0]);
          // Usar el código en lugar del ID
          statusCodeToUse = allStatuses[0].code || 'A';
        } else {
          console.log('No hay estados de asistencia disponibles, usando código por defecto "A"');
          statusCodeToUse = 'A'; // Código por defecto si no hay estados disponibles
        }
      }
      
      console.log('Código final a utilizar:', statusCodeToUse);
      
      // CORRECCIÓN: Verificar que el código existe en los estados obtenidos
      // Ahora buscamos por código en lugar de por ID
      const statusExists = allStatuses?.find(status => 
        status.code === statusCodeToUse || 
        status.code?.toLowerCase() === statusCodeToUse.toLowerCase()
      );
      
      if (!statusExists) {
        console.warn(`El código de estado "${statusCodeToUse}" no se encontró exactamente en la tabla attendance_status`);
        console.log('Estados disponibles:', allStatuses);
        
        // En lugar de fallar, verificamos si es uno de los códigos estándar
        if (!['A', 'EA', 'UA'].includes(statusCodeToUse.toUpperCase())) {
          console.log(`Usando código estándar "A" como fallback`);
          statusCodeToUse = 'A'; // Usar un código estándar como fallback
        } else {
          console.log(`Manteniendo el código estándar "${statusCodeToUse}" aunque no exista en la tabla`);
          // Mantener el código estándar aunque no exista en la tabla
        }
      }
      
      console.log('Código de estado verificado y válido:', statusCodeToUse);
      
      // Procesar cada estudiante seleccionado con una sola operación atómica (upsert)
      let successCount = 0;
      for (const studentId of selectedStudentIds) {
        try {
          const now = new Date().toISOString();
          const row = {
            student_id: studentId,
            date: currentDate,
            program_id: activeProgram?.id as string,
            status_code: statusCodeToUse,
            updated_at: now,
            created_at: now,
          } as any;

          console.log('Upsert de asistencia con payload:', row);

          const { data: upsertData, error: upsertError } = await supabase
            .from('attendance')
            .upsert(row, { onConflict: 'student_id,date,program_id' })
            .select();

          if (upsertError) {
            console.error(`Error en upsert de asistencia para estudiante ${studentId}:`, upsertError);
            continue;
          }

          console.log(`Upsert exitoso para estudiante ${studentId}:`, upsertData);
          successCount++;

          // Actualizar el estado local para reflejar el cambio inmediatamente
          setStudents(prevStudents => {
            return prevStudents.map(student => {
              if (student.id === studentId) {
                return {
                  ...student,
                  attendance_status: statusCodeToUse
                };
              }
              return student;
            });
          });
          
          setFilteredStudents(prevFiltered => {
            return prevFiltered.map(student => {
              if (student.id === studentId) {
                return {
                  ...student,
                  attendance_status: statusCodeToUse
                };
              }
              return student;
            });
          });
          
        } catch (studentError: any) {
          console.error(`Error al procesar asistencia para estudiante ${studentId}:`, studentError?.message || studentError);
        }
      }
      
      // Actualizar la interfaz de usuario con los nuevos estados de asistencia
      // Hacemos una sola actualización al final para evitar múltiples re-renders
      // y asegurar que el estado local refleje correctamente los cambios en la base de datos
      const updateStudentLists = () => {
        console.log('Actualizando estado local con código de asistencia:', statusCodeToUse);
        console.log('Para los estudiantes:', selectedStudentIds);
        
        // Actualizar la lista principal de estudiantes
        setStudents(prevStudents => {
          const updatedStudents = prevStudents.map(student => {
            if (selectedStudentIds.includes(student.id)) {
              console.log(`Actualizando estudiante ${student.id} con estado:`, statusCodeToUse);
              return {
                ...student,
                selected: false,
                attendance_status: statusCodeToUse
              };
            }
            return student;
          });
          console.log('Lista de estudiantes actualizada:', updatedStudents);
          return updatedStudents;
        });
        
        // Actualizar la lista filtrada de estudiantes
        setFilteredStudents(prevFiltered => {
          const updatedFiltered = prevFiltered.map(student => {
            if (selectedStudentIds.includes(student.id)) {
              return {
                ...student,
                selected: false,
                attendance_status: statusCodeToUse
              };
            }
            return student;
          });
          console.log('Lista filtrada actualizada:', updatedFiltered);
          return updatedFiltered;
        });
        
        // Resetear el contador de selección
        setSelectedStudentCount(0);
      };
      
      // Aplicar las actualizaciones
      updateStudentLists();
      
      // Mostrar mensaje de éxito
      if (successCount > 0) {
        // Obtener el nombre del estado para mostrarlo en el mensaje
        const statusName = getAttendanceStatusName(statusCodeToUse);
        const message = `Se ha actualizado la asistencia para ${successCount} estudiante(s) con estado: ${statusName}`;
        
        // Actualizar el mensaje de éxito y mostrarlo
        setSuccessMessage(message);
        setShowSuccessMessage(true);
        
        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 5000);
        
        // Recargar los datos para asegurar que todo está sincronizado
        try {
          console.log('Recargando datos de asistencia para verificar consistencia...');
          await loadAttendanceData(currentDate);
        } catch (reloadError: any) {
          console.error('Error al recargar datos de asistencia:', reloadError?.message || String(reloadError));
          // Aún si falla la recarga, ya hemos actualizado el estado local, así que no es crítico
        }
      } else {
        setSuccessMessage('No se pudo actualizar la asistencia para ningún estudiante. Por favor, intenta de nuevo.');
        setShowSuccessMessage(true);
        
        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 5000);
        
        console.error('No se pudo actualizar la asistencia para ningún estudiante');
      }
    } catch (error: any) {
      console.error('Error al marcar asistencia:', error);
      alert(`${t('error_marking_attendance')}: ${error?.message || 'Unknown error'}`);
    }
  };

  // Función para obtener el nombre del estado de asistencia
  const getAttendanceStatusName = (statusCode: string | null | undefined) => {
    if (!statusCode) return t('not_recorded');
    
    console.log('Buscando nombre para el estado con código:', statusCode);
    console.log('Estados disponibles:', attendanceStatuses);
    
    // Buscar por código exacto (preferido)
    let status = attendanceStatuses.find(
      s => s.code && s.code.toLowerCase() === statusCode.toLowerCase()
    );
    
    // Si no se encuentra exacto, intentar coincidencia parcial por código o descripción
    if (!status) {
      const lower = statusCode.toLowerCase();
      status = attendanceStatuses.find(s =>
        (s.code && s.code.toLowerCase().includes(lower)) ||
        (s.description && s.description.toLowerCase().includes(lower))
      );
    }
    
    if (status) {
      console.log('Estado encontrado:', status);
      // Preferir descripción si existe; si no, mostrar el código
      return status.description || status.code || 'Desconocido';
    }
    
    // Fallback para códigos conocidos
    const lower = statusCode.toLowerCase();
    if (lower === 'a') return 'Asistió';
    if (lower === 'ea') return 'Excusa';
    if (lower === 'ua') return 'Falta';
    
    return statusCode;
  };

  // Componente para mostrar indicador de estado de asistencia
  // El componente AttendanceStatusIndicator ahora está importado desde @/components/AttendanceStatusIndicator
  
  // Función para manejar el cambio de fecha
  const handleDateChange = async (newDate: Date | null) => {
    if (!newDate) return;
    setSelectedDate(newDate);
    
    const formattedDate = format(newDate, 'yyyy-MM-dd');
    console.log(`Fecha formateada: ${formattedDate}`);
    
    // Importante: Primero cargar los datos de asistencia antes de actualizar currentDate
    // ya que currentDate es una dependencia del useEffect
    console.log(`Cargando datos de asistencia para la fecha: ${formattedDate}`);
    await loadAttendanceData(formattedDate);
    
    // Actualizar la fecha actual después de cargar los datos
    setCurrentDate(formattedDate);
    
    console.log(`Datos de asistencia actualizados para la fecha: ${formattedDate}`);
    
    // Resetear selecciones al cambiar de fecha
    setStudents(prevStudents => 
      prevStudents.map(student => ({ ...student, selected: false }))
    );
    
    setFilteredStudents(prevFiltered => 
      prevFiltered.map(student => ({ ...student, selected: false }))
    );
    
    setSelectedStudentCount(0);
  };

  return (
    <div className="h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-black">{t('attendance_title')}</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              dateFormat="dd/MM/yyyy"
              className="border border-gray-300 rounded-md p-2.5 pl-10 bg-white focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-[#0073ea] text-black font-medium shadow-sm w-full"
              wrapperClassName="date-picker-wrapper w-44"
              locale={lang === 'es' ? es : enUS}
              showMonthYearPicker={false}
              showMonthDropdown={false}
              showYearDropdown={false}
              renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
                <div className="flex justify-between items-center px-2 py-2">
                  <button
                    onClick={decreaseMonth}
                    className="p-1 hover:bg-gray-100 rounded-full"
                    aria-label={t('prev_month')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h2 className="text-base font-semibold text-gray-900">
                    {date.toLocaleString(lang, { month: 'long', year: 'numeric' })}
                  </h2>
                  <button
                    onClick={increaseMonth}
                    className="p-1 hover:bg-gray-100 rounded-full"
                    aria-label={t('next_month')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#0073ea]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          
          <button
            onClick={toggleAttendanceMode}
            className={`px-4 py-2 rounded-md flex items-center whitespace-nowrap ${
              attendanceMode 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-[#0073ea] hover:bg-[#0060c0] text-white'
            }`}
          >
            {attendanceMode ? t('disable_attendance_mode') : t('enable_attendance_mode')}
          </button>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {showSuccessMessage && successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md relative">
          <span className="block sm:inline">{successMessage}</span>
          <button 
            onClick={() => setShowSuccessMessage(false)}
            className="absolute top-0 right-0 px-4 py-3"
          >
            <span className="text-green-500 hover:text-green-800">×</span>
          </button>
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder={t('search_name_or_instrument')}
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent text-black font-medium"
            />
            <span className="absolute left-3 top-2.5 text-black font-bold">&#128269;</span>
          </div>
          
          <div className="flex items-center">
            <select
              value={selectedInstrument}
              onChange={(e) => handleInstrumentChange(e.target.value)}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent text-black font-medium"
              aria-label={t('filter_by_instrument')}
            >
              <option value="all">{t('all_instruments')}</option>
              {availableInstruments.map((instrument) => (
                <option key={instrument} value={instrument}>
                  {instrument}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="text-sm text-black font-semibold mb-2">
          {t('showing_n_of_total', { n: filteredStudents.length, total: students.length })}
        </div>
        
        {attendanceMode && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={selectAllStudents}
                className="px-4 py-2 rounded-md flex items-center bg-blue-500 hover:bg-blue-600 text-white text-sm"
              >
                <span className="mr-2">☑</span>
                {t('select_all')}
              </button>
              <button
                onClick={deselectAllStudents}
                className="px-4 py-2 rounded-md flex items-center bg-gray-500 hover:bg-gray-600 text-white text-sm"
              >
                <span className="mr-2">☐</span>
                {t('deselect_all')}
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => markAttendance('A')}
                disabled={selectedStudentCount === 0}
                className={`px-4 py-2 rounded-md flex items-center ${
                  selectedStudentCount > 0
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 text-black cursor-not-allowed'
                }`}
              >
                <span className="mr-2">✓</span>
                {t('mark_present')}
              </button>
              <button
                onClick={() => markAttendance('EA')}
                disabled={selectedStudentCount === 0}
                className={`px-4 py-2 rounded-md flex items-center ${
                  selectedStudentCount > 0
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-gray-300 text-black cursor-not-allowed'
                }`}
              >
                <span className="mr-2">!</span>
                {t('mark_excused_absence')}
              </button>
              <button
                onClick={() => markAttendance('UA')}
                disabled={selectedStudentCount === 0}
                className={`px-4 py-2 rounded-md flex items-center ${
                  selectedStudentCount > 0
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-300 text-black cursor-not-allowed'
                }`}
              >
                <span className="mr-2">✗</span>
                {t('mark_unexcused_absence')}
              </button>
              
              {/* Botón para limpiar asistencia */}
              <button
                onClick={clearAttendanceForDate}
                disabled={selectedStudentCount === 0 || isLoading}
                className={`px-4 py-2 rounded-md flex items-center ${
                  selectedStudentCount > 0 && !isLoading
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-gray-300 text-black cursor-not-allowed'
                }`}
                title={selectedStudentCount > 0 ? `Limpiar asistencia de ${selectedStudentCount} estudiante(s) seleccionado(s)` : 'Selecciona estudiantes para limpiar su asistencia'}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('clear_attendance')}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-t-[#0073ea] border-r-[#0073ea] border-b-gray-200 border-l-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-black">{t('loading_students')}</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Tabla para pantallas medianas y grandes */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {attendanceMode && (
                      <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider w-10"></th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('instrument_label')}</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('attendance')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr 
                        key={student.id} 
                        className={`hover:bg-gray-50 ${student.selected ? 'bg-blue-50' : ''}`}
                      >
                        {attendanceMode && (
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <input
                              type="checkbox"
                              checked={student.selected || false}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="h-4 w-4"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {student.first_name} {student.last_name}
                              </div>
                              <div className="text-xs text-black font-medium">
                                {t('grade')}: {student.current_grade || t('not_specified')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{student.instrument || t('not_specified')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-sm font-medium rounded-full ${
                            student.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {student.is_active ? t('active') : t('inactive')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.attendance_status ? (
                            <AttendanceStatusIndicator
                              key={`${student.id}-${student.attendance_status || 'none'}`}
                              statusCode={student.attendance_status}
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{t('not_recorded')}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={attendanceMode ? 5 : 4} className="px-6 py-4 text-center text-black">
                        {t('no_students_found')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Vista de tarjetas para móviles */}
            <div className="md:hidden space-y-4">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <div key={student.id} className={`bg-gray-50 p-4 rounded-lg border border-gray-200 ${student.selected ? 'border-blue-400 bg-blue-50' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </h3>
                      </div>
                      {attendanceMode && (
                        <input
                          type="checkbox"
                          checked={student.selected || false}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="h-5 w-5"
                        />
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div>
                        <span className="text-black">{t('instrument_label')}:</span>
                        <p className="font-medium">{student.instrument || t('not_specified')}</p>
                      </div>
                      <div>
                        <span className="text-black">{t('status')}:</span>
                        <p>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            student.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {student.is_active ? t('active') : t('inactive')}
                          </span>
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-black">{t('attendance')}:</span>
                        <div className="font-medium">
                          {student.attendance_status ? (
                            <AttendanceStatusIndicator
                              key={`${student.id}-${student.attendance_status || 'none'}`}
                              statusCode={student.attendance_status}
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-900">{t('not_recorded')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-black">
                  {t('no_students_found')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
