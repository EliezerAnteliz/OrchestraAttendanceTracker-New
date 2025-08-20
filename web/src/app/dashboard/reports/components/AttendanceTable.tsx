import React from 'react';
import { MdFileDownload, MdRefresh } from 'react-icons/md';
import LoadingIndicator from './LoadingIndicator';
import ErrorDisplay from './ErrorDisplay';
import NoDataDisplay from './NoDataDisplay';
import { AttendanceData, AttendanceByInstrument, exportToCSV } from '../services/reportService';

interface AttendanceTableProps {
  data: AttendanceData[] | AttendanceByInstrument[];
  type: 'date' | 'instrument';
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ data, type, loading = false, error = null, onRetry }) => {
  const handleExport = () => {
    exportToCSV(data, type === 'date' ? 'attendance_by_date' : 'attendance_by_instrument');
  };

  // Título según el tipo de tabla
  const title = type === 'date' ? 'Detalle por Fecha' : 'Detalle por Instrumento';
  
  // Contenido según el estado
  const renderContent = () => {
    if (loading) {
      return <LoadingIndicator size="small" message={`Cargando datos de ${type === 'date' ? 'fechas' : 'instrumentos'}...`} />;
    }
    
    if (error) {
      return <ErrorDisplay message={error} onRetry={onRetry} />;
    }
    
    if (!data || data.length === 0) {
      return <NoDataDisplay message={`No hay datos de ${type === 'date' ? 'fechas' : 'instrumentos'} disponibles`} />;
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {type === 'date' ? 'Fecha' : 'Instrumento'}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Asistencias
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Faltas Justificadas
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Faltas Injustificadas
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              {type === 'instrument' && (
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasa de Asistencia
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {type === 'date' 
                    ? new Date((item as AttendanceData).date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : (item as AttendanceByInstrument).instrument}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                  {item.present}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                  {item.excused}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                  {item.absent}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                  {item.total}
                </td>
                {type === 'instrument' && (
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                    {(item as AttendanceByInstrument).attendanceRate.toFixed(1)}%
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        {!loading && !error && data && data.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-sm hover:bg-gray-200"
          >
            <MdFileDownload size={16} className="mr-1" />
            Exportar CSV
          </button>
        )}
      </div>
      
      {renderContent()}
    </div>
  );
};

export default AttendanceTable;
