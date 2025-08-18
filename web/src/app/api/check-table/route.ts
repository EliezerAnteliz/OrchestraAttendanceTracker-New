import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Obtener un registro de ejemplo para ver la estructura
    const { data: sampleData, error: sampleError } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      return NextResponse.json({ 
        error: 'Error al obtener datos de muestra', 
        details: sampleError 
      }, { status: 500 });
    }
    
    if (!sampleData || sampleData.length === 0) {
      return NextResponse.json({ 
        message: 'No se encontraron registros en la tabla attendance' 
      }, { status: 404 });
    }
    
    // Obtener las columnas disponibles
    const columns = Object.keys(sampleData[0]);
    const columnTypes = {};
    columns.forEach(column => {
      columnTypes[column] = typeof sampleData[0][column];
    });
    
    // Verificar específicamente si existe la columna 'status'
    const hasStatusColumn = columns.includes('status');
    
    // Verificar otras columnas que se están intentando usar
    const columnsToCheck = ['status_code', 'status_id', 'attendance_status_id'];
    const columnExistence = {};
    columnsToCheck.forEach(column => {
      columnExistence[column] = columns.includes(column);
    });
    
    // Verificar la relación con attendance_status
    let relationStatus = null;
    try {
      const { data: relationData, error: relationError } = await supabase
        .from('attendance')
        .select(`
          *,
          attendance_status:status(id, code, name)
        `)
        .limit(1);
      
      if (relationError) {
        relationStatus = {
          works: false,
          error: relationError
        };
      } else if (relationData && relationData.length > 0) {
        relationStatus = {
          works: !!relationData[0].attendance_status,
          data: relationData[0]
        };
      }
    } catch (error) {
      relationStatus = {
        works: false,
        error: error
      };
    }
    
    // Verificar la estructura de la tabla attendance_status
    const { data: statusData, error: statusError } = await supabase
      .from('attendance_status')
      .select('*')
      .limit(5);
    
    return NextResponse.json({
      tableStructure: {
        columns,
        columnTypes,
        sampleData: sampleData[0]
      },
      statusCheck: {
        hasStatusColumn,
        otherColumns: columnExistence
      },
      relationCheck: relationStatus,
      attendanceStatusTable: {
        data: statusData,
        error: statusError
      }
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error al verificar la estructura de la tabla', 
      details: error 
    }, { status: 500 });
  }
}
