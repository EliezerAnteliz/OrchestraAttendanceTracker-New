'use client';

/**
 * COMPONENTE DE SELECCIÓN MANUAL
 * Reutiliza filtros del Listado para buscar y marcar activos
 */

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { INVENTORY_SUPABASE_CONFIG } from '../../../../../../supabase.inventory.config';
import { MdClose, MdSearch } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';

const inventorySupabase = createClient(
  INVENTORY_SUPABASE_CONFIG.url,
  INVENTORY_SUPABASE_CONFIG.anonKey
);

interface Asset {
  id: string;
  full_code: string | null;
  description: string;
  brand: string | null;
  size: string | null;
  serial_number: string | null;
  assigned_to_text: string | null;
  status_code: string;
}

interface ManualSelectorProps {
  sessionId: string;
  programId: string;
  onAssetSelected: (assetId: string, code: string, result: 'found' | 'mismatch_site', source: 'manual') => void;
  onClose: () => void;
}

export default function ManualSelector({ sessionId, programId, onAssetSelected, onClose }: ManualSelectorProps) {
  const { t } = useI18n();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');
  const [instruments, setInstruments] = useState<string[]>([]);
  // IDs de activos ya auditados EN ESTA SESIÓN de auditoría (sin importar
  // el método — escaneo, manual o foto — cargados de `audit_events` al
  // abrir, más los que se van agregando aquí mismo). Se excluyen de la
  // lista para no volver a mostrarlos como pendientes.
  const [auditedAssetIds, setAuditedAssetIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadInstrumentOptions();
    loadAuditedAssetIds();
  }, []);

  useEffect(() => {
    loadAssets();
  }, [searchTerm, selectedStatus, selectedInstrument, auditedAssetIds]);

  // Activos ya registrados en esta sesión de auditoría (por cualquier
  // método), para excluirlos de "pendientes por auditar".
  async function loadAuditedAssetIds() {
    try {
      const { data } = await inventorySupabase
        .from('audit_events')
        .select('asset_id')
        .eq('audit_session_id', sessionId)
        .not('asset_id', 'is', null);

      const ids = new Set((data || []).map(e => e.asset_id).filter(Boolean)) as Set<string>;
      setAuditedAssetIds(ids);
    } catch (err) {
      console.error('Error loading audited asset ids:', err);
    }
  }

  // Mismo patrón dinámico del dropdown "Instrumento" del Listado de
  // Activos: valores únicos reales de `description`, no hardcodeados.
  // Se limita a la sede de esta auditoría para no mostrar instrumentos
  // que no existen aquí.
  async function loadInstrumentOptions() {
    try {
      const { data } = await inventorySupabase
        .from('assets')
        .select('description')
        .eq('current_program_id', programId)
        .not('description', 'is', null)
        .order('description');

      const unique = [...new Set(data?.map(a => a.description).filter(Boolean))] as string[];
      setInstruments(unique);
    } catch (err) {
      console.error('Error loading instrument options:', err);
    }
  }

  async function loadAssets() {
    try {
      setLoading(true);

      let query = inventorySupabase
        .from('assets')
        .select('id, full_code, description, brand, size, serial_number, assigned_to_text, status_code, current_program_id')
        .eq('current_program_id', programId)
        .order('description');

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        query = query.or(`description.ilike.%${term}%,brand.ilike.%${term}%,full_code.ilike.%${term}%,serial_number.ilike.%${term}%,assigned_to_text.ilike.%${term}%`);
      }

      if (selectedStatus) {
        query = query.eq('status_code', selectedStatus);
      }

      if (selectedInstrument) {
        query = query.eq('description', selectedInstrument);
      }

      // Traer un margen extra (100) antes de filtrar los ya auditados,
      // para que sigan quedando ~50 pendientes visibles aunque varios de
      // los primeros resultados ya se hayan auditado.
      const { data, error } = await query.limit(100);

      if (error) throw error;
      const pending = (data || []).filter(a => !auditedAssetIds.has(a.id)).slice(0, 50);
      setAssets(pending);
    } catch (err: any) {
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAsset(asset: Asset) {
    // Ya auditado — no debería aparecer en la lista, pero por si acaso
    // (doble toque accidental antes de que se re-renderice).
    if (auditedAssetIds.has(asset.id)) {
      return;
    }
    const code = asset.full_code || '';
    onAssetSelected(asset.id, code, 'found', 'manual');

    // Optimista: lo quita de inmediato de "pendientes" (sin esperar a
    // recargar desde la BD) y muestra confirmación, sin cerrar el modal
    // — así se puede seguir seleccionando el siguiente de una vez.
    setAuditedAssetIds(prev => new Set(prev).add(asset.id));
    setToast(`✓ ${asset.description}${asset.brand ? ` - ${asset.brand}` : ''} ${t('inv_added_suffix')}`);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('inv_manual_selection_title')}</h2>
              {auditedAssetIds.size > 0 && (
                <p className="text-xs text-green-700 font-medium">{t('inv_audited_count', { n: auditedAssetIds.size, suffix: auditedAssetIds.size !== 1 ? 's' : '' })}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MdClose size={24} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('inv_search_placeholder_manual')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              autoFocus
            />
          </div>

          {/* Filtros: Instrumento + Estado */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="">{t('inv_all_instruments')}</option>
              {instruments.map(instrument => (
                <option key={instrument} value={instrument}>{instrument}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="">{t('inv_all_statuses')}</option>
              <option value="available">{t('inv_status_option_available')}</option>
              <option value="assigned">{t('inv_status_option_assigned')}</option>
              <option value="repair">{t('inv_status_repair')}</option>
              <option value="on_loan">{t('inv_status_option_on_loan')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assets List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t('inv_searching')}</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {auditedAssetIds.size > 0 ? t('inv_no_pending_with_filter') : t('inv_no_assets_found')}
            </div>
          ) : (
            assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => handleSelectAsset(asset)}
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="font-medium text-gray-900">{asset.description}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {asset.full_code || t('inv_no_code')}
                  {asset.brand && ` • ${asset.brand}`}
                  {asset.size && ` • ${asset.size}`}
                </div>
                {asset.assigned_to_text && (
                  <div className="text-xs text-gray-500 mt-1">
                    {t('inv_assigned_to_colon')} {asset.assigned_to_text}
                  </div>
                )}
                {asset.serial_number && (
                  <div className="text-xs text-gray-500">
                    {t('inv_serial_colon')} {asset.serial_number}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Toast de confirmación */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-10">
          <div className="max-w-7xl mx-auto bg-green-600 text-white p-3 rounded-lg shadow-lg text-center text-sm font-medium">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
