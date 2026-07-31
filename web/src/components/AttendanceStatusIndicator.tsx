import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface AttendanceStatusIndicatorProps {
  statusCode: string | null | undefined;
}

// Paleta de badges tomada del sistema de diseño cálido (SiteTrack App.dc.html,
// método badge(kind)): pastilla lisa con texto/fondo por estado, sin punto de color.
const AttendanceStatusIndicator: React.FC<AttendanceStatusIndicatorProps> = ({ statusCode }) => {
  const { t } = useI18n();

  let label = t('not_recorded');
  let color = '#8A8177';
  let bg = '#F1EDE4';

  if (statusCode && typeof statusCode === 'string' && statusCode.trim() !== '') {
    switch (statusCode.toUpperCase()) {
      case 'A':
        label = t('status_present');
        color = '#5F7A57';
        bg = '#EDF1E9';
        break;
      case 'EA':
        label = t('status_excused');
        color = '#8A6A22';
        bg = '#F6EFDF';
        break;
      case 'UA':
        label = t('status_unexcused');
        color = '#A8402A';
        bg = '#F8E9E4';
        break;
      default:
        label = statusCode;
        color = '#8A8177';
        bg = '#F1EDE4';
    }
  }

  return (
    <span
      className="inline-flex items-center text-[12px] font-medium"
      style={{ borderRadius: 20, padding: '5px 11px', background: bg, color }}
    >
      {label}
    </span>
  );
};

export default AttendanceStatusIndicator;
