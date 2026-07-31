'use client';

/**
 * SESIÓN ACTIVA DE AUDITORÍA
 * Tres flujos: Escaneo (barcode) + Selección manual + Foto OCR
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../../supabase.inventory.config';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';
import { MdArrowBack, MdQrCodeScanner, MdSearch, MdCameraAlt, MdCheckCircle, MdClose, MdUndo, MdPerson, MdWarning } from 'react-icons/md';
import BarcodeScanner from './BarcodeScanner';
import ManualSelector from './ManualSelector';
import PhotoOCR from './PhotoOCR';
import AssetConfirmModal from './AssetConfirmModal';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';


interface AuditSession {
  id: string;
  program_id: string;
  started_at: string;
  status: 'open' | 'closed' | 'cancelled';
  // El join de Supabase (`programs:program_id(name)`) a veces lo tipa como
  // array y a veces como objeto según pueda inferir la relación 1-a-1 — el
  // código ya lo maneja en tiempo de ejecución con Array.isArray() más
  // abajo, esto solo corrige el tipo para que coincida.
  programs?: { name: string } | { name: string }[];
}

interface AuditEvent {
  id: string;
  source: 'scan' | 'manual' | 'photo_assist';
  result: 'found' | 'mismatch_site' | 'unknown_code';
  scanned_at: string;
  assets?: {
    id: string;
    full_code: string;
    description: string;
    brand: string | null;
    size: string | null;
    assigned_to_text: string | null;
  };
  scanned_code?: string | null;
}

type AuditMode = 'scan' | 'manual' | 'photo' | null;

interface PendingConfirm {
  assetId: string;
  code: string;
  result: 'found' | 'mismatch_site';
  source: 'scan' | 'manual' | 'photo_assist';
  asset: {
    id: string;
    description: string;
    brand: string | null;
    full_code: string | null;
    assigned_to_text: string | null;
    status_code: string;
  };
  mismatchProgramName?: string | null;
}

// Supabase/PostgREST devuelve máximo 1000 filas por consulta si no se pagina
// explícitamente con .range() — el mismo bug que ya se corrigió en el
// reporte Anual de Asistencia (ver web/src/app/dashboard/reports/page.tsx).
// Una sesión de auditoría larga (varios escáneres a la vez, reintentos,
// códigos duplicados/desconocidos) puede superar 1000 eventos sin que se
// note: la pantalla en vivo simplemente dejaría de mostrar eventos nuevos y
// el conteo de "auditados" quedaría incompleto de forma silenciosa.
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
        source,
        result,
        scanned_at,
        scanned_code,
        assets:asset_id(id, full_code, description, brand, size, assigned_to_text)
      `)
      .eq('audit_session_id', sessionId)
      // Desempate por id además de scanned_at: dos escaneos casi
      // simultáneos pueden compartir el mismo timestamp, y sin un
      // desempate estable el corte entre páginas podría saltarse o
      // repetir una fila.
      .order('scanned_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < AUDIT_EVENTS_PAGE_SIZE) break;
    from += AUDIT_EVENTS_PAGE_SIZE;
  }
  return all;
}

export default function AuditSessionPage() {
  const { t } = useI18n();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<AuditSession | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  // Total de activos esperados en la sede de esta sesión (current_program_id
  // = session.program_id) — para mostrar "cuánto falta" en vivo durante el
  // recorrido, sin tener que cerrar la sesión y esperar al reporte final.
  const [totalExpected, setTotalExpected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AuditMode>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [savingConfirm, setSavingConfirm] = useState(false);
  // Para deshacer un activo auditado por error (ej. se seleccionó el
  // instrumento equivocado): confirmación inline antes de borrar, y flag
  // de "borrando" para deshabilitar el botón mientras corre.
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  // Valores de asignación/estado ANTES de cada confirmación que sí
  // cambió algo, guardados en memoria (solo dura mientras esta pantalla
  // sigue abierta — una vez que se finaliza la auditoría, se navega al
  // reporte y esto se pierde junto con la posibilidad de deshacer, que
  // es justo el comportamiento pedido). Se usa para revertir el activo
  // automáticamente si se deshace ese evento.
  const [previousAssetStates, setPreviousAssetStates] = useState<Record<string, { assetId: string; assigned_to_text: string | null; status_code: string }>>({});

  useEffect(() => {
    loadSession();
    loadEvents();
  }, [sessionId]);

  // Redirigir a reporte si la sesión está cerrada, o de vuelta a la lista si
  // fue cancelada (una sesión cancelada no tiene reporte que mostrar).
  useEffect(() => {
    if (session && session.status === 'closed') {
      router.push(`/dashboard/inventory/audit/${sessionId}/report`);
    } else if (session && session.status === 'cancelled') {
      router.push('/dashboard/inventory/audit');
    }
  }, [session, sessionId, router]);

  // Decisión ya tomada: solo Admin audita — si Staff/Viewer llega aquí por
  // URL directa, lo regresamos al Dashboard.
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace('/dashboard/inventory');
    }
  }, [roleLoading, isAdmin, router]);

  // Cargar el total de activos esperados de esta sede en cuanto se conoce
  // el program_id de la sesión (se necesita session.program_id, por eso va
  // en un useEffect separado en vez de dentro de loadSession).
  useEffect(() => {
    if (session?.program_id) {
      loadTotalExpected(session.program_id);
    }
  }, [session?.program_id]);

  async function loadSession() {
    try {
      const { data, error: sessionError } = await inventorySupabase
        .from('audit_sessions')
        .select(`
          id,
          program_id,
          started_at,
          status,
          programs:program_id(name)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(data);
    } catch (err: any) {
      console.error('Error loading session:', err);
      setError(err.message || t('inv_error_loading_session'));
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const data = await fetchAllAuditEvents(sessionId);
      setEvents(data);
    } catch (err: any) {
      console.error('Error loading events:', err);
    }
  }

  // Mismo cálculo que usa el reporte final (report/page.tsx): cuenta los
  // activos cuya sede actual (current_program_id) es la sede de esta
  // sesión — ese es el universo contra el que se compara "cuánto falta".
  // Se excluyen los activos con Owner = Stafford (uso de emergencia, no se
  // usan activamente y no se esperan encontrar en el recorrido) — los de
  // Academy SÍ se incluyen, porque esos sí están en uso real y se deben
  // verificar igual que el resto.
  async function loadTotalExpected(programId: string) {
    try {
      const { count, error: countError } = await inventorySupabase
        .from('assets')
        .select('id', { count: 'exact', head: true })
        .eq('current_program_id', programId)
        .or('owner.neq.Stafford,owner.is.null');

      if (countError) throw countError;
      setTotalExpected(count ?? 0);
    } catch (err: any) {
      console.error('Error loading total expected assets:', err);
      // No bloquear la auditoría si esto falla — simplemente no se muestra
      // el contador de "faltan" en vivo (queda como null).
    }
  }

  async function handleAssetScanned(assetId: string | null, code: string, result: 'found' | 'mismatch_site' | 'unknown_code', source: 'scan' | 'manual' | 'photo_assist') {
    // Si se identificó un activo real (found/mismatch_site), antes de
    // registrar el evento se muestra un modal de confirmación con la
    // asignación y el estado ACTUALES — para poder corregirlos ahí mismo
    // si ya no son correctos (ej. el instrumento pasó de un estudiante a
    // otro, o el estudiante se retiró) sin tener que ir aparte a Editar
    // Activo. "unknown_code" no tiene activo real que mostrar/editar, se
    // registra directo.
    if (assetId && (result === 'found' || result === 'mismatch_site')) {
      try {
        const { data: assetInfo, error: assetError } = await inventorySupabase
          .from('assets')
          .select('id, description, brand, full_code, assigned_to_text, status_code, current_program_id')
          .eq('id', assetId)
          .single();

        if (assetError) throw assetError;

        let mismatchProgramName: string | null = null;
        if (result === 'mismatch_site' && assetInfo?.current_program_id) {
          const { data: program } = await inventorySupabase
            .from('programs')
            .select('name')
            .eq('id', assetInfo.current_program_id)
            .single();
          mismatchProgramName = program?.name || null;
        }

        setPendingConfirm({ assetId, code, result, source, asset: assetInfo, mismatchProgramName });
      } catch (err: any) {
        console.error('Error loading asset for confirmation:', err);
        // Si falla traer el detalle, no bloquear la auditoría — registrar
        // el evento igual sin la posibilidad de editar asignación esta vez.
        await saveAuditEvent(assetId, code, result, source);
      }
      return;
    }

    await saveAuditEvent(assetId, code, result, source);
  }

  async function saveAuditEvent(assetId: string | null, code: string, result: 'found' | 'mismatch_site' | 'unknown_code', source: 'scan' | 'manual' | 'photo_assist'): Promise<string | null> {
    try {
      // Quién registra el evento — en el ambiente de prueba (sin login)
      // siempre da null, igual que hasta ahora; en producción, con sesión
      // real de Supabase Auth, empieza a guardarse solo. No bloquea el
      // registro del evento si falla o no hay sesión.
      const { data: userData } = await inventorySupabase.auth.getUser();
      const scannedBy = userData?.user?.id || null;

      const { data, error: insertError } = await inventorySupabase
        .from('audit_events')
        .insert({
          audit_session_id: sessionId,
          asset_id: assetId,
          source,
          scanned_code: source === 'scan' ? code : null,
          result,
          scanned_by: scannedBy,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Recargar eventos
      await loadEvents();

      // Cerrar modo activo si fue exitoso — EXCEPTO en selección manual,
      // donde queremos poder seguir marcando varios activos seguidos sin
      // tener que volver a tocar el botón "Manual" cada vez.
      if ((result === 'found' || result === 'mismatch_site') && source !== 'manual') {
        setActiveMode(null);
      }

      return data?.id || null;
    } catch (err: any) {
      console.error('Error saving event:', err);
      setError(err.message || t('inv_error_saving_event'));
      return null;
    }
  }

  async function handleConfirmAudit(assignedToText: string | null, statusCode: string) {
    if (!pendingConfirm) return;
    const { assetId, code, result, source, asset } = pendingConfirm;

    setSavingConfirm(true);
    try {
      const assignmentChanged = (assignedToText || null) !== (asset.assigned_to_text || null);
      const statusChanged = statusCode !== asset.status_code;

      if (assignmentChanged || statusChanged) {
        const { error: updateError } = await inventorySupabase
          .from('assets')
          .update({
            assigned_to_text: assignedToText,
            status_code: statusCode,
          })
          .eq('id', assetId);

        if (updateError) throw updateError;
      }

      const newEventId = await saveAuditEvent(assetId, code, result, source);

      // Si de verdad se cambió algo, se guarda el estado ANTERIOR ligado
      // al nuevo evento — así, si luego se deshace este evento por error,
      // se puede revertir el activo automáticamente a como estaba.
      if (newEventId && (assignmentChanged || statusChanged)) {
        setPreviousAssetStates(prev => ({
          ...prev,
          [newEventId]: {
            assetId,
            assigned_to_text: asset.assigned_to_text,
            status_code: asset.status_code,
          },
        }));
      }

      setPendingConfirm(null);
    } catch (err: any) {
      console.error('Error confirming audit:', err);
      setError(err.message || t('inv_error_confirming_audit'));
    } finally {
      setSavingConfirm(false);
    }
  }

  // Quitar un activo de "Auditados" por error (ej. se seleccionó el
  // instrumento equivocado) — borra el evento de auditoría; el activo
  // vuelve a aparecer como pendiente en Selección Manual automáticamente
  // (esa pantalla consulta `audit_events` de esta sesión en vivo). Si al
  // confirmar ese evento se había cambiado la asignación/estado, también
  // se revierte el activo a como estaba ANTES (guardado en
  // `previousAssetStates`, solo disponible mientras esta pantalla sigue
  // abierta — una vez finalizada la auditoría ya no hay forma de deshacer,
  // que es el comportamiento pedido).
  async function handleUndoAudit(eventId: string) {
    setUndoingId(eventId);
    try {
      const prevState = previousAssetStates[eventId];
      if (prevState) {
        const { error: revertError } = await inventorySupabase
          .from('assets')
          .update({
            assigned_to_text: prevState.assigned_to_text,
            status_code: prevState.status_code,
          })
          .eq('id', prevState.assetId);

        if (revertError) throw revertError;
      }

      const { error: deleteError } = await inventorySupabase
        .from('audit_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;

      if (prevState) {
        setPreviousAssetStates(prev => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }

      await loadEvents();
      setConfirmUndoId(null);
    } catch (err: any) {
      console.error('Error undoing audit event:', err);
      setError(err.message || t('inv_error_removing_audited'));
    } finally {
      setUndoingId(null);
    }
  }

  async function closeSession() {
    try {
      setLoading(true);
      const { error: updateError } = await inventorySupabase
        .from('audit_sessions')
        .update({
          status: 'closed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      // Navegar al reporte
      router.push(`/dashboard/inventory/audit/${sessionId}/report`);
    } catch (err: any) {
      console.error('Error closing session:', err);
      setError(err.message || t('inv_error_closing_session'));
      setLoading(false);
    }
  }

  // Cancelar una auditoría que se inició por error o que no se va a
  // completar — a diferencia de "Finalizar", no genera reporte. Los eventos
  // ya registrados en esta sesión se dejan tal cual (no se borran, quedan
  // como historial), pero la sesión pasa a 'cancelled' y ya no bloquea que
  // se inicie una auditoría nueva para esta misma sede (createNewSession en
  // la lista solo reanuda sesiones con status='open').
  async function cancelSession() {
    try {
      setCancelling(true);
      const { error: updateError } = await inventorySupabase
        .from('audit_sessions')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      router.push('/dashboard/inventory/audit');
    } catch (err: any) {
      console.error('Error cancelling session:', err);
      setError(err.message || t('inv_error_cancelling_session'));
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  }

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B]"></div>
      </div>
    );
  }

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-[#8A8177]">{t('inv_loading_audit')}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-[#6E675E]">{t('inv_session_not_found')}</p>
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

  // Si la sesión está cerrada o cancelada, el useEffect se encargará de
  // redirigir (a reporte o a la lista, respectivamente) — este bloque solo
  // cubre el instante intermedio para no mostrar la pantalla de auditoría
  // activa de una sesión que ya no lo está.
  if (session.status === 'closed' || session.status === 'cancelled') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C2492B] mx-auto"></div>
          <p className="mt-4 text-[#8A8177]">
            {session.status === 'closed' ? t('inv_redirecting_to_report') : t('inv_cancelling')}
          </p>
        </div>
      </div>
    );
  }

  const foundCount = events.filter(e => e.result === 'found').length;
  const mismatchCount = events.filter(e => e.result === 'mismatch_site').length;
  const unknownCount = events.filter(e => e.result === 'unknown_code').length;

  // "Faltan" en vivo: mismo cálculo que el reporte final — activos de esta
  // sede (totalExpected) que todavía no aparecen en un evento found/mismatch
  // de esta sesión. Se deduplica por asset.id por si el mismo activo se
  // auditó más de una vez. null mientras totalExpected no ha cargado aún.
  const auditedAssetIds = new Set(
    events
      .filter(e => e.result === 'found' || e.result === 'mismatch_site')
      .map(e => (Array.isArray(e.assets) ? (e.assets as any)[0]?.id : e.assets?.id))
      .filter(Boolean)
  );
  const missingCount = totalExpected !== null ? Math.max(0, totalExpected - auditedAssetIds.size) : null;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl sticky top-2 z-10 shadow-sm">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/dashboard/inventory/audit')}
              className="p-1.5 text-[#8A8177] hover:text-[#C2492B] hover:bg-[#F4F0E8] rounded-lg transition-colors"
            >
              <MdArrowBack size={20} />
            </button>
            <div className="flex-1">
              <h1
                className="text-xl text-[#1B1917]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
              >
                {Array.isArray(session.programs) ? session.programs[0]?.name : session.programs?.name}
              </h1>
              <p className="text-[13px] text-[#C2492B] mt-0.5">{t('inv_audit_in_progress')}</p>
            </div>
          </div>

          {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
            <div className="mb-3 inline-flex items-center px-3 py-1 bg-[#F6EFDF] border border-[#E3D3A8] rounded-lg text-[12.5px] text-[#8A6A22]">
              <MdWarning className="mr-2" size={14} />
              {t('inv_test_env_banner')}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-1">
            <div className="bg-[#FAF7F2] border border-[#EFE9DD] rounded-lg p-2 text-center">
              <div
                className="text-2xl text-[#4F6748]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
              >
                {foundCount}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.06em] text-[#8A8177]">{t('inv_stat_found')}</div>
            </div>
            <div className="bg-[#FAF7F2] border border-[#EFE9DD] rounded-lg p-2 text-center">
              <div
                className="text-2xl text-[#C2492B]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
              >
                {missingCount ?? '–'}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.06em] text-[#8A8177]">{t('inv_stat_missing')}</div>
            </div>
            <div className="bg-[#FAF7F2] border border-[#EFE9DD] rounded-lg p-2 text-center">
              <div
                className="text-2xl text-[#8A6A22]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
              >
                {mismatchCount}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.06em] text-[#8A8177]">{t('inv_stat_other_site')}</div>
            </div>
            <div className="bg-[#FAF7F2] border border-[#EFE9DD] rounded-lg p-2 text-center">
              <div
                className="text-2xl text-[#A8402A]"
                style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300 }}
              >
                {unknownCount}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.06em] text-[#8A8177]">{t('inv_stat_not_found')}</div>
            </div>
          </div>
          {totalExpected !== null && (
            <p className="text-[12px] text-[#8A8177] mb-3">
              {t('inv_expected_progress', { found: auditedAssetIds.size, total: totalExpected })}
            </p>
          )}

          {/* Action Buttons */}
          {!activeMode && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setActiveMode('scan')}
                className="flex flex-col items-center gap-1 px-3 py-3 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors"
              >
                <MdQrCodeScanner size={22} />
                <span className="text-[12px] font-medium">{t('inv_action_scan')}</span>
              </button>
              <button
                onClick={() => setActiveMode('manual')}
                className="flex flex-col items-center gap-1 px-3 py-3 bg-[#56504A] text-white rounded-lg hover:bg-[#3F3A35] transition-colors"
              >
                <MdSearch size={22} />
                <span className="text-[12px] font-medium">{t('inv_action_manual')}</span>
              </button>
              <button
                onClick={() => setActiveMode('photo')}
                className="flex flex-col items-center gap-1 px-3 py-3 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors"
              >
                <MdCameraAlt size={22} />
                <span className="text-[12px] font-medium">{t('inv_action_photo_ocr')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-[#F8E9E4] border border-[#EAC7BB] rounded-lg">
          <p className="text-[13px] text-[#8f3421]">{error}</p>
        </div>
      )}

      {/* Active Mode Component */}
      {activeMode === 'scan' && (
        <BarcodeScanner
          sessionId={sessionId}
          programId={session.program_id}
          onAssetScanned={handleAssetScanned}
          onClose={() => setActiveMode(null)}
        />
      )}

      {activeMode === 'manual' && (
        <ManualSelector
          sessionId={sessionId}
          programId={session.program_id}
          onAssetSelected={handleAssetScanned}
          onClose={() => setActiveMode(null)}
        />
      )}

      {activeMode === 'photo' && (
        <PhotoOCR
          sessionId={sessionId}
          programId={session.program_id}
          onAssetSelected={handleAssetScanned}
          onClose={() => setActiveMode(null)}
        />
      )}

      {/* Events List */}
      {!activeMode && (
        <div className="mt-4 space-y-2.5">
          <h2 className="text-[11.5px] uppercase tracking-[0.09em] text-[#8A8177]">{t('inv_audited_assets_count', { n: events.length })}</h2>
          {events.length === 0 ? (
            <div className="text-center py-10 text-[#A29889] text-[13.5px]">
              {t('inv_no_audited_yet')}
            </div>
          ) : (
            events.map((event) => {
              const asset = Array.isArray(event.assets) ? event.assets[0] : event.assets;
              return (
              <div
                key={event.id}
                className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#1B1917]">
                        {asset?.description || event.scanned_code || t('inv_unknown_code')}
                      </span>
                      {asset?.size && (
                        <span className="text-[11px] font-medium text-[#56504A] bg-[#F4F0E8] px-1.5 py-0.5 rounded">
                          {asset.size}
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-[#8A8177] mt-0.5">
                      {asset?.full_code}
                      {asset?.brand && (asset?.full_code ? ` · ${asset.brand}` : asset.brand)}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <MdPerson size={13} className={asset?.assigned_to_text ? 'text-[#A29889] flex-shrink-0' : 'text-[#DED7C9] flex-shrink-0'} />
                        <span className={`text-[12.5px] truncate ${asset?.assigned_to_text ? 'text-[#56504A]' : 'text-[#A29889] italic'}`}>
                          {asset?.assigned_to_text || t('inv_unassigned')}
                        </span>
                      </div>
                      <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        event.source === 'scan' ? 'bg-[#EFE9DD] text-[#56504A]' :
                        event.source === 'manual' ? 'bg-[#F4F0E8] text-[#6E675E]' :
                        'bg-[#F4F0E8] text-[#6E675E]'
                      }`}>
                        {event.source === 'scan' ? t('inv_source_scan') : event.source === 'manual' ? t('inv_action_manual') : t('inv_action_photo_ocr')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {event.result === 'found' && (
                      <MdCheckCircle className="text-[#4F6748]" size={18} />
                    )}
                    {event.result === 'mismatch_site' && (
                      <MdWarning className="text-[#8A6A22]" size={18} />
                    )}
                    {event.result === 'unknown_code' && (
                      <MdClose className="text-[#A8402A]" size={18} />
                    )}
                    {/* Deshacer — por si se seleccionó el instrumento equivocado */}
                    <button
                      onClick={() => setConfirmUndoId(event.id)}
                      className="p-1 text-[#A29889] hover:text-[#A8402A] hover:bg-[#F8E9E4] rounded transition-colors"
                      title={t('inv_remove_from_audited_title')}
                    >
                      <MdUndo size={17} />
                    </button>
                  </div>
                </div>

                {/* Confirmación inline de "deshacer" */}
                {confirmUndoId === event.id && (
                  <div className="mt-3 pt-3 border-t border-[#EFE9DD] flex items-center justify-between gap-2">
                    <p className="text-[11.5px] text-[#6E675E]">
                      {t('inv_confirm_remove_audited')}
                      {previousAssetStates[event.id] && ` ${t('inv_will_also_revert')}`}
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setConfirmUndoId(null)}
                        className="px-3 py-1 text-[11.5px] text-[#56504A] hover:bg-[#F4F0E8] rounded transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={() => handleUndoAudit(event.id)}
                        disabled={undoingId === event.id}
                        className="px-3 py-1 text-[11.5px] bg-[#A8402A] text-white rounded hover:bg-[#8f3421] transition-colors disabled:opacity-50"
                      >
                        {undoingId === event.id ? t('inv_removing') : t('inv_yes_remove')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      )}

      {/* Close/Cancel Session Buttons - Fixed at bottom */}
      {!activeMode && (
        <div className="sticky bottom-0 mt-4 p-3 bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl shadow-sm">
          <div className="flex gap-2">
            {/* Cancelar: para cuando la auditoría se inició por error o no
                se va a completar — no genera reporte. Botón secundario
                (ghost) para que no compita visualmente con "Finalizar",
                que es la acción esperada la mayoría de las veces. */}
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="px-4 py-2.5 text-[#56504A] hover:border-[#C2492B] hover:text-[#C2492B] rounded-lg transition-colors font-medium border border-[#DED7C9]"
            >
              {t('inv_cancel_audit')}
            </button>
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="flex-1 px-4 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium"
            >
              {t('inv_finalize_audit')}
            </button>
          </div>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-[#FFFDFA] border border-[#EAE3D6] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 shadow-xl">
            <h2
              className="text-xl text-[#1B1917] mb-2"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {t('inv_finalize_audit_question')}
            </h2>
            <p className="text-[13.5px] text-[#6E675E] mb-6">
              {t('inv_finalize_audit_desc', { n: foundCount })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={closeSession}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium disabled:opacity-50"
              >
                {loading ? t('inv_finalizing') : t('inv_finalize')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-[#FFFDFA] border border-[#EAE3D6] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 shadow-xl">
            <h2
              className="text-xl text-[#1B1917] mb-2"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {t('inv_cancel_audit_question')}
            </h2>
            <p className="text-[13.5px] text-[#6E675E] mb-6">
              {t('inv_cancel_audit_desc', { n: foundCount })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium disabled:opacity-50"
              >
                {t('inv_keep_going')}
              </button>
              <button
                onClick={cancelSession}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 bg-[#A8402A] text-white rounded-lg hover:bg-[#8f3421] transition-colors font-medium disabled:opacity-50"
              >
                {cancelling ? t('inv_cancelling') : t('inv_yes_cancel_audit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de activo (asignación/estado actuales, editables) */}
      {pendingConfirm && (
        <AssetConfirmModal
          asset={pendingConfirm.asset}
          result={pendingConfirm.result}
          mismatchProgramName={pendingConfirm.mismatchProgramName}
          onConfirm={handleConfirmAudit}
          onCancel={() => setPendingConfirm(null)}
          saving={savingConfirm}
        />
      )}
    </div>
  );
}
