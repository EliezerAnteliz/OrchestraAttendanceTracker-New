'use client';

/**
 * REPORTE FINAL DE AUDITORÍA
 * Muestra encontrados, faltantes, mismatch, unknown
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdArrowBack, MdCheckCircle, MdWarning, MdError, MdRemoveCircle } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';


interface AuditSession {
  id: string;
  program_id: string;
  started_at: string;
  ended_at: string | null;
  programs?: { name: string }[];
}

interface ReportData {
  found: any[];
  mismatch: any[];
  unknown: any[];
  missing: any[];
}

// Supabase/PostgREST devuelve máximo 1000 filas por consulta si no se pagina
// explícitamente con .range() — el mismo bug que ya se corrigió en el
// reporte Anual de Asistencia. Sin esto, una sesión de auditoría con más de
// 1000 eventos mostraría conteos de encontrados/faltantes/mismatch
// incompletos en el reporte final, de forma silenciosa.
const AUDIT_EVENTS_PAGE_SIZE = 1000;
async function fetchAllAuditEvents(sessionId: string) {
  const all: any[] = [];
  let from = 0;
  for (let page = 0; page < 200; page++) {
    const to = from + AUDIT_EVENTS_PAGE_SIZE - 1;
    const { data, error } = await inventorySupabase
      .from('audit_events')
      .select(`
        id,
        result,
        source,
        scanned_code,
        assets:asset_id(id, full_code, description, brand, serial_number)
      `)
      .eq('audit_session_id', sessionId)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < AUDIT_EVENTS_PAGE_SIZE) break;
    from += AUDIT_EVENTS_PAGE_SIZE;
  }
  return all;
}

export default function AuditReportPage() {
  const { t, lang } = useI18n();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<AuditSession | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'found' | 'mismatch' | 'unknown' | 'missing'>('found');

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  // Decisión ya tomada: solo Admin audita — si Staff/Viewer llega aquí por
  // URL directa, lo regresamos al Dashboard.
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/dashboard/inventory');
    }
  }, [roleLoading, isAdmin, router]);

  async function loadReport() {
    try {
      setLoading(true);

      // Cargar sesión
      const { data: sessionData, error: sessionError } = await inventorySupabase
        .from('audit_sessions')
        .select('id, program_id, started_at, ended_at, programs:program_id(name)')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Cargar eventos de la sesión (paginado, ver fetchAllAuditEvents)
      const events = await fetchAllAuditEvents(sessionId);

      // Separar por resultado
      const found = events?.filter(e => e.result === 'found') || [];
      const mismatch = events?.filter(e => e.result === 'mismatch_site') || [];
      const unknown = events?.filter(e => e.result === 'unknown_code') || [];

      // Obtener todos los activos de la sede — se excluyen los de Owner =
      // Stafford (uso de emergencia, no se usan activamente y no forman
      // parte de lo que se espera encontrar en la auditoría). Los de
      // Academy sí se incluyen, porque sí están en uso real.
      const { data: allAssets, error: assetsError } = await inventorySupabase
        .from('assets')
        .select('id, full_code, description, brand, serial_number')
        .eq('current_program_id', sessionData.program_id)
        .or('owner.neq.Stafford,owner.is.null');

      if (assetsError) throw assetsError;

      // Calcular faltantes (activos de la sede que no fueron auditados)
      const auditedAssetIds = new Set(
        events
          ?.filter(e => e.assets && (e.result === 'found' || e.result === 'mismatch_site'))
          .map(e => Array.isArray(e.assets) ? e.assets[0]?.id : e.assets?.id)
          .filter(Boolean)
      );

      const missing = allAssets?.filter(asset => !auditedAssetIds.has(asset.id)) || [];

      setReport({ found, mismatch, unknown, missing });
    } catch (err: any) {
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B]"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-[#8A8177]">{t('inv_generating_report')}</p>
        </div>
      </div>
    );
  }

  if (!session || !report) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-[#6E675E]">{t('inv_could_not_load_report')}</p>
          <button
            onClick={() => router.push('/dashboard/inventory/audit')}
            className="mt-4 px-4 py-2 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium"
          >
            {t('inv_go_back')}
          </button>
        </div>
      </div>
    );
  }

  const currentList = report[activeTab];

  return (
    <div className="pb-8">
      {/* Header */}
      <button
        onClick={() => router.push('/dashboard/inventory/audit')}
        className="flex items-center gap-2 text-[13px] text-[#8A8177] hover:text-[#C2492B] transition-colors mb-4"
      >
        <MdArrowBack size={16} />
        {t('inv_go_back')}
      </button>

      <h1
        className="text-[26px] sm:text-[32px] text-[#1B1917] leading-[1.05]"
        style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
      >
        {t('inv_report_title')}
      </h1>
      <p className="text-[13.5px] text-[#8A8177] mt-1.5">
        {Array.isArray(session.programs) ? session.programs[0]?.name : session.programs?.name}
      </p>

      <div className="text-[12.5px] text-[#8A8177] mt-2 space-y-0.5">
        <div>{t('inv_start_colon')} {formatDate(session.started_at)}</div>
        <div>{t('inv_end_colon')} {formatDate(session.ended_at)}</div>
      </div>

      {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
        <div className="mt-3 inline-flex items-center px-3 py-1 bg-[#F6EFDF] border border-[#E3D3A8] rounded-lg text-[12.5px] text-[#8A6A22]">
          <MdWarning className="mr-2" size={14} />
          {t('inv_test_env_banner')}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 text-center">
          <div
            className="text-[32px] leading-[1.05] text-[#4F6748]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
          >
            {report.found.length}
          </div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-[#8A8177] mt-1">{t('inv_stat_found')}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 text-center">
          <div
            className="text-[32px] leading-[1.05] text-[#A8402A]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
          >
            {report.missing.length}
          </div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-[#8A8177] mt-1">{t('inv_stat_missing')}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 text-center">
          <div
            className="text-[32px] leading-[1.05] text-[#8A6A22]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
          >
            {report.mismatch.length}
          </div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-[#8A8177] mt-1">{t('inv_stat_other_site')}</div>
        </div>
        <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 text-center">
          <div
            className="text-[32px] leading-[1.05] text-[#56504A]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
          >
            {report.unknown.length}
          </div>
          <div className="text-[11px] uppercase tracking-[0.06em] text-[#8A8177] mt-1">{t('inv_stat_not_found')}</div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-6 border-b border-[#E3DDD1] overflow-x-auto mt-6">
        <button
          onClick={() => setActiveTab('found')}
          className={`whitespace-nowrap flex-shrink-0 py-3 text-[14px] border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === 'found' ? 'text-[#C2492B] border-[#C2492B] font-medium' : 'text-[#8A8177] border-transparent hover:text-[#56504A]'
          }`}
        >
          <MdCheckCircle size={16} />
          {t('inv_stat_found')} ({report.found.length})
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`whitespace-nowrap flex-shrink-0 py-3 text-[14px] border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === 'missing' ? 'text-[#C2492B] border-[#C2492B] font-medium' : 'text-[#8A8177] border-transparent hover:text-[#56504A]'
          }`}
        >
          <MdRemoveCircle size={16} />
          {t('inv_stat_missing')} ({report.missing.length})
        </button>
        <button
          onClick={() => setActiveTab('mismatch')}
          className={`whitespace-nowrap flex-shrink-0 py-3 text-[14px] border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === 'mismatch' ? 'text-[#C2492B] border-[#C2492B] font-medium' : 'text-[#8A8177] border-transparent hover:text-[#56504A]'
          }`}
        >
          <MdWarning size={16} />
          {t('inv_stat_other_site')} ({report.mismatch.length})
        </button>
        <button
          onClick={() => setActiveTab('unknown')}
          className={`whitespace-nowrap flex-shrink-0 py-3 text-[14px] border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            activeTab === 'unknown' ? 'text-[#C2492B] border-[#C2492B] font-medium' : 'text-[#8A8177] border-transparent hover:text-[#56504A]'
          }`}
        >
          <MdError size={16} />
          {t('inv_stat_not_found')} ({report.unknown.length})
        </button>
      </nav>

      {/* List */}
      <div className="mt-4 space-y-2.5">
        {currentList.length === 0 ? (
          <div className="text-center py-10 text-[#A29889] text-[13.5px]">
            {t('inv_no_items_in_category')}
          </div>
        ) : (
          currentList.map((item: any, index: number) => {
            // "Faltantes" (missing) es una lista de ACTIVOS directos —
            // viene de allAssets.filter(...) en loadReport(), no de
            // audit_events. Found/Otra sede/No encontrado sí son eventos de
            // auditoría con una relación anidada item.assets. Sin esta
            // distinción, item.assets siempre daba undefined para
            // "Faltantes" y cada fila mostraba "Unknown".
            const asset = activeTab === 'missing'
              ? item
              : (Array.isArray(item.assets) ? item.assets[0] : item.assets);

            return (
              <div key={index} className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-3.5">
                <div className="font-medium text-[#1B1917]">
                  {asset?.description || item.scanned_code || t('inv_unknown_masc')}
                </div>
                <div className="text-[12.5px] text-[#8A8177] mt-0.5">
                  {asset?.full_code || item.scanned_code}
                  {asset?.brand && ` · ${asset.brand}`}
                </div>
                {asset?.serial_number && (
                  <div className="text-[11.5px] text-[#8A8177] mt-1">
                    {t('inv_serial_colon')} {asset.serial_number}
                  </div>
                )}
                {item.source && (
                  <div className="mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F4F0E8] text-[#6E675E]">
                      {item.source === 'scan' ? t('inv_source_scan') : item.source === 'manual' ? t('inv_action_manual') : t('inv_action_photo_ocr')}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
