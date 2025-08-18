'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MdArrowBack, MdAdd, MdEdit, MdDelete, MdSave, MdCancel, MdPhone, MdEmail } from 'react-icons/md';
import { theme } from '@/styles/theme';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Parent {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
}

interface StudentParent {
  student_id: string;
  parent_id: string;
}

export default function StudentContacts() {
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState<Omit<Parent, 'id'>>({
    first_name: '',
    last_name: '',
    phone: '',
    email: ''
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch student data
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('id', params.id)
          .single();

        if (studentError) throw studentError;
        if (!studentData) throw new Error('Estudiante no encontrado');

        setStudent(studentData);

        // Fetch parents associated with this student - consulta directa a la tabla parents
        try {
          // Primero obtenemos los IDs de padres asociados con este estudiante
          const { data: studentParentsData, error: studentParentsError } = await supabase
            .from('student_parents')
            .select('parent_id')
            .eq('student_id', params.id);

          if (studentParentsError) throw studentParentsError;

          if (studentParentsData && studentParentsData.length > 0) {
            const parentIds = studentParentsData.map(sp => sp.parent_id);
            
            // Luego obtenemos todos los datos de esos padres
            const { data: parentsData, error: parentsError } = await supabase
              .from('parents')
              .select('id, first_name, last_name, phone_number, email')
              .in('id', parentIds);

            if (parentsError) throw parentsError;
            
            console.log('Datos de padres obtenidos en página de contactos:', parentsData);
            setParents(parentsData || []);
          } else {
            console.log('No se encontraron padres asociados a este estudiante');
            setParents([]);
          }
        } catch (err) {
          console.error('Error al obtener datos de padres:', err);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const handleAddContact = async () => {
    try {
      setLoading(true);
      
      // Insert new parent
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .insert({
          first_name: newContact.first_name,
          last_name: newContact.last_name,
          phone: newContact.phone,
          email: newContact.email
        })
        .select()
        .single();

      if (parentError) throw parentError;
      
      // Create relationship between student and parent
      const { error: relationError } = await supabase
        .from('student_parents')
        .insert({
          student_id: params.id,
          parent_id: parentData.id
        });

      if (relationError) throw relationError;
      
      // Add the new parent to the local state
      setParents([...parents, parentData]);
      
      // Reset form
      setNewContact({
        first_name: '',
        last_name: '',
        phone: '',
        email: ''
      });
      setIsAddingContact(false);
    } catch (err) {
      console.error('Error adding contact:', err);
      setError(err instanceof Error ? err.message : 'Error al añadir contacto');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async (id: string) => {
    try {
      setLoading(true);
      
      const parentToUpdate = parents.find(p => p.id === id);
      if (!parentToUpdate) return;
      
      const { error } = await supabase
        .from('parents')
        .update({
          first_name: parentToUpdate.first_name,
          last_name: parentToUpdate.last_name,
          phone: parentToUpdate.phone,
          email: parentToUpdate.email
        })
        .eq('id', id);

      if (error) throw error;
      
      setEditingContactId(null);
    } catch (err) {
      console.error('Error updating contact:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar contacto');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      setLoading(true);
      
      // Delete the relationship first
      const { error: relationError } = await supabase
        .from('student_parents')
        .delete()
        .eq('student_id', params.id)
        .eq('parent_id', id);

      if (relationError) throw relationError;
      
      // Then check if this parent is associated with other students
      const { data: otherRelations, error: checkError } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_id', id);

      if (checkError) throw checkError;
      
      // If no other students are associated with this parent, delete the parent
      if (!otherRelations || otherRelations.length === 0) {
        const { error: deleteError } = await supabase
          .from('parents')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;
      }
      
      // Update local state
      setParents(parents.filter(p => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar contacto');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    contactId?: string
  ) => {
    const { name, value } = e.target;
    
    if (contactId) {
      // Editing existing contact
      setParents(parents.map(p => 
        p.id === contactId ? { ...p, [name]: value } : p
      ));
    } else {
      // Adding new contact
      setNewContact({ ...newContact, [name]: value });
    }
  };

  if (loading && !student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-[#0073ea] border-r-[#0073ea] border-b-gray-200 border-l-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
        <p>Error: {error}</p>
        <Link href={`/dashboard/students/${params.id}`} className="text-[#0073ea] hover:underline mt-2 inline-block">
          Volver al perfil del estudiante
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link 
            href={`/dashboard/students/${params.id}`} 
            className="mr-4 p-2 rounded-full hover:bg-gray-100"
          >
            <MdArrowBack size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Contactos del Estudiante</h1>
            {student && (
              <p className="text-gray-600">{student.first_name} {student.last_name}</p>
            )}
          </div>
        </div>
        
        {!isAddingContact && (
          <button
            onClick={() => setIsAddingContact(true)}
            className="px-4 py-2 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors flex items-center"
          >
            <MdAdd className="mr-1" /> Añadir Contacto
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          <p>{error}</p>
        </div>
      )}

      {/* Add new contact form */}
      {isAddingContact && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 border-l-4 border-[#0073ea]">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Añadir Nuevo Contacto</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  name="first_name"
                  value={newContact.first_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                  placeholder="Nombre"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input
                  type="text"
                  name="last_name"
                  value={newContact.last_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                  placeholder="Apellido"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  name="phone"
                  value={newContact.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                  placeholder="Teléfono"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  name="email"
                  value={newContact.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsAddingContact(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center"
              >
                <MdCancel className="mr-1" /> Cancelar
              </button>
              <button
                onClick={handleAddContact}
                disabled={loading || !newContact.first_name || !newContact.last_name}
                className={`px-4 py-2 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors flex items-center ${
                  (loading || !newContact.first_name || !newContact.last_name) ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <MdSave className="mr-1" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts list */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Contactos</h2>
          
          {parents.length > 0 ? (
            <div className="space-y-4">
              {parents.map((parent) => (
                <div 
                  key={parent.id} 
                  className={`p-4 border rounded-md ${
                    editingContactId === parent.id 
                      ? 'border-[#0073ea] bg-[#e5f2ff]' 
                      : 'border-gray-200 hover:border-[#0073ea]'
                  } transition-colors`}
                >
                  {editingContactId === parent.id ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                          <input
                            type="text"
                            name="first_name"
                            value={parent.first_name}
                            onChange={(e) => handleInputChange(e, parent.id)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                          <input
                            type="text"
                            name="last_name"
                            value={parent.last_name}
                            onChange={(e) => handleInputChange(e, parent.id)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                          <input
                            type="tel"
                            name="phone"
                            value={parent.phone || ''}
                            onChange={(e) => handleInputChange(e, parent.id)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                          <input
                            type="email"
                            name="email"
                            value={parent.email || ''}
                            onChange={(e) => handleInputChange(e, parent.id)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0073ea]"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingContactId(null)}
                          className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center text-sm"
                        >
                          <MdCancel className="mr-1" /> Cancelar
                        </button>
                        <button
                          onClick={() => handleUpdateContact(parent.id)}
                          disabled={loading}
                          className={`px-3 py-1 bg-[#0073ea] text-white rounded-md hover:bg-[#0060c0] transition-colors flex items-center text-sm ${
                            loading ? 'opacity-70 cursor-not-allowed' : ''
                          }`}
                        >
                          <MdSave className="mr-1" /> Guardar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{parent.first_name} {parent.last_name}</p>
                          <div className="mt-2 space-y-1">
                            {parent.phone && (
                              <p className="text-sm text-gray-600 flex items-center">
                                <MdPhone className="mr-1 text-[#0073ea]" /> {parent.phone}
                              </p>
                            )}
                            {parent.email && (
                              <p className="text-sm text-gray-600 flex items-center">
                                <MdEmail className="mr-1 text-[#0073ea]" /> {parent.email}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setEditingContactId(parent.id)}
                            className="p-1 text-gray-500 hover:text-[#0073ea] rounded-full hover:bg-gray-100"
                          >
                            <MdEdit size={20} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(parent.id)}
                            className="p-1 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100"
                          >
                            <MdDelete size={20} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Delete confirmation */}
                      {deleteConfirmId === parent.id && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-700 mb-2">¿Estás seguro de que deseas eliminar este contacto?</p>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-100"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDeleteContact(parent.id)}
                              className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">No hay contactos registrados para este estudiante.</p>
          )}
        </div>
      </div>
    </div>
  );
}
