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


interface AuditSession {
  id: string;
  program_id: string;
  started_at: string;
  status: 'open' | 'closed';
  programs?: {
    name: string;
  };
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

export default function AuditSessionPage() {
  const { t } = useI18n();
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

  // Redirigir a reporte si la sesión está cerrada
  useEffect(() => {
    if (session && session.status === 'closed') {
      router.push(`/dashboard/inventory/audit/${sessionId}/report`);
    }
  }, [session, sessionId, router]);

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
      const { data, error: eventsError } = await inventorySupabase
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
        .order('scanned_at', { ascending: false });

      if (eventsError) throw eventsError;
      setEvents(data || []);
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

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('inv_loading_audit')}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">{t('inv_session_not_found')}</p>
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

  // Si la sesión está cerrada, el useEffect se encargará de redirigir
  if (session.status === 'closed') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0073ea] mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('inv_redirecting_to_report')}</p>
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
              <h1 className="text-xl font-bold text-gray-900">
                {Array.isArray(session.programs) ? session.programs[0]?.name : session.programs?.name}
              </h1>
              <p className="text-sm text-gray-600">{t('inv_audit_in_progress')}</p>
            </div>
          </div>

          {INVENTORY_SUPABASE_CONFIG.environment === 'test' && (
            <div className="mb-3 inline-flex items-center px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800">
              <MdWarning className="mr-2" />
              {t('inv_test_env_banner')}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-1">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-green-700">{foundCount}</div>
              <div className="text-xs text-green-600">{t('inv_stat_found')}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-orange-700">{missingCount ?? '–'}</div>
              <div className="text-xs text-orange-600">{t('inv_stat_missing')}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-yellow-700">{mismatchCount}</div>
              <div className="text-xs text-yellow-600">{t('inv_stat_other_site')}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-red-700">{unknownCount}</div>
              <div className="text-xs text-red-600">{t('inv_stat_not_found')}</div>
            </div>
          </div>
          {totalExpected !== null && (
            <p className="text-xs text-gray-500 mb-3">
              {t('inv_expected_progress', { found: auditedAssetIds.size, total: totalExpected })}
            </p>
          )}

          {/* Action Buttons */}
          {!activeMode && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setActiveMode('scan')}
                className="flex flex-col items-center gap-1 px-3 py-3 bg-[#0073ea] text-white rounded-lg hover:bg-[#0060c0] transition-colors"
              >
                <MdQrCodeScanner size={24} />
                <span className="text-xs font-medium">{t('inv_action_scan')}</span>
              </button>
              <button
                onClick={() => setActiveMode('manual')}
                className="flex flex-col items-center gap-1 px-3 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <MdSearch size={24} />
                <span className="text-xs font-medium">{t('inv_action_manual')}</span>
              </button>
              <button
                onClick={() => setActiveMode('photo')}
                className="flex flex-col items-center gap-1 px-3 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <MdCameraAlt size={24} />
                <span className="text-xs font-medium">{t('inv_action_photo_ocr')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg max-w-7xl sm:mx-auto">
          <p className="text-sm text-red-800">{error}</p>
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
        <div className="p-4 space-y-2 max-w-7xl mx-auto">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('inv_audited_assets_count', { n: events.length })}</h2>
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {t('inv_no_audited_yet')}
            </div>
          ) : (
            events.map((event) => {
              const asset = Array.isArray(event.assets) ? event.assets[0] : event.assets;
              return (
              <div
                key={event.id}
                className="bg-white rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {asset?.description || event.scanned_code || t('inv_unknown_code')}
                      </span>
                      {asset?.size && (
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {asset.size}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {asset?.full_code}
                      {asset?.brand && (asset?.full_code ? ` · ${asset.brand}` : asset.brand)}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <MdPerson size={14} className={asset?.assigned_to_text ? 'text-gray-400 flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                        <span className={`text-sm truncate ${asset?.assigned_to_text ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                          {asset?.assigned_to_text || t('inv_unassigned')}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        event.source === 'scan' ? 'bg-blue-100 text-blue-700' :
                        event.source === 'manual' ? 'bg-gray-100 text-gray-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {event.source === 'scan' ? t('inv_source_scan') : event.source === 'manual' ? t('inv_action_manual') : t('inv_action_photo_ocr')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {event.result === 'found' && (
                      <MdCheckCircle className="text-green-600" size={20} />
                    )}
                    {event.result === 'mismatch_site' && (
                      <span className="text-xs text-yellow-700">⚠️</span>
                    )}
                    {event.result === 'unknown_code' && (
                      <MdClose className="text-red-600" size={20} />
                    )}
                    {/* Deshacer — por si se seleccionó el instrumento equivocado */}
                    <button
                      onClick={() => setConfirmUndoId(event.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title={t('inv_remove_from_audited_title')}
                    >
                      <MdUndo size={18} />
                    </button>
                  </div>
                </div>

                {/* Confirmación inline de "deshacer" */}
                {confirmUndoId === event.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-600">
                      {t('inv_confirm_remove_audited')}
                      {previousAssetStates[event.id] && ` ${t('inv_will_also_revert')}`}
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setConfirmUndoId(null)}
                        className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        onClick={() => handleUndoAudit(event.id)}
                        disabled={undoingId === event.id}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
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

      {/* Close Session Button - Fixed at bottom */}
      {!activeMode && (
        <div className="sticky bottom-0 p-4 bg-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              {t('inv_finalize_audit')}
            </button>
          </div>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('inv_finalize_audit_question')}</h2>
            <p className="text-gray-600 mb-6">
              {t('inv_finalize_audit_desc', { n: foundCount })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={closeSession}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? t('inv_finalizing') : t('inv_finalize')}
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
