'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { MdSearch, MdAdd, MdFilterList, MdEdit, MdDelete, MdVisibility, MdContacts, MdUpload, MdClose } from 'react-icons/md';
import ExcelUploader from '@/components/ExcelUploader';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  instrument: string;
  is_active: boolean;
  current_grade: string;
  age?: number;
  orchestra_position?: string;
};

export default function StudentsPage() {
  const { t } = useI18n();
  const { activeProgram, loading: programLoading } = useProgram();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [availableInstruments, setAvailableInstruments] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ added: number; updated: number; errors: number } | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      if (!activeProgram?.id) {
        setStudents([]);
        setFilteredStudents([]);
        return;
      }
      
      // Obtenemos los estudiantes y los ordenamos alfabéticamente por nombre
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('program_id', activeProgram.id)
        .order('first_name', { ascending: true })
        .order('last_name', { ascending: true });
      
      if (error) throw error;
      
      // Ordenamos manualmente para asegurar el orden correcto
      const sortedData = [...(data || [])].sort((a, b) => {
        // Primero comparamos por nombre
        const nameComparison = a.first_name.localeCompare(b.first_name, 'es', { sensitivity: 'base' });
        // Si los nombres son iguales, comparamos por apellido
        if (nameComparison === 0) {
          return a.last_name.localeCompare(b.last_name, 'es', { sensitivity: 'base' });
        }
        return nameComparison;
      });
      
      setStudents(sortedData);
      setFilteredStudents(sortedData);
      
      // Extraer instrumentos únicos para el filtro
      const instruments = [...new Set(sortedData.map(s => s.instrument).filter(Boolean))].sort();
      setAvailableInstruments(instruments);
    } catch (err: any) {
      console.error('Error al cargar estudiantes:', err);
      setError(t('error_loading_students'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [activeProgram?.id]);

  // Filtrar estudiantes cuando cambia la búsqueda, filtro de activos o instrumento
  useEffect(() => {
    let result = students;
    
    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(student => 
        student.first_name.toLowerCase().includes(query) || 
        student.last_name.toLowerCase().includes(query) ||
        student.instrument.toLowerCase().includes(query)
      );
    }
    
    // Filtrar por instrumento
    if (selectedInstrument) {
      result = result.filter(student => student.instrument === selectedInstrument);
    }
    
    // Filtrar por estado activo
    if (showActiveOnly) {
      result = result.filter(student => student.is_active !== false);
    }
    
    setFilteredStudents(result);
  }, [searchQuery, showActiveOnly, selectedInstrument, students]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-[#0073ea] border-r-[#0073ea] border-b-gray-200 border-l-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black">{t('loading_students')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md border border-red-200">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      {!activeProgram?.id && (
        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-4 text-black">
          {t('select_program_to_view_students') || 'Please select a program to view students.'}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-black">{t('students_title')}</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowUploadModal(true)} 
            className="bg-green-600 text-white px-3 py-2 rounded-md flex items-center text-sm flex-1 sm:flex-none justify-center"
          >
            <MdUpload className="mr-1" size={16} /> Carga
          </button>
          <Link href="/dashboard/students/new" className="bg-[#0073ea] text-white px-3 py-2 rounded-md flex items-center text-sm flex-1 sm:flex-none justify-center">
            <MdAdd className="mr-1" size={16} /> Nuevo
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col gap-3 mb-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <input
              type="text"
              placeholder={t('search_student_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent text-black font-medium"
            />
            <MdSearch className="absolute left-3 top-2.5 text-black font-bold" size={20} />
          </div>
          
          {/* Filtros en fila */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Filtro de instrumento */}
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-black font-medium focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
            >
              <option value="">Todos los instrumentos</option>
              {availableInstruments.map((instrument) => (
                <option key={instrument} value={instrument}>{instrument}</option>
              ))}
            </select>
            
            {/* Filtro activo/inactivo */}
            <button
              onClick={() => setShowActiveOnly(!showActiveOnly)}
              className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-black font-medium whitespace-nowrap"
            >
              <MdFilterList className="mr-2" size={18} />
              {showActiveOnly ? 'Mostrar todos' : 'Solo activos'}
            </button>
          </div>
        </div>

        {/* Contador de estudiantes */}
        <div className="text-sm text-black font-semibold mb-4">
          {t('showing_n_of_total', { n: filteredStudents.length, total: students.length })}
        </div>

        {/* Tabla para pantallas medianas y grandes */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('name')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('instrument')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('grade')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-semibold text-black">
                            {student.first_name} {student.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-black">{student.instrument || t('not_assigned')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-black">{student.current_grade || t('not_assigned')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        student.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {student.is_active !== false ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/dashboard/students/${student.id}`} className="text-[#0073ea] hover:text-[#0060c0] mr-4">
                        <MdVisibility className="inline mr-1" /> {t('view')}
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-black">
                    {t('no_students_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Vista de tarjetas para móviles - Optimizada */}
        <div className="md:hidden space-y-3">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => (
              <div key={student.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900 text-base">
                    {student.first_name} {student.last_name}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    student.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {student.is_active !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm mb-2">
                  <div className="flex-1">
                    <span className="text-gray-600">Instrumento:</span>
                    <span className="ml-1 font-medium text-gray-900">{student.instrument || 'Sin asignar'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-600">Grado:</span>
                    <span className="ml-1 font-medium text-gray-900">{student.current_grade || 'Sin asignar'}</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <Link 
                    href={`/dashboard/students/${student.id}`} 
                    className="flex items-center justify-center w-full px-3 py-2 bg-[#0073ea] text-white rounded-md text-sm font-medium hover:bg-[#0060c0] transition-colors"
                  >
                    <MdVisibility className="mr-2" size={16} /> Ver Detalles
                  </Link>
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

      {/* Modal de carga masiva */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-white bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-300">
            <div className="flex justify-between items-center border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-900">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MdUpload className="w-5 h-5 text-blue-600" />
                </div>
                {t('bulk_upload_title')}
              </h2>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  if (uploadResults) {
                    fetchStudents(); // Recargar la lista si hubo cambios
                    setUploadResults(null);
                  }
                }} 
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close"
              >
                <MdClose size={20} />
              </button>
            </div>
            <div className="p-0">
              <ExcelUploader 
                onComplete={(results) => {
                  setUploadResults(results);
                  if (results.added > 0 || results.updated > 0) {
                    // Si se agregaron o actualizaron estudiantes, recargar la lista
                    fetchStudents();
                  }
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
