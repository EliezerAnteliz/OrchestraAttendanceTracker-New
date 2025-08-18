import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Obtener una muestra de registros de asistencia
    const { data: sampleData, error: sampleError } = await supabase
      .from('attendance')
      .select('*')
      .limit(5);
    
    if (sampleError) {
      return NextResponse.json({ 
        error: 'Error al obtener muestra de asistencia', 
        details: sampleError 
      }, { status: 500 });
    }
    
    // Obtener la estructura de la tabla attendance
    const { data: structureData, error: structureError } = await supabase
      .rpc('get_table_structure', { table_name: 'attendance' })
      .select('*');
    
    // Obtener registros para una fecha específica (hoy)
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData, error: todayError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today);
    
    // Obtener registros para el 15 de agosto de 2025
    const specificDate = '2025-08-15';
    const { data: specificData, error: specificError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', specificDate);
    
    return NextResponse.json({
      success: true,
      sampleData,
      sampleColumns: sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : [],
      structureData: structureData || null,
      structureError: structureError ? structureError.message : null,
      todayData,
      todayError: todayError ? todayError.message : null,
      specificData,
      specificError: specificError ? specificError.message : null
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Error inesperado', 
      details: error.message || 'Desconocido' 
    }, { status: 500 });
  }
}
