'use client';

/**
 * MODAL DE CONFIRMACIÓN DE ACTIVO (dentro del flujo de Auditoría)
 *
 * Se muestra cada vez que Escaneo/Manual/Foto+OCR identifican un activo
 * ("found" o "mismatch_site"), ANTES de registrar el evento de auditoría.
 * Permite ver y corregir en el momento la asignación actual (a quién
 * pertenece hoy) y el estado — caso real: un instrumento se reasignó de
 * un estudiante a otro durante el año pero nunca se actualizó en el
 * sistema, o el estudiante se retiró y el instrumento sigue apareciendo
 * asignado. La auditoría física es el momento natural para detectarlo y
 * corregirlo, sin tener que ir aparte a Editar Activo.
 */

import { useEffect, useState } from 'react';
import { MdCheckCircle, MdWarning, MdClose } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { inventorySupabase } from '@/lib/inventorySupabaseClient';

interface AssetInfo {
  id: string;
  description: string;
  brand: string | null;
  full_code: string | null;
  assigned_to_text: string | null;
  assigned_student_id: string | null;
  current_program_id: string | null;
  status_code: string;
  condition_code: string;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface AssetConfirmModalProps {
  asset: AssetInfo;
  result: 'found' | 'mismatch_site';
  mismatchProgramName?: string | null;
  onConfirm: (assignedToText: string | null, assignedStudentId: string | null, statusCode: string, conditionCode: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function AssetConfirmModal({ asset, result, mismatchProgramName, onConfirm, onCancel, saving }: AssetConfirmModalProps) {
  const { t } = useI18n();
  const STATUS_OPTIONS = [
    { value: 'available', label: t('inv_status_available') },
    { value: 'assigned', label: t('inv_status_assigned') },
    { value: 'repair', label: t('inv_status_repair') },
    { value: 'on_loan', label: t('inv_status_on_loan') },
  ];
  const CONDITION_OPTIONS = [
    { value: 'good', label: t('inv_condition_good') },
    { value: 'needs_repair', label: t('inv_condition_needs_repair') },
    { value: 'damaged', label: t('inv_condition_damaged') },
  ];

  const [programStudents, setProgramStudents] = useState<StudentOption[]>([]);
  const [assignedStudentId, setAssignedStudentId] = useState(asset.assigned_student_id || '');
  // Texto libre para casos que NO son un estudiante real registrado (ej.
  // préstamo a un hijo de maestro aún no inscrito, un proveedor, etc.) —
  // arranca en modo "otro" si ya había texto sin un estudiante enlazado,
  // para que el caso suelto quede visible de inmediato.
  const [assignToOther, setAssignToOther] = useState(!asset.assigned_student_id && !!asset.assigned_to_text);
  const [assignedToOtherText, setAssignedToOtherText] = useState(!asset.assigned_student_id ? (asset.assigned_to_text || '') : '');
  const [statusCode, setStatusCode] = useState(asset.status_code || 'available');
  const [conditionCode, setConditionCode] = useState(asset.condition_code || 'good');

  // Estudiantes activos de la sede de este activo, para el selector de
  // "Asignado a" — mismo patrón que Detalle de Activo / Nuevo Activo, así
  // el staff elige de la lista real en vez de tipear el nombre a mano.
  useEffect(() => {
    async function loadProgramStudents() {
      if (!asset.current_program_id) {
        setProgramStudents([]);
        return;
      }
      const { data, error } = await inventorySupabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('program_id', asset.current_program_id)
        .eq('is_active', true)
        .order('first_name');

      if (error) {
        console.error('Error loading students for program:', error);
        setProgramStudents([]);
        return;
      }
      setProgramStudents(data || []);
    }
    loadProgramStudents();
  }, [asset.current_program_id]);

  function handleClearAssignment() {
    setAssignedStudentId('');
    setAssignToOther(false);
    setAssignedToOtherText('');
    // Si estaba "asignado", lo natural al quitarle el estudiante es que
    // pase a disponible — pero solo si no está en reparación/prestado,
    // esos estados se mantienen porque son independientes de a quién
    // estaba asignado.
    if (statusCode === 'assigned') {
      setStatusCode('available');
    }
  }

  function currentAssignedName(): string | null {
    if (assignToOther) {
      return assignedToOtherText.trim() ? assignedToOtherText.trim() : null;
    }
    if (assignedStudentId) {
      const s = programStudents.find(s => s.id === assignedStudentId);
      return s ? `${s.first_name} ${s.last_name}`.trim() : null;
    }
    return null;
  }

  function handleConfirm() {
    const finalStudentId = !assignToOther && assignedStudentId ? assignedStudentId : null;
    onConfirm(currentAssignedName(), finalStudentId, statusCode, conditionCode);
  }

  const newAssignedName = currentAssignedName();
  const newStudentId = !assignToOther && assignedStudentId ? assignedStudentId : null;
  const assignmentChanged =
    newAssignedName !== (asset.assigned_to_text || null) ||
    newStudentId !== (asset.assigned_student_id || null);
  const statusChanged = statusCode !== asset.status_code;
  const conditionChanged = conditionCode !== (asset.condition_code || 'good');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Resultado */}
        <div className={`p-4 flex items-center justify-between gap-2 rounded-t-2xl ${result === 'found' ? 'bg-[#EDF1E9]' : 'bg-[#F6EFDF]'}`}>
          <div className="flex items-center gap-2">
            {result === 'found' ? (
              <MdCheckCircle className="text-[#4F6748]" size={22} />
            ) : (
              <MdWarning className="text-[#8A6A22]" size={22} />
            )}
            <div>
              <div className={`font-medium ${result === 'found' ? 'text-[#4F6748]' : 'text-[#8A6A22]'}`}>
                {result === 'found' ? t('inv_confirm_found_same_site') : t('inv_confirm_found_other_site')}
              </div>
              {result === 'mismatch_site' && mismatchProgramName && (
                <div className="text-[11.5px] text-[#8A6A22]">{t('inv_confirm_belongs_to')} {mismatchProgramName}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="p-1 text-[#6E675E] hover:bg-black/5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label={t('inv_close_without_confirming')}
          >
            <MdClose size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info del activo */}
          <div>
            <div
              className="text-lg text-[#1B1917]"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {asset.description}
            </div>
            <div className="text-[12.5px] text-[#8A8177] mt-0.5">
              {asset.full_code || t('inv_no_code')}
              {asset.brand && ` · ${asset.brand}`}
            </div>
          </div>

          {/* Asignación — editable, selector real de estudiantes de la sede */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-[#56504A]">{t('inv_assigned_to')}</label>
              {(asset.assigned_to_text) && (
                <button
                  type="button"
                  onClick={handleClearAssignment}
                  className="text-[11.5px] text-[#A8402A] hover:text-[#8f3421] font-medium"
                >
                  {t('inv_mark_unassigned')}
                </button>
              )}
            </div>
            <select
              value={assignToOther ? '__other__' : assignedStudentId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__other__') {
                  setAssignToOther(true);
                  setAssignedStudentId('');
                } else if (val === '') {
                  setAssignToOther(false);
                  setAssignedStudentId('');
                  setAssignedToOtherText('');
                } else {
                  setAssignToOther(false);
                  setAssignedStudentId(val);
                  setAssignedToOtherText('');
                }
              }}
              className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
              disabled={!asset.current_program_id}
            >
              <option value="">{t('inv_unassigned')}</option>
              {programStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
              ))}
              <option value="__other__">{t('inv_assigned_other_option')}</option>
            </select>
            {!asset.current_program_id && (
              <p className="text-[11.5px] text-[#8A8177] mt-1.5">{t('inv_assigned_to_needs_site')}</p>
            )}
            {assignToOther && (
              <input
                type="text"
                value={assignedToOtherText}
                onChange={(e) => setAssignedToOtherText(e.target.value)}
                placeholder={t('inv_assigned_to_placeholder_short')}
                className="w-full px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917] mt-2"
              />
            )}
            <p className="text-[11.5px] text-[#8A8177] mt-1.5">
              {t('inv_system_said')} {asset.assigned_to_text || t('inv_unassigned')}
              {assignmentChanged && <span className="text-[#C2492B] font-medium"> — {t('inv_will_update_inline')}</span>}
            </p>
          </div>

          {/* Estado — editable */}
          <div>
            <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('status')}</label>
            <select
              value={statusCode}
              onChange={(e) => setStatusCode(e.target.value)}
              className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {statusChanged && (
              <p className="text-[11.5px] text-[#C2492B] font-medium mt-1.5">{t('inv_will_update')}</p>
            )}
          </div>

          {/* Condición física — independiente de disponibilidad; un
              instrumento puede estar "Asignado" y a la vez "Dañado" */}
          <div>
            <label className="block text-[13px] font-medium text-[#56504A] mb-1.5">{t('inv_condition_label')}</label>
            <select
              value={conditionCode}
              onChange={(e) => setConditionCode(e.target.value)}
              className="w-full appearance-none px-3.5 py-2.5 border border-[#E3DDD1] rounded-[9px] bg-[#FFFDFA] focus:outline-none focus:ring-2 focus:ring-[#C2492B]/30 focus:border-[#C2492B] text-[#1B1917]"
            >
              {CONDITION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {conditionChanged && (
              <p className="text-[11.5px] text-[#C2492B] font-medium mt-1.5">{t('inv_condition_changed')}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 px-4 py-2.5 border border-[#DED7C9] text-[#56504A] rounded-lg hover:border-[#C2492B] hover:text-[#C2492B] transition-colors font-medium disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-[2] px-4 py-2.5 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium disabled:opacity-50"
            >
              {saving ? t('saving') : (assignmentChanged || statusChanged || conditionChanged) ? t('inv_save_and_confirm') : t('inv_confirm_audit')}
            </button>
          </div>
          <p className="text-[11.5px] text-[#A29889] text-center">
            {t('inv_wrong_instrument_hint')}
          </p>
        </div>
      </div>
    </div>
  );
}
