'use client';

import { useEffect, useState } from 'react';

export default function CheckDatabasePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/check-table');
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Error al verificar la estructura de la base de datos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Verificando estructura de la base de datos...</h1>
        <div className="animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Estructura de la Base de Datos</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Tabla Attendance</h2>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Columnas disponibles:</h3>
          <ul className="list-disc pl-5">
            {data?.tableStructure?.columns.map((column: string) => (
              <li key={column} className="mb-1">
                <span className="font-mono">{column}</span>: {data?.tableStructure?.columnTypes[column]}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Verificación de columnas críticas:</h3>
          <div className="pl-5">
            <div className={`mb-1 ${data?.statusCheck?.hasStatusColumn ? 'text-green-600' : 'text-red-600'}`}>
              Columna <span className="font-mono">status</span>: {data?.statusCheck?.hasStatusColumn ? 'Existe ✅' : 'No existe ❌'}
            </div>
            
            {Object.entries(data?.statusCheck?.otherColumns || {}).map(([column, exists]: [string, any]) => (
              <div key={column} className={`mb-1 ${exists ? 'text-green-600' : 'text-red-600'}`}>
                Columna <span className="font-mono">{column}</span>: {exists ? 'Existe ✅' : 'No existe ❌'}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Relación con attendance_status:</h3>
          <div className="pl-5">
            {data?.relationCheck?.works ? (
              <div className="text-green-600">La relación funciona correctamente ✅</div>
            ) : (
              <div className="text-red-600">La relación no funciona ❌</div>
            )}
            
            {data?.relationCheck?.error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                <p className="font-medium">Error en la relación:</p>
                <pre className="text-sm overflow-auto mt-1">{JSON.stringify(data.relationCheck.error, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Datos de ejemplo:</h3>
          <pre className="bg-gray-50 p-3 rounded overflow-auto text-sm">
            {JSON.stringify(data?.tableStructure?.sampleData, null, 2)}
          </pre>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Tabla Attendance Status</h2>
        
        {data?.attendanceStatusTable?.error ? (
          <div className="text-red-600">Error al obtener datos de attendance_status</div>
        ) : (
          <>
            <p className="mb-2">Registros encontrados: {data?.attendanceStatusTable?.data?.length || 0}</p>
            
            {data?.attendanceStatusTable?.data?.length > 0 ? (
              <table className="min-w-full border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 border">ID</th>
                    <th className="px-4 py-2 border">Código</th>
                    <th className="px-4 py-2 border">Nombre</th>
                    <th className="px-4 py-2 border">Color</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendanceStatusTable.data.map((status: any) => (
                    <tr key={status.id}>
                      <td className="px-4 py-2 border">{status.id}</td>
                      <td className="px-4 py-2 border">{status.code}</td>
                      <td className="px-4 py-2 border">{status.name}</td>
                      <td className="px-4 py-2 border" style={{ backgroundColor: status.color }}>
                        {status.color}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No hay registros en la tabla attendance_status</p>
            )}
          </>
        )}
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">Conclusión</h2>
        <div className="p-4 border rounded">
          {data?.statusCheck?.hasStatusColumn ? (
            <p>✅ La columna <span className="font-mono">status</span> existe en la tabla attendance.</p>
          ) : (
            <p className="text-red-600 font-medium">❌ La columna <span className="font-mono">status</span> NO existe en la tabla attendance.</p>
          )}
          
          {data?.relationCheck?.works ? (
            <p>✅ La relación entre attendance y attendance_status funciona correctamente.</p>
          ) : (
            <p className="text-red-600 font-medium">❌ La relación entre attendance y attendance_status NO funciona correctamente.</p>
          )}
          
          <p className="mt-4">
            <strong>Recomendación:</strong> {data?.statusCheck?.hasStatusColumn 
              ? 'Continuar usando la columna status para la relación con attendance_status.' 
              : 'Verificar cuál es la columna correcta para la relación con attendance_status y actualizar el código.'}
          </p>
        </div>
      </div>
    </div>
  );
}
