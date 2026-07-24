'use client';

/**
 * IMPORTAR INVENTARIO MASIVO
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../supabase.inventory.config';
import { MdArrowBack, MdUpload, MdWarning, MdCheckCircle, MdError, MdExpandMore } from 'react-icons/md';
import * as XLSX from 'xlsx';

// Cliente de Supabase para ambiente de prueba
const inventorySupabase = createClient(
  INVENTORY_SUPABASE_CONFIG.url,
  INVENTORY_SUPABASE_CONFIG.anonKey
);

interface ImportRow {
  rowNumber: number;
  full_code?: string;
  description: string;
  brand?: string;
  size?: string;
  serial_number?: string;
  model?: string;
  owner?: string;
  estimated_cost?: number;
  status_code?: string;
  current_program?: string;
  assigned_to?: string;
  generatedCode?: string;
  error?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export default function ImportInventoryPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'with-code' | 'without-code'>('with-code');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modo B: Configuración del lote
  const [batchConfig, setBatchConfig] = useState({
    program_id: '',
    source_id: '',
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
  
  // Preview y resultados
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Cargar catálogos al montar
  useEffect(() => {
    loadCatalogs();
  }, []);

  async function loadCatalogs() {
    try {
      const [programsRes, sourcesRes, groupsRes, classesRes, charsRes, workAreasRes] = await Promise.all([
        inventorySupabase.from('programs').select('id, name').eq('is_active', true).order('name'),
        inventorySupabase.from('asset_sources').select('id, code, name').order('name'),
        inventorySupabase.from('asset_groups').select('id, code, name').order('name'),
        inventorySupabase.from('asset_classes').select('id, code, name').order('name'),
        inventorySupabase.from('asset_characteristics').select('id, code, description').order('code'),
        inventorySupabase.from('asset_work_areas').select('id, code, name, location_id, program_id').order('name'),
      ]);

      setPrograms(programsRes.data || []);
      setSources(sourcesRes.data || []);
      setGroups(groupsRes.data || []);
      setClasses(classesRes.data || []);
      setCharacteristics(charsRes.data || []);
      setWorkAreas(workAreasRes.data || []);

      // Preseleccionar defaults para Modo B
      const tangibleClass = classesRes.data?.find(c => c.code === '01');
      const char04 = charsRes.data?.find(c => c.code === '04');
      
      setBatchConfig(prev => ({
        ...prev,
        class_id: tangibleClass?.id || '',
        characteristic_id: char04?.id || '',
      }));

    } catch (err: any) {
      console.error('Error loading catalogs:', err);
      setError('Error al cargar catálogos');
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

      if (mode === 'with-code') {
        await processWithCode(jsonData);
      } else {
        await processWithoutCode(jsonData);
      }

    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(err.message || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  }

  async function processWithCode(jsonData: any[]) {
    const rows: ImportRow[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y tiene header

      try {
        const full_code = row.full_code?.toString().trim();
        
        if (!full_code || full_code.length !== 16) {
          rows.push({
            rowNumber,
            ...row,
            error: 'Código debe tener 16 dígitos',
          });
          continue;
        }

        // Verificar si ya existe
        const { data: existing } = await inventorySupabase
          .from('assets')
          .select('id')
          .eq('full_code', full_code)
          .single();

        if (existing) {
          rows.push({
            rowNumber,
            ...row,
            error: 'Código duplicado - ya existe en la base de datos',
          });
          continue;
        }

        // Validar tramos del código
        const validation = await validateFullCode(full_code);
        if (!validation.valid) {
          rows.push({
            rowNumber,
            ...row,
            error: validation.error,
          });
          continue;
        }

        rows.push({
          rowNumber,
          full_code,
          description: row.description,
          brand: row.brand,
          size: row.size,
          serial_number: row.serial_number,
          model: row.model,
          owner: row.owner,
          estimated_cost: row.estimated_cost ? parseFloat(row.estimated_cost) : undefined,
          status_code: row.status_code_or_condition || 'available',
          current_program: row.current_program,
          assigned_to: row.assigned_to,
        });

      } catch (err: any) {
        rows.push({
          rowNumber,
          ...row,
          error: err.message,
        });
      }
    }

    setPreviewData(rows);
    setShowPreview(true);
  }

  async function processWithoutCode(jsonData: any[]) {
    // Validar configuración del lote
    if (!batchConfig.program_id || !batchConfig.source_id || !batchConfig.group_id) {
      setError('Debes seleccionar Sede, Procedencia y Grupo de activo para el lote');
      return;
    }

    // Derivar location_id y work_area_id del programa
    const workArea = workAreas.find(wa => wa.program_id === batchConfig.program_id);
    if (!workArea) {
      setError('No se encontró ubicación/área para la sede seleccionada');
      return;
    }

    const rows: ImportRow[] = [];
    let currentSequence = await getNextSequence(batchConfig.group_id, workArea.location_id, workArea.id);

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2;

      try {
        if (!row.description) {
          rows.push({
            rowNumber,
            ...row,
            error: 'Descripción es requerida',
          });
          continue;
        }

        // Generar código
        const location = await getLocationByWorkArea(workArea.id);
        const source = sources.find(s => s.id === batchConfig.source_id);
        const group = groups.find(g => g.id === batchConfig.group_id);
        const assetClass = classes.find(c => c.id === batchConfig.class_id);
        const char = characteristics.find(c => c.id === batchConfig.characteristic_id);

        if (!location || !source || !group || !assetClass || !char) {
          throw new Error('Error al obtener catálogos para generar código');
        }

        const generatedCode = `${location.code}${workArea.code}${source.code}${group.code}${assetClass.code}${char.code}${currentSequence.toString().padStart(4, '0')}`;

        rows.push({
          rowNumber,
          description: row.description,
          brand: row.brand,
          size: row.size,
          serial_number: row.serial_number,
          model: row.model,
          estimated_cost: row.estimated_cost ? parseFloat(row.estimated_cost) : undefined,
          generatedCode,
        });

        currentSequence++;

      } catch (err: any) {
        rows.push({
          rowNumber,
          ...row,
          error: err.message,
        });
      }
    }

    setPreviewData(rows);
    setShowPreview(true);
  }

  async function validateFullCode(full_code: string): Promise<{ valid: boolean; error?: string }> {
    // Parsear código: LLAAOOGGCCHHNNNN
    const locationCode = full_code.substring(0, 2);
    const workAreaCode = full_code.substring(2, 4);
    const sourceCode = full_code.substring(4, 6);
    const groupCode = full_code.substring(6, 8);
    const classCode = full_code.substring(8, 10);
    const charCode = full_code.substring(10, 12);

    // Validar ubicación primero
    const location = await inventorySupabase.from('asset_locations').select('id').eq('code', locationCode).single();
    if (!location.data) return { valid: false, error: `Ubicación ${locationCode} no existe` };

    // Validar área filtrando por ubicación
    const workArea = await inventorySupabase
      .from('asset_work_areas')
      .select('id')
      .eq('code', workAreaCode)
      .eq('location_id', location.data.id)
      .single();
    if (!workArea.data) return { valid: false, error: `Área ${workAreaCode} no existe en ubicación ${locationCode}` };

    const source = await inventorySupabase.from('asset_sources').select('id').eq('code', sourceCode).single();
    if (!source.data) return { valid: false, error: `Procedencia ${sourceCode} no existe` };

    const group = await inventorySupabase.from('asset_groups').select('id').eq('code', groupCode).single();
    if (!group.data) return { valid: false, error: `Grupo ${groupCode} no existe` };

    const assetClass = await inventorySupabase.from('asset_classes').select('id').eq('code', classCode).single();
    if (!assetClass.data) return { valid: false, error: `Clase ${classCode} no existe` };

    const char = await inventorySupabase.from('asset_characteristics').select('id').eq('code', charCode).single();
    if (!char.data) return { valid: false, error: `Característica ${charCode} no existe` };

    return { valid: true };
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
    const { data } = await inventorySupabase
      .from('asset_locations')
      .select('code')
      .eq('id', workArea.location_id)
      .single();
    return data;
  }

  async function getOrganizationId(): Promise<string> {
    // Obtener organization_id del primer programa disponible (igual que en creación individual)
    const { data: programData } = await inventorySupabase
      .from('programs')
      .select('organization_id')
      .eq('is_active', true)
      .limit(1)
      .single();

    // Fallback a la organización de prueba TOSA
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
    const sequence = parseInt(full_code.substring(12, 16));

    // Obtener ubicación primero
    const location = await inventorySupabase
      .from('asset_locations')
      .select('id')
      .eq('code', locationCode)
      .single();
    if (!location.data) throw new Error(`Ubicación ${locationCode} no existe`);

    // Obtener área filtrando por ubicación
    const workArea = await inventorySupabase
      .from('asset_work_areas')
      .select('id')
      .eq('code', workAreaCode)
      .eq('location_id', location.data.id)
      .single();
    if (!workArea.data) throw new Error(`Área ${workAreaCode} no existe en ubicación ${locationCode}`);

    // Obtener resto de IDs
    const [source, group, assetClass, char] = await Promise.all([
      inventorySupabase.from('asset_sources').select('id').eq('code', sourceCode).single(),
      inventorySupabase.from('asset_groups').select('id').eq('code', groupCode).single(),
      inventorySupabase.from('asset_classes').select('id').eq('code', classCode).single(),
      inventorySupabase.from('asset_characteristics').select('id').eq('code', charCode).single(),
    ]);

    if (!source.data) throw new Error(`Procedencia ${sourceCode} no existe`);
    if (!group.data) throw new Error(`Grupo ${groupCode} no existe`);
    if (!assetClass.data) throw new Error(`Clase ${classCode} no existe`);
    if (!char.data) throw new Error(`Característica ${charCode} no existe`);

    return {
      location_id: location.data.id,
      work_area_id: workArea.data.id,
      source_id: source.data.id,
      group_id: group.data.id,
      class_id: assetClass.data.id,
      characteristic_id: char.data.id,
      sequence_number: sequence,
    };
  }

  async function handleConfirmImport() {
    setLoading(true);
    setError(null);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      const validRows = previewData.filter(row => !row.error);

      for (const row of validRows) {
        try {
          if (mode === 'with-code') {
            await insertAssetWithCode(row);
          } else {
            await insertAssetWithoutCode(row);
          }
          result.success++;
        } catch (err: any) {
          result.failed++;
          result.errors.push({
            row: row.rowNumber,
            message: err.message,
          });
        }
      }

      setImportResult(result);
      setShowPreview(false);
      setSuccess(`Importación completada: ${result.success} exitosos, ${result.failed} fallidos`);

    } catch (err: any) {
      setError(err.message || 'Error durante la importación');
    } finally {
      setLoading(false);
    }
  }

  async function insertAssetWithCode(row: ImportRow) {
    const full_code = row.full_code!;
    
    // Obtener organization_id y IDs del código usando funciones comunes
    const [organizationId, assetIds] = await Promise.all([
      getOrganizationId(),
      getAssetIdsFromCode(full_code),
    ]);

    // Buscar current_program_id si se proporcionó (coincidencia parcial case-insensitive)
    let currentProgramId = null;
    if (row.current_program) {
      const { data: programData } = await inventorySupabase
        .from('programs')
        .select('id')
        .ilike('name', `%${row.current_program}%`)
        .eq('is_active', true)
        .limit(1)
        .single();
      
      currentProgramId = programData?.id || null;
    }

    const { error } = await inventorySupabase.from('assets').insert({
      organization_id: organizationId,
      full_code,
      ...assetIds,
      description: row.description,
      brand: row.brand || null,
      size: row.size || null,
      serial_number: row.serial_number || null,
      model: row.model || null,
      owner: row.owner || null,
      estimated_cost: row.estimated_cost || null,
      status_code: row.status_code || 'available',
      current_program_id: currentProgramId,
      assigned_to_text: row.assigned_to || null,
      is_active: true,
    });

    if (error) throw error;
  }

  async function insertAssetWithoutCode(row: ImportRow) {
    const workArea = workAreas.find(wa => wa.program_id === batchConfig.program_id);
    if (!workArea) throw new Error('No se encontró área de trabajo para el programa seleccionado');
    
    // Obtener organization_id usando función común
    const organizationId = await getOrganizationId();

    const { error } = await inventorySupabase.from('assets').insert({
      organization_id: organizationId,
      full_code: row.generatedCode,
      location_id: workArea.location_id,
      work_area_id: workArea.id,
      source_id: batchConfig.source_id,
      group_id: batchConfig.group_id,
      class_id: batchConfig.class_id,
      characteristic_id: batchConfig.characteristic_id,
      sequence_number: parseInt(row.generatedCode!.substring(12, 16)),
      description: row.description,
      brand: row.brand || null,
      size: row.size || null,
      serial_number: row.serial_number || null,
      model: row.model || null,
      estimated_cost: row.estimated_cost || null,
      status_code: 'available',
      current_program_id: batchConfig.program_id,
      is_active: true,
    });

    if (error) throw error;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/inventory/assets')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <MdArrowBack size={20} />
          Volver al Listado
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Importar Inventario</h1>
        <div className="mt-2 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
          <MdWarning className="mr-2" />
          Ambiente de prueba: {INVENTORY_SUPABASE_CONFIG.projectId}
        </div>
      </div>

      {/* Selector de Modo */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Modo de Importación</h2>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setMode('with-code');
              setPreviewData([]);
              setImportResult(null);
            }}
            className={`flex-1 px-6 py-4 rounded-lg border-2 transition-colors ${
              mode === 'with-code'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold mb-1">Modo A: Con Código</div>
            <div className="text-sm">Activos que ya traen código de 16 dígitos</div>
          </button>
          <button
            onClick={() => {
              setMode('without-code');
              setPreviewData([]);
              setImportResult(null);
            }}
            className={`flex-1 px-6 py-4 rounded-lg border-2 transition-colors ${
              mode === 'without-code'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold mb-1">Modo B: Sin Código</div>
            <div className="text-sm">Lote nuevo - el sistema genera los códigos</div>
          </button>
        </div>
      </div>

      {/* Configuración Modo B */}
      {mode === 'without-code' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuración del Lote</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sede <span className="text-red-500">*</span>
              </label>
              <select
                value={batchConfig.program_id}
                onChange={(e) => setBatchConfig({ ...batchConfig, program_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              >
                <option value="">Seleccionar sede</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Procedencia <span className="text-red-500">*</span>
              </label>
              <select
                value={batchConfig.source_id}
                onChange={(e) => setBatchConfig({ ...batchConfig, source_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              >
                <option value="">Seleccionar procedencia</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grupo de Activo <span className="text-red-500">*</span>
              </label>
              <select
                value={batchConfig.group_id}
                onChange={(e) => setBatchConfig({ ...batchConfig, group_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              >
                <option value="">Seleccionar grupo</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Opciones Avanzadas */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2">
              <MdExpandMore size={20} />
              Opciones avanzadas de clasificación
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clase de Activo</label>
                <select
                  value={batchConfig.class_id}
                  onChange={(e) => setBatchConfig({ ...batchConfig, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Característica</label>
                <select
                  value={batchConfig.characteristic_id}
                  onChange={(e) => setBatchConfig({ ...batchConfig, characteristic_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {characteristics.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.description}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Subir Archivo */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Subir Archivo</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <MdUpload size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            {mode === 'with-code'
              ? 'Sube un archivo CSV/Excel con las columnas: full_code, description, brand, size, serial_number, model, owner, estimated_cost, status_code_or_condition, current_program, assigned_to'
              : 'Sube un archivo CSV/Excel con las columnas: description, brand, size, serial_number, model, estimated_cost'
            }
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || (mode === 'without-code' && (!batchConfig.program_id || !batchConfig.source_id || !batchConfig.group_id))}
            className="px-6 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Procesando...' : 'Seleccionar Archivo'}
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <MdError size={20} className="text-red-600 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
          <MdCheckCircle size={20} className="text-green-600 mt-0.5" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Vista Previa */}
      {showPreview && previewData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Vista Previa</h2>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fila</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((row) => (
                  <tr key={row.rowNumber} className={row.error ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.rowNumber}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {row.full_code || row.generatedCode || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.brand || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.error ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <MdError size={16} />
                          {row.error}
                        </span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1">
                          <MdCheckCircle size={16} />
                          Listo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              Total: {previewData.length} filas | 
              Válidas: {previewData.filter(r => !r.error).length} | 
              Con errores: {previewData.filter(r => r.error).length}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewData([]);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={loading || previewData.filter(r => !r.error).length === 0}
                className="px-6 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] disabled:bg-gray-400"
              >
                {loading ? 'Importando...' : `Confirmar Importación (${previewData.filter(r => !r.error).length} activos)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resultado de Importación */}
      {importResult && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Resultado de Importación</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-1">
                <MdCheckCircle size={20} />
                <span className="font-semibold">Exitosos</span>
              </div>
              <div className="text-3xl font-bold text-green-900">{importResult.success}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 mb-1">
                <MdError size={20} />
                <span className="font-semibold">Fallidos</span>
              </div>
              <div className="text-3xl font-bold text-red-900">{importResult.failed}</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900 mb-2">Errores:</h3>
              <div className="space-y-2">
                {importResult.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-600">
                    Fila {err.row}: {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t">
            <button
              onClick={() => router.push('/dashboard/inventory/assets')}
              className="px-6 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0]"
            >
              Ir al Listado de Activos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
