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
import { MdFilterList, MdSearch, MdWarning, MdFileDownload, MdAdd, MdExpandMore, MdExpandLess } from 'react-icons/md';
import * as XLSX from 'xlsx';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useInventoryHeaderActions } from '../InventoryHeaderActions';

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
  follow_up_note: string | null;
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
  investigating: 'inv_status_investigating',
  lost: 'inv_status_lost',
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
  // En mobile los 6 selects + "Limpiar filtros" ocupaban toda la pantalla
  // apilados (grid-cols-1) y tapaban los resultados — quedan colapsados
  // detrás de este toggle, con la búsqueda siempre visible arriba. En
  // sm+ siempre se muestran todos (ver className condicional abajo).
  const [showMoreFilters, setShowMoreFilters] = useState(false);

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
      // Las 6 consultas de catálogo (ubicaciones, grupos, programas, y los
      // 3 valores dinámicos de filtro: instrumento/marca/tamaño) son
      // independientes entre sí — antes se pedían 6 veces, una tras otra
      // (loadDynamicFilters se esperaba al final de loadCatalogs); ahora
      // van todas en paralelo.
      const [
        { data: locationsData, error: locationsError },
        { data: groupsData, error: groupsError },
        { data: programsData, error: programsError },
        { data: instrumentsData },
        { data: brandsData },
        { data: sizesData },
      ] = await Promise.all([
        inventorySupabase
          .from('asset_locations')
          .select('id, code, name')
          .eq('is_active', true)
          .order('name'),
        inventorySupabase
          .from('asset_groups')
          .select('id, code, name')
          .order('name'),
        inventorySupabase
          .from('programs')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        inventorySupabase
          .from('assets')
          .select('description')
          .not('description', 'is', null)
          .order('description'),
        inventorySupabase
          .from('assets')
          .select('brand')
          .not('brand', 'is', null)
          .order('brand'),
        inventorySupabase
          .from('assets')
          .select('size')
          .not('size', 'is', null)
          .order('size'),
      ]);

      if (locationsError) throw locationsError;
      if (groupsError) throw groupsError;
      if (programsError) throw programsError;

      setLocations(locationsData || []);
      setGroups(groupsData || []);
      setPrograms(programsData || []);

      const uniqueInstruments = [...new Set(instrumentsData?.map(a => a.description).filter(Boolean))] as string[];
      setInstruments(uniqueInstruments);

      const uniqueBrands = [...new Set(brandsData?.map(a => a.brand).filter(Boolean))] as string[];
      setBrands(uniqueBrands);

      const uniqueSizes = [...new Set(sizesData?.map(a => a.size).filter(Boolean))] as string[];
      setSizes(uniqueSizes);
    } catch (err: any) {
      console.error('Error loading catalogs:', err);
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
          follow_up_note,
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

      // Aplicar paginaci\u00f3n \u2014 orden por propietario primero (pedido de
      // Eliezer 19/08): TOSA/CMI (propio) arriba, luego Academy, y Stafford
      // al final, usando la columna generada owner_sort_rank (1/2/3) en vez
      // de orden alfab\u00e9tico de "owner" (que dejar\u00eda Academy antes que
      // TOSA/CMI, y Stafford en medio). created_at sigue como desempate
      // dentro de cada grupo de propietario, igual que antes.
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query
        .range(from, to)
        .order('owner_sort_rank', { ascending: true })
        .order('created_at', { ascending: false });

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

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Acciones en el encabezado compartido del módulo (junto al selector de
  // rol): exportar el listado filtrado a Excel (cualquier rol con acceso a
  // esta pestaña), y "Nuevo activo" solo Admin.
  useInventoryHeaderActions(
    <>
      <button
        onClick={exportToExcel}
        className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
        title={t('inv_export_excel_title')}
      >
        <MdFileDownload size={18} />
        {t('inv_export_excel_button')}
      </button>
      {isAdmin && (
        <button
          onClick={() => router.push('/dashboard/inventory/assets/new')}
          className="flex items-center justify-center gap-2 bg-[#C2492B] text-[#FAF7F2] rounded-lg px-[18px] py-2.5 font-medium hover:bg-[#A83A20] transition-colors whitespace-nowrap"
        >
          <MdAdd size={18} />
          {t('inv_new_asset_button')}
        </button>
      )}
    </>
  );

  return (
    <div>
      {/* Título "Inventory", sede, "Exportar a Excel" y "Nuevo activo" ya
          viven en el encabezado compartido de layout.tsx (ver
          useInventoryHeaderActions más arriba); aquí solo va lo específico
          del Listado. */}
      {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
        <div className="inline-flex items-center px-3 py-1 bg-[#F6EFDF] border border-[#E3D3A8] rounded-lg text-[12.5px] text-[#8A6A22]">
          <MdWarning className="mr-2" size={14} />
          {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl px-5 py-[18px] mt-6">
        <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_filters_header')}</div>

        {/* Búsqueda — siempre visible, es lo que más se usa (ver caso de uso
            "buscar violín y no encontrarlo entre 7 filtros apilados" en
            mobile). El resto de los filtros van colapsados debajo en mobile. */}
        <div className="relative mt-3.5">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A29889]" size={18} />
          <input
            type="text"
            placeholder={t('inv_search_placeholder_assets')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
          />
        </div>

        {/* Toggle solo en mobile — en sm+ el resto de filtros ya se ve
            siempre, este botón queda oculto. */}
        <button
          type="button"
          onClick={() => setShowMoreFilters(!showMoreFilters)}
          className="sm:hidden mt-2.5 flex items-center gap-1.5 text-[13px] text-[#6E675E] font-medium"
        >
          <MdFilterList size={16} />
          {t('inv_more_filters')}
          {[selectedStatus, selectedGroup, selectedProgram, selectedInstrument, selectedBrand, selectedSize].filter(Boolean).length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#C2492B] text-white text-[10px]">
              {[selectedStatus, selectedGroup, selectedProgram, selectedInstrument, selectedBrand, selectedSize].filter(Boolean).length}
            </span>
          )}
          {showMoreFilters ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
        </button>

        <div className={`${showMoreFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3.5`}>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917]"
          >
            <option value="">{t('inv_filter_all_statuses')}</option>
            <option value="available">{t('inv_filter_status_available')}</option>
            <option value="assigned">{t('inv_filter_status_assigned')}</option>
            <option value="repair">{t('inv_filter_status_repair')}</option>
            <option value="retired">{t('inv_filter_status_retired')}</option>
            <option value="on_loan">{t('inv_filter_status_on_loan')}</option>
            <option value="investigating">{t('inv_filter_status_investigating')}</option>
            <option value="lost">{t('inv_filter_status_lost')}</option>
          </select>

          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917]"
          >
            <option value="">{t('inv_filter_all_categories')}</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917]"
          >
            <option value="">{t('inv_filter_all_sites')}</option>
            {programs.map(program => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>

          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
            className="appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917]"
          >
            <option value="">{t('inv_filter_all_instruments')}</option>
            {instruments.map(instrument => (
              <option key={instrument} value={instrument}>{instrument}</option>
            ))}
          </select>

          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917]"
          >
            <option value="">{t('inv_filter_all_brands')}</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 text-[#1B1917]"
          >
            <option value="">{t('inv_filter_all_sizes')}</option>
            {sizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>

          <button
            onClick={clearFilters}
            className="px-3.5 py-2.5 text-[#8A8177] hover:text-[#C2492B] transition-colors text-left sm:text-center"
          >
            {t('inv_clear_filters')}
          </button>
        </div>
      </div>

      {/* Paginación */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 text-[13px] text-[#8A8177]">
        <span>
          {t('inv_showing_range_short', { from: assets.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0, to: Math.min(currentPage * pageSize, totalCount), total: totalCount })}
        </span>
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="appearance-none px-3 py-2 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] text-[13px] text-[#56504A] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30"
          >
            <option value={25}>{t('inv_per_page_option', { n: 25 })}</option>
            <option value={50}>{t('inv_per_page_option', { n: 50 })}</option>
            <option value={100}>{t('inv_per_page_option', { n: 100 })}</option>
          </select>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3.5 py-2 border border-[#E3DDD1] rounded-lg text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#E3DDD1] disabled:hover:text-[#56504A] transition-colors"
          >
            {t('inv_previous')}
          </button>
          <span className="text-[#56504A] whitespace-nowrap">
            {t('inv_page_of', { current: currentPage, total: totalPages })}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="px-3.5 py-2 border border-[#DED7C9] rounded-lg text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#DED7C9] disabled:hover:text-[#56504A] transition-colors"
          >
            {t('inv_next')}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 bg-[#F8E9E4] border border-[#EAC7BB] rounded-xl p-4">
          <p className="text-[#8f3421]">{t('inv_error_prefix', { msg: error })}</p>
          <button
            onClick={loadData}
            className="mt-2 px-4 py-2 bg-[#A8402A] text-white rounded-lg hover:bg-[#8f3421] transition-colors text-sm font-medium"
          >
            {t('inv_retry')}
          </button>
        </div>
      )}

      {/* Assets List */}
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl px-[22px] pt-1 pb-2 mt-3.5 overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-[#FAF7F2]/80 flex items-center justify-center z-10 rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
              <p className="mt-4 text-[#8A8177]">{t('inv_loading_assets')}</p>
            </div>
          </div>
        )}

        {assets.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[#A29889]">
            {searchTerm || selectedStatus || selectedGroup || selectedProgram
              ? t('inv_no_assets_filtered')
              : t('inv_no_assets_registered_yet')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[170px_minmax(0,1fr)_150px_70px_140px_150px_130px_100px_220px] min-w-[1400px] gap-4 py-3 border-b border-[#EFE9DD] text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">
              <span>{t('inv_code_column')}</span>
              <span>{t('inv_description_column')}</span>
              <span>{t('inv_col_brand_model')}</span>
              <span>{t('inv_col_size')}</span>
              <span>{t('status')}</span>
              <span>{t('inv_assigned_to')}</span>
              <span>{t('inv_col_program')}</span>
              <span className="text-right">{t('inv_col_est_cost')}</span>
              <span>{t('inv_col_observations')}</span>
            </div>
            {assets.map((asset: Asset) => (
              <div
                key={asset.id}
                onClick={() => router.push(`/dashboard/inventory/assets/${asset.id}`)}
                className="grid grid-cols-[170px_minmax(0,1fr)_150px_70px_140px_150px_130px_100px_220px] min-w-[1400px] gap-4 py-3.5 border-b border-[#F2ECE1] text-[13.5px] items-start cursor-pointer hover:bg-[#FAF7F2] transition-colors"
              >
                <span className="tabular-nums text-[#56504A] pt-0.5">
                  {asset.full_code || <span className="text-[#A29889]">{t('inv_no_code')}</span>}
                </span>
                <div>
                  <div className="font-medium text-[#1B1917] flex items-center gap-2 flex-wrap">
                    {asset.description}
                    {isLoanedOwner(asset.owner) && (
                      <span className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-[#F6EFDF] text-[#8A6A22] whitespace-nowrap">
                        {t('inv_loaned_badge', { owner: asset.owner || '' })}
                      </span>
                    )}
                  </div>
                  {asset.serial_number && (
                    <div className="text-[11.5px] text-[#8A8177] mt-0.5">S/N: {asset.serial_number}</div>
                  )}
                </div>
                <div className="text-[#56504A]">
                  <div>{asset.brand || 'N/A'}</div>
                  {asset.model && <div className="text-[11.5px] text-[#8A8177]">{asset.model}</div>}
                </div>
                <span className="text-[#56504A] pt-0.5">{asset.size || '-'}</span>
                <div className="text-[#56504A] pt-0.5">
                  <div>{getStatusLabel(asset.status_code, asset.asset_status?.description, t)}</div>
                  {(asset.status_code === 'investigating' || asset.status_code === 'lost') && asset.follow_up_note && (
                    <div className="text-[11px] text-[#8A6A22] mt-0.5" title={t('inv_follow_up_note_label')}>{asset.follow_up_note}</div>
                  )}
                </div>
                <span className="text-[#8A8177] pt-0.5">{getAssignedToDisplay(asset) || '-'}</span>
                <span className="text-[#8A8177] pt-0.5">{asset.current_program?.name || '-'}</span>
                <span className="text-[#56504A] tabular-nums text-right pt-0.5">
                  {asset.estimated_cost ? `$${asset.estimated_cost.toFixed(2)}` : '-'}
                </span>
                <div className="text-[#8A8177]">
                  {asset.notes ? (
                    <div className="line-clamp-2" title={asset.notes}>
                      {formatTimestamp(asset.notes)}
                    </div>
                  ) : '-'}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
