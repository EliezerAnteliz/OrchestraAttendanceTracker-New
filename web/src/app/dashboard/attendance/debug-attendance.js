// Función de diagnóstico para verificar datos de asistencia
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Función para verificar datos de asistencia para una fecha específica
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Promise<Object>} - Resultado del diagnóstico
 */
export async function debugAttendanceData(date) {
  const results = {
    date,
    attendanceRecords: [],
    attendanceStatus: [],
    students: [],
    errors: []
  };
  
  try {
    // 1. Verificar registros de asistencia para la fecha
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', date);
    
    if (attendanceError) {
      results.errors.push({ source: 'attendance', error: attendanceError });
    } else {
      results.attendanceRecords = attendanceData || [];
      console.log(`Encontrados ${attendanceData?.length || 0} registros de asistencia para ${date}`);
    }
    
    // 2. Verificar estados de asistencia disponibles
    const { data: statusData, error: statusError } = await supabase
      .from('attendance_status')
      .select('*');
    
    if (statusError) {
      results.errors.push({ source: 'attendance_status', error: statusError });
    } else {
      results.attendanceStatus = statusData || [];
      console.log(`Encontrados ${statusData?.length || 0} estados de asistencia`);
    }
    
    // 3. Verificar estudiantes (primeros 5)
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .limit(5);
    
    if (studentsError) {
      results.errors.push({ source: 'students', error: studentsError });
    } else {
      results.students = studentsData || [];
      console.log(`Encontrados ${studentsData?.length || 0} estudiantes (mostrando primeros 5)`);
    }
    
    // 4. Verificar si hay registros para otras fechas
    if (results.attendanceRecords.length === 0) {
      const { data: otherDates, error: otherDatesError } = await supabase
        .from('attendance')
        .select('date')
        .limit(10);
      
      if (otherDatesError) {
        results.errors.push({ source: 'other_dates', error: otherDatesError });
      } else if (otherDates && otherDates.length > 0) {
        const uniqueDates = [...new Set(otherDates.map(item => item.date))];
        results.otherDates = uniqueDates;
        console.log('Fechas con registros de asistencia:', uniqueDates);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error general en diagnóstico:', error);
    results.errors.push({ source: 'general', error });
    return results;
  }
}

// Función para verificar la estructura de la tabla attendance
export async function checkAttendanceTableStructure() {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error al verificar estructura:', error);
      return { error };
    }
    
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('Columnas en la tabla attendance:', columns);
      return { columns, sample: data[0] };
    }
    
    return { columns: [], message: 'No se encontraron registros para analizar la estructura' };
  } catch (error) {
    console.error('Error general:', error);
    return { error };
  }
}

// Función para crear un registro de asistencia de prueba
export async function createTestAttendanceRecord(studentId, date, statusCode) {
  try {
    // Primero verificamos si ya existe un registro para este estudiante y fecha
    const { data: existingData, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .eq('date', date);
    
    if (checkError) {
      console.error('Error al verificar registro existente:', checkError);
      return { error: checkError };
    }
    
    // Si ya existe, actualizamos
    if (existingData && existingData.length > 0) {
      const { data, error } = await supabase
        .from('attendance')
        .update({ status_code: statusCode })
        .eq('student_id', studentId)
        .eq('date', date);
      
      if (error) {
        console.error('Error al actualizar registro:', error);
        return { error };
      }
      
      console.log('Registro actualizado correctamente');
      return { success: true, action: 'update', data };
    }
    
    // Si no existe, creamos uno nuevo
    const { data, error } = await supabase
      .from('attendance')
      .insert([
        { student_id: studentId, date, status_code: statusCode }
      ]);
    
    if (error) {
      console.error('Error al crear registro:', error);
      return { error };
    }
    
    console.log('Registro creado correctamente');
    return { success: true, action: 'insert', data };
  } catch (error) {
    console.error('Error general:', error);
    return { error };
  }
}
