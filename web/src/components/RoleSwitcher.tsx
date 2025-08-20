'use client';

import { useState } from 'react';
import { MdExpandMore, MdPerson, MdAdminPanelSettings, MdGroups, MdVisibility } from 'react-icons/md';
import { useUserRole, UserRole } from '@/hooks/useUserRole';
import { useI18n } from '@/contexts/I18nContext';

export default function RoleSwitcher() {
  const { t } = useI18n();
  const { 
    actualUserRole, 
    viewingAsRole, 
    canSwitchRoles, 
    switchToRole, 
    resetToActualRole 
  } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);

  if (!canSwitchRoles) {
    return null;
  }

  const currentRole = viewingAsRole || actualUserRole;
  
  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <MdAdminPanelSettings size={16} />;
      case 'staff': return <MdGroups size={16} />;
      case 'viewer': return <MdVisibility size={16} />;
      default: return <MdPerson size={16} />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return t('admin_label');
      case 'staff': return t('staff_label');
      case 'viewer': return t('viewer_label');
      default: return 'Unknown';
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    if (role === actualUserRole) {
      resetToActualRole();
    } else {
      switchToRole(role);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Indicador de vista actual */}
      {viewingAsRole && (
        <div className="mb-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
          {t('viewing_as')}: {getRoleLabel(viewingAsRole)}
        </div>
      )}
      
      {/* Selector de rol */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${getRoleColor(currentRole)} hover:opacity-80`}
        >
          {getRoleIcon(currentRole)}
          <span>{getRoleLabel(currentRole)}</span>
          <MdExpandMore className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} size={16} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="py-1">
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                {t('switch_view_as')}:
              </div>
              
              {(['admin', 'staff', 'viewer'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    currentRole === role ? 'bg-gray-100 font-medium' : ''
                  }`}
                >
                  {getRoleIcon(role)}
                  <span>{getRoleLabel(role)}</span>
                  {role === actualUserRole && (
                    <span className="ml-auto text-xs text-blue-600">({t('your_role')})</span>
                  )}
                  {currentRole === role && role !== actualUserRole && (
                    <span className="ml-auto text-xs text-orange-600">({t('viewing')})</span>
                  )}
                </button>
              ))}
              
              {viewingAsRole && (
                <>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={() => {
                      resetToActualRole();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <MdPerson size={16} />
                    <span>{t('reset_to_actual_role')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
