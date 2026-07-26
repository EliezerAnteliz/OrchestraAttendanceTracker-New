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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea]"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('inv_generating_report')}</p>
        </div>
      </div>
    );
  }

  if (!session || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">{t('inv_could_not_load_report')}</p>
          <button
            onClick={() => router.push('/dashboard/inventory/audit')}
            className="mt-4 px-4 py-2 bg-[#0073ea] text-white rounded-lg"
          >
            {t('inv_go_back')}
          </button>
        </div>
      </div>
    );
  }

  const currentList = report[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/dashboard/inventory/audit')}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MdArrowBack size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{t('inv_report_title')}</h1>
              <p className="text-sm text-gray-600">
                {Array.isArray(session.programs) ? session.programs[0]?.name : session.programs?.name}
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-600 mb-3">
            <div>{t('inv_start_colon')} {formatDate(session.started_at)}</div>
            <div>{t('inv_end_colon')} {formatDate(session.ended_at)}</div>
          </div>

          {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
            <div className="mb-3 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
              <MdWarning className="mr-2" />
              {t('inv_test_env_banner')}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{report.found.length}</div>
              <div className="text-xs text-green-600">{t('inv_stat_found')}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{report.missing.length}</div>
              <div className="text-xs text-red-600">{t('inv_stat_missing')}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{report.mismatch.length}</div>
              <div className="text-xs text-yellow-600">{t('inv_stat_other_site')}</div>
            </div>
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{report.unknown.length}</div>
              <div className="text-xs text-gray-600">{t('inv_stat_not_found')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-2 overflow-x-auto max-w-7xl mx-auto">
        <button
          onClick={() => setActiveTab('found')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'found'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <MdCheckCircle className="inline mr-1" size={16} />
          {t('inv_stat_found')} ({report.found.length})
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'missing'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <MdRemoveCircle className="inline mr-1" size={16} />
          {t('inv_stat_missing')} ({report.missing.length})
        </button>
        <button
          onClick={() => setActiveTab('mismatch')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'mismatch'
              ? 'border-yellow-600 text-yellow-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <MdWarning className="inline mr-1" size={16} />
          {t('inv_stat_other_site')} ({report.mismatch.length})
        </button>
        <button
          onClick={() => setActiveTab('unknown')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'unknown'
              ? 'border-gray-600 text-gray-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <MdError className="inline mr-1" size={16} />
          {t('inv_stat_not_found')} ({report.unknown.length})
        </button>
      </div>

      {/* List */}
      <div className="p-4 space-y-2 max-w-7xl mx-auto">
        {currentList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {t('inv_no_items_in_category')}
          </div>
        ) : (
          currentList.map((item: any, index: number) => {
            const asset = Array.isArray(item.assets) ? item.assets[0] : item.assets;
            
            return (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="font-medium text-gray-900">
                  {asset?.description || item.scanned_code || t('inv_unknown_masc')}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {asset?.full_code || item.scanned_code}
                  {asset?.brand && ` • ${asset.brand}`}
                </div>
                {asset?.serial_number && (
                  <div className="text-xs text-gray-500 mt-1">
                    {t('inv_serial_colon')} {asset.serial_number}
                  </div>
                )}
                {item.source && (
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.source === 'scan' ? 'bg-blue-100 text-blue-700' :
                      item.source === 'manual' ? 'bg-gray-100 text-gray-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
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
