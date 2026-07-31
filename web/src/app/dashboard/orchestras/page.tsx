'use client';

// Sistema de gestión de orquestas - Versión 1.0
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdMusicNote, MdSearch, MdPeople, MdClose } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';
import { useUserRole } from '@/hooks/useUserRole';

interface Orchestra {
  id: string;
  name: string;
  description: string | null;
  program_id: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  student_count?: number;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  instrument: string | null;
  orchestra_id: string | null;
  is_active: boolean;
}

export default function OrchestrasPage() {
  const { t, lang } = useI18n();
  const { activeProgram } = useProgram();
  const { isAdmin } = useUserRole();
  
  const [orchestras, setOrchestras] = useState<Orchestra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingOrchestra, setEditingOrchestra] = useState<Orchestra | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });
  
  // Estados para asignar estudiantes
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningOrchestra, setAssigningOrchestra] = useState<Orchestra | null>(null);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [assigningStudents, setAssigningStudents] = useState(false);
  
  // Estados para ver/gestionar estudiantes de una orquesta
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [viewingOrchestra, setViewingOrchestra] = useState<Orchestra | null>(null);
  const [orchestraStudents, setOrchestraStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentToMove, setStudentToMove] = useState<Student | null>(null);
  const [targetOrchestra, setTargetOrchestra] = useState<string>('');

  useEffect(() => {
    if (activeProgram?.id) {
      fetchOrchestras();
    }
  }, [activeProgram]);

  const fetchOrchestras = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Obtener orquestas
      const { data: orchestrasData, error: orchestrasError } = await supabase
        .from('orchestras')
        .select('*')
        .eq('program_id', activeProgram?.id)
        .order('name');

      if (orchestrasError) throw orchestrasError;

      // Obtener conteo de estudiantes por orquesta
      const orchestrasWithCount = await Promise.all(
        (orchestrasData || []).map(async (orchestra) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('orchestra_id', orchestra.id)
            .eq('is_active', true);

          return {
            ...orchestra,
            student_count: count || 0
          };
        })
      );

      setOrchestras(orchestrasWithCount);
    } catch (error) {
      console.error('Error fetching orchestras:', error);
      alert(lang === 'es' ? 'Error al cargar orquestas' : 'Error loading orchestras');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert(lang === 'es' ? 'El nombre es obligatorio' : 'Name is required');
      return;
    }

    try {
      if (editingOrchestra) {
        // Actualizar
        const { error } = await supabase
          .from('orchestras')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active
          })
          .eq('id', editingOrchestra.id);

        if (error) throw error;
        alert(lang === 'es' ? 'Orquesta actualizada exitosamente' : 'Orchestra updated successfully');
      } else {
        // Crear nueva
        const { error } = await supabase
          .from('orchestras')
          .insert([{
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            program_id: activeProgram?.id,
            organization_id: activeProgram?.organization_id
          }]);

        if (error) throw error;
        alert(lang === 'es' ? 'Orquesta creada exitosamente' : 'Orchestra created successfully');
      }

      setShowModal(false);
      setEditingOrchestra(null);
      setFormData({ name: '', description: '', is_active: true });
      fetchOrchestras();
    } catch (error: any) {
      console.error('Error saving orchestra:', error);
      alert(error.message || (lang === 'es' ? 'Error al guardar orquesta' : 'Error saving orchestra'));
    }
  };

  const handleEdit = (orchestra: Orchestra) => {
    setEditingOrchestra(orchestra);
    setFormData({
      name: orchestra.name,
      description: orchestra.description || '',
      is_active: orchestra.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (orchestra: Orchestra) => {
    if (orchestra.student_count && orchestra.student_count > 0) {
      alert(lang === 'es' 
        ? `No se puede eliminar la orquesta "${orchestra.name}" porque tiene ${orchestra.student_count} estudiante(s) asignado(s). Primero reasigne los estudiantes a otra orquesta.`
        : `Cannot delete orchestra "${orchestra.name}" because it has ${orchestra.student_count} student(s) assigned. Please reassign students first.`
      );
      return;
    }

    if (!confirm(lang === 'es' 
      ? `¿Está seguro de eliminar la orquesta "${orchestra.name}"?`
      : `Are you sure you want to delete orchestra "${orchestra.name}"?`
    )) {
      return;
    }

    try {
      const { error } = await supabase
        .from('orchestras')
        .delete()
        .eq('id', orchestra.id);

      if (error) throw error;
      
      alert(lang === 'es' ? 'Orquesta eliminada exitosamente' : 'Orchestra deleted successfully');
      fetchOrchestras();
    } catch (error: any) {
      console.error('Error deleting orchestra:', error);
      alert(error.message || (lang === 'es' ? 'Error al eliminar orquesta' : 'Error deleting orchestra'));
    }
  };

  // Función para abrir modal de asignación de estudiantes
  const handleAssignStudents = async (orchestra: Orchestra) => {
    setAssigningOrchestra(orchestra);
    setSelectedStudents(new Set());
    setStudentSearchTerm('');
    
    try {
      // Obtener estudiantes activos del programa que NO estén en ninguna orquesta
      const { data: students, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, instrument, orchestra_id, is_active')
        .eq('program_id', activeProgram?.id)
        .eq('is_active', true)
        .is('orchestra_id', null)
        .order('last_name', { ascending: true });

      if (error) throw error;
      
      setAvailableStudents(students || []);
      setShowAssignModal(true);
    } catch (error: any) {
      console.error('Error loading students:', error);
      alert(error.message || (lang === 'es' ? 'Error al cargar estudiantes' : 'Error loading students'));
    }
  };

  // Función para seleccionar/deseleccionar estudiante
  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  // Función para seleccionar todos los estudiantes filtrados
  const toggleSelectAll = () => {
    const filteredIds = filteredAvailableStudents.map(s => s.id);
    if (selectedStudents.size === filteredIds.length && filteredIds.length > 0) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredIds));
    }
  };

  // Función para asignar estudiantes a la orquesta
  const handleConfirmAssignment = async () => {
    if (selectedStudents.size === 0) {
      alert(lang === 'es' ? 'Selecciona al menos un estudiante' : 'Select at least one student');
      return;
    }

    if (!assigningOrchestra) return;

    setAssigningStudents(true);
    try {
      // Actualizar todos los estudiantes seleccionados
      const updates = Array.from(selectedStudents).map(studentId => 
        supabase
          .from('students')
          .update({ orchestra_id: assigningOrchestra.id })
          .eq('id', studentId)
      );

      await Promise.all(updates);

      alert(lang === 'es' 
        ? `${selectedStudents.size} estudiante(s) asignado(s) a ${assigningOrchestra.name} exitosamente`
        : `${selectedStudents.size} student(s) assigned to ${assigningOrchestra.name} successfully`
      );

      setShowAssignModal(false);
      setAssigningOrchestra(null);
      setSelectedStudents(new Set());
      fetchOrchestras();
    } catch (error: any) {
      console.error('Error assigning students:', error);
      alert(error.message || (lang === 'es' ? 'Error al asignar estudiantes' : 'Error assigning students'));
    } finally {
      setAssigningStudents(false);
    }
  };

  // Función para ver estudiantes de una orquesta
  const handleViewStudents = async (orchestra: Orchestra) => {
    setViewingOrchestra(orchestra);
    setLoadingStudents(true);
    setShowStudentsModal(true);
    
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, instrument, orchestra_id, is_active')
        .eq('orchestra_id', orchestra.id)
        .eq('is_active', true)
        .order('first_name', { ascending: true })
        .order('last_name', { ascending: true });

      if (error) throw error;
      
      setOrchestraStudents(students || []);
    } catch (error: any) {
      console.error('Error loading students:', error);
      alert(error.message || (lang === 'es' ? 'Error al cargar estudiantes' : 'Error loading students'));
    } finally {
      setLoadingStudents(false);
    }
  };

  // Función para mover estudiante a otra orquesta
  const handleMoveStudent = async () => {
    if (!studentToMove || !targetOrchestra) return;

    try {
      const newOrchestraId = targetOrchestra === 'none' ? null : targetOrchestra;
      
      const { error } = await supabase
        .from('students')
        .update({ orchestra_id: newOrchestraId })
        .eq('id', studentToMove.id);

      if (error) throw error;

      const targetOrchestraName = targetOrchestra === 'none' 
        ? (lang === 'es' ? 'Sin orquesta' : 'No orchestra')
        : orchestras.find(o => o.id === targetOrchestra)?.name || '';

      alert(lang === 'es' 
        ? `${studentToMove.first_name} ${studentToMove.last_name} movido a ${targetOrchestraName} exitosamente`
        : `${studentToMove.first_name} ${studentToMove.last_name} moved to ${targetOrchestraName} successfully`
      );

      setStudentToMove(null);
      setTargetOrchestra('');
      
      // Recargar estudiantes de la orquesta actual
      if (viewingOrchestra) {
        handleViewStudents(viewingOrchestra);
      }
      // silent: el modal "Ver estudiantes" sigue abierto en este punto
      fetchOrchestras(true);
    } catch (error: any) {
      console.error('Error moving student:', error);
      alert(error.message || (lang === 'es' ? 'Error al mover estudiante' : 'Error moving student'));
    }
  };

  // Función para remover estudiante de la orquesta
  const handleRemoveStudent = async (student: Student) => {
    if (!confirm(lang === 'es' 
      ? `¿Remover a ${student.first_name} ${student.last_name} de ${viewingOrchestra?.name}?`
      : `Remove ${student.first_name} ${student.last_name} from ${viewingOrchestra?.name}?`
    )) {
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({ orchestra_id: null })
        .eq('id', student.id);

      if (error) throw error;

      alert(lang === 'es' 
        ? `${student.first_name} ${student.last_name} removido de la orquesta`
        : `${student.first_name} ${student.last_name} removed from orchestra`
      );

      // Recargar estudiantes
      if (viewingOrchestra) {
        handleViewStudents(viewingOrchestra);
      }
      // silent: el modal "Ver estudiantes" sigue abierto en este punto
      fetchOrchestras(true);
    } catch (error: any) {
      console.error('Error removing student:', error);
      alert(error.message || (lang === 'es' ? 'Error al remover estudiante' : 'Error removing student'));
    }
  };

  // Filtrar estudiantes disponibles
  const filteredAvailableStudents = availableStudents.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    (s.instrument && s.instrument.toLowerCase().includes(studentSearchTerm.toLowerCase()))
  );

  const filteredOrchestras = orchestras.filter(o =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.description && o.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C2492B]"></div>
      </div>
    );
  }

  const totalAssigned = orchestras.reduce((sum, o) => sum + (o.student_count || 0), 0);

  return (
    <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full">
      <div className="max-w-[1420px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-7 pb-5 sm:pb-[22px] border-b border-[#E3DDD1]">
          <div>
            <h1
              className="text-[28px] sm:text-[40px] leading-[1.05] text-[#1B1917]"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {lang === 'es' ? 'Orquestas' : 'Orchestras'}
            </h1>
            <p className="text-[#8A8177] mt-2 text-sm">
              {orchestras.length} {lang === 'es' ? 'orquestas' : 'ensembles'} · {totalAssigned} {lang === 'es' ? 'estudiantes asignados' : 'students assigned'}
              {activeProgram?.name ? ` · ${activeProgram.name}` : ''}
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => {
                setEditingOrchestra(null);
                setFormData({ name: '', description: '', is_active: true });
                setShowModal(true);
              }}
              className="bg-[#C2492B] text-[#FAF7F2] rounded-lg px-[18px] py-2.5 font-medium hover:bg-[#A83A20] transition-colors w-full sm:w-auto"
            >
              {lang === 'es' ? 'Nueva Orquesta' : 'New orchestra'}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-[22px]">
          <input
            type="text"
            placeholder={lang === 'es' ? 'Buscar orquesta…' : 'Search orchestra…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-[14px] py-3 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917] font-medium"
          />
          <MdSearch className="absolute left-3 top-3.5 text-[#A29889]" size={18} />
        </div>

        {/* Orchestras Grid */}
        {filteredOrchestras.length === 0 ? (
          <div className="text-center py-12 mt-[18px]">
            <MdMusicNote className="mx-auto text-[#A29889] mb-3" size={40} />
            <p className="text-[#8A8177] font-medium">
              {searchTerm
                ? (lang === 'es' ? 'No se encontraron orquestas' : 'No orchestras found')
                : (lang === 'es' ? 'No hay orquestas creadas' : 'No orchestras created yet')
              }
            </p>
            {isAdmin && !searchTerm && (
              <button
                onClick={() => {
                  setEditingOrchestra(null);
                  setFormData({ name: '', description: '', is_active: true });
                  setShowModal(true);
                }}
                className="mt-4 bg-[#C2492B] text-[#FAF7F2] px-6 py-2.5 rounded-lg font-medium hover:bg-[#A83A20] transition-colors"
              >
                {lang === 'es' ? 'Crear Primera Orquesta' : 'Create First Orchestra'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 mt-[18px]">
            {filteredOrchestras.map((orchestra) => (
              <div
                key={orchestra.id}
                className={`bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl px-6 pt-[22px] pb-5 flex flex-col gap-[18px] ${!orchestra.is_active ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      className="text-[26px] text-[#1B1917] leading-tight"
                      style={{ fontFamily: 'var(--font-newsreader), serif', letterSpacing: '-0.015em' }}
                    >
                      {orchestra.name}
                    </div>
                    {/* Nota: aquí el mockup muestra un texto de horario/nivel ficticio
                        (ej. "Intermediate strings · Tue / Thu") que no manejamos en
                        nuestros datos — mostramos la descripción real o el estado. */}
                    {orchestra.description ? (
                      <div className="text-[12.5px] text-[#8A8177] mt-1">{orchestra.description}</div>
                    ) : !orchestra.is_active ? (
                      <div className="text-[12.5px] text-[#A8402A] mt-1">{lang === 'es' ? 'Inactiva' : 'Inactive'}</div>
                    ) : null}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-3.5 text-[12.5px] flex-shrink-0">
                      <button
                        onClick={() => handleEdit(orchestra)}
                        className="text-[#8A8177] hover:text-[#C2492B] transition-colors"
                      >
                        {lang === 'es' ? 'Editar' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDelete(orchestra)}
                        className="text-[#8A8177] hover:text-[#A8402A] transition-colors"
                      >
                        {lang === 'es' ? 'Eliminar' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-baseline gap-2.5">
                  <span
                    className="text-[40px] leading-none text-[#1B1917]"
                    style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
                  >
                    {orchestra.student_count || 0}
                  </span>
                  <span className="text-[13px] text-[#8A8177]">
                    {lang === 'es' ? 'estudiantes' : 'students'}
                  </span>
                </div>

                <div className="flex gap-2.5 border-t border-[#EFE9DD] pt-4">
                  <button
                    onClick={() => handleViewStudents(orchestra)}
                    className="flex-1 border border-[#DED7C9] rounded-lg py-2.5 text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium"
                  >
                    {lang === 'es' ? 'Ver Estudiantes' : 'View students'}
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleAssignStudents(orchestra)}
                      className="flex-1 bg-[#C2492B] text-[#FAF7F2] rounded-lg py-2.5 font-medium hover:bg-[#A83A20] transition-colors"
                    >
                      {lang === 'es' ? 'Asignar Estudiantes' : 'Assign students'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF7F2] rounded-lg sm:rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-[#E3DDD1]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px]">
              <div>
                <h2
                  className="text-2xl leading-none text-[#1B1917]"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {editingOrchestra
                    ? (lang === 'es' ? 'Editar Orquesta' : 'Edit Orchestra')
                    : (lang === 'es' ? 'Nueva Orquesta' : 'New Orchestra')
                  }
                </h2>
                <p className="text-[12.5px] text-[#8A8177] mt-1.5">
                  {lang === 'es' ? 'Completa la información de la orquesta' : 'Complete orchestra information'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingOrchestra(null);
                  setFormData({ name: '', description: '', is_active: true });
                }}
                className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
              >
                <MdClose size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-[30px] py-[26px]">
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12.5px] text-[#8A8177] mb-1">
                      {lang === 'es' ? 'Nombre' : 'Name'} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                      placeholder={lang === 'es' ? 'Ej: Mozart, Beethoven' : 'Ex: Mozart, Beethoven'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[12.5px] text-[#8A8177] mb-1">
                      {lang === 'es' ? 'Descripción' : 'Description'}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                      rows={3}
                      placeholder={lang === 'es' ? 'Descripción opcional' : 'Optional description'}
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-[#C2492B] border-gray-300 rounded focus:ring-[#C2492B]"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-[#56504A]">
                      {lang === 'es' ? 'Orquesta activa' : 'Active orchestra'}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingOrchestra(null);
                      setFormData({ name: '', description: '', is_active: true });
                    }}
                    className="px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
                  >
                    {lang === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 text-sm bg-[#C2492B] text-[#FAF7F2] rounded-lg hover:bg-[#A83A20] transition-colors font-medium"
                  >
                    {editingOrchestra
                      ? (lang === 'es' ? 'Actualizar' : 'Update')
                      : (lang === 'es' ? 'Crear' : 'Create')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignación de Estudiantes */}
      {showAssignModal && assigningOrchestra && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF7F2] rounded-lg sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-[#E3DDD1]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px]">
              <div>
                <h2
                  className="text-2xl leading-none text-[#1B1917]"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {lang === 'es' ? 'Asignar Estudiantes' : 'Assign Students'}
                </h2>
                <p className="text-[12.5px] text-[#8A8177] mt-1.5">
                  {lang === 'es' ? 'Orquesta: ' : 'Orchestra: '}
                  <span className="font-medium text-[#C2492B]">{assigningOrchestra.name}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningOrchestra(null);
                  setSelectedStudents(new Set());
                }}
                className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
              >
                <MdClose size={18} />
              </button>
            </div>

            {/* Search and Select All */}
            <div className="px-4 sm:px-[30px] py-4 border-b border-[#E3DDD1] space-y-3">
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#A29889]" size={18} />
                <input
                  type="text"
                  placeholder={lang === 'es' ? 'Buscar estudiante...' : 'Search student...'}
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-[14px] py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={toggleSelectAll}
                  className="text-[13px] text-[#8A8177] hover:text-[#C2492B] font-medium transition-colors"
                >
                  {selectedStudents.size === filteredAvailableStudents.length && filteredAvailableStudents.length > 0
                    ? (lang === 'es' ? 'Deseleccionar todos' : 'Deselect all')
                    : (lang === 'es' ? 'Seleccionar todos' : 'Select all')
                  }
                </button>
                <span className="text-[13px] text-[#6E675E]">
                  {selectedStudents.size} {lang === 'es' ? 'seleccionado(s)' : 'selected'}
                </span>
              </div>
            </div>

            {/* Students List */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-[30px] py-4">
              {filteredAvailableStudents.length === 0 ? (
                <div className="text-center py-12 text-[#8A8177]">
                  <MdPeople className="mx-auto mb-3 text-[#A29889]" size={40} />
                  <p>
                    {studentSearchTerm
                      ? (lang === 'es' ? 'No se encontraron estudiantes' : 'No students found')
                      : (lang === 'es' ? 'No hay estudiantes disponibles sin orquesta' : 'No students available without orchestra')
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableStudents.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => toggleStudentSelection(student.id)}
                      className={`px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedStudents.has(student.id)
                          ? 'border-[#C2492B] bg-[#FBF2ED]'
                          : 'border-[#EAE3D6] bg-[#FFFDFA] hover:border-[#D6C9BB]'
                      }`}
                    >
                      <p className="text-[14.5px] font-medium text-[#1B1917]">
                        {student.first_name} {student.last_name}
                      </p>
                      {student.instrument && (
                        <p className="text-[12.5px] text-[#8A8177] mt-0.5">{student.instrument}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-[30px] py-3 sm:pt-[18px] sm:pb-[24px] border-t border-[#E3DDD1]">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssigningOrchestra(null);
                    setSelectedStudents(new Set());
                  }}
                  className="px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
                  disabled={assigningStudents}
                >
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmAssignment}
                  disabled={assigningStudents || selectedStudents.size === 0}
                  className="px-4 py-2.5 text-sm bg-[#C2492B] text-[#FAF7F2] rounded-lg hover:bg-[#A83A20] transition-colors font-medium disabled:bg-[#DED7C9] disabled:text-[#A29889] disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {assigningStudents ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      {lang === 'es' ? 'Asignando...' : 'Assigning...'}
                    </>
                  ) : (
                    lang === 'es' ? `Asignar ${selectedStudents.size} estudiante(s)` : `Assign ${selectedStudents.size} student(s)`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Ver Estudiantes de la Orquesta */}
      {showStudentsModal && viewingOrchestra && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF7F2] rounded-lg sm:rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-[#E3DDD1]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px]">
              <div>
                <h2
                  className="text-2xl leading-none text-[#1B1917]"
                  style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                >
                  {viewingOrchestra.name}
                </h2>
                <p className="text-[12.5px] text-[#8A8177] mt-1.5">
                  {orchestraStudents.length} {lang === 'es' ? 'estudiante(s)' : 'student(s)'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowStudentsModal(false);
                  setViewingOrchestra(null);
                  setOrchestraStudents([]);
                }}
                className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
              >
                <MdClose size={18} />
              </button>
            </div>

            {/* Students List */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-[30px] py-[26px]">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C2492B]"></div>
                </div>
              ) : orchestraStudents.length === 0 ? (
                <div className="text-center py-12 text-[#8A8177]">
                  <MdPeople className="mx-auto mb-3 text-[#A29889]" size={40} />
                  <p>{lang === 'es' ? 'No hay estudiantes en esta orquesta' : 'No students in this orchestra'}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orchestraStudents.map((student) => (
                    <div
                      key={student.id}
                      className="px-4 py-3.5 rounded-lg border border-[#EAE3D6] bg-[#FFFDFA]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-[#1B1917] truncate">
                            {student.first_name} {student.last_name}
                          </p>
                          {student.instrument && (
                            <p className="text-[12.5px] text-[#8A8177] mt-0.5">
                              {student.instrument}
                            </p>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                setStudentToMove(student);
                                setTargetOrchestra('');
                              }}
                              className="px-3 py-2 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors text-[13px]"
                              title={lang === 'es' ? 'Cambiar de orquesta' : 'Change orchestra'}
                            >
                              {lang === 'es' ? 'Cambiar' : 'Move'}
                            </button>
                            <button
                              onClick={() => handleRemoveStudent(student)}
                              className="px-3 py-2 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#A8402A] hover:text-[#A8402A] transition-colors text-[13px]"
                              title={lang === 'es' ? 'Remover de orquesta' : 'Remove from orchestra'}
                            >
                              {lang === 'es' ? 'Remover' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Mini modal para cambiar de orquesta */}
                      {studentToMove?.id === student.id && (
                        <div className="mt-3 pt-3 border-t border-[#EFE9DD]">
                          <p className="text-[12.5px] text-[#8A8177] mb-2">
                            {lang === 'es' ? 'Mover a:' : 'Move to:'}
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={targetOrchestra}
                              onChange={(e) => setTargetOrchestra(e.target.value)}
                              className="flex-1 appearance-none px-[14px] py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] text-[#1B1917] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30"
                            >
                              <option value="">{lang === 'es' ? 'Seleccionar orquesta...' : 'Select orchestra...'}</option>
                              <option value="none">{lang === 'es' ? 'Sin orquesta' : 'No orchestra'}</option>
                              {orchestras
                                .filter(o => o.id !== viewingOrchestra.id && o.is_active)
                                .map(o => (
                                  <option key={o.id} value={o.id}>{o.name}</option>
                                ))
                              }
                            </select>
                            <button
                              onClick={handleMoveStudent}
                              disabled={!targetOrchestra}
                              className="px-4 py-2.5 text-sm bg-[#C2492B] text-[#FAF7F2] rounded-lg hover:bg-[#A83A20] transition-colors font-medium disabled:bg-[#DED7C9] disabled:text-[#A29889] disabled:cursor-not-allowed"
                            >
                              {lang === 'es' ? 'Confirmar' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => {
                                setStudentToMove(null);
                                setTargetOrchestra('');
                              }}
                              className="px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
                            >
                              {lang === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-[30px] py-3 sm:pt-[18px] sm:pb-[24px] border-t border-[#E3DDD1]">
              <button
                onClick={() => {
                  setShowStudentsModal(false);
                  setViewingOrchestra(null);
                  setOrchestraStudents([]);
                }}
                className="w-full px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
              >
                {lang === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
