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

  // Filtrar estudiantes cuando cambia la búsqueda o el filtro de activos
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
    
    // Filtrar por estado activo
    if (showActiveOnly) {
      result = result.filter(student => student.is_active !== false);
    }
    
    setFilteredStudents(result);
  }, [searchQuery, showActiveOnly, students]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-black">{t('students_title')}</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <button 
            onClick={() => setShowUploadModal(true)} 
            className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center whitespace-nowrap"
          >
            <MdUpload className="mr-1" /> {t('bulk_upload')}
          </button>
          <Link href="/dashboard/students/new" className="bg-[#0073ea] text-white px-4 py-2 rounded-md flex items-center whitespace-nowrap">
            <MdAdd className="mr-1" /> {t('new_student')}
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder={t('search_student_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] focus:border-transparent text-black font-medium"
            />
            <MdSearch className="absolute left-3 top-2.5 text-black font-bold" size={20} />
          </div>
          <div className="flex items-center">
            <button
              onClick={() => setShowActiveOnly(!showActiveOnly)}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-black font-medium"
            >
              <MdFilterList className="mr-2" />
              {showActiveOnly ? t('show_all') : t('only_active')}
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
                          <div className="text-sm font-medium text-gray-900">
                            {student.first_name} {student.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{student.instrument || t('not_assigned')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{student.current_grade || t('not_assigned')}</div>
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
        
        {/* Vista de tarjetas para móviles */}
        <div className="md:hidden space-y-4">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => (
              <div key={student.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {student.first_name} {student.last_name}
                    </h3>
                  </div>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    student.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {student.is_active !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div>
                    <span className="text-black font-medium">{t('instrument')}:</span>
                    <p className="font-medium">{student.instrument || t('not_assigned')}</p>
                  </div>
                  <div>
                    <span className="text-black font-medium">{t('grade')}:</span>
                    <p className="font-medium">{student.current_grade || t('not_assigned')}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                  <Link 
                    href={`/dashboard/students/${student.id}`} 
                    className="flex items-center px-3 py-1.5 bg-[#e5f2ff] text-[#0073ea] rounded-md text-sm"
                  >
                    <MdVisibility className="mr-1" /> {t('view')}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex justify-between items-center border-b p-4 bg-transparent rounded-t-lg">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-900"><MdUpload /> {t('bulk_upload_title')}</h2>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  if (uploadResults) {
                    fetchStudents(); // Recargar la lista si hubo cambios
                    setUploadResults(null);
                  }
                }} 
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0073ea] rounded"
                aria-label="Close"
              >
                <MdClose size={22} />
              </button>
            </div>
            <div className="p-4">
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
