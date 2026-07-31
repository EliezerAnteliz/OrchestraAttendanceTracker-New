'use client';

/**
 * Slot compartido para que cada sub-pestaña del módulo de Inventario
 * (Dashboard/Listado/Auditoría/...) registre su propio botón de acción
 * principal en el encabezado del módulo, junto al selector de rol.
 *
 * Vive en su propio archivo (NO dentro de layout.tsx) a propósito: Next.js
 * App Router trata layout.tsx como un archivo de ruta especial, y en build
 * de producción puede no preservar exports nombrados adicionales más allá
 * del default — importar un hook exportado desde layout.tsx funcionaba en
 * dev pero rompía en producción con "useInventoryHeaderActions is not a
 * function". Al vivir en un módulo normal, tanto layout.tsx como cada
 * page.tsx lo importan igual y sin sorpresas.
 */

import { ReactNode, createContext, useContext, useEffect } from 'react';

export const InventoryHeaderActionsContext = createContext<{
  setActions: (node: ReactNode | null) => void;
} | null>(null);

export function useInventoryHeaderActions(node: ReactNode | null) {
  const ctx = useContext(InventoryHeaderActionsContext);
  useEffect(() => {
    ctx?.setActions(node);
    return () => ctx?.setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
}
