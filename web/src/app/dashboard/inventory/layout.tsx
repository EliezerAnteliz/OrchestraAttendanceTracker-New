'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProgram } from '@/contexts/ProgramContext';
import RoleSwitcher from '@/components/RoleSwitcher';
import { MdAdd } from 'react-icons/md';

export default function InventoryLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { isAdmin } = useUserRole();
  const { activeProgram } = useProgram();
  const pathname = usePathname();

  // Importar y Auditoría son operaciones exclusivas de Admin (RLS ya lo
  // exige: solo Admin escribe assets/mantenimiento y solo Admin audita) —
  // se ocultan del menú para Staff/Viewer en vez de llevarlos a una
  // pantalla que de todos modos les va a rechazar la acción.
  const inventoryMenuItems = [
    { label: t('inv_nav_dashboard'), href: '/dashboard/inventory' },
    { label: t('inv_nav_listado'), href: '/dashboard/inventory/assets' },
    ...(isAdmin ? [
      { label: t('inv_nav_importar'), href: '/dashboard/inventory/import' },
      { label: t('inv_nav_auditoria'), href: '/dashboard/inventory/audit' },
    ] : []),
  ];

  return (
    <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full">
    <div className="max-w-[1420px] mx-auto">
      {/* Encabezado compartido del módulo — se mantiene igual entre las 4
          sub-pestañas (Dashboard/Listado/Importar/Auditoría), como en el
          mockup: título + subtítulo con la sede activa a la izquierda,
          selector de rol a la derecha. */}
      <div className="pb-5 sm:pb-[22px] border-b border-[#E3DDD1] flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1
            className="text-[28px] sm:text-[40px] text-[#1B1917] leading-[1.05]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            {t('menu_inventory')}
          </h1>
          <p className="text-[13px] sm:text-[14px] text-[#8A8177] mt-1.5">
            {t('inv_module_subtitle', { site: activeProgram?.name || '' })}
          </p>
        </div>
        {/* Acción global "Nuevo activo" (solo Admin) junto al selector de
            rol — así el resto de cada sub-pestaña arranca a ras, sin una
            fila de acciones propia debajo de las pestañas (como pedía
            Eliezer, comparando con cómo ya se ve Importar). */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/dashboard/inventory/assets/new"
              className="flex items-center justify-center gap-2 bg-[#C2492B] text-[#FAF7F2] rounded-lg px-[18px] py-2.5 font-medium hover:bg-[#A83A20] transition-colors whitespace-nowrap"
            >
              <MdAdd size={18} />
              {t('inv_new_asset_button')}
            </Link>
          )}
          {/* Mismo selector "Ver como Admin/Staff/Viewer" que ya existe en
              el resto de la app — solo se renderiza si el usuario real es
              Admin (RoleSwitcher se auto-oculta si no). Sirve para
              previsualizar la UI de Inventario como la vería Staff/Viewer;
              no reemplaza probar con una cuenta real para confirmar que el
              RLS los bloquea (esto solo cambia lo que ve, no el rol real
              con el que se autentican las llamadas a Supabase). */}
          <RoleSwitcher />
        </div>
      </div>

      {/* Pestañas — texto simple con subrayado en la activa, como el
          mockup (nada de pastillas ni íconos). */}
      <nav className="flex gap-6 border-b border-[#E3DDD1] overflow-x-auto">
        {inventoryMenuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard/inventory' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap flex-shrink-0 py-3 text-[14px] border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'text-[#C2492B] border-[#C2492B] font-medium'
                  : 'text-[#8A8177] border-transparent hover:text-[#56504A]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {children}
      </div>
    </div>
    </div>
  );
}
