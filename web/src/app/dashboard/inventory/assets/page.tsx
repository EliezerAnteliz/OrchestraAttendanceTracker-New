'use client';

/**
 * LISTADO DE ACTIVOS DE INVENTARIO
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdFilterList, MdSearch, MdWarning, MdAdd, MdFileDownload } from 'react-icons/md';
import * as XLSX from 'xlsx';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';

// Cliente de Supabase para ambiente de prueba

interface Asset {
  id: string;
  full_code: string | null;
  description: string;
  brand: string | null;
  size: string | null;
  serial_number: string | null;
  model: string | null;
  owner: string | null;
  estimated_cost: number | null;
  status_code: string;
  current_program_id: string | null;
  assigned_to_text: string | null;
  assigned_student_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  asset_status?: {
    description: string;
  } | null;
  asset_groups?: {
    name: string;
  } | null;
  current_program?: {
    name: string;
  } | null;
  assigned_student?: {
    first_name: string;
    last_name: string;
  } | null;
}

// Un activo puede estar asignado a un estudiante real (assigned_student_id,
// enlace verdadero) o a texto libre (assigned_to_text, para no-estudiantes o
// mientras se completa la vinculación) — nunca ambos a la vez. Esta función
// centraliza esa prioridad para no repetirla en cada lugar que muestra
// "a quién está asignado" (tabla, exportación a Excel, etc.).
function getAssignedToDisplay(asset: Asset): string {
  if (asset.assigned_student) {
    return `${asset.assigned_student.first_name} ${asset.assigned_student.last_name}`;
  }
  return asset.assigned_to_text || '';
}

interface AssetLocation {
  id: string;
  code: string;
  name: string;
}

interface AssetGroup {
  id: string;
  code: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
}

// Traduce el estado de un activo a partir de su status_code (catálogo fijo),
// en vez de usar el texto crudo de la base de datos (siempre en español).
// Si el código no es uno de los conocidos, cae de regreso a la descripción original.
const STATUS_LABEL_KEYS: Record<string, string> = {
  available: 'inv_status_available',
  assigned: 'inv_status_assigned',
  repair: 'inv_status_repair',
  on_loan: 'inv_status_on_loan',
  retired: 'inv_filter_status_retired',
};

function getStatusLabel(statusCode: string, description: string | undefined, t: (key: string) => string): string {
  const key = STATUS_LABEL_KEYS[statusCode];
  return key ? t(key) : (description || statusCode);
}

// Un activo se considera "prestado" (no es propiedad de TOSA) si su Owner es
// Stafford (colegio, uso de emergencia) o Academy (préstamo de otra
// institución). CMI se trata como TOSA (mismo ente, nombre institucional
// anterior) — no cuenta como préstamo.
function isLoanedOwner(owner: string | null | undefined): boolean {
  return owner === 'Stafford' || owner === 'Academy';
}

export default function AssetsListPage() {
  const { t } = useI18n();
  const { isAdmin } = useUserRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros — algunos se pueden precargar desde la URL (ej. enlaces del
  // Dashboard como "Ver Disponibles" o "Ver Stafford"), leyendo ?filter=
  // (estado) y ?program= (sede) una sola vez al montar. Antes estos
  // parámetros llegaban en la URL pero se ignoraban por completo.
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('filter') || '');
  const [selectedProgram, setSelectedProgram] = useState<string>(() => searchParams.get('program') || '');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');

  // Valores dinámicos para filtros
  const [instruments, setInstruments] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadCatalogs();
  }, []);

  // Debounce para el searchTerm (espera 300ms después de que el usuario deja de escribir)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadData();
  }, [currentPage, pageSize, debouncedSearchTerm, selectedLocation, selectedGroup, selectedStatus, selectedProgram, selectedInstrument, selectedBrand, selectedSize]);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, selectedLocation, selectedGroup, selectedStatus, selectedProgram, selectedInstrument, selectedBrand, selectedSize]);

  async function loadCatalogs() {
    try {
      // Cargar ubicaciones
      const { data: locationsData, error: locationsError } = await inventorySupabase
        .from('asset_locations')
        .select('id, code, name')
        .eq('is_active', true)
        .order('name');

      if (locationsError) throw locationsError;

      // Cargar grupos
      const { data: groupsData, error: groupsError } = await inventorySupabase
        .from('asset_groups')
        .select('id, code, name')
        .order('name');

      if (groupsError) throw groupsError;

      // Cargar programas
      const { data: programsData, error: programsError } = await inventorySupabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (programsError) throw programsError;

      setLocations(locationsData || []);
      setGroups(groupsData || []);
      setPrograms(programsData || []);

      // Cargar valores dinámicos para filtros (description, brand, size)
      await loadDynamicFilters();
    } catch (err: any) {
      console.error('Error loading catalogs:', err);
    }
  }

  async function loadDynamicFilters() {
    try {
      // Obtener valores únicos de description (instrumentos)
      const { data: instrumentsData } = await inventorySupabase
        .from('assets')
        .select('description')
        .not('description', 'is', null)
        .order('description');

      const uniqueInstruments = [...new Set(instrumentsData?.map(a => a.description).filter(Boolean))] as string[];
      setInstruments(uniqueInstruments);

      // Obtener valores únicos de brand
      const { data: brandsData } = await inventorySupabase
        .from('assets')
        .select('brand')
        .not('brand', 'is', null)
        .order('brand');

      const uniqueBrands = [...new Set(brandsData?.map(a => a.brand).filter(Boolean))] as string[];
      setBrands(uniqueBrands);

      // Obtener valores únicos de size
      const { data: sizesData } = await inventorySupabase
        .from('assets')
        .select('size')
        .not('size', 'is', null)
        .order('size');

      const uniqueSizes = [...new Set(sizesData?.map(a => a.size).filter(Boolean))] as string[];
      setSizes(uniqueSizes);
    } catch (err: any) {
      console.error('Error loading dynamic filters:', err);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Construir query con filtros
      let query = inventorySupabase
        .from('assets')
        .select(`
          id,
          full_code,
          description,
          brand,
          size,
          serial_number,
          model,
          owner,
          estimated_cost,
          status_code,
          current_program_id,
          assigned_to_text,
          assigned_student_id,
          notes,
          created_at,
          is_active,
          group_id,
          asset_status:status_code(description),
          asset_groups:group_id(name),
          asset_sources:source_id(name),
          current_program:current_program_id(name),
          assigned_student:assigned_student_id(first_name, last_name)
        `, { count: 'exact' });

      // Aplicar filtros
      if (selectedStatus) {
        if (selectedStatus === 'active') {
          query = query.eq('is_active', true);
        } else if (selectedStatus === 'inactive') {
          query = query.eq('is_active', false);
        } else {
          query = query.eq('status_code', selectedStatus);
        }
      }

      if (selectedGroup) {
        query = query.eq('group_id', selectedGroup);
      }

      if (selectedProgram) {
        query = query.eq('current_program_id', selectedProgram);
      }

      if (selectedInstrument) {
        query = query.eq('description', selectedInstrument);
      }

      if (selectedBrand) {
        query = query.eq('brand', selectedBrand);
      }

      if (selectedSize) {
        query = query.eq('size', selectedSize);
      }

      // B\u00fasqueda por texto (incluye asignado a)
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        query = query.or(`description.ilike.%${term}%,brand.ilike.%${term}%,full_code.ilike.%${term}%,serial_number.ilike.%${term}%,assigned_to_text.ilike.%${term}%`);
      }

      // Aplicar paginaci\u00f3n
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data: assetsData, error: assetsError, count } = await query;

      if (assetsError) throw assetsError;

      setTotalCount(count || 0);

      // Normalizar los datos de relaciones que vienen como arrays
      const normalizedAssets = (assetsData || []).map(asset => {
        const assetStatusNormalized = Array.isArray(asset.asset_status) ? asset.asset_status[0] : asset.asset_status;
        const assetGroupsNormalized = Array.isArray(asset.asset_groups) ? asset.asset_groups[0] : asset.asset_groups;
        const currentProgramNormalized = Array.isArray(asset.current_program) ? asset.current_program[0] : asset.current_program;
        const assignedStudentNormalized = Array.isArray(asset.assigned_student) ? asset.assigned_student[0] : asset.assigned_student;

        return {
          ...asset,
          asset_status: assetStatusNormalized,
          asset_groups: assetGroupsNormalized,
          current_program: currentProgramNormalized,
          assigned_student: assignedStudentNormalized,
        };
      });

      setAssets(normalizedAssets);

    } catch (err: any) {
      console.error('Error loading assets:', {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code,
        fullError: err
      });
      setError(err.message || err.hint || 'Error al cargar los activos');
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSearchTerm('');
    setSelectedLocation('');
    setSelectedGroup('');
    setSelectedStatus('');
    setSelectedProgram('');
    setSelectedInstrument('');
    setSelectedBrand('');
    setSelectedSize('');
  }

  function exportToExcel() {
    // Preparar datos para exportación
    const dataToExport = assets.map((asset: Asset) => ({
      'Código': asset.full_code || '',
      'Descripción': asset.description || '',
      'Marca': asset.brand || '',
      'Modelo': asset.model || '',
      'Serial': asset.serial_number || '',
      'Tamaño': asset.size || '',
      'Procedencia': (asset as any).asset_sources?.name || '',
      'Estado': asset.asset_status?.description || '',
      'Asignado a': getAssignedToDisplay(asset),
      'Programa': asset.current_program?.name || '',
      'Owner': asset.owner || '',
      'Costo Estimado': asset.estimated_cost || '',
      'Observations': asset.notes || '',
    }));

    // Crear libro de Excel
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activos');

    // Ajustar ancho de columnas
    const columnWidths = [
      { wch: 18 }, // Código
      { wch: 30 }, // Descripción
      { wch: 15 }, // Marca
      { wch: 15 }, // Modelo
      { wch: 18 }, // Serial
      { wch: 10 }, // Tamaño
      { wch: 18 }, // Procedencia
      { wch: 15 }, // Estado
      { wch: 20 }, // Asignado a
      { wch: 20 }, // Programa
      { wch: 15 }, // Owner
      { wch: 12 }, // Costo
      { wch: 30 }, // Observations
    ];
    worksheet['!cols'] = columnWidths;

    // Descargar archivo
    const fileName = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  // No desmontar el componente completo cuando está cargando
  // Solo mostrar indicador sobre la tabla

  // Formatear timestamp ISO a fecha legible
  const formatTimestamp = (text: string) => {
    const timestampRegex = /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/g;
    return text.replace(timestampRegex, (match, isoDate) => {
      const date = new Date(isoDate);
      const formatted = date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `[${formatted}]`;
    });
  };

  return (
    <div className="p-4 lg:p-6 w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('inv_assets_list_title')}</h1>
            <p className="text-gray-600 mt-1">
              {t('inv_assets_list_subtitle')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title={t('inv_export_excel_title')}
            >
              <MdFileDownload size={20} />
              {t('inv_export_excel_button')}
            </button>
            {isAdmin && (
              <button
                onClick={() => router.push('/dashboard/inventory/assets/new')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors"
              >
                <MdAdd size={20} />
                {t('inv_new_asset_button')}
              </button>
            )}
          </div>
        </div>
        {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
          <div className="mt-2 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
            <MdWarning className="mr-2" />
            {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MdFilterList className="text-gray-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">{t('inv_filters_header')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          {/* Search */}
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('inv_search_placeholder_assets')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="" className="text-gray-500">{t('inv_filter_all_statuses')}</option>
            <option value="available">{t('inv_filter_status_available')}</option>
            <option value="assigned">{t('inv_filter_status_assigned')}</option>
            <option value="repair">{t('inv_filter_status_repair')}</option>
            <option value="retired">{t('inv_filter_status_retired')}</option>
            <option value="on_loan">{t('inv_filter_status_on_loan')}</option>
          </select>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="" className="text-gray-500">{t('inv_filter_all_categories')}</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          {/* Program/Sede Filter */}
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="" className="text-gray-500">{t('inv_filter_all_sites')}</option>
            {programs.map(program => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>

          {/* Instrument Filter */}
          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="" className="text-gray-500">{t('inv_filter_all_instruments')}</option>
            {instruments.map(instrument => (
              <option key={instrument} value={instrument}>{instrument}</option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="" className="text-gray-500">{t('inv_filter_all_brands')}</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          {/* Size Filter */}
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="" className="text-gray-500">{t('inv_filter_all_sizes')}</option>
            {sizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t('inv_clear_filters')}
          </button>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          {t('inv_showing_range_assets', { from: ((currentPage - 1) * pageSize) + 1, to: Math.min(currentPage * pageSize, totalCount), total: totalCount })}
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Controles de Paginación - Superior */}
        <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-700">
              {t('inv_showing_range_short', { from: assets.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0, to: Math.min(currentPage * pageSize, totalCount), total: totalCount })}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value={25}>{t('inv_per_page_option', { n: 25 })}</option>
              <option value={50}>{t('inv_per_page_option', { n: 50 })}</option>
              <option value={100}>{t('inv_per_page_option', { n: 100 })}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('inv_previous')}
            </button>
            <span className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
              {t('inv_page_of', { current: currentPage, total: Math.ceil(totalCount / pageSize) || 1 })}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('inv_next')}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{t('inv_error_prefix', { msg: error })}</p>
            <button
              onClick={loadData}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              {t('inv_retry')}
            </button>
          </div>
        )}

        <div className="overflow-x-auto relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
                <p className="mt-4 text-gray-600">{t('inv_loading_assets')}</p>
              </div>
            </div>
          )}
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '150px'}}>
                  {t('inv_code_column')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '200px'}}>
                  {t('inv_description_column')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '160px'}}>
                  {t('inv_col_brand_model')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '80px'}}>
                  {t('inv_col_size')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '120px'}}>
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '140px'}}>
                  {t('inv_assigned_to')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '120px'}}>
                  {t('inv_col_program')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '100px'}}>
                  {t('inv_col_est_cost')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{minWidth: '250px'}}>
                  {t('inv_col_observations')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || selectedStatus || selectedGroup || selectedProgram
                      ? t('inv_no_assets_filtered')
                      : t('inv_no_assets_registered_yet')}
                  </td>
                </tr>
              ) : (
                assets.map((asset: Asset) => (
                  <tr 
                    key={asset.id} 
                    onClick={() => router.push(`/dashboard/inventory/assets/${asset.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                      {asset.full_code || <span className="text-gray-400">{t('inv_no_code')}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {asset.description}
                        {isLoanedOwner(asset.owner) && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800 whitespace-nowrap">
                            {t('inv_loaned_badge', { owner: asset.owner })}
                          </span>
                        )}
                      </div>
                      {asset.serial_number && (
                        <div className="text-xs text-gray-500">S/N: {asset.serial_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{asset.brand || 'N/A'}</div>
                      {asset.model && <div className="text-xs text-gray-500">{asset.model}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                      {asset.size || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        asset.status_code === 'available' ? 'bg-green-100 text-green-800' :
                        asset.status_code === 'assigned' ? 'bg-purple-100 text-purple-800' :
                        asset.status_code === 'repair' ? 'bg-orange-100 text-orange-800' :
                        asset.status_code === 'retired' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(asset.status_code, asset.asset_status?.description, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getAssignedToDisplay(asset) || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {asset.current_program?.name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                      {asset.estimated_cost ? `$${asset.estimated_cost.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {asset.notes ? (
                        <div 
                          className="line-clamp-2" 
                          title={asset.notes}
                        >
                          {formatTimestamp(asset.notes)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginación */}
        <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-700">
              {t('inv_showing_range_short', { from: assets.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0, to: Math.min(currentPage * pageSize, totalCount), total: totalCount })}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value={25}>{t('inv_per_page_option', { n: 25 })}</option>
              <option value={50}>{t('inv_per_page_option', { n: 50 })}</option>
              <option value={100}>{t('inv_per_page_option', { n: 100 })}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('inv_previous')}
            </button>
            <span className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
              {t('inv_page_of', { current: currentPage, total: Math.ceil(totalCount / pageSize) || 1 })}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('inv_next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
