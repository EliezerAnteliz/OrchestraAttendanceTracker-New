'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { MdArrowBack, MdEdit, MdDelete, MdSave, MdCancel, MdPerson, MdPhone, MdSchool, MdMusicNote, MdEmail, MdAdd } from 'react-icons/md';
import { theme } from '@/styles/theme';
import { useProgram } from '@/contexts/ProgramContext';
import { useUserRole } from '@/hooks/useUserRole';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  current_grade: string;
  instrument: string;
  instrument_size: string;
  orchestra_position: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Parent {
  id: string;
  full_name: string;
  phone_number: string;
  email: string;
  preferred_contact_method?: string;
}

interface StudentParent {
  student_id: string;
  parent_id: string;
}

export default function StudentDetail() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { activeProgram } = useProgram();
  const { canEditStudents } = useUserRole();
  const [student, setStudent] = useState<Student | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStudent, setEditedStudent] = useState<Student | null>(null);
  const [editedParents, setEditedParents] = useState<Parent[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setLoading(true);
        if (!activeProgram?.id) {
          setStudent(null);
          setParents([]);
          setError(null);
          return;
        }
        console.log('Consultando estudiante con ID:', params.id);
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('id', params.id)
          .eq('program_id', activeProgram.id)
          .single();

        console.log('Resultado de la consulta de estudiante:', studentData, studentError);
        
        if (studentError) throw studentError;
        if (!studentData) throw new Error('Estudiante no encontrado');

        setStudent(studentData);
        setEditedStudent(studentData);

        // Fetch parents associated with this student - consulta directa a la tabla parents
        try {
          console.log('Buscando padres para el estudiante ID:', params.id);
          
          // Consulta directa para verificar la estructura de la tabla parents
          const { data: parentsSample, error: parentsSampleError } = await supabase
            .from('parents')
            .select('*')
            .limit(1);
            
          console.log('Muestra de la tabla parents (estructura):', parentsSample, parentsSampleError);
          
          // Primero obtenemos los IDs de padres asociados con este estudiante
          const { data: studentParentsData, error: studentParentsError } = await supabase
            .from('student_parents')
            .select('parent_id')
            .eq('student_id', params.id);

          console.log('Resultado de student_parents:', studentParentsData, studentParentsError);
          
          if (studentParentsError) throw studentParentsError;

          if (studentParentsData && studentParentsData.length > 0) {
            const parentIds = studentParentsData.map(sp => sp.parent_id);
            console.log('IDs de padres encontrados:', parentIds);
            
            // Luego obtenemos todos los datos de esos padres
            const { data: parentsData, error: parentsError } = await supabase
              .from('parents')
              .select('id, full_name, phone_number, email, preferred_contact_method')
              .in('id', parentIds);

            console.log('Consulta a parents:', parentsData, parentsError);
            
            if (parentsError) throw parentsError;
            
            // Ordenar padres alfabéticamente por nombre completo
            const sortedParents = [...(parentsData || [])].sort((a, b) => 
              a.full_name.localeCompare(b.full_name, 'es', { sensitivity: 'base' })
            );
            
            setParents(sortedParents);
            setEditedParents(sortedParents);
            
            console.log('Datos de padres obtenidos:', sortedParents);
          } else {
            console.log('No se encontraron padres asociados a este estudiante');
            setParents([]);
            setEditedParents([]);
          }
        } catch (err) {
          console.error('Error al obtener datos de padres:', err);
        }

      } catch (err) {
        console.error('Error fetching student data:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar datos del estudiante');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchStudentData();
    }
  }, [params.id, activeProgram?.id]);

  const handleSaveChanges = async () => {
    if (!editedStudent) return;

    try {
      setLoading(true);
      
      // Update student data
      const { error: studentError } = await supabase
        .from('students')
        .update({
          first_name: editedStudent.first_name,
          last_name: editedStudent.last_name,
          current_grade: editedStudent.current_grade,
          instrument: editedStudent.instrument,
          instrument_size: editedStudent.instrument_size,
          orchestra_position: editedStudent.orchestra_position,
          is_active: editedStudent.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id);

      if (studentError) throw studentError;

      // Update parents data
      for (const parent of editedParents) {
        const { error: parentError } = await supabase
          .from('parents')
          .update({
            full_name: parent.full_name,
            phone_number: parent.phone_number,
            email: parent.email,
            preferred_contact_method: parent.preferred_contact_method
          })
          .eq('id', parent.id);

        if (parentError) {
          console.error('Error updating parent:', parentError);
          throw parentError;
        }
      }

      setStudent(editedStudent);
      setParents(editedParents);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating data:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async () => {
    try {
      setLoading(true);
      console.log('Iniciando eliminación del estudiante:', params.id);
      
      // Get current user and program context for RLS
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Usuario actual:', user?.id);
      
      // First delete student-parent relationships
      console.log('Eliminando relaciones estudiante-padre...');
      const { data: deletedRelations, error: spError } = await supabase
        .from('student_parents')
        .delete()
        .eq('student_id', params.id)
        .select();
      
      console.log('Relaciones eliminadas:', deletedRelations);
      
      if (spError) {
        console.error('Error eliminando relaciones:', spError);
        throw spError;
      }

      // Then delete attendance records
      console.log('Eliminando registros de asistencia...');
      const { data: deletedAttendance, error: attError } = await supabase
        .from('attendance')
        .delete()
        .eq('student_id', params.id)
        .select();
      
      console.log('Registros de asistencia eliminados:', deletedAttendance);
      
      if (attError) {
        console.error('Error eliminando asistencia:', attError);
        throw attError;
      }

      // Check if student exists and user has permission to delete
      console.log('Verificando existencia del estudiante...');
      const { data: studentCheck, error: checkError } = await supabase
        .from('students')
        .select('*')
        .eq('id', params.id)
        .single();
      
      console.log('Estudiante encontrado para eliminar:', studentCheck);
      
      if (checkError) {
        console.error('Error verificando estudiante:', checkError);
        throw new Error(`No se puede acceder al estudiante: ${checkError.message}`);
      }

      if (!studentCheck) {
        throw new Error('El estudiante no existe o no tienes permisos para eliminarlo');
      }

      // Finally delete the student
      console.log('Eliminando estudiante...');
      const { data: deletedData, error } = await supabase
        .from('students')
        .delete()
        .eq('id', params.id)
        .select();

      console.log('Resultado de eliminación:', { deletedData, error });

      if (error) {
        console.error('Error eliminando estudiante:', error);
        throw error;
      }

      if (!deletedData || deletedData.length === 0) {
        console.warn('No se eliminó ningún registro. Posible problema de RLS');
        
        // Try alternative deletion method with program context
        console.log('Intentando eliminación alternativa...');
        const { error: altError } = await supabase
          .from('students')
          .delete()
          .eq('id', params.id)
          .eq('program_id', studentCheck.program_id);
          
        if (altError) {
          throw new Error(`RLS bloqueó la eliminación: ${altError.message}`);
        }
      }

      console.log('Estudiante eliminado exitosamente');
      setDeleteConfirm(false);
      router.push('/dashboard/students');
    } catch (err) {
      console.error('Error deleting student:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar estudiante');
      setLoading(false);
      setDeleteConfirm(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editedStudent) return;
    
    const { name, value, type } = e.target as HTMLInputElement;
    
    setEditedStudent({
      ...editedStudent,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    });
  };

  const handleParentInputChange = (parentId: string, field: string, value: string) => {
    setEditedParents(prev => 
      prev.map(parent => 
        parent.id === parentId 
          ? { ...parent, [field]: value }
          : parent
      )
    );
  };

  if (loading && !student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-[#0073ea] border-r-[#0073ea] border-b-gray-200 border-l-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading_student_data')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
        <p>Error: {error}</p>
        <Link href="/dashboard/students" className="text-[#0073ea] hover:underline mt-2 inline-block">
          {t('back_to_students')}
        </Link>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded mb-4">
        <p>{t('student_not_found')}</p>
        <Link href="/dashboard/students" className="text-[#0073ea] hover:underline mt-2 inline-block">
          {t('back_to_students')}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full">
      {!activeProgram?.id && (
        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-4 text-black">
          {t('select_program_to_view_student') || 'Please select a program to view this student.'}
        </div>
      )}
      
      {/* Header - Monday.com style */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center">
          <Link 
            href="/dashboard/students" 
            className="mr-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MdArrowBack size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {student?.first_name} {student?.last_name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isEditing ? t('edit_student') : t('student_details_tab')}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {!isEditing ? (
            <>
              {canEditStudents && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditedParents([...parents]);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors flex items-center justify-center text-sm font-medium"
                >
                  <MdEdit className="mr-2" size={16} /> {t('edit')}
                </button>
              )}
              {canEditStudents && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center text-sm font-medium"
                >
                  <MdDelete className="mr-2" size={16} /> {t('delete')}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleSaveChanges}
                disabled={loading}
                className={`flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center text-sm font-medium ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <MdSave className="mr-2" size={16} /> {t('save')}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedStudent(student);
                  setEditedParents(parents);
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center text-sm font-medium"
              >
                <MdCancel className="mr-2" size={16} /> {t('cancel')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">{t('confirm_delete_title')}</h3>
            <p className="mb-6">
              ¿Estás seguro de que deseas eliminar a {student.first_name} {student.last_name}? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteStudent}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student information cards - Monday.com style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Personal Information Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold flex items-center text-gray-900">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <MdPerson className="text-blue-600" size={20} />
              </div>
              {t('personal_info')}
            </h2>
          </div>
          <div className="p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('first_name')}</label>
                  <input
                    type="text"
                    name="first_name"
                    value={editedStudent?.first_name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('last_name')}</label>
                  <input
                    type="text"
                    name="last_name"
                    value={editedStudent?.last_name || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('grade')}</label>
                  <input
                    type="text"
                    name="current_grade"
                    value={editedStudent?.current_grade || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('age')}</label>
                  <input
                    type="number"
                    name="age"
                    value={editedStudent?.age || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={editedStudent?.is_active || false}
                      onChange={handleInputChange}
                      className="h-5 w-5 text-[#0073ea] focus:ring-[#0073ea] border-gray-300 rounded"
                    />
                    <span className="ml-2 text-gray-700">{t('active')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('full_name')}</p>
                  <p className="text-lg font-semibold text-gray-900">{student.first_name} {student.last_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('grade')}</p>
                  <p className="text-lg font-semibold text-gray-900">{student.current_grade || t('not_specified')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('age')}</p>
                  <p className="text-lg font-semibold text-gray-900">{student.age ? `${student.age} ${t('years')}` : t('not_specified')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('status')}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                    student.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {student.is_active ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
            
        {/* Orchestra Information Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold flex items-center text-gray-900">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <MdMusicNote className="text-purple-600" size={20} />
              </div>
              {t('orchestra_info')}
            </h2>
          </div>
          <div className="p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('instrument')}</label>
                  <input
                    type="text"
                    name="instrument"
                    value={editedStudent?.instrument || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('instrument_size')}</label>
                  <input
                    type="text"
                    name="instrument_size"
                    value={editedStudent?.instrument_size || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('position')}</label>
                  <input
                    type="text"
                    name="orchestra_position"
                    value={editedStudent?.orchestra_position || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('instrument')}</p>
                  <p className="text-lg font-semibold text-gray-900">{student.instrument || t('not_specified')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('instrument_size')}</p>
                  <p className="text-lg font-semibold text-gray-900">{student.instrument_size || t('not_specified')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('position')}</p>
                  <p className="text-lg font-semibold text-gray-900">{student.orchestra_position || t('not_specified')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Parents information card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold flex items-center text-gray-900">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <MdPerson className="text-green-600" size={20} />
            </div>
            {t('parents_info')}
          </h2>
        </div>
        <div className="p-6">
          
          {(isEditing ? editedParents : parents).length > 0 ? (
            <div className="space-y-4">
              {(isEditing ? editedParents : parents).map((parent, index) => (
                <div key={parent.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('parent_name') || 'Nombre del padre/madre'}</label>
                        <input
                          type="text"
                          value={parent.full_name || ''}
                          onChange={(e) => handleParentInputChange(parent.id, 'full_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone') || 'Teléfono'}</label>
                          <input
                            type="tel"
                            value={parent.phone_number || ''}
                            onChange={(e) => handleParentInputChange(parent.id, 'phone_number', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                            placeholder={t('phone_placeholder') || 'Número de teléfono'}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('email') || 'Email'}</label>
                          <input
                            type="email"
                            value={parent.email || ''}
                            onChange={(e) => handleParentInputChange(parent.id, 'email', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-gray-900"
                            placeholder={t('email_placeholder') || 'Correo electrónico'}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-lg text-gray-900 mb-3">
                        {parent.full_name}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center bg-white p-3 rounded-lg border border-gray-200">
                          <div className="p-2 bg-blue-100 rounded-lg mr-3">
                            <MdPhone className="text-blue-600" size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t('phone') || 'Teléfono'}</p>
                            {parent.phone_number ? (
                              <p className="text-gray-900 font-medium truncate">{parent.phone_number}</p>
                            ) : (
                              <p className="text-gray-400 italic text-sm">{t('phone_not_registered')}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center bg-white p-3 rounded-lg border border-gray-200">
                          <div className="p-2 bg-green-100 rounded-lg mr-3">
                            <MdEmail className="text-green-600" size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t('email') || 'Email'}</p>
                            {parent.email ? (
                              <p className="text-gray-900 font-medium truncate">{parent.email}</p>
                            ) : (
                              <p className="text-gray-400 italic text-sm">{t('email_not_registered')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
              <div className="p-3 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <MdPerson className="text-gray-400" size={24} />
              </div>
              <p className="text-gray-600 mb-4 font-medium">{t('no_contacts_registered')}</p>
              <p className="text-gray-500 text-sm">{t('no_contacts_available')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
