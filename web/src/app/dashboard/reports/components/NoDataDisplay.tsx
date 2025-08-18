import React from 'react';
import { MdInfoOutline } from 'react-icons/md';

interface NoDataDisplayProps {
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const NoDataDisplay: React.FC<NoDataDisplayProps> = ({
  message = 'No hay datos disponibles para mostrar',
  icon,
  action
}) => {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 flex flex-col items-center justify-center">
      {icon || <MdInfoOutline size={36} className="text-gray-400 mb-3" />}
      <p className="text-gray-600 text-center mb-4">{message}</p>
      
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-[#0073ea] text-white rounded-sm hover:bg-[#0060c0] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default NoDataDisplay;
