'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AttendanceDebug() {
  const supabase = createClientComponentClient();
  const [debugInfo, setDebugInfo] = useState<any>({
    loading: true,
    attendanceData: null,
    error: null,
    columns: [],
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const fetchAttendanceData = async () => {
    try {
      setDebugInfo(prev => ({ ...prev, loading: true }));
      
      // Obtener la fecha actual en formato YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      console.log(`Fecha de consulta: ${today}`);
      
      // Consultar datos de asistencia para la fecha actual
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', today);
      
      if (error) {
        console.error('Error al consultar asistencia:', error);
        setDebugInfo(prev => ({ 
          ...prev, 
          loading: false, 
          error: error.message 
        }));
        return;
      }
      
      console.log(`Se encontraron ${data?.length || 0} registros de asistencia para hoy`);
      
      // Extraer nombres de columnas del primer registro (si existe)
      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
      console.log('Columnas encontradas:', columns);
      
      // Actualizar estado con la información de depuración
      setDebugInfo({
        loading: false,
        attendanceData: data,
        error: null,
        columns,
        date: today
      });
      
    } catch (error: any) {
      console.error('Error inesperado:', error);
      setDebugInfo(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || 'Error desconocido' 
      }));
    }
  };

  const checkOtherDate = async () => {
    try {
      // Consultar datos de asistencia para el 15 de agosto de 2025
      const specificDate = '2025-08-15';
      console.log(`Consultando asistencia para fecha específica: ${specificDate}`);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', specificDate);
      
      if (error) {
        console.error('Error al consultar asistencia para fecha específica:', error);
        return;
      }
      
      console.log(`Se encontraron ${data?.length || 0} registros para el ${specificDate}`);
      console.log('Primeros 3 registros:', data?.slice(0, 3));
      
      // Actualizar estado con la información de la fecha específica
      setDebugInfo(prev => ({
        ...prev,
        specificDateData: data,
        specificDate
      }));
      
    } catch (error: any) {
      console.error('Error al consultar fecha específica:', error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Depuración de Asistencia</h1>
      
      <div className="mb-6">
        <button 
          onClick={fetchAttendanceData}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
        >
          Actualizar Datos
        </button>
        <button 
          onClick={checkOtherDate}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Verificar 15/08/2025
        </button>
      </div>
      
      {debugInfo.loading ? (
        <p>Cargando datos...</p>
      ) : debugInfo.error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">
          <p><strong>Error:</strong> {debugInfo.error}</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Información General</h2>
            <p><strong>Fecha:</strong> {debugInfo.date}</p>
            <p><strong>Registros encontrados:</strong> {debugInfo.attendanceData?.length || 0}</p>
            <p><strong>Columnas en la tabla:</strong> {debugInfo.columns.join(', ')}</p>
          </div>
          
          {debugInfo.attendanceData && debugInfo.attendanceData.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Primeros 5 Registros</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr>
                      {debugInfo.columns.map((column: string) => (
                        <th key={column} className="border px-4 py-2 bg-gray-100">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {debugInfo.attendanceData.slice(0, 5).map((record: any, index: number) => (
                      <tr key={index}>
                        {debugInfo.columns.map((column: string) => (
                          <td key={`${index}-${column}`} className="border px-4 py-2">
                            {record[column] !== null ? 
                              (typeof record[column] === 'object' ? 
                                JSON.stringify(record[column]) : 
                                String(record[column])
                              ) : 
                              'null'
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {debugInfo.specificDateData && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">
                Datos para {debugInfo.specificDate}
              </h2>
              <p><strong>Registros encontrados:</strong> {debugInfo.specificDateData.length}</p>
              
              {debugInfo.specificDateData.length > 0 && (
                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full bg-white border">
                    <thead>
                      <tr>
                        {debugInfo.columns.map((column: string) => (
                          <th key={`spec-${column}`} className="border px-4 py-2 bg-gray-100">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {debugInfo.specificDateData.slice(0, 5).map((record: any, index: number) => (
                        <tr key={`spec-${index}`}>
                          {debugInfo.columns.map((column: string) => (
                            <td key={`spec-${index}-${column}`} className="border px-4 py-2">
                              {record[column] !== null ? 
                                (typeof record[column] === 'object' ? 
                                  JSON.stringify(record[column]) : 
                                  String(record[column])
                                ) : 
                                'null'
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
