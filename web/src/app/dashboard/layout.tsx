'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MdDashboard, MdPeople, MdAssignment, MdInsertChart, MdLogout, MdMenu, MdClose, MdRefresh } from 'react-icons/md';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useI18n } from '@/contexts/I18nContext';
import { ProgramProvider, useProgram } from '@/contexts/ProgramContext';
import { supabase } from '@/lib/supabase';

const sidebarItems = [
  { key: 'menu_dashboard', href: '/dashboard', icon: <MdDashboard size={24} /> },
  { key: 'menu_students', href: '/dashboard/students', icon: <MdPeople size={24} /> },
  { key: 'menu_attendance', href: '/dashboard/attendance', icon: <MdAssignment size={24} /> },
  { key: 'menu_reports', href: '/dashboard/reports', icon: <MdInsertChart size={24} /> },
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
    <div className="mt-2 w-full">
      <label className="block text-sm text-gray-700 mb-1">{t('select_site_label')}</label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 border border-gray-300 rounded px-2 py-2 text-base text-gray-800 bg-white font-normal"
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
          className="inline-flex items-center justify-center border border-gray-300 rounded px-2 py-2 text-gray-700 hover:bg-gray-50"
        >
          <MdRefresh size={18} />
        </button>
      </div>
    </div>
  );
}

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
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
        z-30 
        transition-transform duration-300 ease-in-out
        overflow-hidden
      `}
    >
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-[#0073ea]">{t('brand_title')}</h2>
          <p className="text-sm text-gray-500">{t('brand_subtitle')}</p>
          {/* Program selector */}
          <ProgramSwitcher />
        </div>
        <button 
          className="md:hidden text-gray-500 hover:text-gray-700"
          onClick={() => setIsOpen(false)}
        >
          <MdClose size={24} />
        </button>
      </div>
      <nav className="mt-4">
        <ul>
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.key} className="mb-1">
                <Link
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center px-4 py-3 text-sm ${
                    isActive
                      ? 'bg-[#e5f2ff] text-[#0073ea] border-l-4 border-[#0073ea]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
          {isOrgAdmin && (
            <li className="mb-1">
              <Link
                href="/dashboard/admin/users"
                onClick={handleLinkClick}
                className={`flex items-center px-4 py-3 text-sm ${
                  pathname.startsWith('/dashboard/admin')
                    ? 'bg-[#e5f2ff] text-[#0073ea] border-l-4 border-[#0073ea]'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3"><MdPeople size={24} /></span>
                {t('admin_label')}
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 truncate max-w-[150px]">{user?.email}</span>
          <button
            onClick={signOut}
            className="flex items-center text-sm text-gray-600 hover:text-[#0060c0]"
          >
            <MdLogout className="mr-1" /> {t('sign_out')}
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
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header with menu button */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center gap-3 safe-area-inset-top">
          <button 
            className="text-gray-500 hover:text-gray-700 mr-4"
            onClick={() => setIsSidebarOpen(true)}
          >
            <MdMenu size={24} />
          </button>
          <h1 className="text-lg font-semibold text-[#0073ea] flex-1">{t('mobile_header')}</h1>
          {/* Compact selector for mobile */}
          {programs?.length ? (
            <div className="flex items-center gap-2 min-w-[160px]">
              <select
                className="flex-1 border border-gray-300 rounded px-2 py-2 text-base text-gray-800 bg-white font-normal"
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
                className="inline-flex items-center justify-center border border-gray-300 rounded px-2 py-2 text-gray-700 hover:bg-gray-50"
              >
                <MdRefresh size={18} />
              </button>
            </div>
          ) : null}
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
          <DashboardContent>{children}</DashboardContent>
        </ProgramProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}
