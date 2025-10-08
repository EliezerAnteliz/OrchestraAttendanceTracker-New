'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdAdd, MdEdit, MdDelete, MdMusicNote, MdSearch, MdPeople } from 'react-icons/md';
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

  useEffect(() => {
    if (activeProgram?.id) {
      fetchOrchestras();
    }
  }, [activeProgram]);

  const fetchOrchestras = async () => {
    try {
      setLoading(true);
      
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

  const filteredOrchestras = orchestras.filter(o =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.description && o.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <MdMusicNote className="mr-2" size={28} />
          {lang === 'es' ? 'Gestión de Orquestas' : 'Orchestra Management'}
        </h1>
        
        {isAdmin && (
          <button
            onClick={() => {
              setEditingOrchestra(null);
              setFormData({ name: '', description: '', is_active: true });
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 transition-colors"
          >
            <MdAdd className="mr-2" size={20} />
            {lang === 'es' ? 'Nueva Orquesta' : 'New Orchestra'}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={lang === 'es' ? 'Buscar orquesta...' : 'Search orchestra...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Orchestras Grid */}
      {filteredOrchestras.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <MdMusicNote className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">
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
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              {lang === 'es' ? 'Crear Primera Orquesta' : 'Create First Orchestra'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrchestras.map((orchestra) => (
            <div
              key={orchestra.id}
              className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${
                orchestra.is_active ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    <MdMusicNote className="mr-2 text-blue-600" size={24} />
                    {orchestra.name}
                  </h3>
                  {!orchestra.is_active && (
                    <span className="text-xs text-red-600 font-medium">
                      {lang === 'es' ? 'Inactiva' : 'Inactive'}
                    </span>
                  )}
                </div>
                
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(orchestra)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={lang === 'es' ? 'Editar' : 'Edit'}
                    >
                      <MdEdit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(orchestra)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={lang === 'es' ? 'Eliminar' : 'Delete'}
                    >
                      <MdDelete size={18} />
                    </button>
                  </div>
                )}
              </div>

              {orchestra.description && (
                <p className="text-gray-600 text-sm mb-4">{orchestra.description}</p>
              )}

              <div className="flex items-center text-gray-700 bg-gray-50 rounded-md p-3">
                <MdPeople className="mr-2 text-blue-600" size={20} />
                <span className="font-medium">
                  {orchestra.student_count || 0} {lang === 'es' ? 'estudiante(s)' : 'student(s)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {editingOrchestra 
                  ? (lang === 'es' ? 'Editar Orquesta' : 'Edit Orchestra')
                  : (lang === 'es' ? 'Nueva Orquesta' : 'New Orchestra')
                }
              </h2>

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {lang === 'es' ? 'Nombre' : 'Name'} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder={lang === 'es' ? 'Ej: Mozart, Beethoven' : 'Ex: Mozart, Beethoven'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {lang === 'es' ? 'Descripción' : 'Description'}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                      {lang === 'es' ? 'Orquesta activa' : 'Active orchestra'}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingOrchestra(null);
                      setFormData({ name: '', description: '', is_active: true });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    {lang === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
    </div>
  );
}
