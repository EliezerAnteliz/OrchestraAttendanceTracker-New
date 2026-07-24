'use client';

/**
 * DASHBOARD DE INVENTARIO
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../supabase.inventory.config';
import { MdInventory, MdCheckCircle, MdBuild, MdWarning, MdTrendingUp, MdSwapHoriz, MdArchive } from 'react-icons/md';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

// Cliente de Supabase para ambiente de prueba
const inventorySupabase = createClient(
  INVENTORY_SUPABASE_CONFIG.url,
  INVENTORY_SUPABASE_CONFIG.anonKey
);

interface DashboardStats {
  total: number;
  available: number;
  assigned: number;
  repair: number;
  onLoan: number;
  retired: number;
  // Activos con Owner = Stafford o Academy — no son propiedad de TOSA, se
  // cuentan aparte y no se incluyen en `total` ni en el desglose por sede.
  loaned: number;
  // Desglose de `loaned` por tipo de dueño, para poder mostrar la suma
  // (staffordCount + academyCount = loaned) y que sea verificable a simple vista.
  staffordCount: number;
  academyCount: number;
  recentAssets: Asset[];
  byProgram: ProgramStats[];
}

interface ProgramStats {
  programId: string;
  programName: string;
  total: number;
  // Total "a disposición operativa" de la sede: propios (TOSA/CMI) + Academy
  // (prestados pero en uso activo) — excluye solo Stafford. Mismo alcance
  // que usa la Auditoría para su "total esperado". Puede ser mayor que
  // `total` cuando la sede tiene instrumentos de Academy en uso.
  operational: number;
  // Cuántos de esos son específicamente de Academy (subconjunto de
  // `operational`, para poder mostrar la suma: total + academy = operational).
  academy: number;
  available: number;
  assigned: number;
  repair: number;
  onLoan: number;
  lastAuditDate: string | null;
  lastAuditSessionId: string | null;
  lastAuditMissing: number | null;
}

interface Asset {
  id: string;
  full_code: string | null;
  description: string;
  brand: string | null;
  size: string | null;
  status_code: string;
  assigned_to_text: string | null;
  created_at: string;
  asset_status?: {
    description: string;
  };
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
// anterior) — no cuenta como préstamo. El Dashboard excluye estos activos
// del "Total de Activos" y del desglose por sede; solo se muestran en un
// contador aparte.
function isLoanedOwner(owner: string | null | undefined): boolean {
  return owner === 'Stafford' || owner === 'Academy';
}

export default function InventoryDashboard() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    available: 0,
    assigned: 0,
    repair: 0,
    onLoan: 0,
    retired: 0,
    loaned: 0,
    staffordCount: 0,
    academyCount: 0,
    recentAssets: [],
    byProgram: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError(null);

      // Obtener estadísticas (incluye sede actual para el desglose por sede,
      // y owner para poder separar los activos prestados de Stafford/Academy)
      const { data: allActiveAssets, error: assetsError } = await inventorySupabase
        .from('assets')
        .select('id, status_code, full_code, description, brand, size, assigned_to_text, created_at, current_program_id, owner, current_program:current_program_id(name)')
        .eq('is_active', true);

      if (assetsError) throw assetsError;

      // Los activos prestados (Stafford/Academy) no son propiedad de TOSA —
      // se excluyen del "Total de Activos" y del desglose por sede, y se
      // cuentan aparte en `loaned`.
      const assets = (allActiveAssets || []).filter(a => !isLoanedOwner((a as any).owner));
      const loaned = (allActiveAssets?.length || 0) - assets.length;
      // Desglose del total `loaned` por tipo de dueño (global, todas las
      // sedes), para poder mostrar la suma igual que en las tarjetas por sede.
      const staffordCount = (allActiveAssets || []).filter((a: any) => a.owner === 'Stafford').length;
      const academyCount = (allActiveAssets || []).filter((a: any) => a.owner === 'Academy').length;

      // Calcular estadísticas
      const total = assets?.length || 0;
      const available = assets?.filter(a => a.status_code === 'available').length || 0;
      const assigned = assets?.filter(a => a.status_code === 'assigned').length || 0;
      const repair = assets?.filter(a => a.status_code === 'repair').length || 0;
      const onLoan = assets?.filter(a => a.status_code === 'on_loan').length || 0;

      // Dados de baja: quedan fuera del conteo activo de arriba (is_active=false),
      // así que se cuentan aparte con una consulta liviana (solo el total, sin traer filas).
      const { count: retiredCount, error: retiredError } = await inventorySupabase
        .from('assets')
        .select('id', { count: 'exact', head: true })
        .eq('status_code', 'retired');

      if (retiredError) throw retiredError;
      const retired = retiredCount || 0;

      // Desglose por sede — el total global no dice mucho en una app
      // pensada para auditar sede por sede; se agrupa cada activo por
      // `current_program_id` (dónde está físicamente hoy, no el código
      // de compra) y se cuentan los mismos 3 estados por sede. Se recorre
      // TODA la lista activa (`allActiveAssets`, no la ya filtrada `assets`)
      // para que una sede que solo tenga instrumentos de Academy en uso
      // (sin ninguno propio) también aparezca en el desglose — antes se
      // habría quedado invisible si solo se recorrían los propios.
      const programMap: Record<string, ProgramStats> = {};
      (allActiveAssets || []).forEach((a: any) => {
        const programNameRaw = Array.isArray(a.current_program) ? a.current_program[0]?.name : a.current_program?.name;
        const key = a.current_program_id || 'none';
        const name = programNameRaw || t('inv_unknown_site_assigned');
        if (!programMap[key]) {
          programMap[key] = {
            programId: key, programName: name, total: 0, operational: 0, academy: 0, available: 0, assigned: 0, repair: 0, onLoan: 0,
            lastAuditDate: null, lastAuditSessionId: null, lastAuditMissing: null
          };
        }
        const isStafford = a.owner === 'Stafford';
        const isPropio = !isLoanedOwner(a.owner); // excluye Stafford Y Academy

        // "operational": a disposición real (propios + Academy) — todo
        // menos Stafford, mismo alcance que usa la Auditoría.
        if (!isStafford) programMap[key].operational += 1;
        if (a.owner === 'Academy') programMap[key].academy += 1;

        // "total" y el desglose por estado: solo activos propios (TOSA/CMI),
        // igual que en las tarjetas de resumen de arriba.
        if (isPropio) {
          programMap[key].total += 1;
          if (a.status_code === 'available') programMap[key].available += 1;
          if (a.status_code === 'assigned') programMap[key].assigned += 1;
          if (a.status_code === 'repair') programMap[key].repair += 1;
          if (a.status_code === 'on_loan') programMap[key].onLoan += 1;
        }
      });
      const byProgram = Object.values(programMap).sort((a, b) => {
        if (a.programId === 'none') return 1;
        if (b.programId === 'none') return -1;
        return a.programName.localeCompare(b.programName);
      });

      // Última auditoría cerrada por sede — conecta el Dashboard con el
      // módulo de Auditoría (antes no había ninguna relación entre ambos).
      // "Faltantes" aquí es una aproximación rápida para el Dashboard
      // (activos activos de la sede menos los auditados como found/mismatch
      // en esa sesión); el conteo exacto y detallado sigue siendo el
      // Reporte de Auditoría, al que este indicador enlaza directo.
      const { data: closedSessions, error: sessionsError } = await inventorySupabase
        .from('audit_sessions')
        .select('id, program_id, ended_at')
        .eq('status', 'closed')
        .order('ended_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const latestSessionByProgram: Record<string, { id: string; ended_at: string }> = {};
      (closedSessions || []).forEach((s: any) => {
        if (!latestSessionByProgram[s.program_id]) {
          latestSessionByProgram[s.program_id] = { id: s.id, ended_at: s.ended_at };
        }
      });

      await Promise.all(
        Object.entries(latestSessionByProgram).map(async ([programId, lastSession]) => {
          const stat = programMap[programId];
          if (!stat) return; // sede sin activos activos hoy, no aplica

          const { count: auditedCount, error: auditedError } = await inventorySupabase
            .from('audit_events')
            .select('id', { count: 'exact', head: true })
            .eq('audit_session_id', lastSession.id)
            .in('result', ['found', 'mismatch_site']);

          if (auditedError) throw auditedError;

          stat.lastAuditDate = lastSession.ended_at;
          stat.lastAuditSessionId = lastSession.id;
          // Se compara contra `operational` (propios + Academy, excluye solo
          // Stafford) y no contra `total` (solo propios) — ese es el mismo
          // universo que usa la Auditoría real para calcular "faltantes",
          // así que esta aproximación del Dashboard queda alineada con el
          // número que de verdad va a mostrar el Reporte de Auditoría.
          stat.lastAuditMissing = Math.max(0, stat.operational - (auditedCount || 0));
        })
      );

      // Obtener últimos 5 activos registrados
      const { data: recent, error: recentError } = await inventorySupabase
        .from('assets')
        .select(`
          id,
          full_code,
          description,
          brand,
          size,
          status_code,
          assigned_to_text,
          created_at,
          asset_status:status_code(description)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      setStats({
        total,
        available,
        assigned,
        repair,
        onLoan,
        retired,
        loaned,
        staffordCount,
        academyCount,
        recentAssets: recent || [],
        byProgram
      });

    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || t('inv_error_loading_dashboard'));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('inv_loading_dashboard')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ Error: {error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {t('inv_retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MdInventory className="text-[#0073ea]" />
          {t('inv_dashboard_title')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('inv_dashboard_subtitle')}
        </p>
        {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
          <div className="mt-2 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
            <MdWarning className="mr-2" />
            {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-3">
        {/* Total Assets */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{t('inv_total_assets')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <MdInventory className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        {/* Available */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{t('inv_available_plural')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.available}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <MdCheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{t('inv_assigned_plural')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.assigned}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <MdTrendingUp className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* In Repair */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{t('inv_in_repair_label')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.repair}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <MdBuild className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        {/* On Loan */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{t('inv_on_loan_plural')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.onLoan}</p>
            </div>
            <div className="bg-teal-100 p-3 rounded-full">
              <MdSwapHoriz className="text-teal-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Dados de baja — no se cuentan en las tarjetas de arriba (son
          inventario activo); se deja un indicador discreto en vez de
          otra tarjeta grande, ya que no es un estado "en uso". */}
      <div className="mb-1">
        {stats.retired > 0 && (
          <Link
            href="/dashboard/inventory/assets?filter=retired"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <MdArchive size={16} />
            {t('inv_retired_count', { n: stats.retired, suffix: stats.retired === 1 ? '' : 's' })}
          </Link>
        )}
      </div>

      {/* Prestados (Stafford/Academy) — no son propiedad de TOSA, se
          excluyen del "Total de Activos" de arriba y se muestran aparte,
          igual que "dados de baja". */}
      <div className="mb-8">
        {stats.loaned > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm text-gray-500">
            <MdSwapHoriz size={16} />
            {t('inv_loaned_footnote_breakdown', {
              stafford: stats.staffordCount,
              academy: stats.academyCount,
              n: stats.loaned,
              suffix: stats.loaned === 1 ? '' : 's'
            })}
          </p>
        )}
      </div>

      {/* Por Sede — el total global no dice mucho en una app pensada
          para auditar sede por sede; aquí se ve de un vistazo cómo está
          cada una. Tarjetas (no tabla) para que combine visualmente con
          las 4 tarjetas de resumen de arriba, y escale bien si se agregan
          más sedes (grid en vez de columnas de tabla que se quedan vacías
          con pocas filas). */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('inv_by_site')}</h2>
        {stats.byProgram.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            {t('inv_no_assets_registered_yet')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.byProgram.map((p) => {
              const content = (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{p.programName}</h3>
                    <div className="text-right leading-none">
                      <span className="text-2xl font-bold text-gray-900">{p.total}</span>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">{t('inv_own_label')}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {p.available} {t('inv_available_plural')}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                      {p.assigned} {t('inv_assigned_plural')}
                    </span>
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                      {p.repair} {t('inv_repair_label')}
                    </span>
                    {p.onLoan > 0 && (
                      <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                        {p.onLoan} {t('inv_on_loan_plural')}
                      </span>
                    )}
                  </div>
                  {p.operational > p.total && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                        <MdSwapHoriz size={13} />
                        {t('inv_operational_breakdown', { total: p.total, academy: p.academy, operational: p.operational })}
                      </span>
                    </div>
                  )}
                  {p.programId !== 'none' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      {p.lastAuditDate ? (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span>{t('inv_last_audit_colon')} {formatDate(p.lastAuditDate)}</span>
                          {p.lastAuditMissing !== null && p.lastAuditMissing > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium whitespace-nowrap">
                              {t('inv_missing_of_expected', { missing: p.lastAuditMissing, total: p.operational, suffix: p.lastAuditMissing === 1 ? '' : 's' })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic">{t('inv_no_closed_audits')}</span>
                      )}
                    </div>
                  )}
                </>
              );

              return p.programId === 'none' ? (
                <div
                  key={p.programId}
                  className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-dashed border-gray-300 opacity-75"
                >
                  {content}
                </div>
              ) : (
                <Link
                  key={p.programId}
                  href={`/dashboard/inventory/assets?program=${p.programId}`}
                  className="block bg-white rounded-lg shadow-md p-5 border-l-4 border-blue-500 hover:shadow-lg transition-shadow"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Assets Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('inv_latest_assets_registered')}</h2>
          <Link
            href="/dashboard/inventory/assets"
            className="text-sm text-[#0073ea] hover:text-[#0060c0] font-medium"
          >
            {t('inv_view_all_arrow')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv_code_column')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv_description_column')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv_brand_size_column')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv_assigned_to')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {t('inv_no_assets_registered_yet')}
                  </td>
                </tr>
              ) : (
                stats.recentAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {asset.full_code || t('inv_no_code')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {asset.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {asset.brand || 'N/A'} {asset.size && `- ${asset.size}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        asset.status_code === 'available' ? 'bg-green-100 text-green-800' :
                        asset.status_code === 'assigned' ? 'bg-purple-100 text-purple-800' :
                        asset.status_code === 'repair' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusLabel(asset.status_code, asset.asset_status?.description, t)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {asset.assigned_to_text || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
