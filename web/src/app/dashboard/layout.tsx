'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MdDashboard, MdPeople, MdAssignment, MdInsertChart, MdLogout, MdMenu, MdClose, MdRefresh, MdMusicNote, MdInventory } from 'react-icons/md';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useI18n } from '@/contexts/I18nContext';
import { ProgramProvider, useProgram } from '@/contexts/ProgramContext';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { UserRoleProvider } from '@/contexts/UserRoleContext';

const sidebarItems = [
  { key: 'menu_dashboard', href: '/dashboard', icon: <MdDashboard size={24} /> },
  { key: 'menu_students', href: '/dashboard/students', icon: <MdPeople size={24} /> },
  { key: 'menu_attendance', href: '/dashboard/attendance', icon: <MdAssignment size={24} /> },
  { key: 'menu_orchestras', href: '/dashboard/orchestras', icon: <MdMusicNote size={24} /> },
  { key: 'menu_reports', href: '/dashboard/reports', icon: <MdInsertChart size={24} /> },
  { key: 'menu_inventory', href: '/dashboard/inventory', icon: <MdInventory size={24} /> },
];

function ProgramSwitcher() {
  const { programs, activeProgram, setActiveProgramId, loading, refreshPrograms } = useProgram();
  const { t } = useI18n();
  if (loading) {
    return <p className="mt-2 text-sm text-gray-600">{t('loading_programs')}</p>;
  }
  if (!programs?.length) {
    return (
      <div className="mt-2 text-sm text-gray-700">
        <p>{t('no_sites_assigned')}</p>
        <button
          onClick={refreshPrograms}
          className="mt-1 inline-flex items-center px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
        >
          <MdRefresh className="mr-1" /> {t('refresh_sites')}
        </button>
      </div>
    );
  }
  return (
    <div className="w-full">
      <label className="block text-xs text-blue-100 mb-2 font-medium">{t('select_site_label')}</label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white/95 backdrop-blur-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white"
          value={activeProgram?.id || ''}
          onChange={(e) => setActiveProgramId(e.target.value)}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={refreshPrograms}
          title={t('refresh_sites')}
          aria-label={t('refresh_sites')}
          className="inline-flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-2 py-2 text-white hover:bg-white/30 transition-all duration-200 shadow-sm"
        >
          <MdRefresh size={16} />
        </button>
      </div>
    </div>
  );
}

// Iniciales a partir del correo (no tenemos nombre real disponible en el
// usuario de Auth) — mismo patrón de avatar circular ya usado en otras
// partes de la app (ej. el selector de estudiante de Reportes). Si el
// correo tiene separador (ej. "eliezer.anteliz@...") usa la primera letra
// de cada parte; si no, las 2 primeras letras del usuario.
const getInitials = (email?: string | null) => {
  if (!email) return '?';
  const local = email.split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
};

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const { isAdmin } = useUserRole();
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  // Close sidebar when clicking a link on mobile
  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function checkAdmin() {
      try {
        const { data, error } = await supabase.rpc('list_admin_visible_programs');
        if (error) throw error;
        if (!mounted) return;
        setIsOrgAdmin(Array.isArray(data) && data.length > 0);
      } catch (e) {
        if (!mounted) return;
        setIsOrgAdmin(false);
      }
    }
    checkAdmin();
    return () => { mounted = false; };
  }, []);

  return (
    <aside
      className={`
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed md:static
        top-0 left-0
        h-full
        w-64
        bg-white
        border-r border-gray-200
        shadow-lg md:shadow-none
        z-30
        transition-transform duration-300 ease-in-out
        overflow-hidden
        flex flex-col
      `}
    >
      <div className="p-4 border-b border-gray-200 bg-[#0073ea] text-white flex-shrink-0">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{t('brand_title')}</h2>
            <p className="text-xs text-blue-100 opacity-90">{t('brand_subtitle')}</p>
          </div>
          <button
            className="md:hidden text-white hover:text-blue-200 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <MdClose size={20} />
          </button>
        </div>
        {/* Program selector */}
        <div className="mt-3">
          <ProgramSwitcher />
        </div>
      </div>
      {/* flex-1 + overflow-y-auto: si algún día se agregan más ítems de los
          que caben en pantallas cortas, el menú scrollea en vez de empujar
          o quedar tapado por el pie de cuenta (que ahora vive en el flujo
          normal, no con position:absolute). */}
      <nav className="mt-6 px-2 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {sidebarItems.map((item) => {
            // "Dashboard" (href = '/dashboard') es un caso especial: TODAS
            // las rutas de la app empiezan con "/dashboard/", así que un
            // startsWith normal lo dejaba siempre marcado como activo sin
            // importar la página. Solo él necesita coincidencia exacta.
            const isActive = item.href === '/dashboard'
              ? pathname === item.href
              : (pathname === item.href || pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-[#0073ea] text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`mr-3 transition-transform duration-200 ${
                    isActive ? 'scale-110' : 'group-hover:scale-105'
                  }`}>{item.icon}</span>
                  <span className="font-medium">{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
          {isOrgAdmin && isAdmin && (
            <li>
              <Link
                href="/dashboard/admin/users"
                onClick={handleLinkClick}
                className={`flex items-center px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group ${
                  pathname.startsWith('/dashboard/admin')
                    ? 'bg-[#0073ea] text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`mr-3 transition-transform duration-200 ${
                  pathname.startsWith('/dashboard/admin') ? 'scale-110' : 'group-hover:scale-105'
                }`}><MdPeople size={24} /></span>
                <span className="font-medium">{t('admin_label')}</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      {/* mt-auto en vez de position:absolute — vive en el flujo normal del
          flex column del <aside>, así que nunca puede quedar tapando el
          último ítem del menú si algún día se agrega uno más en pantallas
          cortas. */}
      <div className="flex-shrink-0 mt-auto p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar circular con iniciales — mismo patrón ya usado en el
              selector de estudiante de Reportes, para que el pie de cuenta
              se sienta parte del mismo sistema visual en vez de solo texto
              suelto. */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0073ea]/10 text-[#0073ea] flex items-center justify-center font-semibold text-xs">
            {getInitials(user?.email)}
          </div>
          <span className="flex-1 min-w-0 text-xs text-gray-600 truncate font-medium">{user?.email}</span>
          <button
            onClick={signOut}
            title={t('sign_out')}
            aria-label={t('sign_out')}
            className="flex-shrink-0 flex items-center justify-center text-xs text-gray-600 hover:text-[#0060c0] transition-colors duration-200 bg-white hover:bg-gray-50 p-1.5 rounded-md border border-gray-200 hover:border-gray-300"
          >
            <MdLogout size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function DashboardContent({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useI18n();
  const { programs, activeProgram, setActiveProgramId, refreshPrograms } = useProgram();

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header with menu button */}
        <header className="md:hidden bg-[#0073ea] text-white shadow-md safe-area-inset-top">
          <div className="p-3 flex items-center gap-3">
            <button 
              className="text-white hover:text-blue-200 flex-shrink-0 transition-colors duration-200"
              onClick={() => setIsSidebarOpen(true)}
            >
              <MdMenu size={20} />
            </button>
            <h1 className="text-sm font-bold text-white truncate flex-1 min-w-0">{t('mobile_header')}</h1>
          </div>
          {/* Program selector in separate row for better mobile layout */}
          {programs?.length ? (
            <div className="px-3 pb-3 flex items-center gap-2">
              <select
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white/95 backdrop-blur-sm font-medium shadow-sm min-w-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                value={activeProgram?.id || ''}
                onChange={(e) => setActiveProgramId(e.target.value)}
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => (typeof window !== 'undefined') && (window as any).requestIdleCallback ? (window as any).requestIdleCallback(() => refreshPrograms()) : refreshPrograms()}
                title={t('refresh_sites')}
                aria-label={t('refresh_sites')}
                className="inline-flex items-center justify-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-2 py-2 text-white hover:bg-white/30 transition-all duration-200 shadow-sm flex-shrink-0"
              >
                <MdRefresh size={14} />
              </button>
            </div>
          ) : null}
        </header>
        
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ProgramProvider>
          {/* Una sola instancia de estado de rol para toda la app — antes
              cada componente que llamaba useUserRole() (Sidebar, layout de
              Inventario, páginas individuales) creaba su propia copia
              independiente, lo que causó un caso real donde "viendo como
              Staff" se reflejaba en un componente pero no en otro. */}
          <UserRoleProvider>
            <DashboardContent>{children}</DashboardContent>
          </UserRoleProvider>
        </ProgramProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}
