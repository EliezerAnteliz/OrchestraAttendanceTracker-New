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

import { useState } from 'react';
import { MdCheckCircle, MdWarning, MdClose } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';

interface AssetInfo {
  id: string;
  description: string;
  brand: string | null;
  full_code: string | null;
  assigned_to_text: string | null;
  status_code: string;
}

interface AssetConfirmModalProps {
  asset: AssetInfo;
  result: 'found' | 'mismatch_site';
  mismatchProgramName?: string | null;
  onConfirm: (assignedToText: string | null, statusCode: string) => void;
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
  const [assignedTo, setAssignedTo] = useState(asset.assigned_to_text || '');
  const [statusCode, setStatusCode] = useState(asset.status_code || 'available');

  function handleClearAssignment() {
    setAssignedTo('');
    // Si estaba "asignado", lo natural al quitarle el estudiante es que
    // pase a disponible — pero solo si no está en reparación/prestado,
    // esos estados se mantienen porque son independientes de a quién
    // estaba asignado.
    if (statusCode === 'assigned') {
      setStatusCode('available');
    }
  }

  function handleConfirm() {
    onConfirm(assignedTo.trim() ? assignedTo.trim() : null, statusCode);
  }

  const assignmentChanged = (assignedTo.trim() || null) !== (asset.assigned_to_text || null);
  const statusChanged = statusCode !== asset.status_code;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60]">
      <div className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        {/* Resultado */}
        <div className={`p-4 flex items-center justify-between gap-2 ${result === 'found' ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center gap-2">
            {result === 'found' ? (
              <MdCheckCircle className="text-green-600" size={24} />
            ) : (
              <MdWarning className="text-yellow-600" size={24} />
            )}
            <div>
              <div className={`font-semibold ${result === 'found' ? 'text-green-800' : 'text-yellow-800'}`}>
                {result === 'found' ? t('inv_confirm_found_same_site') : t('inv_confirm_found_other_site')}
              </div>
              {result === 'mismatch_site' && mismatchProgramName && (
                <div className="text-xs text-yellow-700">{t('inv_confirm_belongs_to')} {mismatchProgramName}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="p-1 text-gray-500 hover:bg-black/5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label={t('inv_close_without_confirming')}
          >
            <MdClose size={22} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info del activo */}
          <div>
            <div className="font-bold text-lg text-gray-900">{asset.description}</div>
            <div className="text-sm text-gray-600">
              {asset.full_code || 'Sin código'}
              {asset.brand && ` • ${asset.brand}`}
            </div>
          </div>

          {/* Asignación — editable */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">{t('inv_assigned_to')}</label>
              {(asset.assigned_to_text) && (
                <button
                  type="button"
                  onClick={handleClearAssignment}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  {t('inv_mark_unassigned')}
                </button>
              )}
            </div>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder={t('inv_assigned_to_placeholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('inv_system_said')} {asset.assigned_to_text || t('inv_unassigned')}
              {assignmentChanged && <span className="text-blue-600 font-medium"> — {t('inv_will_update_inline')}</span>}
            </p>
          </div>

          {/* Estado — editable */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
            <select
              value={statusCode}
              onChange={(e) => setStatusCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {statusChanged && (
              <p className="text-xs text-blue-600 font-medium mt-1">{t('inv_will_update')}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-[2] px-4 py-3 bg-[#C2492B] text-white rounded-lg hover:bg-[#A83A20] transition-colors font-medium disabled:opacity-50"
            >
              {saving ? t('saving') : (assignmentChanged || statusChanged) ? t('inv_save_and_confirm') : t('inv_confirm_audit')}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            {t('inv_wrong_instrument_hint')}
          </p>
        </div>
      </div>
    </div>
  );
}
