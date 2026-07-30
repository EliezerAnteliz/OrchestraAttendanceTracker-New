'use client';

/**
 * EDITAR/VER DETALLE DE ACTIVO DE INVENTARIO
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdArrowBack, MdSave, MdWarning, MdDelete, MdHistory, MdAdd } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';

// Cliente de Supabase para ambiente de prueba

interface Asset {
  id: string;
  full_code: string | null;
  location_id: string;
  work_area_id: string | null;
  source_id: string;
  group_id: string;
  class_id: string;
  characteristic_id: string | null;
  sequence_number: number;
  description: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  serial_number: string | null;
  estimated_cost: number | null;
  status_code: string;
  current_program_id: string | null;
  assigned_to_text: string | null;
  assigned_student_id: string | null;
  owner: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Un activo se considera "prestado" (no es propiedad de TOSA) si su Owner es
// Stafford (colegio, uso de emergencia) o Academy (préstamo de otra
// institución). CMI se trata como TOSA (mismo ente, nombre institucional
// anterior) — no cuenta como préstamo.
function isLoanedOwner(owner: string | null | undefined): boolean {
  return owner === 'Stafford' || owner === 'Academy';
}

interface Catalog {
  id: string;
  code: string;
  name: string;
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

interface MaintenanceEvent {
  id: string;
  asset_id: string;
  event_date: string;
  event_type: string;
  vendor: string | null;
  description: string | null;
  cost: number | null;
  created_at: string;
}

export default function AssetDetailPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useUserRole();
  const router = useRouter();
  const params = useParams();
  const assetId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [retireReason, setRetireReason] = useState('');
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateReason, setReactivateReason] = useState('');

  const [asset, setAsset] = useState<Asset | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programStudents, setProgramStudents] = useState<StudentOption[]>([]);
  // true = "Asignado a" está en modo texto libre (no-estudiante, ej. "Terranova")
  const [assignToOther, setAssignToOther] = useState(false);
  const [maintenanceEvents, setMaintenanceEvents] = useState<MaintenanceEvent[]>([]);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    event_date: new Date().toISOString().split('T')[0],
    event_type: '',
    vendor: '',
    description: '',
    cost: '',
  });

  // Formulario (solo campos editables)
  const [formData, setFormData] = useState({
    description: '',
    brand: '',
    model: '',
    size: '',
    serial_number: '',
    estimated_cost: '',
    status_code: '',
    current_program_id: '',
    assigned_to_text: '',
    assigned_student_id: '',
    owner: '',
    notes: '',
  });

  useEffect(() => {
    if (assetId) {
      loadAssetData();
    }
  }, [assetId]);

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

  async function loadAssetData() {
    try {
      setLoading(true);
      setError(null);

      // Cargar activo con todas las relaciones
      const { data: assetData, error: assetError} = await inventorySupabase
        .from('assets')
        .select(`
          *,
          asset_locations:location_id(code, name),
          asset_work_areas:work_area_id(code, name),
          asset_sources:source_id(code, name),
          asset_groups:group_id(code, name),
          asset_classes:class_id(code, name),
          asset_characteristics:characteristic_id(code, description),
          current_program:current_program_id(name)
        `)
        .eq('id', assetId)
        .single();

      if (assetError) throw assetError;
      if (!assetData) throw new Error(t('inv_asset_not_found'));

      setAsset(assetData);

      // Cargar programas
      const { data: programsData, error: programsError } = await inventorySupabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (programsError) throw programsError;
      setPrograms(programsData || []);

      // Cargar eventos de mantenimiento
      await loadMaintenanceEvents();

      // Inicializar formulario
      setFormData({
        description: assetData.description || '',
        brand: assetData.brand || '',
        model: assetData.model || '',
        size: assetData.size || '',
        serial_number: assetData.serial_number || '',
        estimated_cost: assetData.estimated_cost?.toString() || '',
        status_code: assetData.status_code || 'available',
        current_program_id: assetData.current_program_id || '',
        assigned_to_text: assetData.assigned_to_text || '',
        assigned_student_id: assetData.assigned_student_id || '',
        owner: assetData.owner || '',
        notes: assetData.notes || '',
      });
      // Si ya tenía texto libre pero no un estudiante enlazado, arranca en modo "otro"
      setAssignToOther(!assetData.assigned_student_id && !!assetData.assigned_to_text);

    } catch (err: any) {
      console.error('Error loading asset:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMaintenanceEvents() {
    try {
      const { data, error } = await inventorySupabase
        .from('asset_maintenance_log')
        .select('*')
        .eq('asset_id', assetId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setMaintenanceEvents(data || []);
    } catch (err: any) {
      console.error('Error loading maintenance events:', err);
      // No mostrar error al usuario, solo log
    }
  }

  async function handleAddMaintenanceEvent(e: React.FormEvent) {
    e.preventDefault();

    if (!maintenanceForm.event_date || !maintenanceForm.event_type) {
      setError(t('inv_date_and_type_required'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: insertError } = await inventorySupabase
        .from('asset_maintenance_log')
        .insert({
          asset_id: assetId,
          event_date: maintenanceForm.event_date,
          event_type: maintenanceForm.event_type,
          vendor: maintenanceForm.vendor || null,
          description: maintenanceForm.description || null,
          cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
        });

      if (insertError) throw insertError;

      setSuccess(t('inv_maintenance_event_added_success'));
      setShowMaintenanceModal(false);
      
      // Resetear formulario
      setMaintenanceForm({
        event_date: new Date().toISOString().split('T')[0],
        event_type: '',
        vendor: '',
        description: '',
        cost: '',
      });

      // Recargar eventos
      await loadMaintenanceEvents();

    } catch (err: any) {
      console.error('Error adding maintenance event:', err);
      setError(err.message || t('inv_error_adding_maintenance'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.description) {
      setError(t('inv_description_required'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData = {
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
      };

      const { error: updateError } = await inventorySupabase
        .from('assets')
        .update(updateData)
        .eq('id', assetId);

      if (updateError) throw updateError;

      setSuccess(t('inv_asset_updated_success'));
      
      // Recargar datos
      await loadAssetData();

    } catch (err: any) {
      console.error('Error updating asset:', err);
      setError(err.message || t('inv_error_updating_asset'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire() {
    if (!retireReason.trim()) {
      setError(t('inv_retire_reason_required'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const retireNote = `[${now}] DADO DE BAJA: ${retireReason}`;
      const updatedNotes = formData.notes 
        ? `${formData.notes}\n\n${retireNote}`
        : retireNote;

      const { error: updateError } = await inventorySupabase
        .from('assets')
        .update({
          status_code: 'retired',
          is_active: false,
          notes: updatedNotes,
        })
        .eq('id', assetId);

      if (updateError) throw updateError;

      setSuccess(t('inv_asset_retired_success'));
      setShowRetireModal(false);
      setRetireReason('');
      
      // Recargar datos
      await loadAssetData();

    } catch (err: any) {
      console.error('Error retiring asset:', err);
      setError(err.message || t('inv_error_retiring_asset'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate() {
    if (!reactivateReason.trim()) {
      setError(t('inv_reactivate_reason_required'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const reactivateNote = `[${now}] REACTIVADO: ${reactivateReason}`;
      const updatedNotes = formData.notes 
        ? `${formData.notes}\n\n${reactivateNote}`
        : reactivateNote;

      const { error: updateError } = await inventorySupabase
        .from('assets')
        .update({
          status_code: 'available',
          is_active: true,
          notes: updatedNotes,
        })
        .eq('id', assetId);

      if (updateError) throw updateError;

      setSuccess(t('inv_asset_reactivated_success'));
      setShowReactivateModal(false);
      setReactivateReason('');
      
      // Recargar datos
      await loadAssetData();

    } catch (err: any) {
      console.error('Error reactivating asset:', err);
      setError(err.message || t('inv_error_reactivating_asset'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('inv_loading_asset')}</p>
        </div>
      </div>
    );
  }

  if (error && !asset) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ {error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {t('inv_go_back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <MdArrowBack size={20} />
          {t('inv_back_to_list')}
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
              {t('inv_asset_detail_title')}
              {isLoanedOwner(asset?.owner) && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  {t('inv_loaned_badge', { owner: asset?.owner })}
                </span>
              )}
            </h1>
            {asset?.full_code && (
              <p className="text-xl font-mono text-[#C2492B] mt-1">{asset.full_code}</p>
            )}
          </div>
          {isAdmin && (asset?.is_active && asset?.status_code !== 'retired' ? (
            <button
              onClick={() => setShowRetireModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <MdDelete size={20} />
              {t('inv_retire_button')}
            </button>
          ) : (!asset?.is_active || asset?.status_code === 'retired') && (
            <button
              onClick={() => setShowReactivateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <MdHistory size={20} />
              {t('inv_reactivate_button')}
            </button>
          ))}
        </div>
        {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
          <div className="mt-2 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
            <MdWarning className="mr-2" />
            {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">✅ {success}</p>
        </div>
      )}

      {/* Información No Editable */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('inv_coding_info_header')}
        </h2>

        {/* Código Completo */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <span className="text-gray-600 font-medium text-sm">{t('inv_full_code_colon')}</span>
          <p className="font-mono font-bold text-2xl text-[#C2492B] mt-1">{asset?.full_code || t('inv_no_code')}</p>
        </div>

        {/* Segmentos del Código Decodificados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_location_label')}</span>
            <p className="text-gray-900 font-semibold">
              {(asset as any)?.asset_locations?.code || '-'} - {(asset as any)?.asset_locations?.name || t('inv_no_location')}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_work_area_label')}</span>
            <p className="text-gray-900 font-semibold">
              {(asset as any)?.asset_work_areas?.code || '-'} - {(asset as any)?.asset_work_areas?.name || t('inv_no_area')}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_source_label')}</span>
            <p className="text-gray-900 font-semibold">
              {(asset as any)?.asset_sources?.code || '-'} - {(asset as any)?.asset_sources?.name || t('inv_no_source')}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_group_label')}</span>
            <p className="text-gray-900 font-semibold">
              {(asset as any)?.asset_groups?.code || '-'} - {(asset as any)?.asset_groups?.name || t('inv_no_group')}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_class_label')}</span>
            <p className="text-gray-900 font-semibold">
              {(asset as any)?.asset_classes?.code || '-'} - {(asset as any)?.asset_classes?.name || t('inv_no_class')}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_characteristic_label')}</span>
            <p className="text-gray-900 font-semibold">
              {(asset as any)?.asset_characteristics?.code || '-'} - {(asset as any)?.asset_characteristics?.description || t('inv_no_characteristic')}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_sequence_label')}</span>
            <p className="text-gray-900 font-semibold">
              {asset?.sequence_number?.toString().padStart(4, '0') || '0000'}
            </p>
          </div>
          <div>
            <span className="text-gray-600 font-medium text-sm">{t('inv_owner_label')}</span>
            <p className="text-gray-900 font-semibold">
              {asset?.owner || t('inv_not_specified')}
            </p>
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-300 text-sm">
          <div>
            <span className="text-gray-600 font-medium">{t('inv_created_date_label')}</span>
            <p className="text-gray-900">{asset?.created_at ? new Date(asset.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES') : '-'}</p>
          </div>
          <div>
            <span className="text-gray-600 font-medium">{t('inv_updated_date_label')}</span>
            <p className="text-gray-900">{asset?.updated_at ? new Date(asset.updated_at).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES') : '-'}</p>
          </div>
        </div>
      </div>

      {/* Formulario Editable — Staff/Viewer lo ven en solo lectura (fieldset
          disabled deshabilita todos los campos/controles de adentro de una
          vez), consistente con el RLS real: solo Admin puede escribir en
          `assets`. */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <fieldset disabled={!isAdmin} className="contents">
        {/* Información del Activo */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">
            {t('inv_asset_info_header')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Descripción */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inv_description_column')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>

            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_brand_label')}</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_model_label')}</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            {/* Tamaño */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_col_size')}</label>
              <input
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            {/* Número de serie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_serial_number_label')}</label>
              <input
                type="text"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

            {/* Costo estimado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_estimated_cost_label')}</label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Estado y Asignación */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">
            {t('inv_status_assignment_header')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('status')} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status_code}
                onChange={(e) => setFormData({ ...formData, status_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
                disabled={!asset?.is_active}
              >
                <option value="available">{t('inv_status_available')}</option>
                <option value="assigned">{t('inv_status_assigned')}</option>
                <option value="repair">{t('inv_status_repair')}</option>
                <option value="on_loan">{t('inv_status_on_loan')}</option>
                <option value="retired">{t('inv_filter_status_retired')}</option>
              </select>
            </div>

            {/* Programa/Sede */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_program_site_label')}</label>
              <select
                value={formData.current_program_id}
                onChange={(e) => setFormData({ ...formData, current_program_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">{t('inv_unassigned')}</option>
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>{prog.name}</option>
                ))}
              </select>
            </div>

            {/* Dueño/Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_owner_label_form')}</label>
              <select
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">{t('inv_select_owner_placeholder')}</option>
                <option value="TOSA">TOSA</option>
                <option value="Stafford">{t('inv_owner_stafford')}</option>
                <option value="Academy">Academy</option>
                <option value="Otro">{t('inv_other')}</option>
              </select>
            </div>

            {/* Asignado a */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_assigned_to')}</label>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                disabled={!formData.current_program_id}
              >
                <option value="">{t('inv_unassigned')}</option>
                {programStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
                <option value="__other__">{t('inv_assigned_other_option')}</option>
              </select>
              {!formData.current_program_id && (
                <p className="text-xs text-gray-500 mt-1">{t('inv_assigned_to_needs_site')}</p>
              )}
              {assignToOther && (
                <input
                  type="text"
                  value={formData.assigned_to_text}
                  onChange={(e) => setFormData({ ...formData, assigned_to_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 mt-2"
                  placeholder={t('inv_assigned_to_placeholder_short')}
                />
              )}
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">
            {t('inv_notes_header')}
          </h2>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            rows={6}
            placeholder={t('inv_notes_placeholder')}
          />
        </div>
      </fieldset>

        {/* Botones */}
        <div className="flex gap-4 justify-end flex-wrap pt-4 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            {t('cancel')}
          </button>
          {isAdmin && (
            <button
              type="submit"
              disabled={saving || !asset?.is_active}
              className="flex items-center gap-2 px-6 py-2 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors disabled:bg-gray-400"
            >
              <MdSave size={20} />
              {saving ? t('saving') : t('inv_save_changes_button')}
            </button>
          )}
        </div>
      </form>

      {/* Historial de Mantenimiento */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-2 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MdHistory size={24} />
            {t('inv_maintenance_history_header')}
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowMaintenanceModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors"
            >
              <MdAdd size={20} />
              {t('inv_add_event_button')}
            </button>
          )}
        </div>

        {maintenanceEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('inv_no_maintenance_events')}</p>
        ) : (
          <div className="space-y-4">
            {maintenanceEvents.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        {event.event_type}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(event.event_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    {event.vendor && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">{t('inv_vendor_colon')}</span> {event.vendor}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">{t('inv_description_colon')}</span> {event.description}
                      </p>
                    )}
                  </div>
                  {event.cost && (
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        ${event.cost.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dar de Baja */}
      {showRetireModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('inv_retire_modal_title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('inv_retire_modal_text')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inv_reason_label')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                rows={3}
                placeholder={t('inv_retire_reason_placeholder')}
                required
              />
            </div>
            <div className="flex gap-4 justify-end flex-wrap">
              <button
                onClick={() => {
                  setShowRetireModal(false);
                  setRetireReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRetire}
                disabled={saving || !retireReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {saving ? t('inv_processing') : t('inv_confirm_retire')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reactivar */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('inv_reactivate_modal_title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('inv_reactivate_modal_text')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inv_reason_label')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                rows={3}
                placeholder={t('inv_reactivate_reason_placeholder')}
                required
              />
            </div>
            <div className="flex gap-4 justify-end flex-wrap">
              <button
                onClick={() => {
                  setShowReactivateModal(false);
                  setReactivateReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleReactivate}
                disabled={saving || !reactivateReason.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {saving ? t('inv_processing') : t('inv_confirm_reactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Evento de Mantenimiento */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('inv_add_maintenance_modal_title')}</h3>
            <form onSubmit={handleAddMaintenanceEvent}>
              <div className="space-y-4">
                {/* Fecha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inv_date_label')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={maintenanceForm.event_date}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, event_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>

                {/* Tipo de evento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inv_event_type_label')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={maintenanceForm.event_type}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, event_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  >
                    <option value="">{t('inv_select_type_placeholder')}</option>
                    <option value="Reparación">{t('inv_event_type_repair')}</option>
                    <option value="Limpieza">{t('inv_event_type_cleaning')}</option>
                    <option value="Ajuste">{t('inv_event_type_adjustment')}</option>
                    <option value="Otro">{t('inv_other')}</option>
                  </select>
                </div>

                {/* Proveedor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_vendor_label')}</label>
                  <input
                    type="text"
                    value={maintenanceForm.vendor}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={t('inv_vendor_placeholder')}
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_description_column')}</label>
                  <textarea
                    value={maintenanceForm.description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    rows={3}
                    placeholder={t('inv_maintenance_desc_placeholder')}
                  />
                </div>

                {/* Costo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv_cost_label')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end flex-wrap mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowMaintenanceModal(false);
                    setMaintenanceForm({
                      event_date: new Date().toISOString().split('T')[0],
                      event_type: '',
                      vendor: '',
                      description: '',
                      cost: '',
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={saving}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !maintenanceForm.event_date || !maintenanceForm.event_type}
                  className="px-4 py-2 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] disabled:bg-gray-400"
                >
                  {saving ? t('saving') : t('inv_add_event_button')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
