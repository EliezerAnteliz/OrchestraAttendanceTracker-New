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

  // Mismos colores de texto por rol que la tabla de Admin/Usuarios — sin
  // fondos de color, mismo criterio de "texto plano" que usa el resto de
  // la app en vez de pills multicolor.
  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'text-[#C2492B]';
      case 'staff': return 'text-[#56504A]';
      case 'viewer': return 'text-[#8A8177]';
      default: return 'text-[#8A8177]';
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
      {/* Indicador de vista actual — mismo tono de advertencia cálido
          (#F6EFDF/#8A6A22) usado en el resto de la app */}
      {viewingAsRole && (
        <div className="mb-2 text-xs text-[#8A6A22] bg-[#F6EFDF] px-2 py-1 rounded-md border border-[#EADFC0]">
          {t('viewing_as')}: {getRoleLabel(viewingAsRole)}
        </div>
      )}

      {/* Selector de rol */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E3DDD1] bg-[#FFFDFA] text-sm font-medium transition-colors hover:border-[#D6C9BB] ${getRoleColor(currentRole)}`}
        >
          {getRoleIcon(currentRole)}
          <span>{getRoleLabel(currentRole)}</span>
          <MdExpandMore className={`transition-transform text-[#A29889] ${isOpen ? 'rotate-180' : ''}`} size={16} />
        </button>

        {/* Dropdown — mismo patrón de panel flotante (fondo/borde/sombra)
            usado en modales del resto de la app */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-[#FFFDFA] border border-[#EAE3D6] rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="py-1">
              <div className="px-3 py-2 text-xs text-[#8A8177] border-b border-[#F2ECE1]">
                {t('switch_view_as')}:
              </div>

              {(['admin', 'staff', 'viewer'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1B1917] hover:bg-[#EFE9DD] transition-colors ${
                    currentRole === role ? 'bg-[#EFE0D5] font-medium' : ''
                  }`}
                >
                  <span className={getRoleColor(role)}>{getRoleIcon(role)}</span>
                  <span>{getRoleLabel(role)}</span>
                  {role === actualUserRole && (
                    <span className="ml-auto text-xs text-[#C2492B]">({t('your_role')})</span>
                  )}
                  {currentRole === role && role !== actualUserRole && (
                    <span className="ml-auto text-xs text-[#8A6A22]">({t('viewing')})</span>
                  )}
                </button>
              ))}

              {viewingAsRole && (
                <>
                  <div className="border-t border-[#F2ECE1] my-1"></div>
                  <button
                    onClick={() => {
                      resetToActualRole();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#C2492B] hover:bg-[#EFE9DD] transition-colors"
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
