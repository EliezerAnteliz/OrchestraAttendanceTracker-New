'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { MdSearch, MdAdd, MdFilterList, MdEdit, MdDelete, MdVisibility, MdContacts, MdUpload, MdClose, MdPerson, MdPhone, MdEmail, MdMusicNote, MdSchool, MdCalendarToday, MdCheckCircle } from 'react-icons/md';
import ExcelUploader from '@/components/ExcelUploader';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';
import { useUserRole } from '@/hooks/useUserRole';

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
  const { canBulkUpload, canEditStudents, loading: roleLoading } = useUserRole();
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
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showStudentDrawer, setShowStudentDrawer] = useState(false);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [orchestras, setOrchestras] = useState<any[]>([]);

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

  const fetchStudentDetails = async (studentId: string) => {
    try {
      setLoadingDetails(true);
      
      // Obtener información del estudiante
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      // Obtener información de la orquesta
      let orchestraData = null;
      if (studentData.orchestra_id) {
        const { data: orchestra } = await supabase
          .from('orchestras')
          .select('name')
          .eq('id', studentData.orchestra_id)
          .single();
        orchestraData = orchestra;
      }

      // Obtener información de los padres a través de la tabla de relación student_parents
      const { data: studentParentsData } = await supabase
        .from('student_parents')
        .select(`
          parent_id,
          relationship,
          is_primary_contact,
          parents (
            id,
            full_name,
            phone_number,
            email
          )
        `)
        .eq('student_id', studentId);

      // Formatear datos de padres
      const parentsData = studentParentsData?.map(sp => {
        const parent = Array.isArray(sp.parents) ? sp.parents[0] : sp.parents;
        return {
          id: parent?.id,
          full_name: parent?.full_name,
          phone_number: parent?.phone_number,
          email: parent?.email,
          relationship: sp.relationship,
          is_primary_contact: sp.is_primary_contact
        };
      }) || [];

      // Obtener lista de orquestas para el selector
      const { data: orchestrasData } = await supabase
        .from('orchestras')
        .select('*')
        .eq('program_id', activeProgram?.id)
        .order('name');

      setOrchestras(orchestrasData || []);

      const details = {
        ...studentData,
        orchestra_name: orchestraData?.name || null,
        parents: parentsData
      };

      setStudentDetails(details);
      setEditFormData(details);
      setShowStudentDrawer(true);
    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    fetchStudentDetails(student.id);
  };

  const closeDrawer = () => {
    setShowStudentDrawer(false);
    setSelectedStudent(null);
    setStudentDetails(null);
    setIsEditMode(false);
    setEditFormData(null);
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditFormData(studentDetails);
  };

  const handleSaveEdit = async () => {
    try {
      // Actualizar información del estudiante
      const { error: updateError } = await supabase
        .from('students')
        .update({
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          age: editFormData.age,
          current_grade: editFormData.current_grade,
          instrument: editFormData.instrument,
          instrument_size: editFormData.instrument_size,
          orchestra_position: editFormData.orchestra_position,
          orchestra_id: editFormData.orchestra_id || null,
          is_active: editFormData.is_active
        })
        .eq('id', selectedStudent.id);

      if (updateError) throw updateError;

      // Actualizar padres si existen
      if (editFormData.parents && editFormData.parents.length > 0) {
        for (const parent of editFormData.parents) {
          if (parent.id) {
            await supabase
              .from('parents')
              .update({
                full_name: parent.full_name,
                phone_number: parent.phone_number,
                email: parent.email
              })
              .eq('id', parent.id);
          }
        }
      }

      // Recargar datos
      await fetchStudents();
      await fetchStudentDetails(selectedStudent.id);
      setIsEditMode(false);
    } catch (error) {
      console.error('Error updating student:', error);
      alert(t('error_updating_student') || 'Error al actualizar estudiante');
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setEditFormData({ ...editFormData, [field]: value });
  };

  const handleParentChange = (index: number, field: string, value: any) => {
    const updatedParents = [...(editFormData.parents || [])];
    updatedParents[index] = { ...updatedParents[index], [field]: value };
    setEditFormData({ ...editFormData, parents: updatedParents });
  };

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
        <h1 className="text-2xl font-bold text-gray-800">{t('students_title')}</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          {canBulkUpload && (
            <button 
              onClick={() => setShowUploadModal(true)} 
              className="bg-green-600 text-white px-3 py-2 rounded-md flex items-center text-sm flex-1 sm:flex-none justify-center"
            >
              <MdUpload className="mr-1" size={16} /> {t('bulk_upload_short')}
            </button>
          )}
          {canEditStudents && (
            <Link href="/dashboard/students/new" className="bg-[#0073ea] text-white px-3 py-2 rounded-md flex items-center text-sm flex-1 sm:flex-none justify-center">
              <MdAdd className="mr-1" size={16} /> {t('new_student_short')}
            </Link>
          )}
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
              <option value="">{t('all_instruments')}</option>
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr 
                    key={student.id}
                    onClick={() => handleStudentClick(student)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-black">
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
              <div 
                key={student.id} 
                onClick={() => handleStudentClick(student)}
                className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-800 text-base">
                    {student.first_name} {student.last_name}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    student.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {student.is_active !== false ? t('active') : t('inactive')}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex-1">
                    <span className="text-gray-600">{t('instrument')}:</span>
                    <span className="ml-1 font-medium text-gray-900">{student.instrument || t('not_assigned')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-600">{t('grade')}:</span>
                    <span className="ml-1 font-medium text-gray-900">{student.current_grade || t('not_assigned')}</span>
                  </div>
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
              <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
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

      {/* Modal centrado con información del estudiante */}
      {showStudentDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pb-20 sm:pb-4">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
          />
          
          {/* Modal centrado */}
          <div className="relative w-full max-w-4xl max-h-[85vh] sm:max-h-[90vh] mx-auto">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl overflow-hidden">
              <div className="flex flex-col max-h-[85vh] sm:max-h-[90vh]">
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="p-1.5 sm:p-2 bg-white bg-opacity-20 rounded-lg">
                        <MdPerson size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-semibold">
                          {selectedStudent?.first_name} {selectedStudent?.last_name}
                        </h2>
                        <p className="text-xs sm:text-sm text-blue-100">
                          {t('student_profile')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closeDrawer}
                      className="p-1.5 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    >
                      <MdClose size={20} className="sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                  {loadingDetails ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : studentDetails && editFormData ? (
                    <div className="space-y-4 sm:space-y-6">
                      {/* Información Personal */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-blue-100">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <MdPerson className="mr-2 text-blue-600" size={18} />
                          {t('personal_info')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('first_name')}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.first_name}
                                onChange={(e) => handleInputChange('first_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.first_name}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('last_name')}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.last_name}
                                onChange={(e) => handleInputChange('last_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.last_name}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('age') || 'Edad'}
                            </p>
                            {isEditMode ? (
                              <input
                                type="number"
                                value={editFormData.age || ''}
                                onChange={(e) => handleInputChange('age', parseInt(e.target.value) || null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.age ? `${studentDetails.age} años` : t('not_specified')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('grade')}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.current_grade || ''}
                                onChange={(e) => handleInputChange('current_grade', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.current_grade || t('not_specified')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('status')}
                            </p>
                            {isEditMode ? (
                              <select
                                value={editFormData.is_active !== false ? 'true' : 'false'}
                                onChange={(e) => handleInputChange('is_active', e.target.value === 'true')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              >
                                <option value="true">{t('active')}</option>
                                <option value="false">{t('inactive')}</option>
                              </select>
                            ) : (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                studentDetails.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {studentDetails.is_active !== false ? t('active') : t('inactive')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Información de Orquesta */}
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-purple-100">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <MdMusicNote className="mr-2 text-purple-600" size={18} />
                          {t('orchestra_info')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('instrument')}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.instrument || ''}
                                onChange={(e) => handleInputChange('instrument', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.instrument || t('not_assigned')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('instrument_size') || 'Tamaño'}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.instrument_size || ''}
                                onChange={(e) => handleInputChange('instrument_size', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                                placeholder="3/4, 4/4, etc."
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.instrument_size || t('not_specified')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('orchestra')}
                            </p>
                            {isEditMode ? (
                              <select
                                value={editFormData.orchestra_id || ''}
                                onChange={(e) => handleInputChange('orchestra_id', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                              >
                                <option value="">{t('not_assigned')}</option>
                                {orchestras.map((orch) => (
                                  <option key={orch.id} value={orch.id}>{orch.name}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.orchestra_name || t('not_assigned')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                              {t('orchestra_position') || 'Posición'}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.orchestra_position || ''}
                                onChange={(e) => handleInputChange('orchestra_position', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                                placeholder="Primer violín, etc."
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">
                                {studentDetails.orchestra_position || t('not_specified')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Información de Padres */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-green-100">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
                          <MdContacts className="mr-2 text-green-600" size={18} />
                          {t('parents_info')}
                        </h3>
                        {studentDetails.parents && studentDetails.parents.length > 0 ? (
                          <div className="space-y-4">
                            {(isEditMode ? editFormData.parents : studentDetails.parents).map((parent: any, index: number) => (
                              <div key={index} className="bg-white rounded-lg p-4 border border-green-200">
                                {isEditMode ? (
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1 block">
                                        {t('parent_name')}
                                      </label>
                                      <input
                                        type="text"
                                        value={parent.full_name || ''}
                                        onChange={(e) => handleParentChange(index, 'full_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1 block">
                                        {t('phone')}
                                      </label>
                                      <input
                                        type="text"
                                        value={parent.phone_number || ''}
                                        onChange={(e) => handleParentChange(index, 'phone_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1 block">
                                        {t('email')}
                                      </label>
                                      <input
                                        type="email"
                                        value={parent.email || ''}
                                        onChange={(e) => handleParentChange(index, 'email', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="font-semibold text-gray-800 text-base">
                                      {parent.full_name}
                                    </p>
                                    <div className="space-y-2">
                                      {parent.phone_number && (
                                        <div className="flex items-center gap-2">
                                          <MdPhone className="text-green-600 flex-shrink-0" size={18} />
                                          <a 
                                            href={`tel:${parent.phone_number}`}
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                          >
                                            {parent.phone_number}
                                          </a>
                                        </div>
                                      )}
                                      {parent.email && (
                                        <div className="flex items-center gap-2">
                                          <MdEmail className="text-green-600 flex-shrink-0" size={18} />
                                          <a 
                                            href={`mailto:${parent.email}`}
                                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline break-all"
                                          >
                                            {parent.email}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                            <p className="text-sm text-gray-500">
                              {t('no_parent_info') || 'No hay información de padres registrada'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer con acciones */}
                <div className="px-3 sm:px-6 py-2.5 sm:py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-between items-center gap-2">
                    {isEditMode ? (
                      <>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                        >
                          <MdCheckCircle className="mr-1 sm:mr-2" size={16} />
                          {t('save')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={closeDrawer}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                          {t('close')}
                        </button>
                        {canEditStudents && (
                          <button
                            onClick={handleEditClick}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                          >
                            <MdEdit className="mr-1 sm:mr-2" size={16} />
                            {t('edit')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
