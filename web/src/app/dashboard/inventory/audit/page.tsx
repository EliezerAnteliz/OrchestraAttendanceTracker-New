'use client';

/**
 * MÓDULO DE AUDITORÍA DE INVENTARIO
 * Mobile-first - Escaneo de códigos de barras + selección manual
 * 
 * ⚠️ IMPORTANTE: Esta página usa el proyecto de prueba de Supabase
 * NO modifica ni accede a datos de producción
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../supabase.inventory.config';
import { MdQrCodeScanner, MdAdd, MdCheckCircle, MdError, MdWarning, MdArrowBack } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';

const inventorySupabase = createClient(
  INVENTORY_SUPABASE_CONFIG.url,
  INVENTORY_SUPABASE_CONFIG.anonKey
);

interface Program {
  id: string;
  name: string;
}

interface AuditSession {
  id: string;
  program_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'open' | 'closed';
  programs?: {
    name: string;
  } | {
    name: string;
  }[];
  event_count?: number;
}

export default function AuditPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Cargar programas activos
      const { data: programsData, error: programsError } = await inventorySupabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (programsError) throw programsError;
      setPrograms(programsData || []);

      // Cargar sesiones de auditoría (últimas 20)
      const { data: sessionsData, error: sessionsError } = await inventorySupabase
        .from('audit_sessions')
        .select(`
          id,
          program_id,
          started_at,
          ended_at,
          status,
          programs:program_id(name)
        `)
        .order('started_at', { ascending: false })
        .limit(20);

      if (sessionsError) throw sessionsError;

      // Contar eventos por sesión
      const sessionsWithCounts = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { count } = await inventorySupabase
            .from('audit_events')
            .select('*', { count: 'exact', head: true })
            .eq('audit_session_id', session.id);

          return {
            ...session,
            event_count: count || 0,
          };
        })
      );

      setSessions(sessionsWithCounts);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || t('inv_error_loading_data'));
    } finally {
      setLoading(false);
    }
  }

  async function createNewSession() {
    if (!selectedProgramId) {
      setError(t('inv_must_select_site'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verificar si ya existe una sesión abierta para esta sede
      const { data: existingSession } = await inventorySupabase
        .from('audit_sessions')
        .select('id')
        .eq('program_id', selectedProgramId)
        .eq('status', 'open')
        .single();

      if (existingSession) {
        // Reanudar sesión existente
        router.push(`/dashboard/inventory/audit/${existingSession.id}`);
        return;
      }

      // Obtener organization_id del programa
      const { data: programData, error: programError } = await inventorySupabase
        .from('programs')
        .select('organization_id')
        .eq('id', selectedProgramId)
        .single();

      if (programError) {
        console.error('Error fetching program:', {
          message: programError.message,
          details: programError.details,
          hint: programError.hint,
          code: programError.code
        });
        throw new Error(`${t('inv_error_fetching_program_prefix')} ${programError.message}`);
      }

      if (!programData) throw new Error(t('inv_program_not_found'));

      // Fallback organization_id (mismo que en importador)
      const organizationId = programData.organization_id || '8bade020-abcc-4ee9-a14a-fa311bb3f482';

      // Quién inicia la sesión — en el ambiente de prueba (sin login) esto
      // siempre da null y la columna queda vacía, como hasta ahora; en
      // producción, en cuanto haya sesión real de Supabase Auth, empieza a
      // guardarse solo. No bloquea la creación si falla o no hay sesión.
      const { data: userData } = await inventorySupabase.auth.getUser();
      const startedBy = userData?.user?.id || null;

      // Crear nueva sesión
      const { data: newSession, error: insertError } = await inventorySupabase
        .from('audit_sessions')
        .insert({
          organization_id: organizationId,
          program_id: selectedProgramId,
          status: 'open',
          started_by: startedBy,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting audit session:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        throw new Error(`${t('inv_error_creating_session_prefix')} ${insertError.message || insertError.code || t('inv_unknown_masc')}`);
      }

      // Navegar a la sesión
      router.push(`/dashboard/inventory/audit/${newSession.id}`);
    } catch (err: any) {
      console.error('Error creating session:', {
        message: err.message,
        stack: err.stack,
        fullError: err
      });
      setError(err.message || t('inv_error_creating_session'));
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('inv_loading_audits')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header - Mobile optimized */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MdArrowBack size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{t('inv_audit_title')}</h1>
              <p className="text-sm text-gray-600">{t('inv_audit_subtitle')}</p>
            </div>
          </div>

          {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
            <div className="mb-3 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
              <MdWarning className="mr-2" />
              {t('inv_test_env_banner')}
            </div>
          )}

          <button
            onClick={() => setShowNewSessionModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors font-medium"
          >
            <MdAdd size={24} />
            {t('inv_new_audit')}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 max-w-7xl sm:mx-auto">
          <MdError className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Sessions List */}
      <div className="p-4 space-y-3 max-w-7xl mx-auto">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <MdQrCodeScanner size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-2">{t('inv_no_audits_registered')}</p>
            <p className="text-sm text-gray-500">{t('inv_create_new_audit_to_start')}</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => router.push(`/dashboard/inventory/audit/${session.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-4 active:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {Array.isArray(session.programs) ? session.programs[0]?.name : session.programs?.name || t('inv_unknown_site')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatDate(session.started_at)}
                  </p>
                </div>
                <div>
                  {session.status === 'open' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                      {t('inv_open_status')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                      <MdCheckCircle size={14} />
                      {t('inv_closed_status')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{t('inv_assets_audited_count', { n: session.event_count || 0 })}</span>
                {session.ended_at && (
                  <span>• {t('inv_finished_on', { date: formatDate(session.ended_at) })}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6 animate-slide-up">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('inv_new_audit')}</h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('inv_select_site_label')}
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="">{t('inv_select_site_placeholder')}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewSessionModal(false);
                  setSelectedProgramId('');
                  setError(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={createNewSession}
                disabled={!selectedProgramId || loading}
                className="flex-1 px-4 py-3 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('inv_creating') : t('inv_start')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
