'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { MdSearch, MdAdd, MdEdit, MdDelete, MdUpload, MdClose, MdCheckCircle, MdCameraAlt, MdPerson } from 'react-icons/md';
import ExcelUploader from '@/components/ExcelUploader';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';
import { useUserRole } from '@/hooks/useUserRole';

// Persona autorizada para retirar al estudiante — form "Ascend Enrollment"
// (cols BX-CC), carga manual vía plantilla Excel (13/08). Ver también
// ExcelUploader.tsx.
type AuthorizedPickupPerson = {
  first_name: string;
  last_name: string;
  phone: string;
};

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
  // Alergias/condiciones médicas (form Ascend Enrollment, cols AE-AL) y
  // personas autorizadas para retirar (cols BX-CC) — texto libre tal cual
  // viene del formulario, cargado a mano vía la plantilla de carga masiva.
  dietary_restrictions?: string | null;
  dietary_restrictions_details?: string | null;
  requires_special_care?: string | null;
  special_care_details?: string | null;
  takes_medication?: string | null;
  medication_details?: string | null;
  has_allergies_or_illness?: string | null;
  allergies_illness_details?: string | null;
  authorized_pickup?: AuthorizedPickupPerson[];
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

// El campo students.instrument tiene 3 formas distintas de decir "sin
// instrumento" en producción: NULL, "" (vacío) y el texto literal
// "Not Assigned". El filtro comparaba con === así que solo encontraba la
// tercera — Aaliyah Trochez (instrument: "") quedaba invisible al filtrar
// por "Not Assigned" (17/08). Esta función unifica los 3 casos.
const isUnassignedInstrument = (instrument?: string | null) => {
  const value = (instrument || '').trim().toLowerCase();
  return value === '' || value === 'not assigned';
};

// Valor especial para la opción "Sin instrumento" del selector de filtro,
// distinto de "" (que sigue significando "todos los instrumentos").
const UNASSIGNED_FILTER_VALUE = '__unassigned__';

// Mapea la descripción cruda del activo de Inventario (VIOLIN/VIOLONCELLO/
// VIOLA/BASS, siempre en mayúsculas ahí) al nombre "bonito" que se muestra
// en la ficha del estudiante y en los filtros — mismo mapeo que el trigger
// de base de datos sync_student_instrument_from_asset(), para que la UI
// muestre el resultado correcto de inmediato, sin depender de un refetch
// para ver el texto bien formateado (17/08).
const FRIENDLY_INSTRUMENT_BY_DESCRIPTION: Record<string, string> = {
  VIOLIN: 'Violin',
  VIOLONCELLO: 'Cello',
  CELLO: 'Cello',
  VIOLA: 'Viola',
  BASS: 'Bass',
};
const friendlyInstrumentName = (description?: string | null) => {
  const key = (description || '').trim().toUpperCase();
  if (FRIENDLY_INSTRUMENT_BY_DESCRIPTION[key]) return FRIENDLY_INSTRUMENT_BY_DESCRIPTION[key];
  const trimmed = (description || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() : '';
};

// Opciones del selector de "instrumento funcional" cuando un alumno usa un
// instrumento distinto al catalogado en Inventario — adaptación temporal sin
// fecha determinada (ej. violín con cuerdas de viola). Caso Issac Hernandez
// Ibarra, 17/08 — antes había que hacerlo manual por SQL, ahora se gestiona
// desde esta misma página.
const INSTRUMENT_OVERRIDE_OPTIONS = ['Violin', 'Viola', 'Cello', 'Bass'];

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
  // Foto de perfil del estudiante — vive en el bucket privado
  // "student-photos" de Supabase Storage (students.profile_photo guarda la
  // ruta del objeto, no la URL: hay que firmarla cada vez que se muestra
  // porque el bucket no es público — son fotos de menores).
  const [photoSignedUrl, setPhotoSignedUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  // Lightbox para ver la foto en grande — clic en el avatar en modo vista
  // (en modo edición el clic sigue abriendo el selector de archivo).
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
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
  // escribir el nombre del instrumento como texto suelto. Mismo picker se
  // reutiliza en modo edición de un alumno ya existente.
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  // Selección del picker de instrumento en modo edición: '' = sin
  // instrumento, '__other__' = texto libre, uuid = activo real de
  // Inventario (puede ser el ya enlazado o uno nuevo de availableAssets).
  const [editAssetSelection, setEditAssetSelection] = useState('');
  // Override de "instrumento funcional" (adaptación temporal distinta al
  // activo catalogado en Inventario, ver INSTRUMENT_OVERRIDE_OPTIONS más
  // arriba) — solo aplica cuando hay un activo real seleccionado en el
  // picker de arriba (editAssetSelection no es '' ni '__other__').
  const [instrumentOverrideEnabled, setInstrumentOverrideEnabled] = useState(false);
  const [overrideInstrumentValue, setOverrideInstrumentValue] = useState('');

  useEffect(() => {
    const fetchAvailableAssets = async () => {
      if (!(showNewStudentModal || isEditMode) || !activeProgram?.id) return;
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
  }, [showNewStudentModal, isEditMode, activeProgram?.id]);

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
      
      // Extraer instrumentos únicos para el filtro. El campo "instrument"
      // trae datos sucios (mayúsculas/minúsculas mezcladas, espacios,
      // el texto literal "Not Assigned"), así que lo normalizamos para
      // no mostrar duplicados como "Violin"/"violin" en el dropdown, y
      // excluimos cualquier variante de "sin instrumento" (se maneja
      // aparte con isUnassignedInstrument, ver más abajo — caso Aaliyah
      // Trochez, 17/08).
      const instrumentCounts = new Map<string, { label: string; count: number }>();
      sortedData.forEach(s => {
        const raw = (s.instrument || '').trim();
        if (!raw || isUnassignedInstrument(raw)) return;
        const key = raw.toLowerCase();
        const existing = instrumentCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          instrumentCounts.set(key, { label: raw, count: 1 });
        }
      });
      const instruments = [...instrumentCounts.values()]
        .map(v => v.label)
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      setAvailableInstruments(instruments);
    } catch (err: any) {
      console.error('Error al cargar estudiantes:', err);
      setError(t('error_loading_students'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Esperamos a que ProgramContext resuelva activeProgram antes de
    // consultar. Si no, fetchStudents entra a la rama "!activeProgram?.id"
    // y muestra "0 de 0 estudiantes" un instante antes de que llegue el
    // programa real — el flash que reportó Eliezer (14/08).
    if (programLoading) return;
    fetchStudents();
  }, [activeProgram?.id, programLoading]);

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
        (student.instrument || '').toLowerCase().includes(query)
      );
    }

    // Filtrar por instrumento — "Sin instrumento" agrupa NULL/""/"Not
    // Assigned" (ver isUnassignedInstrument); el resto compara sin
    // distinguir mayúsculas ni espacios sobrantes, porque el dato en la
    // base tiene variantes tipo "Violin"/"violin"/"Violin ".
    if (selectedInstrument === UNASSIGNED_FILTER_VALUE) {
      result = result.filter(student => isUnassignedInstrument(student.instrument));
    } else if (selectedInstrument) {
      const target = selectedInstrument.trim().toLowerCase();
      result = result.filter(student => (student.instrument || '').trim().toLowerCase() === target);
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

      // Firma la URL de la foto (bucket privado) — falla en silencio si no
      // tiene foto o si el objeto ya no existe, no debe bloquear la ficha.
      if (details.profile_photo) {
        try {
          const { data: signedData, error: signedError } = await supabase
            .storage
            .from('student-photos')
            .createSignedUrl(details.profile_photo, 3600);
          if (signedError) throw signedError;
          setPhotoSignedUrl(signedData?.signedUrl || null);
        } catch (photoErr) {
          console.error('Error signing student photo URL:', photoErr);
          setPhotoSignedUrl(null);
        }
      } else {
        setPhotoSignedUrl(null);
      }

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
    setEditAssetSelection('');
    setInstrumentOverrideEnabled(false);
    setOverrideInstrumentValue('');
    setPhotoSignedUrl(null);
    setPhotoUploadError(null);
    setShowPhotoLightbox(false);
  };

  const handleEditClick = () => {
    // Precarga el picker de instrumento: si ya tiene un activo de Inventario
    // enlazado, lo deja seleccionado (para poder cambiarlo o quitarlo); si
    // solo tiene texto libre en "instrument", arranca en modo "Otro"; si no
    // tiene nada, arranca vacío.
    if (linkedAssets.length > 0) {
      setEditAssetSelection(linkedAssets[0].id);
    } else if (editFormData?.instrument) {
      setEditAssetSelection('__other__');
    } else {
      setEditAssetSelection('');
    }
    // Precarga el override de "instrumento funcional" (ver caso Issac,
    // 17/08) — solo tiene sentido si hay un activo real de Inventario
    // enlazado; el caso "Otro" (texto libre) ya es override por definición
    // y se resuelve aparte en handleSaveEdit.
    const hasOverride = studentDetails?.settings?.instrument_override === true && linkedAssets.length > 0;
    setInstrumentOverrideEnabled(hasOverride);
    setOverrideInstrumentValue(hasOverride ? (studentDetails?.instrument || '') : '');
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditFormData(studentDetails);
    setEditAssetSelection('');
    setInstrumentOverrideEnabled(false);
    setOverrideInstrumentValue('');
  };

  // Maneja el selector de instrumento en modo edición — mismo patrón que
  // handleNewStudentAssetChange (crear estudiante), pero sobre editFormData.
  const handleEditAssetChange = (value: string) => {
    setEditAssetSelection(value);
    if (value === '__other__' || value === '') {
      // Al salir del activo con override activo, o al quitar el instrumento
      // por completo, el override deja de aplicar — "Otro" es su propio
      // mecanismo de texto libre (ver handleSaveEdit).
      setInstrumentOverrideEnabled(false);
      setOverrideInstrumentValue('');
      setEditFormData({ ...editFormData, instrument: '', instrument_size: '' });
    } else {
      const fromLinked = linkedAssets.find((a) => a.id === value);
      const fromAvailable = availableAssets.find((a) => a.id === value);
      const asset = fromLinked || fromAvailable;
      setEditFormData({
        ...editFormData,
        // Si el override sigue activo al cambiar de activo físico, el texto
        // mostrado lo sigue controlando overrideInstrumentValue; si no, se
        // deriva del catálogo del activo recién elegido.
        instrument: instrumentOverrideEnabled ? overrideInstrumentValue : friendlyInstrumentName(asset?.description),
        instrument_size: asset?.size || '',
      });
    }
  };

  // Activa/desactiva el override de "instrumento funcional" sobre el activo
  // actualmente seleccionado en el picker (ver INSTRUMENT_OVERRIDE_OPTIONS).
  const handleToggleInstrumentOverride = (checked: boolean) => {
    setInstrumentOverrideEnabled(checked);
    const asset = linkedAssets.find((a) => a.id === editAssetSelection) || availableAssets.find((a) => a.id === editAssetSelection);
    if (checked) {
      const initial = overrideInstrumentValue || friendlyInstrumentName(asset?.description) || INSTRUMENT_OVERRIDE_OPTIONS[0];
      setOverrideInstrumentValue(initial);
      setEditFormData({ ...editFormData, instrument: initial });
    } else {
      setEditFormData({ ...editFormData, instrument: friendlyInstrumentName(asset?.description) });
    }
  };

  const handleOverrideInstrumentValueChange = (value: string) => {
    setOverrideInstrumentValue(value);
    setEditFormData({ ...editFormData, instrument: value });
  };

  // Sube/reemplaza la foto de perfil del estudiante en el bucket privado
  // "student-photos". Se guarda de inmediato (no espera al botón "Guardar"
  // del resto de la ficha) — mismo patrón que la asignación de instrumento
  // desde Inventario, que también escribe directo. Ruta: {program_id}/
  // {student.id}.{ext}, upsert:true para que reemplazar una foto anterior
  // no deje archivos huérfanos en el bucket.
  const handlePhotoUpload = async (file: File) => {
    if (!selectedStudent?.id || !activeProgram?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError(t('photo_too_large'));
      return;
    }
    setPhotoUploadError(null);
    setUploadingPhoto(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${activeProgram.id}/${selectedStudent.id}.${ext}`;

      const { error: uploadError } = await supabase
        .storage
        .from('student-photos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('students')
        .update({ profile_photo: path })
        .eq('id', selectedStudent.id);
      if (updateError) throw updateError;

      const { data: signedData, error: signedError } = await supabase
        .storage
        .from('student-photos')
        .createSignedUrl(path, 3600);
      if (signedError) throw signedError;

      setPhotoSignedUrl(signedData?.signedUrl || null);
      setStudentDetails((prev: any) => (prev ? { ...prev, profile_photo: path } : prev));
      setEditFormData((prev: any) => (prev ? { ...prev, profile_photo: path } : prev));
      // Silent: no queremos que la lista de fondo se ponga en loading solo
      // por haber cambiado una foto.
      fetchStudents(true);
    } catch (err) {
      console.error('Error uploading student photo:', err);
      setPhotoUploadError(t('photo_upload_error'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      // Resuelve de forma determinista el texto final de "instrument" y el
      // flag settings.instrument_override, sin depender del orden en que
      // corran los triggers de auto-sync de Inventario (que solo respetan
      // el override si YA está marcado en la fila — ver
      // sync_student_instrument_from_asset() en la base de datos):
      //  - "Otro" (sin activo real en Inventario): siempre override=true,
      //    el texto es el que escribió el staff a mano.
      //  - Activo real + checkbox de "instrumento distinto" activo: caso
      //    Issac (adaptación temporal) — override=true, texto = el elegido
      //    en el selector Violin/Viola/Cello/Bass.
      //  - Activo real sin override: override=false, el texto se deriva del
      //    catálogo del activo (mismo mapeo que el trigger de la BD).
      //  - Sin instrumento: override=false, texto vacío.
      let finalOverride = false;
      let finalInstrument = '';
      let finalInstrumentSize = '';
      if (editAssetSelection === '__other__') {
        finalOverride = true;
        finalInstrument = editFormData.instrument || '';
        finalInstrumentSize = editFormData.instrument_size || '';
      } else if (editAssetSelection) {
        const asset = linkedAssets.find((a) => a.id === editAssetSelection) || availableAssets.find((a) => a.id === editAssetSelection);
        finalInstrumentSize = asset?.size || '';
        if (instrumentOverrideEnabled) {
          finalOverride = true;
          finalInstrument = overrideInstrumentValue || '';
        } else {
          finalOverride = false;
          finalInstrument = friendlyInstrumentName(asset?.description);
        }
      }

      // Actualizar información del estudiante
      const { error: updateError } = await supabase
        .from('students')
        .update({
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          age: editFormData.age,
          current_grade: editFormData.current_grade,
          instrument: finalInstrument,
          instrument_size: finalInstrumentSize,
          settings: { ...(studentDetails?.settings || {}), instrument_override: finalOverride },
          orchestra_position: editFormData.orchestra_position,
          orchestra_id: editFormData.orchestra_id || null,
          is_active: editFormData.is_active,
          dietary_restrictions: editFormData.dietary_restrictions || null,
          dietary_restrictions_details: editFormData.dietary_restrictions_details || null,
          requires_special_care: editFormData.requires_special_care || null,
          special_care_details: editFormData.special_care_details || null,
          takes_medication: editFormData.takes_medication || null,
          medication_details: editFormData.medication_details || null,
          has_allergies_or_illness: editFormData.has_allergies_or_illness || null,
          allergies_illness_details: editFormData.allergies_illness_details || null,
          // Filtra entradas vacías (agregadas con "+" y nunca completadas)
          // antes de guardar.
          authorized_pickup: (editFormData.authorized_pickup || []).filter(
            (p: any) => (p.first_name && p.first_name.trim()) || (p.last_name && p.last_name.trim())
          )
        })
        .eq('id', selectedStudent.id);

      if (updateError) throw updateError;

      // Sincronizar el enlace con Inventario si cambió el activo elegido en
      // el picker de instrumento. previousAssetId = lo que tenía enlazado
      // antes de entrar en modo edición; newAssetId = lo que quedó
      // seleccionado ahora ('' o '__other__' cuentan como "sin activo").
      const previousAssetId = linkedAssets[0]?.id || null;
      const newAssetId =
        editAssetSelection && editAssetSelection !== '__other__' ? editAssetSelection : null;

      if (previousAssetId !== newAssetId) {
        if (previousAssetId) {
          await supabase
            .from('assets')
            .update({ assigned_student_id: null, assigned_to_text: null, status_code: 'available' })
            .eq('id', previousAssetId);
        }
        if (newAssetId) {
          await supabase
            .from('assets')
            .update({ assigned_student_id: selectedStudent.id, assigned_to_text: null, status_code: 'assigned' })
            .eq('id', newAssetId);
        }
      }

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

  // Personas autorizadas para retirar al estudiante — a diferencia de los
  // padres (que se administran aparte, ver "manage_contacts"), esta lista no
  // tiene una pantalla propia, así que el modal de la ficha permite
  // agregar/quitar directo (no solo editar las que ya vinieron del Excel).
  const handleAuthorizedPickupChange = (index: number, field: string, value: any) => {
    const updated = [...(editFormData.authorized_pickup || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditFormData({ ...editFormData, authorized_pickup: updated });
  };

  const handleAddAuthorizedPickup = () => {
    const updated = [...(editFormData.authorized_pickup || []), { first_name: '', last_name: '', phone: '' }];
    setEditFormData({ ...editFormData, authorized_pickup: updated });
  };

  const handleRemoveAuthorizedPickup = (index: number) => {
    const updated = (editFormData.authorized_pickup || []).filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, authorized_pickup: updated });
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
        instrument: friendlyInstrumentName(asset?.description),
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
      asset_id: '',
      instrument: '',
      instrument_size: '',
      orchestra_position: '',
      is_active: true,
      parent_name: '',
      parent_phone: '',
      parent_email: ''
    });
  };

  if (loading || programLoading) {
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
            <option value={UNASSIGNED_FILTER_VALUE}>{t('not_assigned')}</option>
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
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                      {/* Avatar — foto real si existe (bucket privado
                          "student-photos", URL firmada), si no, iniciales.
                          En modo edición se puede tocar/clickear para subir
                          o reemplazar la foto. */}
                      <div className="relative flex-shrink-0">
                        {/* Formato "foto de pasaporte" — cuadrado con
                            esquinas redondeadas en vez de círculo, y más
                            grande (80px/96px vs los 56px/64px originales)
                            para poder distinguir bien al estudiante. */}
                        <div
                          onClick={() => {
                            if (isEditMode) {
                              if (!uploadingPhoto) photoInputRef.current?.click();
                            } else if (photoSignedUrl) {
                              setShowPhotoLightbox(true);
                            }
                          }}
                          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-[#EFE9DC] border border-[#E3DDD1] flex items-center justify-center ${isEditMode || photoSignedUrl ? 'cursor-pointer' : ''}`}
                        >
                          {photoSignedUrl ? (
                            <img src={photoSignedUrl} alt={t('student_photo')} className="w-full h-full object-cover" />
                          ) : (
                            <MdPerson size={38} className="text-[#A29889]" />
                          )}
                        </div>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
                            disabled={uploadingPhoto}
                            title={photoSignedUrl ? t('change_photo') : t('add_photo')}
                            className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#C2492B] text-white flex items-center justify-center border-2 border-[#FAF7F2] disabled:opacity-60"
                          >
                            <MdCameraAlt size={15} />
                          </button>
                        )}
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2
                          className="text-2xl sm:text-[32px] leading-none text-[#1B1917] truncate"
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
                        {isEditMode && (uploadingPhoto || photoUploadError) && (
                          <p className={`text-[11.5px] mt-1 ${photoUploadError ? 'text-[#A8402A]' : 'text-[#8A8177]'}`}>
                            {uploadingPhoto ? t('uploading_photo') : photoUploadError}
                          </p>
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
                          {isEditMode ? (
                            <div className="col-span-2">
                              <p className="text-[12.5px] text-[#8A8177] mb-1">
                                {t('instrument')}
                              </p>
                              <select
                                value={editAssetSelection}
                                onChange={(e) => handleEditAssetChange(e.target.value)}
                                disabled={loadingAssets}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              >
                                <option value="">{t('no_instrument_assigned_option')}</option>
                                {linkedAssets.map((asset) => (
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
                              {editAssetSelection === '__other__' && (
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                  <input
                                    type="text"
                                    value={editFormData.instrument || ''}
                                    onChange={(e) => handleInputChange('instrument', e.target.value)}
                                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                                    placeholder={t('instrument_placeholder')}
                                  />
                                  <input
                                    type="text"
                                    value={editFormData.instrument_size || ''}
                                    onChange={(e) => handleInputChange('instrument_size', e.target.value)}
                                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                                    placeholder="3/4, 4/4"
                                  />
                                </div>
                              )}
                              {editAssetSelection && editAssetSelection !== '__other__' && (
                                <>
                                  <p className="text-[11.5px] text-[#8A8177] mt-1">{t('instrument_from_inventory_hint')}</p>
                                  <label className="flex items-center gap-2 mt-2 text-[12.5px] text-[#1B1917]">
                                    <input
                                      type="checkbox"
                                      checked={instrumentOverrideEnabled}
                                      onChange={(e) => handleToggleInstrumentOverride(e.target.checked)}
                                    />
                                    {t('instrument_override_label')}
                                  </label>
                                  <p className="text-[11px] text-[#8A8177] mt-0.5">{t('instrument_override_hint')}</p>
                                  {instrumentOverrideEnabled && (
                                    <select
                                      value={overrideInstrumentValue}
                                      onChange={(e) => handleOverrideInstrumentValueChange(e.target.value)}
                                      className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917] mt-2"
                                    >
                                      {INSTRUMENT_OVERRIDE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  )}
                                </>
                              )}
                            </div>
                          ) : linkedAssets.length > 0 ? (
                            <div className="col-span-2">
                              <p className="text-[12.5px] text-[#8A8177] mb-1">
                                {t('instrument')}
                              </p>
                              {studentDetails?.settings?.instrument_override === true && (
                                <>
                                  <p className="text-[14px] text-[#1B1917]">
                                    {studentDetails.instrument || t('not_assigned')}
                                  </p>
                                  <p className="text-[11.5px] text-[#8A8177] mb-1.5">
                                    {t('instrument_override_active_hint')}
                                  </p>
                                </>
                              )}
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
                                <p className="text-[14px] text-[#1B1917]">
                                  {studentDetails.instrument || t('not_assigned')}
                                </p>
                              </div>
                              <div>
                                <p className="text-[12.5px] text-[#8A8177] mb-1">
                                  {t('instrument_size') || 'Tamaño'}
                                </p>
                                <p className="text-[14px] text-[#1B1917]">
                                  {studentDetails.instrument_size || t('not_specified')}
                                </p>
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

                      {/* Alergias y Condiciones Médicas — form Ascend Enrollment
                          (cols AE-AL), carga manual vía plantilla Excel (13/08).
                          Mismo patrón sin caja/borde. En modo vista solo se
                          muestran los pares con algo cargado, para no llenar
                          la ficha de "No especificado" quíntuple cuando el
                          estudiante todavía no tiene este dato subido. */}
                      <div>
                        <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                          {t('medical_info')}
                        </h3>
                        {isEditMode ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('dietary_restrictions')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.dietary_restrictions || ''}
                                onChange={(e) => handleInputChange('dietary_restrictions', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('dietary_restrictions_details')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.dietary_restrictions_details || ''}
                                onChange={(e) => handleInputChange('dietary_restrictions_details', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('requires_special_care')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.requires_special_care || ''}
                                onChange={(e) => handleInputChange('requires_special_care', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('special_care_details')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.special_care_details || ''}
                                onChange={(e) => handleInputChange('special_care_details', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('takes_medication')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.takes_medication || ''}
                                onChange={(e) => handleInputChange('takes_medication', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('medication_details')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.medication_details || ''}
                                onChange={(e) => handleInputChange('medication_details', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('has_allergies_or_illness')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.has_allergies_or_illness || ''}
                                onChange={(e) => handleInputChange('has_allergies_or_illness', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                            <div>
                              <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                {t('allergies_illness_details')}
                              </label>
                              <input
                                type="text"
                                value={editFormData.allergies_illness_details || ''}
                                onChange={(e) => handleInputChange('allergies_illness_details', e.target.value)}
                                className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md text-[14px] text-[#1B1917]"
                              />
                            </div>
                          </div>
                        ) : (
                          [
                            [t('dietary_restrictions'), studentDetails.dietary_restrictions, studentDetails.dietary_restrictions_details],
                            [t('requires_special_care'), studentDetails.requires_special_care, studentDetails.special_care_details],
                            [t('takes_medication'), studentDetails.takes_medication, studentDetails.medication_details],
                            [t('has_allergies_or_illness'), studentDetails.has_allergies_or_illness, studentDetails.allergies_illness_details],
                          ].some(([, value]) => !!value) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              {[
                                [t('dietary_restrictions'), studentDetails.dietary_restrictions, studentDetails.dietary_restrictions_details],
                                [t('requires_special_care'), studentDetails.requires_special_care, studentDetails.special_care_details],
                                [t('takes_medication'), studentDetails.takes_medication, studentDetails.medication_details],
                                [t('has_allergies_or_illness'), studentDetails.has_allergies_or_illness, studentDetails.allergies_illness_details],
                              ].map(([label, value, details], i) =>
                                value ? (
                                  <div key={i}>
                                    <p className="text-[12.5px] text-[#8A8177] mb-1">{label}</p>
                                    <p className="text-[14px] text-[#1B1917]">
                                      {value}
                                      {details ? ` — ${details}` : ''}
                                    </p>
                                  </div>
                                ) : null
                              )}
                            </div>
                          ) : (
                            <p className="text-[13px] text-[#8A8177]">
                              {t('no_medical_info')}
                            </p>
                          )
                        )}
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

                      {/* Personas Autorizadas para Retirar — form Ascend
                          Enrollment (cols BX-CC), carga manual vía plantilla
                          Excel (13/08). A diferencia de Padres, esta lista se
                          agrega/quita directo acá (no tiene pantalla propia
                          de contactos). */}
                      <div>
                        <h3 className="text-[11.5px] tracking-[0.09em] uppercase text-[#8A8177] pb-3 border-b border-[#E3DDD1] mb-3 sm:mb-4">
                          {t('authorized_pickup_info')}
                        </h3>
                        {isEditMode ? (
                          <div className="space-y-3">
                            {(editFormData.authorized_pickup || []).map((person: any, index: number) => (
                              <div
                                key={index}
                                className={`flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end ${
                                  index > 0 ? 'pt-3 border-t border-[#EFE9DD]' : ''
                                }`}
                              >
                                <div className="flex-1">
                                  <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                    {t('first_name')}
                                  </label>
                                  <input
                                    type="text"
                                    value={person.first_name || ''}
                                    onChange={(e) => handleAuthorizedPickupChange(index, 'first_name', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                    {t('last_name')}
                                  </label>
                                  <input
                                    type="text"
                                    value={person.last_name || ''}
                                    onChange={(e) => handleAuthorizedPickupChange(index, 'last_name', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[12.5px] text-[#8A8177] mb-1 block">
                                    {t('phone')}
                                  </label>
                                  <input
                                    type="text"
                                    value={person.phone || ''}
                                    onChange={(e) => handleAuthorizedPickupChange(index, 'phone', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-medium"
                                  />
                                </div>
                                <button
                                  onClick={() => handleRemoveAuthorizedPickup(index)}
                                  className="shrink-0 w-9 h-9 flex items-center justify-center border border-[#DED7C9] rounded-lg text-[#6E675E] hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
                                  aria-label={t('remove') || 'Quitar'}
                                >
                                  <MdClose size={16} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={handleAddAuthorizedPickup}
                              className="text-[13px] text-[#C2492B] hover:underline font-medium flex items-center gap-1"
                            >
                              <MdAdd size={14} /> {t('add_authorized_pickup_person')}
                            </button>
                          </div>
                        ) : studentDetails.authorized_pickup && studentDetails.authorized_pickup.length > 0 ? (
                          <div className="space-y-2">
                            {studentDetails.authorized_pickup.map((person: any, index: number) => (
                              <div key={index} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <p className="text-[14px] text-[#1B1917]">
                                  {person.first_name} {person.last_name}
                                </p>
                                {person.phone && (
                                  <a
                                    href={`tel:${person.phone}`}
                                    className="text-[14px] text-[#1B1917] hover:text-[#C2492B]"
                                  >
                                    {person.phone}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-[#8A8177]">
                            {t('no_authorized_pickup_info')}
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

      {/* Lightbox de la foto del estudiante — clic en el avatar (modo
          vista) la agranda para verla mejor; clic afuera, en la X, o Esc
          la cierra. z-[60] para quedar por encima del drawer (z-50). */}
      {showPhotoLightbox && photoSignedUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setShowPhotoLightbox(false)}
        >
          <button
            onClick={() => setShowPhotoLightbox(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label={t('close')}
          >
            <MdClose size={20} />
          </button>
          <img
            src={photoSignedUrl}
            alt={t('student_photo')}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-2xl object-contain"
          />
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
