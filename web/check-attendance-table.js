// Script para verificar la estructura de la tabla attendance en Supabase
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para verificar la estructura de la tabla attendance
async function checkAttendanceTableStructure() {
  try {
    console.log('Verificando estructura de la tabla attendance...');
    
    // Obtener un registro de ejemplo para ver la estructura
    const { data: sampleData, error: sampleError } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Error al obtener datos de muestra:', sampleError);
      return;
    }
    
    if (!sampleData || sampleData.length === 0) {
      console.log('No se encontraron registros en la tabla attendance');
      return;
    }
    
    // Mostrar las columnas disponibles
    console.log('\nColumnas en la tabla attendance:');
    const columns = Object.keys(sampleData[0]);
    columns.forEach(column => {
      console.log(`- ${column}: ${typeof sampleData[0][column]}`);
    });
    
    // Verificar específicamente si existe la columna 'status'
    if (columns.includes('status')) {
      console.log('\n✅ La columna "status" SÍ existe en la tabla attendance');
    } else {
      console.log('\n❌ La columna "status" NO existe en la tabla attendance');
      console.log('Esto explica por qué la consulta con JOIN está fallando.');
    }
    
    // Verificar otras columnas que se están intentando usar
    const columnsToCheck = ['status_code', 'status_id', 'attendance_status_id'];
    columnsToCheck.forEach(column => {
      if (columns.includes(column)) {
        console.log(`✅ La columna "${column}" SÍ existe en la tabla attendance`);
      } else {
        console.log(`❌ La columna "${column}" NO existe en la tabla attendance`);
      }
    });
    
    // Mostrar un registro de ejemplo
    console.log('\nRegistro de ejemplo:');
    console.log(JSON.stringify(sampleData[0], null, 2));
    
    // Verificar la estructura de la tabla attendance_status
    console.log('\nVerificando estructura de la tabla attendance_status...');
    const { data: statusData, error: statusError } = await supabase
      .from('attendance_status')
      .select('*')
      .limit(5);
    
    if (statusError) {
      console.error('Error al obtener datos de attendance_status:', statusError);
      return;
    }
    
    if (!statusData || statusData.length === 0) {
      console.log('No se encontraron registros en la tabla attendance_status');
      return;
    }
    
    console.log('\nRegistros en attendance_status:');
    statusData.forEach((status, index) => {
      console.log(`${index + 1}. ID: ${status.id}, Código: ${status.code}, Nombre: ${status.name}`);
    });
    
    // Verificar la columna correcta para la relación
    console.log('\nProbando diferentes columnas para la relación...');
    
    // Probar con status
    if (columns.includes('status')) {
      try {
        const { data: relationData, error: relationError } = await supabase
          .from('attendance')
          .select(`
            *,
            attendance_status:status(id, code, name)
          `)
          .limit(1);
        
        if (relationError) {
          console.log('❌ La relación con attendance_status usando la columna "status" NO funciona:', relationError.message);
        } else if (relationData && relationData.length > 0 && relationData[0].attendance_status) {
          console.log('✅ La relación con attendance_status usando la columna "status" SÍ funciona');
          console.log('Datos obtenidos:', relationData[0].attendance_status);
        } else {
          console.log('❓ La relación con attendance_status usando la columna "status" no devuelve datos');
        }
      } catch (error) {
        console.error('Error al probar la relación con status:', error);
      }
    }
    
    // Probar con status_code si existe
    if (columns.includes('status_code')) {
      try {
        const { data: relationData, error: relationError } = await supabase
          .from('attendance')
          .select(`
            *,
            attendance_status:status_code(id, code, name)
          `)
          .limit(1);
        
        if (relationError) {
          console.log('❌ La relación con attendance_status usando la columna "status_code" NO funciona:', relationError.message);
        } else if (relationData && relationData.length > 0 && relationData[0].attendance_status) {
          console.log('✅ La relación con attendance_status usando la columna "status_code" SÍ funciona');
          console.log('Datos obtenidos:', relationData[0].attendance_status);
        } else {
          console.log('❓ La relación con attendance_status usando la columna "status_code" no devuelve datos');
        }
      } catch (error) {
        console.error('Error al probar la relación con status_code:', error);
      }
    }
    
    // Probar con attendance_status_id si existe
    if (columns.includes('attendance_status_id')) {
      try {
        const { data: relationData, error: relationError } = await supabase
          .from('attendance')
          .select(`
            *,
            attendance_status:attendance_status_id(id, code, name)
          `)
          .limit(1);
        
        if (relationError) {
          console.log('❌ La relación con attendance_status usando la columna "attendance_status_id" NO funciona:', relationError.message);
        } else if (relationData && relationData.length > 0 && relationData[0].attendance_status) {
          console.log('✅ La relación con attendance_status usando la columna "attendance_status_id" SÍ funciona');
          console.log('Datos obtenidos:', relationData[0].attendance_status);
        } else {
          console.log('❓ La relación con attendance_status usando la columna "attendance_status_id" no devuelve datos');
        }
      } catch (error) {
        console.error('Error al probar la relación con attendance_status_id:', error);
      }
    }
    
    console.log('\nVerificación completada.');
    
  } catch (error) {
    console.error('Error al verificar la estructura de la tabla:', error);
  }
}

// Ejecutar la verificación
checkAttendanceTableStructure();
