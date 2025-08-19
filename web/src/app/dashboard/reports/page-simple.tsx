'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdPieChart, MdPerson, MdGroups, MdCalendarMonth, MdDownload } from 'react-icons/md';

// Componentes básicos
const LoadingIndicator = ({ message = 'Cargando...' }) => (
  <div className="flex flex-col items-center justify-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
    <p className="text-gray-600">{message}</p>
  </div>
);

const ErrorDisplay = ({ message, severity = 'error' }) => (
  <div className={`p-4 rounded-md ${severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
    <div className="flex items-center">
      <MdPieChart className="mr-2" />
      <p>{message}</p>
    </div>
  </div>
);

const NoDataDisplay = ({ message = 'No hay datos disponibles.' }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-md">
    <p className="text-gray-500">{message}</p>
  </div>
);

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
  // Estados
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'individual' | 'group'>('group');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [reportData, setReportData] = useState<AttendanceStats | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [studentModalVisible, setStudentModalVisible] = useState<boolean>(false);

  // Cargar estudiantes al inicio
  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, instrument')
          .eq('is_active', true);

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
        setError('No se pudieron cargar los estudiantes. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, []);

  // Generar reporte
  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      setReportError(null);

      // Obtener el mes actual (primer día y último día)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      
      // Construir la consulta para obtener datos de asistencia SIN embebidos ambiguos
      // Usamos el campo plano status_code directamente para clasificar A/EA/UA
      let query = supabase
        .from('attendance')
        .select(`
          date,
          status_code,
          student_id
        `)
        .gte('date', startDate)
        .lte('date', endDate);
      
      // Si es reporte individual, filtrar por estudiante
      if (reportType === 'individual' && selectedStudent) {
        query = query.eq('student_id', selectedStudent.id);
      }
      
      const { data: attendanceData, error: attendanceError } = await query;
      
      if (attendanceError) throw attendanceError;
      
      // Procesar datos para estadísticas
      let total = 0;
      let present = 0;
      let excused = 0;
      let unexcused = 0;
      
      attendanceData.forEach(record => {
        total++;
        const statusCode = (record.status_code || '').toUpperCase();
        
        if (statusCode === 'A') {
          present++;
        } else if (statusCode === 'EA') {
          excused++;
        } else if (statusCode === 'UA') {
          unexcused++;
        }
      });
      
      // Calcular porcentajes
      const stats = {
        total_attendance: present,
        total_excused_absences: excused,
        total_unexcused_absences: unexcused,
        attendance_percentage: total > 0 ? (present / total) * 100 : 0,
        excused_percentage: total > 0 ? (excused / total) * 100 : 0,
        unexcused_percentage: total > 0 ? (unexcused / total) * 100 : 0,
        total: total
      };
      
      setReportData(stats);
      
    } catch (error) {
      console.error('Error al generar reporte:', error);
      setReportError(`Error al generar el reporte: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGenerating(false);
    }
  };

  // Exportar a CSV
  const exportReportToCSV = () => {
    if (!reportData) return;
    
    const title = reportType === 'individual' && selectedStudent 
      ? `Reporte de ${selectedStudent.name}` 
      : 'Reporte Grupal';
      
    const csvData = [
      ['Tipo de Reporte', reportType === 'individual' ? 'Individual' : 'Grupal'],
      ['Período', 'Mensual'],
      ['Estudiante', reportType === 'individual' && selectedStudent ? selectedStudent.name : 'Todos'],
      [''],
      ['Estadísticas', ''],
      ['Total Asistencias', reportData.total_attendance],
      ['Total Faltas Justificadas', reportData.total_excused_absences],
      ['Total Faltas Injustificadas', reportData.total_unexcused_absences],
      ['Porcentaje Asistencia', `${reportData.attendance_percentage.toFixed(1)}%`],
      ['Porcentaje Faltas Justificadas', `${reportData.excused_percentage.toFixed(1)}%`],
      ['Porcentaje Faltas Injustificadas', `${reportData.unexcused_percentage.toFixed(1)}%`]
    ];
    
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

  // Componente de gráfico de torta
  const PieChart = ({ data }: { data: AttendanceStats }) => {
    const total = data.total;
    const presentPercentage = data.attendance_percentage;
    const excusedPercentage = data.excused_percentage;
    const unexcusedPercentage = data.unexcused_percentage;
    
    return (
      <div className="relative w-64 h-64 mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Círculo de asistencias */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="#4CAF50"
            strokeWidth="20"
            strokeDasharray={`${presentPercentage} ${100 - presentPercentage}`}
            strokeDashoffset="25"
          />
          {/* Círculo de faltas justificadas */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="#FFC107"
            strokeWidth="20"
            strokeDasharray={`${excusedPercentage} ${100 - excusedPercentage}`}
            strokeDashoffset={`${100 - presentPercentage + 25}`}
          />
          {/* Círculo de faltas injustificadas */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke="#F44336"
            strokeWidth="20"
            strokeDasharray={`${unexcusedPercentage} ${100 - unexcusedPercentage}`}
            strokeDashoffset={`${100 - presentPercentage - excusedPercentage + 25}`}
          />
          {/* Texto central */}
          <text x="50" y="50" textAnchor="middle" dy=".3em" className="text-xl font-bold">
            {total}
          </text>
        </svg>
        
        {/* Leyenda */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 mr-2"></div>
            <span>Asistencias: {data.total_attendance} ({presentPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
            <span>Faltas Justificadas: {data.total_excused_absences} ({excusedPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 mr-2"></div>
            <span>Faltas Injustificadas: {data.total_unexcused_absences} ({unexcusedPercentage.toFixed(1)}%)</span>
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
    if (!visible) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Seleccionar Estudiante</h2>
          <div className="space-y-2">
            {students.map(student => (
              <div 
                key={student.id}
                className="p-3 border rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => onSelect(student)}
              >
                {student.name} - {student.instrument}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancelar
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
    <div className="space-y-6">
      {/* Selector de tipo de reporte */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-800 mb-4">Tipo de Reporte</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              setReportType('group');
              setSelectedStudent(null);
              setReportData(null);
            }}
            className={`flex items-center px-4 py-2 rounded-md ${
              reportType === 'group'
                ? 'bg-[#0073ea] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MdGroups className="mr-2" /> Grupal
          </button>
          <button
            onClick={() => {
              setReportType('individual');
              setReportData(null);
              setStudentModalVisible(true);
            }}
            className={`flex items-center px-4 py-2 rounded-md ${
              reportType === 'individual'
                ? 'bg-[#0073ea] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MdPerson className="mr-2" /> Individual
          </button>
        </div>
      </div>

      {/* Información del período */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
          <MdCalendarMonth className="mr-2" /> Período Mensual
        </h2>
        <p className="text-gray-600">
          Mostrando datos del mes actual
        </p>
      </div>

      {/* Selección de estudiante (solo para reporte individual) */}
      {reportType === 'individual' && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Estudiante Seleccionado</h2>
          {selectedStudent ? (
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{selectedStudent.name}</p>
                <p className="text-sm text-gray-600">{selectedStudent.instrument}</p>
              </div>
              <button
                onClick={() => setStudentModalVisible(true)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setStudentModalVisible(true)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Seleccionar Estudiante
            </button>
          )}
        </div>
      )}

      {/* Botón para generar reporte */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerateReport}
          disabled={generating || (reportType === 'individual' && !selectedStudent)}
          className={`px-6 py-3 rounded-md flex items-center ${
            generating || (reportType === 'individual' && !selectedStudent)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#0073ea] text-white hover:bg-[#0060c0]'
          }`}
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Generando...
            </>
          ) : (
            <>
              <MdPieChart className="mr-2" /> Generar Reporte
            </>
          )}
        </button>
      </div>

      {/* Error al generar reporte */}
      {reportError && <ErrorDisplay message={reportError} />}

      {/* Resultados del reporte */}
      {reportData && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-800">
              {reportType === 'individual' && selectedStudent
                ? `Reporte de ${selectedStudent.name}`
                : 'Reporte Grupal'}
            </h2>
            <button
              onClick={exportReportToCSV}
              className="px-3 py-1 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors flex items-center text-sm"
            >
              <MdDownload className="mr-1" /> Exportar CSV
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Estadísticas */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700">Estadísticas</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">Asistencias</p>
                  <p className="text-2xl font-bold text-green-700">{reportData.total_attendance}</p>
                  <p className="text-sm text-gray-500">{reportData.attendance_percentage.toFixed(1)}%</p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">Faltas Justificadas</p>
                  <p className="text-2xl font-bold text-yellow-700">{reportData.total_excused_absences}</p>
                  <p className="text-sm text-gray-500">{reportData.excused_percentage.toFixed(1)}%</p>
                </div>
                
                <div className="bg-red-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">Faltas Injustificadas</p>
                  <p className="text-2xl font-bold text-red-700">{reportData.total_unexcused_absences}</p>
                  <p className="text-sm text-gray-500">{reportData.unexcused_percentage.toFixed(1)}%</p>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600">Total Registros</p>
                  <p className="text-2xl font-bold text-blue-700">{reportData.total}</p>
                </div>
              </div>
            </div>
            
            {/* Gráfico */}
            <div>
              <h3 className="font-medium text-gray-700 mb-4">Distribución de Asistencia</h3>
              <PieChart data={reportData} />
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
    </div>
  );
}
