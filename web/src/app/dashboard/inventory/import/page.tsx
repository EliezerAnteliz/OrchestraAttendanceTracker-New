'use client';

/**
 * IMPORTAR INVENTARIO MASIVO - VERSIÓN SIMPLIFICADA
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 * 
 * Formato aceptado: 13 columnas del historial (Ascend Equipment Inventory.xlsx)
 * SITE, DESCRIPTION, BRAND, SIZE, SERIAL, MODEL, INVENTORY #, OWNER, STATUS, CONDITION, IN COMMODATE TO, OBSERVATIONS, Estimated Cost
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdArrowBack, MdUpload, MdWarning, MdCheckCircle, MdError, MdExpandMore, MdDownload } from 'react-icons/md';
import * as XLSX from 'xlsx';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';

// Cliente de Supabase para ambiente de prueba

interface ImportRow {
  rowNumber: number;
  site: string;
  description: string;
  brand?: string;
  size?: string;
  serial?: string;
  model?: string;
  inventoryCode?: string;
  owner?: string;
  status?: string;
  condition?: string;
  inCommodateTo?: string;
  observations?: string;
  estimatedCost?: number;
  
  // Campos procesados
  willGenerateCode: boolean;
  generatedCode?: string;
  error?: string;
  warning?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export default function ImportInventoryPage() {
  const { t } = useI18n();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Configuración del lote (solo para filas sin código)
  const [batchConfig, setBatchConfig] = useState({
    group_id: '',
    class_id: '',
    characteristic_id: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Catálogos
  const [programs, setPrograms] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [characteristics, setCharacteristics] = useState<any[]>([]);
  const [workAreas, setWorkAreas] = useState<any[]>([]);
  const [statusCodes, setStatusCodes] = useState<any[]>([]);
  
  // Preview y resultados
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Cargar catálogos al montar
  useEffect(() => {
    loadCatalogs();
  }, []);

  // Solo Admin puede importar (RLS ya lo exige para INSERT en `assets`) — si
  // Staff/Viewer llega aquí por URL directa, lo regresamos al Listado.
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/dashboard/inventory/assets');
    }
  }, [roleLoading, isAdmin, router]);

  async function loadCatalogs() {
    try {
      const [programsRes, sourcesRes, groupsRes, classesRes, charsRes, workAreasRes, statusRes] = await Promise.all([
        inventorySupabase.from('programs').select('id, name').eq('is_active', true).order('name'),
        inventorySupabase.from('asset_sources').select('id, code, name').order('name'),
        inventorySupabase.from('asset_groups').select('id, code, name').order('name'),
        inventorySupabase.from('asset_classes').select('id, code, name').order('name'),
        inventorySupabase.from('asset_characteristics').select('id, code, description').order('code'),
        inventorySupabase.from('asset_work_areas').select('id, code, name, location_id, program_id').order('name'),
        inventorySupabase.from('asset_status').select('code, description').order('code'),
      ]);

      setPrograms(programsRes.data || []);
      setSources(sourcesRes.data || []);
      setGroups(groupsRes.data || []);
      setClasses(classesRes.data || []);
      setCharacteristics(charsRes.data || []);
      setWorkAreas(workAreasRes.data || []);
      setStatusCodes(statusRes.data || []);

      // Preseleccionar defaults
      const instrumentsGroup = groupsRes.data?.find(g => g.code === '08');
      const tangibleClass = classesRes.data?.find(c => c.code === '01');
      const char04 = charsRes.data?.find(c => c.code === '04');
      
      setBatchConfig({
        group_id: instrumentsGroup?.id || '',
        class_id: tangibleClass?.id || '',
        characteristic_id: char04?.id || '',
      });

    } catch (err: any) {
      console.error('Error loading catalogs:', err);
      setError(t('inv_error_loading_catalogs'));
    }
  }

  // Descargar plantilla Excel
  async function downloadTemplate() {
    try {
      // Cargar programas actuales para la lista desplegable
      const { data: programsData } = await inventorySupabase
        .from('programs')
        .select('name')
        .eq('is_active', true)
        .order('name');
      
      const programNames = programsData?.map(p => p.name) || [];

      // Crear workbook con UNA SOLA HOJA
      const wb = XLSX.utils.book_new();

      const headers = [
        'SITE',
        'DESCRIPTION',
        'BRAND',
        'SIZE',
        'SERIAL',
        'MODEL',
        'INVENTORY #',
        'OWNER',
        'STATUS',
        'CONDITION',
        'IN COMMODATE TO',
        'OBSERVATIONS',
        'Estimated Cost'
      ];

      const exampleRow = [
        programNames[0] || 'Stafford',
        'Violín 4/4 (EJEMPLO - BORRAR ESTA FILA)',
        'Yamaha',
        '4/4',
        'SN123456',
        'V5SC',
        '', // INVENTORY # vacío para que se genere automático
        'TOSA',
        'Purchased',
        'IN CORE',
        '',
        'Activo de ejemplo',
        '500'
      ];

      const wsData = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
      XLSX.utils.book_append_sheet(wb, wsData, 'Carga de Inventario');

      // Descargar archivo
      XLSX.writeFile(wb, 'Plantilla_Carga_Inventario.xlsx');
      
      setSuccess(t('inv_template_downloaded_success'));
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error('Error generating template:', err);
      setError(t('inv_error_generating_template'));
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setPreviewData([]);
    setImportResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      await processFile(jsonData);

    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(err.message || t('inv_error_processing_file'));
    } finally {
      setLoading(false);
    }
  }

  async function processFile(jsonData: any[]) {
    const rows: ImportRow[] = [];
    
    // Contador de consecutivos por combinación de Grupo+Location+WorkArea
    // Formato de key: "groupId-locationId-workAreaId"
    const sequenceCounters: Record<string, number> = {};

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y tiene header

      try {
        const inventoryCode = row['INVENTORY #']?.toString().trim() || '';
        const willGenerateCode = !inventoryCode;

        const processedRow: ImportRow = {
          rowNumber,
          site: row['SITE']?.toString().trim() || '',
          description: row['DESCRIPTION']?.toString().trim() || '',
          brand: row['BRAND']?.toString().trim(),
          size: row['SIZE']?.toString().trim(),
          serial: row['SERIAL']?.toString().trim(),
          model: row['MODEL']?.toString().trim(),
          inventoryCode: inventoryCode || undefined,
          owner: row['OWNER']?.toString().trim(),
          status: row['STATUS']?.toString().trim(),
          condition: row['CONDITION']?.toString().trim(),
          inCommodateTo: row['IN COMMODATE TO']?.toString().trim(),
          observations: row['OBSERVATIONS']?.toString().trim(),
          estimatedCost: row['Estimated Cost'] ? parseFloat(row['Estimated Cost']) : undefined,
          willGenerateCode,
        };

        // Validaciones básicas
        if (!processedRow.description) {
          processedRow.error = t('inv_description_required_import');
          rows.push(processedRow);
          continue;
        }

        if (!processedRow.site) {
          processedRow.error = t('inv_site_required_import');
          rows.push(processedRow);
          continue;
        }

        // Si trae código, validarlo
        if (!willGenerateCode) {
          if (inventoryCode.length !== 16) {
            processedRow.error = t('inv_inventory_code_16_digits');
            rows.push(processedRow);
            continue;
          }

          // Verificar si ya existe
          const { data: existing } = await inventorySupabase
            .from('assets')
            .select('id')
            .eq('full_code', inventoryCode)
            .single();

          if (existing) {
            processedRow.error = t('inv_duplicate_code');
            rows.push(processedRow);
            continue;
          }

          // Validar estructura del código
          const validation = await validateFullCode(inventoryCode);
          if (!validation.valid) {
            processedRow.error = validation.error;
            rows.push(processedRow);
            continue;
          }
        } else {
          // Si no trae código, verificar que tengamos la config necesaria
          if (!batchConfig.group_id) {
            processedRow.error = t('inv_must_select_group_for_auto_codes');
            rows.push(processedRow);
            continue;
          }

          // Generar código preview con contador de consecutivos
          try {
            const generatedCode = await generateCodePreview(processedRow, sequenceCounters);
            processedRow.generatedCode = generatedCode;
          } catch (err: any) {
            processedRow.error = t('inv_error_generating_code', { msg: err.message });
            rows.push(processedRow);
            continue;
          }
        }

        rows.push(processedRow);

      } catch (err: any) {
        rows.push({
          rowNumber,
          site: '',
          description: row['DESCRIPTION'] || '',
          willGenerateCode: false,
          error: t('inv_error_processing_row', { msg: err.message }),
        });
      }
    }

    setPreviewData(rows);
    setShowPreview(true);
  }

  async function validateFullCode(full_code: string): Promise<{ valid: boolean; error?: string }> {
    // Validar formato: 16 dígitos seguidos (LLAAOOGGCCHHNNNN)
    if (full_code.length !== 16) {
      return { valid: false, error: t('inv_code_must_be_16_digits') };
    }

    // Parsear código: LLAAOOGGCCHHNNNN
    const locationCode = full_code.substring(0, 2);
    const workAreaCode = full_code.substring(2, 4);
    const sourceCode = full_code.substring(4, 6);
    const groupCode = full_code.substring(6, 8);
    const classCode = full_code.substring(8, 10);
    const charCode = full_code.substring(10, 12);

    // Validar ubicación primero
    const location = await inventorySupabase.from('asset_locations').select('id').eq('code', locationCode).single();
    if (!location.data) return { valid: false, error: t('inv_location_not_exist', { code: locationCode }) };

    // Validar área filtrando por ubicación
    const workArea = await inventorySupabase
      .from('asset_work_areas')
      .select('id')
      .eq('code', workAreaCode)
      .eq('location_id', location.data.id)
      .single();
    if (!workArea.data) return { valid: false, error: t('inv_area_not_exist_in_location', { area: workAreaCode, location: locationCode }) };

    const source = await inventorySupabase.from('asset_sources').select('id').eq('code', sourceCode).single();
    if (!source.data) return { valid: false, error: t('inv_source_not_exist', { code: sourceCode }) };

    const group = await inventorySupabase.from('asset_groups').select('id').eq('code', groupCode).single();
    if (!group.data) return { valid: false, error: t('inv_group_not_exist', { code: groupCode }) };

    const assetClass = await inventorySupabase.from('asset_classes').select('id').eq('code', classCode).single();
    if (!assetClass.data) return { valid: false, error: t('inv_class_not_exist', { code: classCode }) };

    const char = await inventorySupabase.from('asset_characteristics').select('id').eq('code', charCode).single();
    if (!char.data) return { valid: false, error: t('inv_characteristic_not_exist', { code: charCode }) };

    return { valid: true };
  }

  async function getOrganizationId(): Promise<string> {
    // Obtener organization_id del primer programa disponible (igual que en creación individual)
    const { data: programData } = await inventorySupabase
      .from('programs')
      .select('organization_id')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    return programData?.organization_id || '8bade020-abcc-4ee9-a14a-fa311bb3f482';
  }

  async function getAssetIdsFromCode(full_code: string) {
    // Parsear código: LLAAOOGGCCHHNNNN
    const locationCode = full_code.substring(0, 2);
    const workAreaCode = full_code.substring(2, 4);
    const sourceCode = full_code.substring(4, 6);
    const groupCode = full_code.substring(6, 8);
    const classCode = full_code.substring(8, 10);
    const charCode = full_code.substring(10, 12);
    const sequenceStr = full_code.substring(12, 16); // Últimos 4 dígitos

    // Validar ubicación primero
    const location = await inventorySupabase.from('asset_locations').select('id').eq('code', locationCode).single();
    if (!location.data) throw new Error(t('inv_location_not_exist', { code: locationCode }));

    // Validar área filtrando por ubicación
    const workArea = await inventorySupabase
      .from('asset_work_areas')
      .select('id')
      .eq('code', workAreaCode)
      .eq('location_id', location.data.id)
      .single();
    if (!workArea.data) throw new Error(t('inv_area_not_exist_in_location', { area: workAreaCode, location: locationCode }));

    const [source, group, assetClass, char] = await Promise.all([
      inventorySupabase.from('asset_sources').select('id').eq('code', sourceCode).single(),
      inventorySupabase.from('asset_groups').select('id').eq('code', groupCode).single(),
      inventorySupabase.from('asset_classes').select('id').eq('code', classCode).single(),
      inventorySupabase.from('asset_characteristics').select('id').eq('code', charCode).single(),
    ]);

    if (!source.data) throw new Error(t('inv_source_not_exist', { code: sourceCode }));
    if (!group.data) throw new Error(t('inv_group_not_exist', { code: groupCode }));
    if (!assetClass.data) throw new Error(t('inv_class_not_exist', { code: classCode }));
    if (!char.data) throw new Error(t('inv_characteristic_not_exist', { code: charCode }));

    return {
      location_id: location.data.id,
      work_area_id: workArea.data.id,
      source_id: source.data.id,
      group_id: group.data.id,
      class_id: assetClass.data.id,
      characteristic_id: char.data.id,
      sequence_number: parseInt(sequenceStr, 10), // Parsear últimos 4 dígitos como entero
    };
  }

  async function getNextSequence(groupId: string, locationId: string, workAreaId: string | null): Promise<number> {
    const { data } = await inventorySupabase.rpc('get_next_asset_sequence', { 
      p_group_id: groupId,
      p_location_id: locationId,
      p_work_area_id: workAreaId
    });
    return data || 1;
  }

  async function getLocationByWorkArea(workAreaId: string) {
    const workArea = workAreas.find(wa => wa.id === workAreaId);
    if (!workArea) return null;
    const { data } = await inventorySupabase
      .from('asset_locations')
      .select('code')
      .eq('id', workArea.location_id)
      .single();
    return data;
  }

  async function generateCodePreview(row: ImportRow, sequenceCounters: Record<string, number>): Promise<string> {
    // Mapear STATUS a source_id
    const statusToSource: Record<string, string> = {
      'Purchased': 'Comprado',
      'Donated': 'Donado',
      'Borrowed': 'Alquilado',
    };

    const sourceName = statusToSource[row.status || ''] || 'Comprado';
    const source = sources.find(s => s.name.toLowerCase() === sourceName.toLowerCase());
    if (!source) throw new Error(t('inv_source_name_not_found', { name: sourceName }));

    // Buscar program_id por nombre de SITE
    const program = programs.find(p => p.name.toLowerCase() === row.site.toLowerCase());
    if (!program) throw new Error(t('inv_site_name_not_found', { site: row.site }));

    // Buscar work_area por program_id
    const workArea = workAreas.find(wa => wa.program_id === program.id);
    if (!workArea) throw new Error(t('inv_no_work_area_for_site', { site: row.site }));

    // Obtener location
    const location = await getLocationByWorkArea(workArea.id);
    if (!location) throw new Error(t('inv_no_location_for_work_area'));

    // Obtener códigos
    const group = groups.find(g => g.id === batchConfig.group_id);
    const assetClass = classes.find(c => c.id === batchConfig.class_id);
    const char = characteristics.find(c => c.id === batchConfig.characteristic_id);

    if (!group || !assetClass || !char) {
      throw new Error(t('inv_incomplete_batch_config'));
    }

    // Crear key para el contador: groupId-locationId-workAreaId
    const counterKey = `${batchConfig.group_id}-${workArea.location_id}-${workArea.id}`;

    // Si no hemos procesado esta combinación antes, obtener el siguiente secuencial de la BD
    if (!sequenceCounters[counterKey]) {
      sequenceCounters[counterKey] = await getNextSequence(batchConfig.group_id, workArea.location_id, workArea.id);
    }

    // Usar el contador actual y luego incrementarlo para la siguiente fila
    const sequential = sequenceCounters[counterKey];
    sequenceCounters[counterKey]++; // Incrementar para la próxima fila del mismo lote

    const seqStr = sequential.toString().padStart(4, '0');
    
    // Formato: LLAAOOGGCCHHNNNN (16 dígitos sin guiones)
    const code = `${location.code}${workArea.code}${source.code}${group.code}${assetClass.code}${char.code}${seqStr}`;

    return code;
  }

  async function confirmImport() {
    setLoading(true);
    setError(null);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      for (const row of previewData) {
        if (row.error) {
          result.failed++;
          result.errors.push({ row: row.rowNumber, message: row.error });
          continue;
        }

        try {
          // Mapear CONDITION a status_code
          const conditionToStatus: Record<string, string> = {
            'IN USE': 'assigned',
            'IN CORE': 'available',
            'In Repair': 'repair',
            'Retired': 'retired',
          };

          const statusCode = conditionToStatus[row.condition || 'IN CORE'] || 'available';
          const isActive = row.condition !== 'Retired';

          // Buscar program_id
          const program = programs.find(p => p.name.toLowerCase() === row.site.toLowerCase());
          if (!program) throw new Error(t('inv_site_name_not_found', { site: row.site }));

          // Preparar datos del activo
          const assetData: any = {
            full_code: row.willGenerateCode ? row.generatedCode : row.inventoryCode,
            description: row.description,
            brand: row.brand || null,
            size: row.size || null,
            serial_number: row.serial || null,
            model: row.model || null,
            owner: row.owner || null,
            estimated_cost: row.estimatedCost || null,
            status_code: statusCode,
            current_program_id: program.id,
            assigned_to_text: row.inCommodateTo || null,
            notes: row.observations || null,
            is_active: isActive,
          };

          // Obtener organization_id y extraer IDs del código usando funciones compartidas
          const code = row.willGenerateCode ? row.generatedCode! : row.inventoryCode!;
          
          const [organizationId, assetIds] = await Promise.all([
            getOrganizationId(),
            getAssetIdsFromCode(code),
          ]);

          assetData.organization_id = organizationId;
          assetData.location_id = assetIds.location_id;
          assetData.work_area_id = assetIds.work_area_id;
          assetData.source_id = assetIds.source_id;
          assetData.group_id = assetIds.group_id;
          assetData.class_id = assetIds.class_id;
          assetData.characteristic_id = assetIds.characteristic_id;
          assetData.sequence_number = assetIds.sequence_number; // ✅ Últimos 4 dígitos del código

          // Insertar activo
          const { error: insertError } = await inventorySupabase
            .from('assets')
            .insert(assetData);

          if (insertError) throw insertError;

          result.success++;

        } catch (err: any) {
          console.error(`Error importing row ${row.rowNumber}:`, err);
          result.failed++;
          result.errors.push({ row: row.rowNumber, message: err.message });
        }
      }

      setImportResult(result);
      setSuccess(t('inv_import_completed', { success: result.success, failed: result.failed }));

    } catch (err: any) {
      console.error('Error during import:', err);
      setError(err.message || t('inv_error_during_import'));
    } finally {
      setLoading(false);
    }
  }

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MdArrowBack size={24} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('inv_import_title')}</h1>
            <p className="text-gray-600 mt-1">
              {t('inv_import_subtitle')}
            </p>
          </div>
        </div>
        {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
          <div className="inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
            <MdWarning className="mr-2" />
            {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <MdCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <MdError className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Configuración del lote */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('inv_batch_config_header')}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {t('inv_batch_config_hint')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('inv_asset_group_required_label')}
            </label>
            <select
              value={batchConfig.group_id}
              onChange={(e) => setBatchConfig({ ...batchConfig, group_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="">{t('inv_select_group_ellipsis')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.code} - {g.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {t('inv_default_group_hint')}
            </p>
          </div>
        </div>

        {/* Opciones avanzadas */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <MdExpandMore
            size={20}
            className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
          {t('inv_advanced_options_label')}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('inv_asset_class_simple_label')}
              </label>
              <select
                value={batchConfig.class_id}
                onChange={(e) => setBatchConfig({ ...batchConfig, class_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="">{t('inv_select_class_ellipsis')}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('inv_characteristic_simple_label')}
              </label>
              <select
                value={batchConfig.characteristic_id}
                onChange={(e) => setBatchConfig({ ...batchConfig, characteristic_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="">{t('inv_select_characteristic_ellipsis')}</option>
                {characteristics.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Upload section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('inv_upload_file_header')}</h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <button
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MdDownload size={20} />
            {t('inv_download_template_button')}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdUpload size={20} />
            {loading ? t('inv_processing') : t('inv_upload_file_button')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-3">{t('inv_format_instructions_header')}</h3>

          <div className="text-sm text-blue-800 space-y-3">
            <p className="font-medium">
              {t('inv_columns_format_text')}
            </p>

            <div>
              <p className="font-medium mb-1">{t('inv_column_descriptions_header')}</p>
              <ul className="space-y-1 list-disc list-inside ml-2">
                <li><strong>SITE:</strong> {t('inv_site_field_desc')}</li>
                <li><strong>DESCRIPTION:</strong> {t('inv_description_field_desc')}</li>
                <li><strong>INVENTORY #:</strong> {t('inv_inventory_field_desc_pre')} <strong>{t('inv_leave_empty')}</strong> {t('inv_inventory_field_desc_post')}</li>
                <li><strong>OWNER:</strong> {t('inv_owner_field_desc')}</li>
                <li><strong>STATUS:</strong> {t('inv_status_field_desc')}</li>
                <li><strong>CONDITION:</strong> {t('inv_condition_field_desc')}</li>
                <li><strong>IN COMMODATE TO:</strong> {t('inv_in_commodate_field_desc')}</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1">{t('inv_important_label')}</p>
              <ul className="space-y-1 list-disc list-inside ml-2">
                <li>{t('inv_empty_inventory_hint_pre')} <strong>{t('inv_empty_word')}</strong> {t('inv_empty_inventory_hint_post')}</li>
                <li>{t('inv_full_inventory_hint_pre')} <strong>{t('inv_full_word')}</strong> {t('inv_full_inventory_hint_post')}</li>
                <li>{t('inv_auto_codes_hint')}</li>
                <li>{t('inv_status_ignored_hint')}</li>
                <li>{t('inv_retired_condition_hint')}</li>
              </ul>
            </div>

            <p className="font-medium">
              {t('inv_download_template_tip')}
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && previewData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {t('inv_preview_title', { n: previewData.length })}
          </h2>

          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inv_row_column')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inv_type_column')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inv_code_column')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inv_description_column')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('inv_site_label')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((row) => (
                  <tr key={row.rowNumber} className={row.error ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.rowNumber}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.willGenerateCode ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          {t('inv_new_code_badge')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {t('inv_existing_code_badge')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {row.willGenerateCode ? row.generatedCode : row.inventoryCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.site}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.error ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <MdError size={16} />
                          {row.error}
                        </span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1">
                          <MdCheckCircle size={16} />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-4 flex-wrap">
            <button
              onClick={() => {
                setShowPreview(false);
                setPreviewData([]);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={confirmImport}
              disabled={loading || previewData.some(r => r.error)}
              className="px-4 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('inv_importing') : t('inv_confirm_import_button')}
            </button>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('inv_import_result_header')}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-600 mb-1">{t('inv_successful_label')}</p>
              <p className="text-3xl font-bold text-green-700">{importResult.success}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600 mb-1">{t('inv_failed_label')}</p>
              <p className="text-3xl font-bold text-red-700">{importResult.failed}</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">{t('inv_errors_colon')}</h3>
              <div className="space-y-2">
                {importResult.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-600">
                    {t('inv_row_error_template', { row: err.row, msg: err.message })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-4">
            <button
              onClick={() => router.push('/dashboard/inventory/assets')}
              className="px-4 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors"
            >
              {t('inv_view_assets_list')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
