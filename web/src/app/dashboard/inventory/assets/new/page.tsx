'use client';

/**
 * CREAR NUEVO ACTIVO DE INVENTARIO
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdArrowBack, MdSave, MdWarning } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';

// Cliente de Supabase para ambiente de prueba

interface Catalog {
  id: string;
  code: string;
  name: string;
}

interface Characteristic {
  id: string;
  code: string;
  description: string;
}

interface Program {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
}


export default function NewAssetPage() {
  const { t } = useI18n();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Catálogos
  const [locations, setLocations] = useState<Catalog[]>([]);
  const [workAreas, setWorkAreas] = useState<any[]>([]);
  const [sources, setSources] = useState<Catalog[]>([]);
  const [groups, setGroups] = useState<Catalog[]>([]);
  const [classes, setClasses] = useState<Catalog[]>([]);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programStudents, setProgramStudents] = useState<StudentOption[]>([]);
  // true = "Asignado a" está en modo texto libre (no-estudiante, ej. "Terranova")
  const [assignToOther, setAssignToOther] = useState(false);

  // Tipo de activo
  const [assetType, setAssetType] = useState<'sede' | 'admin' | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    location_id: '',
    work_area_id: '',
    program_id: '', // Para derivar ubicación/área automáticamente
    source_id: '',
    group_id: '',
    class_id: '',
    characteristic_id: '', // Se preseleccionará automáticamente con el ID correcto
    description: '',
    brand: '',
    model: '',
    size: '',
    serial_number: '',
    estimated_cost: '',
    status_code: 'available',
    current_program_id: '',
    assigned_to_text: '',
    assigned_student_id: '',
    owner: '',
    notes: '',
  });

  useEffect(() => {
    loadCatalogs();
  }, []);

  // Estudiantes activos del programa/sede seleccionado, para el selector de
  // "Asignado a" — se recarga cada vez que cambia la sede del activo.
  useEffect(() => {
    async function loadProgramStudents() {
      if (!formData.current_program_id) {
        setProgramStudents([]);
        return;
      }
      const { data, error } = await inventorySupabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('program_id', formData.current_program_id)
        .eq('is_active', true)
        .order('first_name');

      if (error) {
        console.error('Error loading students for program:', error);
        setProgramStudents([]);
        return;
      }
      setProgramStudents(data || []);
    }
    loadProgramStudents();
  }, [formData.current_program_id]);

  // Solo Admin puede crear activos (RLS ya lo exige) — si Staff/Viewer llega
  // aquí por URL directa, lo regresamos al Listado en vez de dejarlo ver un
  // formulario que igual va a fallar al guardar.
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/dashboard/inventory/assets');
    }
  }, [roleLoading, isAdmin, router]);

  useEffect(() => {
    // Derivar ubicación/área cuando se selecciona un programa (sede)
    if (assetType === 'sede' && formData.program_id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Buscando work area para program_id:', formData.program_id);
        console.log('Work areas disponibles:', workAreas);
      }
      const workArea = workAreas.find((wa: any) => wa.program_id === formData.program_id);
      if (process.env.NODE_ENV === 'development') {
        console.log('Work area encontrada:', workArea);
      }
      if (workArea) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Asignando location_id:', workArea.location_id, 'work_area_id:', workArea.id);
        }
        setFormData(prev => ({
          ...prev,
          location_id: workArea.location_id,
          work_area_id: workArea.id,
        }));
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('No se encontró work area para program_id:', formData.program_id);
      }
    }
  }, [formData.program_id, assetType, workAreas]);

  useEffect(() => {
    // Preseleccionar clase "Tangible" cuando se carguen las clases
    if (classes.length > 0 && !formData.class_id) {
      const tangibleClass = classes.find(c => c.code === '01'); // Código 01 = Tangible
      if (tangibleClass) {
        setFormData(prev => ({ ...prev, class_id: tangibleClass.id }));
      }
    }
  }, [classes, formData.class_id]);
  
  useEffect(() => {
    // Preseleccionar característica '04' cuando se carguen las características
    if (characteristics.length > 0 && !formData.characteristic_id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Características cargadas:', characteristics);
      }
      const char04 = characteristics.find(ch => ch.code === '04');
      if (process.env.NODE_ENV === 'development') {
        console.log('Característica 04 encontrada:', char04);
      }
      if (char04) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Asignando característica 04 con ID:', char04.id);
        }
        setFormData(prev => ({ ...prev, characteristic_id: char04.id }));
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('No se encontró característica con código 04');
      }
    }
  }, [characteristics, formData.characteristic_id]);

  async function loadCatalogs() {
    try {
      setLoading(true);

      const [
        locationsRes,
        workAreasRes,
        sourcesRes,
        groupsRes,
        classesRes,
        characteristicsRes,
        programsRes,
      ] = await Promise.all([
        inventorySupabase.from('asset_locations').select('id, code, name').eq('is_active', true).order('name'),
        inventorySupabase.from('asset_work_areas').select('id, code, name, location_id, program_id').order('name'),
        inventorySupabase.from('asset_sources').select('id, code, name').order('name'),
        inventorySupabase.from('asset_groups').select('id, code, name').order('name'),
        inventorySupabase.from('asset_classes').select('id, code, name').order('name'),
        inventorySupabase.from('asset_characteristics').select('id, code, description').order('code'),
        inventorySupabase.from('programs').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (workAreasRes.error) throw workAreasRes.error;
      if (sourcesRes.error) throw sourcesRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (classesRes.error) throw classesRes.error;
      if (characteristicsRes.error) throw characteristicsRes.error;
      if (programsRes.error) throw programsRes.error;

      setLocations(locationsRes.data || []);
      setWorkAreas(workAreasRes.data || []);
      setSources(sourcesRes.data || []);
      setGroups(groupsRes.data || []);
      setClasses(classesRes.data || []);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Características recibidas de Supabase:', characteristicsRes.data);
      }
      setCharacteristics(characteristicsRes.data || []);
      setPrograms(programsRes.data || []);

    } catch (err: any) {
      console.error('Error loading catalogs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Validando formulario:', formData);
      console.log('Tipo de activo:', assetType);
    }
    
    // Validaciones
    if (!formData.location_id) {
      setError(t('inv_missing_location'));
      return;
    }
    if (!formData.source_id) {
      setError(t('inv_missing_source'));
      return;
    }
    if (!formData.group_id) {
      setError(t('inv_missing_group'));
      return;
    }
    if (!formData.class_id) {
      setError(t('inv_missing_class'));
      return;
    }
    if (!formData.characteristic_id) {
      setError(t('inv_missing_characteristic'));
      return;
    }
    if (!formData.description) {
      setError(t('inv_missing_description'));
      return;
    }
    if (!assetType) {
      setError(t('inv_select_asset_type'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Obtener códigos de los catálogos seleccionados
      const location = locations.find(l => l.id === formData.location_id);
      const workArea = workAreas.find(wa => wa.id === formData.work_area_id);
      const source = sources.find(s => s.id === formData.source_id);
      const group = groups.find(g => g.id === formData.group_id);
      const assetClass = classes.find(c => c.id === formData.class_id);
      const characteristic = characteristics.find(ch => ch.id === formData.characteristic_id);

      if (!location || !source || !group || !assetClass || !characteristic) {
        throw new Error(t('inv_error_getting_catalog_codes'));
      }

      // Obtener siguiente número de secuencia (por Grupo + Ubicación + Área)
      const { data: seqData, error: seqError } = await inventorySupabase
        .rpc('get_next_asset_sequence', { 
          p_group_id: formData.group_id,
          p_location_id: formData.location_id,
          p_work_area_id: formData.work_area_id || null
        });

      if (seqError) throw seqError;
      const sequenceNumber = seqData as number;

      // Armar el código completo (16 dígitos)
      const fullCode = 
        location.code.padStart(2, '0') +
        (workArea?.code || '00').padStart(2, '0') +
        source.code.padStart(2, '0') +
        group.code.padStart(2, '0') +
        assetClass.code.padStart(2, '0') +
        characteristic.code.padStart(2, '0') +
        sequenceNumber.toString().padStart(4, '0');

      if (process.env.NODE_ENV === 'development') {
        console.log('Generated code:', fullCode);
      }

      // Obtener organization_id del primer programa disponible
      const { data: programData } = await inventorySupabase
        .from('programs')
        .select('organization_id')
        .eq('id', formData.current_program_id || programs[0]?.id)
        .single();

      const organizationId = programData?.organization_id || '8bade020-abcc-4ee9-a14a-fa311bb3f482';

      // Preparar datos del activo
      const assetData = {
        organization_id: organizationId,
        full_code: fullCode,
        location_id: formData.location_id,
        work_area_id: formData.work_area_id || null,
        source_id: formData.source_id,
        group_id: formData.group_id,
        class_id: formData.class_id,
        characteristic_id: formData.characteristic_id || null,
        sequence_number: sequenceNumber,
        description: formData.description,
        brand: formData.brand || null,
        model: formData.model || null,
        size: formData.size || null,
        serial_number: formData.serial_number || null,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        status_code: formData.status_code,
        current_program_id: formData.current_program_id || null,
        assigned_student_id: formData.assigned_student_id || null,
        // Si hay un estudiante enlazado, el texto libre no aplica (evita
        // que quede un texto viejo desincronizado del enlace real).
        assigned_to_text: formData.assigned_student_id ? null : (formData.assigned_to_text || null),
        owner: formData.owner || null,
        notes: formData.notes || null,
        is_active: true,
      };

      // Insertar activo
      const { data: insertedAsset, error: insertError } = await inventorySupabase
        .from('assets')
        .insert(assetData)
        .select()
        .single();

      if (insertError) {
        // Si falla por duplicado, reintentar una vez
        if (insertError.code === '23505') {
          if (process.env.NODE_ENV === 'development') {
            console.log('Duplicate detected, retrying...');
          }
          const { data: newSeqData } = await inventorySupabase
            .rpc('get_next_asset_sequence', { 
              p_group_id: formData.group_id,
              p_location_id: formData.location_id,
              p_work_area_id: formData.work_area_id || null
            });
          
          const newSequence = newSeqData as number;
          const newFullCode = fullCode.substring(0, 12) + newSequence.toString().padStart(4, '0');
          
          assetData.full_code = newFullCode;
          assetData.sequence_number = newSequence;

          const { data: retryInsert, error: retryError } = await inventorySupabase
            .from('assets')
            .insert(assetData)
            .select()
            .single();

          if (retryError) throw retryError;
          setSuccessCode(newFullCode);
        } else {
          throw insertError;
        }
      } else {
        setSuccessCode(fullCode);
      }

    } catch (err: any) {
      console.error('Error creating asset:', err);
      setError(err.message || t('inv_error_creating_asset'));
    } finally {
      setSaving(false);
    }
  }

  if (loading || roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-[#8A8177]">{t('inv_loading_catalogs')}</p>
        </div>
      </div>
    );
  }

  if (successCode) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#FFFDFA] border border-[#CFDCC7] rounded-xl p-6 sm:p-10 text-center">
          <h2
            className="text-2xl text-[#1B1917] mb-5"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            {t('inv_asset_created_success')}
          </h2>
          <div className="bg-[#EDF1E9] border border-[#CFDCC7] rounded-lg p-4 sm:p-6 mb-6">
            <p className="text-[12.5px] text-[#8A8177] mb-2">{t('inv_generated_code_colon')}</p>
            <p className="text-2xl sm:text-4xl font-mono font-semibold text-[#4F6748] break-all">
              {successCode}
            </p>
          </div>
          <p className="text-[13.5px] text-[#6E675E] mb-6">
            {t('inv_use_code_for_barcode')}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => router.push('/dashboard/inventory/assets')}
              className="px-5 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium"
            >
              {t('inv_view_assets_list')}
            </button>
            <button
              onClick={() => {
                setSuccessCode(null);
                setFormData({
                  location_id: '',
                  work_area_id: '',
                  program_id: '',
                  source_id: '',
                  group_id: '',
                  class_id: '',
                  characteristic_id: '',
                  description: '',
                  brand: '',
                  model: '',
                  size: '',
                  serial_number: '',
                  estimated_cost: '',
                  status_code: 'available',
                  current_program_id: '',
                  assigned_to_text: '',
                  assigned_student_id: '',
                  owner: '',
                  notes: '',
                });
                setAssignToOther(false);
                setAssetType('');
                setShowAdvanced(false);
                // Los valores por defecto se reasignarán automáticamente por el useEffect
              }}
              className="px-5 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium"
            >
              {t('inv_create_another_asset')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[13px] text-[#8A8177] hover:text-[#C2492B] transition-colors mb-4"
      >
        <MdArrowBack size={16} />
        {t('inv_go_back')}
      </button>
      <h1
        className="text-[26px] sm:text-[32px] text-[#1B1917] leading-[1.05]"
        style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
      >
        {t('inv_new_asset_button')}
      </h1>
      <p className="text-[13.5px] text-[#8A8177] mt-1.5">
        {t('inv_new_asset_subtitle')}
      </p>
      {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
        <div className="mt-3 inline-flex items-center px-3 py-1 bg-[#F6EFDF] border border-[#E3D3A8] rounded-lg text-[12.5px] text-[#8A6A22]">
          <MdWarning className="mr-2" size={14} />
          {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
        </div>
      )}

      {error && (
        <div className="mt-5 bg-[#F8E9E4] border border-[#EAC7BB] rounded-xl p-4">
          <p className="text-[#8f3421]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-5 sm:p-6 mt-5">
        {/* Sección 1: Codificación */}
        <div className="mb-7">
          <h2 className="text-[15px] font-medium text-[#1B1917] pb-3 mb-4 border-b border-[#EFE9DD]">
            {t('inv_coding_section_header')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipo de Activo */}
            <div className="md:col-span-2">
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_asset_purpose_question')} <span className="text-[#A8402A]">*</span>
              </label>
              <select
                value={assetType}
                onChange={(e) => {
                  setAssetType(e.target.value as 'sede' | 'admin' | '');
                  setFormData({ ...formData, location_id: '', work_area_id: '', program_id: '' });
                }}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                required
              >
                <option value="">{t('inv_select_type_placeholder')}</option>
                <option value="sede">{t('inv_asset_type_site')}</option>
                <option value="admin">{t('inv_asset_type_admin')}</option>
              </select>
            </div>

            {/* Si es Sede: selector de programa */}
            {assetType === 'sede' && (
              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                  {t('inv_site_label')} <span className="text-[#A8402A]">*</span>
                </label>
                <select
                  value={formData.program_id}
                  onChange={(e) => setFormData({ ...formData, program_id: e.target.value })}
                  className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                  required
                >
                  <option value="">{t('inv_select_site_placeholder2')}</option>
                  {programs.map(prog => (
                    <option key={prog.id} value={prog.id}>{prog.name}</option>
                  ))}
                </select>
                <p className="text-[11.5px] text-[#8A8177] mt-1.5">
                  {t('inv_location_auto_hint')}
                </p>
              </div>
            )}

            {/* Si es Admin: selectores manuales */}
            {assetType === 'admin' && (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                    {t('inv_location_simple_label')} <span className="text-[#A8402A]">*</span>
                  </label>
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                    required
                  >
                    <option value="">{t('inv_select_location_placeholder')}</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                    {t('inv_work_area_simple_label')}
                  </label>
                  <select
                    value={formData.work_area_id}
                    onChange={(e) => setFormData({ ...formData, work_area_id: e.target.value })}
                    className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                  >
                    <option value="">{t('inv_no_specific_area')}</option>
                    {workAreas
                      .filter((wa: any) => !wa.program_id) // Solo áreas sin programa
                      .map((wa: any) => (
                        <option key={wa.id} value={wa.id}>{wa.name}</option>
                      ))}
                  </select>
                </div>
              </>
            )}

            {/* Procedencia */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_source_simple_label')} <span className="text-[#A8402A]">*</span>
              </label>
              <select
                value={formData.source_id}
                onChange={(e) => setFormData({ ...formData, source_id: e.target.value })}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                required
              >
                <option value="">{t('inv_select_source_placeholder')}</option>
                {sources.map(src => (
                  <option key={src.id} value={src.id}>{src.name}</option>
                ))}
              </select>
            </div>

            {/* Grupo */}
            <div className="md:col-span-2">
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_asset_group_label')} <span className="text-[#A8402A]">*</span>
              </label>
              <select
                value={formData.group_id}
                onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                required
              >
                <option value="">{t('inv_select_group_placeholder')}</option>
                {groups.map(grp => (
                  <option key={grp.id} value={grp.id}>{grp.name}</option>
                ))}
              </select>
            </div>

            {/* Opciones Avanzadas de Clasificación */}
            <div className="md:col-span-2 border-t border-[#EFE9DD] pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[13px] text-[#C2492B] hover:text-[#A83A20] font-medium"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                {t('inv_advanced_options_toggle')}
              </button>
              <p className="text-[11.5px] text-[#8A8177] mt-1.5">
                {t('inv_advanced_options_hint')}
              </p>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-[#FAF7F2] border border-[#EFE9DD] rounded-lg">
                  {/* Clase */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                      {t('inv_asset_class_label')} <span className="text-[#A8402A]">*</span>
                    </label>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                    >
                      <option value="">{t('inv_select_class_placeholder')}</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                    <p className="text-[11.5px] text-[#8A8177] mt-1.5">
                      {t('inv_class_hint')}
                    </p>
                  </div>

                  {/* Característica */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                      {t('inv_characteristic_simple_label')} <span className="text-[#A8402A]">*</span>
                    </label>
                    <select
                      value={formData.characteristic_id}
                      onChange={(e) => setFormData({ ...formData, characteristic_id: e.target.value })}
                      className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                    >
                      <option value="">{t('inv_select_characteristic_placeholder')}</option>
                      {characteristics.map(char => (
                        <option key={char.id} value={char.id}>
                          {char.code} - {char.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11.5px] text-[#8A8177] mt-1.5">
                      {t('inv_characteristic_hint')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sección 2: Información del Activo */}
        <div className="mb-7">
          <h2 className="text-[15px] font-medium text-[#1B1917] pb-3 mb-4 border-b border-[#EFE9DD]">
            {t('inv_asset_info_header')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Descripción */}
            <div className="md:col-span-2">
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_description_column')} <span className="text-[#A8402A]">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                placeholder={t('inv_description_placeholder_example')}
                required
              />
            </div>

            {/* Marca */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_brand_label')}
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                placeholder={t('inv_brand_placeholder_example')}
              />
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_model_label')}
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
              />
            </div>

            {/* Tamaño */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_col_size')}
              </label>
              <input
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                placeholder={t('inv_size_placeholder_example')}
              />
            </div>

            {/* Número de serie */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_serial_number_label')}
              </label>
              <input
                type="text"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
              />
            </div>

            {/* Costo estimado */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_estimated_cost_label')}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Estado y Asignación */}
        <div className="mb-7">
          <h2 className="text-[15px] font-medium text-[#1B1917] pb-3 mb-4 border-b border-[#EFE9DD]">
            {t('inv_status_assignment_header')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Estado */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('status')} <span className="text-[#A8402A]">*</span>
              </label>
              <select
                value={formData.status_code}
                onChange={(e) => setFormData({ ...formData, status_code: e.target.value })}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
                required
              >
                <option value="available">{t('inv_status_available')}</option>
                <option value="assigned">{t('inv_status_assigned')}</option>
                <option value="repair">{t('inv_status_repair')}</option>
                <option value="on_loan">{t('inv_status_on_loan')}</option>
              </select>
            </div>

            {/* Programa/Sede */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_program_site_label')}
              </label>
              <select
                value={formData.current_program_id}
                onChange={(e) => setFormData({ ...formData, current_program_id: e.target.value })}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
              >
                <option value="">{t('inv_unassigned')}</option>
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>{prog.name}</option>
                ))}
              </select>
            </div>

            {/* Dueño/Owner */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('inv_owner_label_form')}</label>
              <select
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
              >
                <option value="">{t('inv_select_owner_placeholder')}</option>
                <option value="TOSA">TOSA</option>
                <option value="Stafford">{t('inv_owner_stafford')}</option>
                <option value="Academy">Academy</option>
                <option value="Otro">{t('inv_other')}</option>
              </select>
              <p className="text-[11.5px] text-[#8A8177] mt-1.5">
                {t('inv_owner_entity_hint')}
              </p>
            </div>

            {/* Asignado a */}
            <div>
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_assigned_to_freetext_label')}
              </label>
              <select
                value={assignToOther ? '__other__' : (formData.assigned_student_id || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__other__') {
                    setAssignToOther(true);
                    setFormData({ ...formData, assigned_student_id: '' });
                  } else if (val === '') {
                    setAssignToOther(false);
                    setFormData({ ...formData, assigned_student_id: '', assigned_to_text: '' });
                  } else {
                    setAssignToOther(false);
                    setFormData({ ...formData, assigned_student_id: val, assigned_to_text: '' });
                  }
                }}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917] disabled:bg-[#F4F0E8] disabled:text-[#8A8177]"
                disabled={!formData.current_program_id}
              >
                <option value="">{t('inv_unassigned')}</option>
                {programStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
                <option value="__other__">{t('inv_assigned_other_option')}</option>
              </select>
              {!formData.current_program_id && (
                <p className="text-[11.5px] text-[#8A8177] mt-1.5">{t('inv_assigned_to_needs_site')}</p>
              )}
              {assignToOther && (
                <input
                  type="text"
                  value={formData.assigned_to_text}
                  onChange={(e) => setFormData({ ...formData, assigned_to_text: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917] mt-2"
                  placeholder={t('inv_assigned_to_placeholder_short')}
                />
              )}
              <p className="text-[11.5px] text-[#8A8177] mt-1.5">
                {t('inv_assigned_to_hint')}
              </p>
            </div>
          </div>
        </div>

        {/* Sección 4: Notas */}
        <div>
          <h2 className="text-[15px] font-medium text-[#1B1917] pb-3 mb-4 border-b border-[#EFE9DD]">
            {t('inv_notes_header')}
          </h2>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
            rows={4}
            placeholder={t('inv_notes_placeholder')}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end flex-wrap pt-5 mt-7 border-t border-[#EFE9DD]">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
            disabled={saving}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <MdSave size={18} />
            {saving ? t('saving') : t('inv_create_asset_button')}
          </button>
        </div>
      </form>
    </div>
  );
}
