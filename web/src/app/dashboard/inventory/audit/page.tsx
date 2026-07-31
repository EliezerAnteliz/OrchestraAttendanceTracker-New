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
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdQrCodeScanner, MdAdd, MdCheckCircle, MdError, MdWarning, MdClose } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useInventoryHeaderActions } from '../InventoryHeaderActions';


interface Program {
  id: string;
  name: string;
}

interface AuditSession {
  id: string;
  program_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'open' | 'closed' | 'cancelled';
  programs?: {
    name: string;
  } | {
    name: string;
  }[];
  event_count?: number;
}

export default function AuditPage() {
  const { t, lang } = useI18n();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  // Botón "Nueva auditoría" en el encabezado compartido del módulo (junto
  // al selector de rol) — reemplaza a "Nuevo activo" en esta sub-pestaña,
  // ya que esa acción no aplica aquí. Abre el modal de selección de sede
  // definido más abajo en esta misma página (estado local). Se registra
  // antes de cualquier `return` condicional para no violar las reglas de
  // hooks (deben llamarse en el mismo orden en todos los renders).
  useInventoryHeaderActions(
    <button
      onClick={() => setShowNewSessionModal(true)}
      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium"
    >
      <MdAdd size={18} />
      {t('inv_new_audit')}
    </button>
  );

  useEffect(() => {
    loadData();
  }, []);

  // Decisión ya tomada: solo Admin audita — si Staff/Viewer llega aquí por
  // URL directa, lo regresamos al Dashboard.
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/dashboard/inventory');
    }
  }, [roleLoading, isAdmin, router]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Programas activos y sesiones de auditoría son independientes entre
      // sí — se piden en paralelo en vez de uno tras otro.
      const [
        { data: programsData, error: programsError },
        { data: sessionsData, error: sessionsError },
      ] = await Promise.all([
        inventorySupabase
          .from('programs')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        inventorySupabase
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
          .limit(20),
      ]);

      if (programsError) throw programsError;
      setPrograms(programsData || []);

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

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B]"></div>
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-[#8A8177]">{t('inv_loading_audits')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* "Nueva auditoría" ya vive en el encabezado compartido de
          layout.tsx (ver useInventoryHeaderActions más arriba) — no
          "Nuevo activo", que no aplica en esta sub-pestaña. */}
      {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
        <div className="inline-flex items-center px-3 py-1 bg-[#F6EFDF] border border-[#E3D3A8] rounded-lg text-[12.5px] text-[#8A6A22]">
          <MdWarning className="mr-2" size={14} />
          {t('inv_test_env_banner')}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-5 bg-[#F8E9E4] border border-[#EAC7BB] rounded-xl p-4 flex items-start gap-3">
          <MdError className="text-[#8f3421] flex-shrink-0 mt-0.5" size={18} />
          <p className="text-[13.5px] text-[#8f3421]">{error}</p>
        </div>
      )}

      {/* Sessions List */}
      <div className="mt-5 space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <MdQrCodeScanner size={48} className="mx-auto text-[#DED7C9] mb-4" />
            <p className="text-[#6E675E] text-[14px] mb-1">{t('inv_no_audits_registered')}</p>
            <p className="text-[12.5px] text-[#A29889]">{t('inv_create_new_audit_to_start')}</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => router.push(`/dashboard/inventory/audit/${session.id}`)}
              className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl p-4 hover:border-[#C2492B]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex-1">
                  <h3 className="text-[15px] font-medium text-[#1B1917]">
                    {Array.isArray(session.programs) ? session.programs[0]?.name : session.programs?.name || t('inv_unknown_site')}
                  </h3>
                  <p className="text-[12.5px] text-[#8A8177] mt-0.5">
                    {formatDate(session.started_at)}
                  </p>
                </div>
                <div>
                  {session.status === 'open' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EDF1E9] text-[#4F6748] rounded-full text-[11px] font-medium whitespace-nowrap">
                      <span className="w-1.5 h-1.5 bg-[#4F6748] rounded-full animate-pulse"></span>
                      {t('inv_open_status')}
                    </span>
                  ) : session.status === 'cancelled' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F8E9E4] text-[#8f3421] rounded-full text-[11px] font-medium whitespace-nowrap">
                      <MdClose size={13} />
                      {t('inv_cancelled_status')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F0E8] text-[#56504A] rounded-full text-[11px] font-medium whitespace-nowrap">
                      <MdCheckCircle size={13} />
                      {t('inv_closed_status')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-[12.5px] text-[#8A8177]">
                <span>{t('inv_assets_audited_count', { n: session.event_count || 0 })}</span>
                {session.ended_at && (
                  <span>· {t('inv_finished_on', { date: formatDate(session.ended_at) })}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-[#FFFDFA] border border-[#EAE3D6] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 shadow-xl">
            <h2
              className="text-xl text-[#1B1917] mb-4"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {t('inv_new_audit')}
            </h2>

            <div className="mb-6">
              <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">
                {t('inv_select_site_label')}
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
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
                className="flex-1 px-4 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={createNewSession}
                disabled={!selectedProgramId || loading}
                className="flex-1 px-4 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
