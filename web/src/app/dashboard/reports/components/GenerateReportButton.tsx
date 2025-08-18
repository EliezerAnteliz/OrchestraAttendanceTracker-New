import React from 'react';
import { MdInsertChart, MdWarning } from 'react-icons/md';

interface GenerateReportButtonProps {
  onGenerate: () => void;
  loading: boolean;
  generating: boolean;
  disabled: boolean;
  reportType: 'individual' | 'group';
  selectedStudent: any | null;
  error?: string | null;
}

const GenerateReportButton: React.FC<GenerateReportButtonProps> = ({
  onGenerate,
  loading,
  generating,
  disabled,
  reportType,
  selectedStudent,
  error
}) => {
  // Validar si se puede generar el reporte
  const canGenerate = () => {
    if (loading || generating) return false;
    if (reportType === 'individual' && !selectedStudent) return false;
    return !disabled;
  };

  // Obtener mensaje de error o validación
  const getValidationMessage = () => {
    if (reportType === 'individual' && !selectedStudent) {
      return {
        type: 'warning',
        message: 'Debe seleccionar un estudiante para generar un reporte individual'
      };
    }
    if (error) {
      return {
        type: 'error',
        message: error
      };
    }
    return null;
  };

  const validationMessage = getValidationMessage();

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4 mb-4">
      <div className="flex flex-col">
        <button
          onClick={onGenerate}
          disabled={!canGenerate()}
          className={`flex items-center justify-center px-4 py-2 rounded-sm transition-colors
            ${canGenerate()
              ? 'bg-[#0073ea] text-white hover:bg-[#0060c0]'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
        >
          <MdInsertChart size={20} className="mr-2" />
          {generating ? 'Generando...' : 'Generar Reporte'}
          {generating && (
            <span className="ml-2 inline-block h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
          )}
        </button>
        
        {validationMessage && (
          <div className={`mt-3 flex items-start ${validationMessage.type === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
            <MdWarning size={16} className="mr-1 flex-shrink-0 mt-0.5" />
            <p className="text-xs">{validationMessage.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerateReportButton;
