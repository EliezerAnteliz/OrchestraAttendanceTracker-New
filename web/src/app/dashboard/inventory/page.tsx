'use client';

/**
 * DASHBOARD DE INVENTARIO
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useEffect, useState } from 'react';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdWarning, MdSwapHoriz, MdArchive, MdAdd } from 'react-icons/md';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useInventoryHeaderActions } from '../layout';

// Cliente de Supabase para ambiente de prueba

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
  const { isAdmin } = useUserRole();

  // Botón "Nuevo activo" en el encabezado compartido del módulo (junto al
  // selector de rol), solo para Admin.
  useInventoryHeaderActions(
    isAdmin ? (
      <Link
        href="/dashboard/inventory/assets/new"
        className="flex items-center justify-center gap-2 bg-[#C2492B] text-[#FAF7F2] rounded-lg px-[18px] py-2.5 font-medium hover:bg-[#A83A20] transition-colors whitespace-nowrap"
      >
        <MdAdd size={18} />
        {t('inv_new_asset_button')}
      </Link>
    ) : null
  );

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
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-[#8A8177]">{t('inv_loading_dashboard')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F8E9E4] border border-[#EAC7BB] rounded-xl p-4">
        <p className="text-[#8f3421]">{error}</p>
        <button
          onClick={loadDashboardData}
          className="mt-3 px-4 py-2 bg-[#A8402A] text-white rounded-lg hover:bg-[#8f3421] transition-colors text-sm font-medium"
        >
          {t('inv_retry')}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Ambiente de prueba — el título "Inventory", el subtítulo con la
          sede, y la acción "Nuevo activo" ya viven en el encabezado
          compartido de layout.tsx (arriba de las pestañas). */}
      {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
        <div className="inline-flex items-center px-3 py-1 bg-[#F6EFDF] border border-[#E3D3A8] rounded-lg text-[12.5px] text-[#8A6A22]">
          <MdWarning className="mr-2" size={14} />
          {t('inv_test_env_with_id', { id: INVENTORY_SUPABASE_CONFIG.projectId })}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 mt-6">
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-[18px]">
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_total_assets')}</div>
          <div className="text-[42px] leading-[1.05] mt-3 text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}>{stats.total}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-[18px]">
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_available_plural')}</div>
          <div className="text-[42px] leading-[1.05] mt-3 text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}>{stats.available}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-[18px]">
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_assigned_plural')}</div>
          <div className="text-[42px] leading-[1.05] mt-3 text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}>{stats.assigned}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-[18px]">
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_in_repair_label')}</div>
          <div className="text-[42px] leading-[1.05] mt-3 text-[#C2492B]" style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}>{stats.repair}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-[18px]">
          <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_on_loan_plural')}</div>
          <div className="text-[42px] leading-[1.05] mt-3 text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}>{stats.onLoan}</div>
        </div>
      </div>

      {/* Dados de baja — no se cuentan en las tarjetas de arriba (son
          inventario activo); se deja un indicador discreto en vez de
          otra tarjeta grande, ya que no es un estado "en uso". */}
      <div className="mt-3">
        {stats.retired > 0 && (
          <Link
            href="/dashboard/inventory/assets?filter=retired"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[#8A8177] hover:text-[#C2492B] transition-colors"
          >
            <MdArchive size={14} />
            {t('inv_retired_count', { n: stats.retired, suffix: stats.retired === 1 ? '' : 's' })}
          </Link>
        )}
      </div>

      {/* Prestados (Stafford/Academy) — no son propiedad de TOSA, se
          excluyen del "Total de Activos" de arriba y se muestran aparte,
          igual que "dados de baja". */}
      <div className="mt-1">
        {stats.loaned > 0 && (
          <p className="inline-flex items-center gap-1.5 text-[12.5px] text-[#A29889]">
            <MdSwapHoriz size={14} />
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
          las de resumen de arriba, y escale bien si se agregan más sedes
          (grid en vez de columnas de tabla que se quedan vacías con pocas
          filas). */}
      <div className="mt-7">
        <h2 className="text-[11.5px] uppercase tracking-[0.09em] font-medium text-[#8A8177] mb-3">{t('inv_by_site')}</h2>
        {stats.byProgram.length === 0 ? (
          <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-8 text-center text-[#8A8177]">
            {t('inv_no_assets_registered_yet')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.byProgram.map((p) => {
              const content = (
                <>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-2xl text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif' }}>{p.programName}</span>
                    <span className="text-[34px] text-[#1B1917] leading-none" style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}>{p.total}</span>
                  </div>
                  <div className="text-[11.5px] uppercase tracking-[0.09em] text-[#A29889] mt-0.5">{t('inv_own_label')}</div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="border border-[#E3DDD1] rounded-full px-[11px] py-[5px] text-[12.5px] text-[#56504A]">
                      {p.available} {t('inv_available_plural')}
                    </span>
                    <span className="border border-[#E3DDD1] rounded-full px-[11px] py-[5px] text-[12.5px] text-[#56504A]">
                      {p.assigned} {t('inv_assigned_plural')}
                    </span>
                    <span className="border border-[#E3DDD1] rounded-full px-[11px] py-[5px] text-[12.5px] text-[#56504A]">
                      {p.repair} {t('inv_repair_label')}
                    </span>
                    {p.onLoan > 0 && (
                      <span className="border border-[#E3DDD1] rounded-full px-[11px] py-[5px] text-[12.5px] text-[#56504A]">
                        {p.onLoan} {t('inv_on_loan_plural')}
                      </span>
                    )}
                  </div>
                  {p.operational > p.total && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 border border-[#E3DDD1] rounded-full px-[11px] py-[5px] text-[12.5px] text-[#56504A]">
                        <MdSwapHoriz size={13} />
                        {t('inv_operational_breakdown', { total: p.total, academy: p.academy, operational: p.operational })}
                      </span>
                    </div>
                  )}
                  {p.programId !== 'none' && (
                    <div className="border-t border-[#EFE9DD] mt-[18px] pt-[14px] text-[12.5px] text-[#8A8177]">
                      {p.lastAuditDate ? (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span>{t('inv_last_audit_colon')} {formatDate(p.lastAuditDate)}</span>
                          {p.lastAuditMissing !== null && p.lastAuditMissing > 0 && (
                            <span className="text-[#A8402A] whitespace-nowrap">
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
                  className="bg-[#FFFDFA] border border-dashed border-[#DED7C9] rounded-xl px-5 py-[18px] opacity-70"
                >
                  {content}
                </div>
              ) : (
                <Link
                  key={p.programId}
                  href={`/dashboard/inventory/assets?program=${p.programId}`}
                  className="block bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl px-5 py-[18px] hover:border-[#C2492B]/40 transition-colors"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Assets */}
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl px-[22px] pt-5 pb-2 mt-[18px] overflow-x-auto">
        <div className="flex items-baseline justify-between gap-5">
          <h2 className="text-[14.5px] font-medium text-[#1B1917]">{t('inv_latest_assets_registered')}</h2>
          <Link
            href="/dashboard/inventory/assets"
            className="text-[13px] text-[#C2492B] hover:text-[#A83A20] font-medium whitespace-nowrap"
          >
            {t('inv_view_all_arrow')}
          </Link>
        </div>

        {stats.recentAssets.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[#A29889]">{t('inv_no_assets_registered_yet')}</p>
        ) : (
          <>
            <div className="grid grid-cols-[200px_minmax(0,1fr)_150px_170px_120px] min-w-[900px] gap-4 py-3 mt-2.5 border-b border-[#EFE9DD] text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">
              <span>{t('inv_code_column')}</span>
              <span>{t('inv_description_column')}</span>
              <span>{t('inv_brand_size_column')}</span>
              <span>{t('status')}</span>
              <span>{t('inv_assigned_to')}</span>
            </div>
            {stats.recentAssets.map((asset) => (
              <div key={asset.id} className="grid grid-cols-[200px_minmax(0,1fr)_150px_170px_120px] min-w-[900px] gap-4 py-3.5 border-b border-[#F2ECE1] text-[13.5px] items-center">
                <span className="tabular-nums text-[#56504A]">{asset.full_code || t('inv_no_code')}</span>
                <span className="text-[#1B1917] truncate">{asset.description}</span>
                <span className="text-[#56504A] truncate">{asset.brand || 'N/A'} {asset.size && `- ${asset.size}`}</span>
                <span className="text-[#56504A]">{getStatusLabel(asset.status_code, asset.asset_status?.description, t)}</span>
                <span className="text-[#8A8177] truncate">{asset.assigned_to_text || '-'}</span>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  );
}
