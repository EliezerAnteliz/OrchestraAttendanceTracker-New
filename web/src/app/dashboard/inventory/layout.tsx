'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MdDashboard, MdList, MdUpload, MdQrCodeScanner } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';
import RoleSwitcher from '@/components/RoleSwitcher';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { isAdmin } = useUserRole();
  const pathname = usePathname();

  // Importar y Auditoría son operaciones exclusivas de Admin (RLS ya lo
  // exige: solo Admin escribe assets/mantenimiento y solo Admin audita) —
  // se ocultan del menú para Staff/Viewer en vez de llevarlos a una
  // pantalla que de todos modos les va a rechazar la acción.
  const inventoryMenuItems = [
    { label: t('inv_nav_dashboard'), href: '/dashboard/inventory', icon: <MdDashboard size={20} /> },
    { label: t('inv_nav_listado'), href: '/dashboard/inventory/assets', icon: <MdList size={20} /> },
    ...(isAdmin ? [
      { label: t('inv_nav_importar'), href: '/dashboard/inventory/import', icon: <MdUpload size={20} /> },
      { label: t('inv_nav_auditoria'), href: '/dashboard/inventory/audit', icon: <MdQrCodeScanner size={20} /> },
    ] : []),
  ];

  return (
    <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full">
    <div className="max-w-[1420px] mx-auto">
      {/* Submenu de Inventario — mismo patrón de pastilla activa (terracota
          sólido) que el resto de los controles segmentados de la app
          (ej. Reportes > Tipo de reporte / Período). */}
      <div className="bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl mb-6 p-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* overflow-x-auto + whitespace-nowrap + flex-shrink-0: en
              celular los tabs (con ícono+texto cada uno) no caben en el
              ancho de pantalla — sin esto se encimaban/cortaban en vez de
              poder deslizarse. */}
          <nav className="flex gap-2 overflow-x-auto">
            {inventoryMenuItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard/inventory' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? 'bg-[#C2492B] text-[#FAF7F2]'
                      : 'text-[#56504A] hover:bg-[#F4F0E8]'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {/* Mismo selector "Ver como Admin/Staff/Viewer" que ya existe en
              el resto de la app — solo se renderiza si el usuario real es
              Admin (RoleSwitcher se auto-oculta si no). Sirve para
              previsualizar la UI de Inventario como la vería Staff/Viewer;
              no reemplaza probar con una cuenta real para confirmar que el
              RLS los bloquea (esto solo cambia lo que ve, no el rol real
              con el que se autentican las llamadas a Supabase). */}
          <div className="flex-shrink-0">
            <RoleSwitcher />
          </div>
        </div>
      </div>

      {children}
    </div>
    </div>
  );
}
