'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { MdSearch, MdAdd, MdEdit, MdDelete, MdUpload, MdClose, MdCheckCircle } from 'react-icons/md';
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
  orchestra_id?: string;
};

// Listas fijas para estandarizar "Grado" y "Posición" — antes eran texto
// libre y en producción terminaron con variantes como "4th", "4th grade",
// "4th " (espacio de más), "2nd grado", etc. Con un select, todos los
// estudiantes nuevos quedan en el mismo formato.
const GRADE_OPTIONS = [
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
];

// Jerarquía típica dentro de una orquesta escolar.
const POSITION_OPTIONS = ['Concert Master', 'Principal', 'Assistant', 'Section'];

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
  // Nombre de orquesta por id, solo para pintar "{instrumento} · {orquesta}"
  // en la segunda línea de cada tarjeta de la lista — fetch aparte y liviano
  // (no toca la query de fetchStudents) para no arriesgar esa consulta ya
  // probada en producción.
  const [orchestraNamesById, setOrchestraNamesById] = useState<Record<string, string>>({});
  // Activos de Inventario enlazados a este estudiante (assigned_student_id) —
  // instrumento físico real, no el texto declarado en el propio estudiante.
  const [linkedAssets, setLinkedAssets] = useState<any[]>([]);
  const [showNewStudentModal, setShowNewStudentModal] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    first_name: '',
    last_name: '',
    age: '',
    current_grade: '',
    // asset_id: '' = sin instrumento, '__other__' = texto libre (no está en
    // inventario todavía), un uuid = activo real de Inventario enlazado.
    asset_id: '',
    instrument: '',
    instrument_size: '',
    orchestra_position: '',
    is_active: true,
    parent_name: '',
    parent_phone: '',
    parent_email: ''
  });
  const [savingNewStudent, setSavingNewStudent] = useState(false);
  // Instrumentos de Inventario disponibles (sin asignar) para el programa
  // activo — se ofrecen para enlazar al crear un estudiante en vez de
  // escribir el nombre del instrumento como texto suelto.
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  useEffect(() => {
    const fetchAvailableAssets = async () => {
      if (!showNewStudentModal || !activeProgram?.id) return;
      try {
        setLoadingAssets(true);
        const { data, error: assetsError } = await supabase
          .from('assets')
          .select('id, full_code, description, brand, size, serial_number')
          .eq('current_program_id', activeProgram.id)
          .eq('status_code', 'available')
          .eq('is_active', true)
          .is('assigned_student_id', null)
          .order('description', { ascending: true });

        if (assetsError) throw assetsError;
        setAvailableAssets(data || []);
      } catch (err) {
        console.error('Error loading available assets:', err);
        setAvailableAssets([]);
      } finally {
        setLoadingAssets(false);
      }
    };

    fetchAvailableAssets();
  }, [showNewStudentModal, activeProgram?.id]);

  const fetchStudents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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

  useEffect(() => {
    const fetchOrchestraNames = async () => {
      if (!activeProgram?.id) {
        setOrchestraNamesById({});
        return;
      }
      try {
        const { data, error: orchestrasError } = await supabase
          .from('orchestras')
          .select('id, name')
          .eq('program_id', activeProgram.id);

        if (orchestrasError) throw orchestrasError;

        const map: Record<string, string> = {};
        (data || []).forEach((o: any) => { map[o.id] = o.name; });
        setOrchestraNamesById(map);
      } catch (err) {
        console.error('Error al cargar nombres de orquestas:', err);
        setOrchestraNamesById({});
      }
    };

    fetchOrchestraNames();
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

  const fetchStudentDetails = async (studentId: string, silent = false) => {
    try {
      if (!silent) setLoadingDetails(true);

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

      // Instrumento(s) real(es) de Inventario enlazados a este estudiante.
      // Falla en silencio (deja la lista vacía) si la columna aún no existe
      // en este ambiente o si el estudiante no tiene nada enlazado — no debe
      // bloquear la carga del resto del perfil.
      try {
        const { data: assetsData, error: assetsError } = await supabase
          .from('assets')
          .select('id, full_code, description, brand, size, serial_number, status_code')
          .eq('assigned_student_id', studentId)
          .eq('is_active', true);
        if (assetsError) throw assetsError;
        setLinkedAssets(assetsData || []);
      } catch (assetsErr) {
        console.error('Error fetching linked inventory assets:', assetsErr);
        setLinkedAssets([]);
      }

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
    setLinkedAssets([]);
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

      // Recargar datos (silent: evita que la pantalla completa se ponga en
      // "loading" y se desmonte todo -incluyendo este modal abierto- solo
      // porque estamos refrescando la lista de fondo, no cargándola de cero)
      await fetchStudents(true);
      await fetchStudentDetails(selectedStudent.id, true);
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

  const handleNewStudentChange = (field: string, value: any) => {
    setNewStudentData({ ...newStudentData, [field]: value });
  };

  // Maneja el selector de instrumento del modal "Nuevo Estudiante": puede
  // elegirse un activo real de Inventario (enlace verdadero), "Otro" (texto
  // libre, para instrumentos que aún no están en Inventario) o dejarlo vacío.
  const handleNewStudentAssetChange = (value: string) => {
    if (value === '__other__') {
      setNewStudentData({ ...newStudentData, asset_id: '__other__', instrument: '', instrument_size: '' });
    } else if (value === '') {
      setNewStudentData({ ...newStudentData, asset_id: '', instrument: '', instrument_size: '' });
    } else {
      const asset = availableAssets.find((a) => a.id === value);
      setNewStudentData({
        ...newStudentData,
        asset_id: value,
        instrument: asset?.description || '',
        instrument_size: asset?.size || '',
      });
    }
  };

  const handleSaveNewStudent = async () => {
    try {
      setSavingNewStudent(true);
      
      // Validar campos requeridos
      if (!newStudentData.first_name || !newStudentData.last_name) {
        alert(t('required_fields_error') || 'Por favor complete los campos requeridos');
        return;
      }

      if (!activeProgram?.id) {
        alert('No hay programa activo seleccionado');
        return;
      }

      // Obtener organization_id del programa activo
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('organization_id')
        .eq('id', activeProgram.id)
        .single();

      if (programError || !programData) {
        throw new Error('Error al obtener información del programa');
      }

      // Generar student_id único
      const randomNum = Math.floor(Math.random() * 10000);
      const studentId = `S${randomNum}`;

      // Insertar nuevo estudiante
      const { data: studentData, error: insertError } = await supabase
        .from('students')
        .insert({
          student_id: studentId,
          first_name: newStudentData.first_name,
          last_name: newStudentData.last_name,
          age: newStudentData.age ? parseInt(newStudentData.age) : null,
          current_grade: newStudentData.current_grade || null,
          instrument: newStudentData.instrument || null,
          instrument_size: newStudentData.instrument_size || null,
          orchestra_position: newStudentData.orchestra_position || null,
          is_active: newStudentData.is_active,
          program_id: activeProgram.id,
          organization_id: programData.organization_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Si se eligió un instrumento real de Inventario (no "__other__" ni
      // vacío), enlazar ese activo al estudiante recién creado.
      let assetLinkFailed = false;
      if (studentData && newStudentData.asset_id && newStudentData.asset_id !== '__other__') {
        const { error: assetLinkError } = await supabase
          .from('assets')
          .update({
            assigned_student_id: studentData.id,
            assigned_to_text: null,
            status_code: 'assigned',
          })
          .eq('id', newStudentData.asset_id);

        if (assetLinkError) {
          // No revertimos la creación del estudiante por esto — el RLS de
          // assets hoy solo permite escribir a Admin (ver "Only Admin can
          // update assets"), así que si quien crea el estudiante es Staff
          // esta actualización puede fallar por permisos. Se avisa al
          // usuario en vez de fallar en silencio, para que sepa que debe
          // pedirle a un Admin que enlace el instrumento desde Inventario.
          console.error('Error linking asset to new student:', assetLinkError);
          assetLinkFailed = true;
        }
      }

      // Insertar información de contacto del padre si se proporcionó
      if (studentData && (newStudentData.parent_name || newStudentData.parent_phone || newStudentData.parent_email)) {
        const { data: parentData, error: parentError } = await supabase
          .from('parents')
          .insert({
            full_name: newStudentData.parent_name || null,
            phone_number: newStudentData.parent_phone || null,
            email: newStudentData.parent_email || null,
            organization_id: programData.organization_id,
            program_id: activeProgram.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!parentError && parentData) {
          await supabase
            .from('student_parents')
            .insert({
              student_id: studentData.id,
              parent_id: parentData.id,
              program_id: activeProgram.id,
              is_primary_contact: true,
              created_at: new Date().toISOString()
            });
        }
      }

      // Recargar lista de estudiantes (silent: el modal de "Nuevo Estudiante"
      // sigue abierto en este punto, no queremos que la pantalla completa
      // se desmonte a un loading mientras se ve)
      await fetchStudents(true);

      // Cerrar modal y resetear formulario
      setShowNewStudentModal(false);
      setNewStudentData({
        first_name: '',
        last_name: '',
        age: '',
        current_grade: '',
        asset_id: '',
        instrument: '',
        instrument_size: '',
        orchestra_position: '',
        is_active: true,
        parent_name: '',
        parent_phone: '',
        parent_email: ''
      });
      
      if (assetLinkFailed) {
        alert(t('student_created_asset_link_failed') || 'Estudiante creado, pero no se pudo enlazar el instrumento (solo un Admin puede hacerlo desde Inventario).');
      } else {
        alert(t('student_created_successfully') || 'Estudiante creado exitosamente');
      }
    } catch (error) {
      console.error('Error creating student:', error);
      alert(t('error_creating_student') || 'Error al crear estudiante');
    } finally {
      setSavingNewStudent(false);
    }
  };

  const closeNewStudentModal = () => {
    setShowNewStudentModal(false);
    setNewStudentData({
      first_name: '',
      last_name: '',
      age: '',
      current_grade: '',
      instrument: '',
      instrument_size: '',
      orchestra_position: '',
      is_active: true,
      parent_name: '',
      parent_phone: '',
      parent_email: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-4 md:p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-[#C2492B] border-r-[#C2492B] border-b-gray-200 border-l-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black">{t('loading_students')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-50 p-4 rounded-md border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-7 bg-[#FAF7F2]">
    <div className="max-w-[1420px] mx-auto">
      {!activeProgram?.id && (
        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mb-4 text-black">
          {t('select_program_to_view_students') || 'Please select a program to view students.'}
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-end gap-4 pb-5 border-b border-[#E3DDD1]">
        <div>
          <h1
            className="text-[40px] leading-[1.05] text-[#1B1917]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            {t('students_title')}
          </h1>
          <p className="text-[#8A8177] mt-2 text-sm">
            {t('showing_n_of_total', { n: filteredStudents.length, total: students.length })}
            {activeProgram?.name ? ` · ${activeProgram.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canBulkUpload && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="border border-[#DED7C9] text-[#56504A] px-4 py-2.5 rounded-lg flex items-center text-sm flex-1 sm:flex-none justify-center hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
            >
              <MdUpload className="mr-1.5" size={16} /> {t('bulk_upload_short')}
            </button>
          )}
          {canEditStudents && (
            <button
              onClick={() => setShowNewStudentModal(true)}
              className="bg-[#C2492B] text-[#FAF7F2] font-medium px-4 py-2.5 rounded-lg flex items-center text-sm flex-1 sm:flex-none justify-center hover:bg-[#A83A20] transition-colors"
            >
              <MdAdd className="mr-1.5" size={16} /> {t('new_student_short')}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Barra de búsqueda */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('search_student_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-[#E3DDD1] rounded-lg bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917] font-medium"
            />
            <MdSearch className="absolute left-3 top-3.5 text-[#A29889]" size={18} />
          </div>

          {/* Filtro de instrumento */}
          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
            className="sm:w-56 px-3 py-3 border border-[#E3DDD1] rounded-lg bg-[#FFFDFA] text-[#1B1917] font-medium focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30"
          >
            <option value="">{t('all_instruments')}</option>
            {availableInstruments.map((instrument) => (
              <option key={instrument} value={instrument}>{instrument}</option>
            ))}
          </select>

          {/* Filtro activo/inactivo */}
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className="flex items-center justify-center px-4 py-3 bg-[#FFFDFA] border border-[#E3DDD1] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] text-[#56504A] font-medium whitespace-nowrap transition-colors"
          >
            {showActiveOnly ? t('show_all') : t('only_active')}
          </button>
        </div>

        {/* Tarjetas de estudiante — mismo componente en móvil y escritorio.
            grid-cols con auto-fill/minmax (no un número fijo de columnas)
            para que el ancho de cada tarjeta se mantenga ~310px como en el
            mockup, en vez de estirarse al ancho disponible. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3 mt-[18px]">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => handleStudentClick(student)}
                className="text-left bg-[#FFFDFA] border border-[#EAE3D6] hover:border-[#D6C9BB] rounded-[11px] px-[18px] py-4 cursor-pointer transition-colors flex flex-col gap-2.5"
              >
                <div className="flex justify-between items-baseline gap-2">
                  <h3 className="text-[15.5px] font-medium text-[#1B1917] truncate">
                    {student.first_name} {student.last_name}
                  </h3>
                  <span
                    className={`shrink-0 text-[11.5px] uppercase ${
                      student.is_active !== false ? 'text-[#6E7F63]' : 'text-[#A8402A]'
                    }`}
                    style={{ letterSpacing: '0.06em' }}
                  >
                    {student.is_active !== false ? t('active') : t('inactive')}
                  </span>
                </div>

                <div className="flex justify-between items-baseline gap-2 text-[13px] text-[#8A8177]">
                  <span className="truncate">
                    {student.instrument || t('not_assigned')}
                    {student.orchestra_id && orchestraNamesById[student.orchestra_id]
                      ? ` · ${orchestraNamesById[student.orchestra_id]}`
                      : ''}
                  </span>
                  <span className="shrink-0">{student.current_grade ? `${t('grade')} ${student.current_grade}` : t('not_assigned')}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-[#A29889]">
              {t('no_students_found')}
            </div>
          )}
        </div>
      </div>

      {/* Modal de carga masiva — mismo modelo (fondo, bordes, tipografía)
          que los otros dos modales de Estudiantes. */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF7F2] rounded-lg sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[#E3DDD1]">
            <div className="flex items-start justify-between gap-3 border-b border-[#E3DDD1] px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px]">
              <h2
                className="text-2xl sm:text-[32px] leading-none text-[#1B1917]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
              >
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
                className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <MdClose size={18} />
              </button>
            </div>
            <div className="p-0">
              <ExcelUploader
                onComplete={(results) => {
                  setUploadResults(results);
                  if (results.added > 0 || results.updated > 0) {
                    // Si se agregaron o actualizaron estudiantes, recargar la lista
                    // en silencio: este modal de carga sigue abierto en pantalla
                    fetchStudents(true);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal centrado con información del estudiante */}
      {showStudentDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pt-16 sm:pt-4 pb-20 sm:pb-4 safe-area-inset">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={closeDrawer}
          />
          
          {/* Modal centrado — ancho contenido (no ocupa toda la pantalla),
              como en el mockup: min(760px, 100%) en vez de estirarse. */}
          <div className="relative w-full sm:max-w-[760px] max-h-[80vh] sm:max-h-[86vh] mx-auto">
            <div className="bg-[#FAF7F2] rounded-lg sm:rounded-2xl border border-[#E3DDD1] shadow-xl overflow-hidden">
              <div className="flex flex-col max-h-[80vh] sm:max-h-[86vh]">
                {/* Header */}
                <div className="px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px] border-b border-[#E3DDD1]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2
                        className="text-2xl sm:text-[32px] leading-none text-[#1B1917]"
                        style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                      >
                        {selectedStudent?.first_name} {selectedStudent?.last_name}
                      </h2>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5">
                        {(linkedAssets[0]?.description || selectedStudent?.instrument) && (
                          <span className="inline-flex items-center gap-1 text-[12.5px] tracking-[0.09em] uppercase text-[#C2492B]">
                            {linkedAssets[0]?.description || selectedStudent.instrument}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={closeDrawer}
                      className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
                    >
                      <MdClose size={18} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:px-[30px] sm:py-[26px]">
                  {loadingDetails ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C2492B]"></div>
                    </div>
                  ) : studentDetails && editFormData ? (
                    <div className="space-y-4 sm:space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-[26px]">
                      {/* Información Personal — sin caja/borde alrededor,
                          solo la etiqueta en mayúsculas + línea divisoria,
                          igual que el mockup (no "una sección = una tarjeta"). */}
                      <div>
                        <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                          {t('personal_info')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('first_name')}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.first_name}
                                onChange={(e) => handleInputChange('first_name', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            ) : (
                              <p className="text-[14px] text-[#1B1917]">
                                {studentDetails.first_name}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('last_name')}
                            </p>
                            {isEditMode ? (
                              <input
                                type="text"
                                value={editFormData.last_name}
                                onChange={(e) => handleInputChange('last_name', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            ) : (
                              <p className="text-[14px] text-[#1B1917]">
                                {studentDetails.last_name}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* grid-cols-2 en mobile: 3 columnas a secas dejaba
                            cada <select> (ej. "Grade") en ~100px, muy
                            apretado en 375px — con 2 columnas el 3er campo
                            (Estado) cae solo a su propia fila. */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('age') || 'Edad'}
                            </p>
                            {isEditMode ? (
                              <input
                                type="number"
                                value={editFormData.age || ''}
                                onChange={(e) => handleInputChange('age', parseInt(e.target.value) || null)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            ) : (
                              <p className="text-[14px] text-[#1B1917]">
                                {studentDetails.age ? `${studentDetails.age} años` : t('not_specified')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('grade')}
                            </p>
                            {isEditMode ? (
                              <select
                                value={editFormData.current_grade || ''}
                                onChange={(e) => handleInputChange('current_grade', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              >
                                <option value="">{t('not_specified')}</option>
                                {GRADE_OPTIONS.map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-[14px] text-[#1B1917]">
                                {studentDetails.current_grade || t('not_specified')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('status')}
                            </p>
                            {isEditMode ? (
                              <select
                                value={editFormData.is_active !== false ? 'true' : 'false'}
                                onChange={(e) => handleInputChange('is_active', e.target.value === 'true')}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              >
                                <option value="true">{t('active')}</option>
                                <option value="false">{t('inactive')}</option>
                              </select>
                            ) : (
                              <p className={`text-[14px] ${
                                studentDetails.is_active !== false ? 'text-[#5F7A57]' : 'text-[#A8402A]'
                              }`}>
                                {studentDetails.is_active !== false ? t('active') : t('inactive')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Información de Orquesta — sin caja/borde, mismo patrón. */}
                      <div>
                        <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                          {t('orchestra_info')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          {linkedAssets.length > 0 ? (
                            <div className="col-span-2">
                              <p className="text-[12.5px] text-[#8A8177] mb-1">
                                {t('instrument')}
                              </p>
                              <div className="space-y-1.5">
                                {linkedAssets.map((asset) => (
                                  <div key={asset.id}>
                                    <p className="text-[14px] text-[#1B1917]">
                                      {asset.description}{asset.size ? ` · ${asset.size}` : ''}
                                    </p>
                                    <p className="text-[12px] text-[#8A8177] truncate">
                                      {[asset.brand, asset.serial_number ? `S/N ${asset.serial_number}` : null, asset.full_code ? `#${asset.full_code}` : null].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-[12.5px] text-[#8A8177] mb-1">
                                  {t('instrument')}
                                </p>
                                {isEditMode ? (
                                  <input
                                    type="text"
                                    value={editFormData.instrument || ''}
                                    onChange={(e) => handleInputChange('instrument', e.target.value)}
                                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                                  />
                                ) : (
                                  <p className="text-[14px] text-[#1B1917]">
                                    {studentDetails.instrument || t('not_assigned')}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-[12.5px] text-[#8A8177] mb-1">
                                  {t('instrument_size') || 'Tamaño'}
                                </p>
                                {isEditMode ? (
                                  <input
                                    type="text"
                                    value={editFormData.instrument_size || ''}
                                    onChange={(e) => handleInputChange('instrument_size', e.target.value)}
                                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                                    placeholder="3/4, 4/4"
                                  />
                                ) : (
                                  <p className="text-[14px] text-[#1B1917]">
                                    {studentDetails.instrument_size || t('not_specified')}
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('orchestra')}
                            </p>
                            {isEditMode ? (
                              <select
                                value={editFormData.orchestra_id || ''}
                                onChange={(e) => handleInputChange('orchestra_id', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              >
                                <option value="">{t('not_assigned')}</option>
                                {orchestras.map((orch) => (
                                  <option key={orch.id} value={orch.id}>{orch.name}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-[14px] text-[#1B1917]">
                                {studentDetails.orchestra_name || t('not_assigned')}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[12.5px] text-[#8A8177] mb-1">
                              {t('orchestra_position') || 'Posición'}
                            </p>
                            {isEditMode ? (
                              <select
                                value={editFormData.orchestra_position || ''}
                                onChange={(e) => handleInputChange('orchestra_position', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              >
                                <option value="">{t('not_assigned')}</option>
                                {POSITION_OPTIONS.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-[14px] text-[#1B1917]">
                                {studentDetails.orchestra_position || t('not_specified')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>

                      {/* Información de Padres — sin caja/borde, mismo patrón. */}
                      <div>
                        <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                          {t('parents_info')}
                        </h3>
                        {studentDetails.parents && studentDetails.parents.length > 0 ? (
                          <div className="space-y-3">
                            {(isEditMode ? editFormData.parents : studentDetails.parents).map((parent: any, index: number) => (
                              isEditMode ? (
                                <div
                                  key={index}
                                  className={index > 0 ? 'pt-3 mt-3 border-t border-[#EFE9DD] space-y-3' : 'space-y-3'}
                                >
                                  <div>
                                    <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                      {t('parent_name')}
                                    </label>
                                    <input
                                      type="text"
                                      value={parent.full_name || ''}
                                      onChange={(e) => handleParentChange(index, 'full_name', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                      <label className="text-[12.5px] text-[#8A8177] mb-1 block">
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
                                      <label className="text-[12.5px] text-[#8A8177] mb-1 block">
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
                                </div>
                              ) : (
                                <div key={index} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <p className="text-[14px] text-[#1B1917]">
                                    {parent.full_name}
                                  </p>
                                  {parent.phone_number && (
                                    <a
                                      href={`tel:${parent.phone_number}`}
                                      className="text-[14px] text-[#1B1917] hover:text-[#C2492B]"
                                    >
                                      {parent.phone_number}
                                    </a>
                                  )}
                                  {parent.email && (
                                    <a
                                      href={`mailto:${parent.email}`}
                                      className="text-[14px] text-[#C2492B] hover:underline break-all"
                                    >
                                      {parent.email}
                                    </a>
                                  )}
                                </div>
                              )
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-[#8A8177]">
                            {t('no_parent_info') || 'No hay información de padres registrada'}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Footer con acciones */}
                <div className="px-4 sm:px-[30px] py-3 sm:pt-[18px] sm:pb-[24px] border-t border-[#E3DDD1]">
                  <div className="flex justify-end items-center gap-2">
                    {isEditMode ? (
                      <>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium flex items-center justify-center"
                        >
                          <MdCheckCircle className="mr-1 sm:mr-2" size={16} />
                          {t('save')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={closeDrawer}
                          className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
                        >
                          {t('close')}
                        </button>
                        {canEditStudents && (
                          <button
                            onClick={handleEditClick}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium flex items-center justify-center"
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

      {/* Modal para Nuevo Estudiante */}
      {showNewStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pt-16 sm:pt-4 pb-20 sm:pb-4 safe-area-inset">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={closeNewStudentModal}
          />
          
          {/* Modal centrado — ancho contenido, no toda la pantalla */}
          <div className="relative w-full sm:max-w-[760px] max-h-[80vh] sm:max-h-[90vh] mx-auto">
            <div className="bg-[#FAF7F2] rounded-lg sm:rounded-2xl border border-[#E3DDD1] shadow-xl overflow-hidden">
              <div className="flex flex-col max-h-[80vh] sm:max-h-[90vh]">
                {/* Header */}
                <div className="px-4 sm:px-[30px] py-4 sm:pt-[26px] sm:pb-[22px] border-b border-[#E3DDD1]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2
                        className="text-2xl sm:text-[32px] leading-none text-[#1B1917]"
                        style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
                      >
                        {t('new_student')}
                      </h2>
                      <p className="text-[12.5px] text-[#8A8177] mt-1.5">
                        {t('complete_student_info')}
                      </p>
                    </div>
                    <button
                      onClick={closeNewStudentModal}
                      className="w-8 h-8 sm:w-[34px] sm:h-[34px] flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors flex-shrink-0"
                    >
                      <MdClose size={18} />
                    </button>
                  </div>
                </div>

                {/* Content — mismo patrón sin caja/borde por sección que el modal
                    de ficha de estudiante: solo etiqueta en mayúsculas + línea
                    divisoria, para que ambos modales se vean como el mismo modelo. */}
                <div className="flex-1 overflow-y-auto p-4 sm:px-[30px] sm:py-[26px]">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-[26px]">
                    {/* Información Personal */}
                    <div>
                      <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                        {t('personal_info')}
                      </h3>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('first_name')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newStudentData.first_name}
                            onChange={(e) => handleNewStudentChange('first_name', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                            placeholder={t('first_name_placeholder')}
                          />
                        </div>
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('last_name')} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newStudentData.last_name}
                            onChange={(e) => handleNewStudentChange('last_name', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                            placeholder={t('last_name_placeholder')}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('age') || 'Edad'}
                          </label>
                          <input
                            type="number"
                            value={newStudentData.age}
                            onChange={(e) => handleNewStudentChange('age', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                            placeholder="8"
                          />
                        </div>
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('grade')}
                          </label>
                          <select
                            value={newStudentData.current_grade}
                            onChange={(e) => handleNewStudentChange('current_grade', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                          >
                            <option value="">{t('not_specified')}</option>
                            {GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('status')}
                          </label>
                          <select
                            value={newStudentData.is_active ? 'true' : 'false'}
                            onChange={(e) => handleNewStudentChange('is_active', e.target.value === 'true')}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                          >
                            <option value="true">{t('active')}</option>
                            <option value="false">{t('inactive')}</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Información de Orquesta */}
                    <div>
                      <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                        {t('orchestra_info')}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <div className="col-span-2">
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('instrument')}
                          </label>
                          <select
                            value={newStudentData.asset_id}
                            onChange={(e) => handleNewStudentAssetChange(e.target.value)}
                            disabled={loadingAssets}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                          >
                            <option value="">{t('no_instrument_assigned_option')}</option>
                            {availableAssets.map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.description}
                                {asset.size ? ` · ${asset.size}` : ''}
                                {asset.serial_number
                                  ? ` — S/N ${asset.serial_number}`
                                  : asset.full_code
                                  ? ` — #${asset.full_code}`
                                  : ''}
                              </option>
                            ))}
                            <option value="__other__">{t('instrument_other_option')}</option>
                          </select>
                          {!loadingAssets && availableAssets.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">{t('no_instruments_available')}</p>
                          )}
                          {newStudentData.asset_id === '__other__' && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <input
                                type="text"
                                value={newStudentData.instrument}
                                onChange={(e) => handleNewStudentChange('instrument', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                                placeholder={t('instrument_placeholder')}
                              />
                              <input
                                type="text"
                                value={newStudentData.instrument_size}
                                onChange={(e) => handleNewStudentChange('instrument_size', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                                placeholder="3/4, 4/4"
                              />
                            </div>
                          )}
                          {newStudentData.asset_id && newStudentData.asset_id !== '__other__' && (
                            <p className="text-xs text-gray-500 mt-1">{t('instrument_from_inventory_hint')}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('orchestra_position') || 'Posición'}
                          </label>
                          <select
                            value={newStudentData.orchestra_position}
                            onChange={(e) => handleNewStudentChange('orchestra_position', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                          >
                            <option value="">{t('not_assigned')}</option>
                            {POSITION_OPTIONS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Información de Padres */}
                    <div>
                      <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                        {t('parent_contact_info')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('parent_name')}
                          </label>
                          <input
                            type="text"
                            value={newStudentData.parent_name}
                            onChange={(e) => handleNewStudentChange('parent_name', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                            placeholder={t('parent_name_placeholder')}
                          />
                        </div>
                        <div>
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('parent_phone') || 'Teléfono'}
                          </label>
                          <input
                            type="tel"
                            value={newStudentData.parent_phone}
                            onChange={(e) => handleNewStudentChange('parent_phone', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                            placeholder={t('parent_phone_placeholder')}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                            {t('parent_email') || 'Email'}
                          </label>
                          <input
                            type="email"
                            value={newStudentData.parent_email}
                            onChange={(e) => handleNewStudentChange('parent_email', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900"
                            placeholder={t('parent_email_placeholder')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer con acciones */}
                <div className="px-4 sm:px-[30px] py-3 sm:pt-[18px] sm:pb-[24px] border-t border-[#E3DDD1]">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={closeNewStudentModal}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm border border-[#DED7C9] text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleSaveNewStudent}
                      disabled={savingNewStudent || !newStudentData.first_name || !newStudentData.last_name}
                      className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm bg-gradient-to-r from-[#C2492B] to-[#A83A20] text-white rounded-lg font-medium flex items-center justify-center transition-all duration-200 ${
                        (savingNewStudent || !newStudentData.first_name || !newStudentData.last_name) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md transform hover:scale-[1.01]'
                      }`}
                    >
                      <MdCheckCircle className="mr-1 sm:mr-2" size={16} />
                      {savingNewStudent ? t('saving') : t('save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
