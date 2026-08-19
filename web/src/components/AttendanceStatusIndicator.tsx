import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface AttendanceStatusIndicatorProps {
  statusCode: string | null | undefined;
}

// Paleta de badges — antes eran pastillas de fondo muy pálido con texto del
// mismo tono apagado (ej. "Present" en verde grisáceo sobre verde casi
// blanco), tan sutil que en una grilla con muchos alumnos costaba distinguir
// de un vistazo quién estaba presente/ausente/sin registrar (reportado por
// Eliezer, 19/08). Ahora los 3 estados con dato real (Present/Excused
// absence/Unexcused absence) son pastillas de color sólido con texto blanco
// — mismo family de color que el resto del sistema (verde/dorado/terracota)
// pero mucho más saturado, para que resalten de inmediato. "Sin registrar"
// se deja aparte, con estilo outline/neutro, para que sea obvio que ahí no
// hay dato — no compite visualmente con los 3 estados reales.
const AttendanceStatusIndicator: React.FC<AttendanceStatusIndicatorProps> = ({ statusCode }) => {
  const { t } = useI18n();

  let label = t('not_recorded');
  let color = '#6E675E';
  let bg = '#EDE8DD';
  let border: string | undefined = '#C7BFAE';

  if (statusCode && typeof statusCode === 'string' && statusCode.trim() !== '') {
    switch (statusCode.toUpperCase()) {
      case 'A':
        label = t('status_present');
        color = '#FFFFFF';
        bg = '#3F8F46';
        border = undefined;
        break;
      case 'EA':
        label = t('status_excused');
        color = '#FFFFFF';
        bg = '#C98A1D';
        border = undefined;
        break;
      case 'UA':
        label = t('status_unexcused');
        color = '#FFFFFF';
        bg = '#B23A22';
        border = undefined;
        break;
      default:
        label = statusCode;
        color = '#6E675E';
        bg = '#EDE8DD';
        border = '#C7BFAE';
    }
  }

  return (
    <span
      className="inline-flex items-center text-[12px] font-semibold"
      style={{
        borderRadius: 20,
        padding: '5px 11px',
        background: bg,
        color,
        border: border ? `1px solid ${border}` : undefined,
      }}
    >
      {label}
    </span>
  );
};

export default AttendanceStatusIndicator;
