import React from 'react';
import { MdPerson, MdGroups, MdBarChart } from 'react-icons/md';

interface ReportTypeSelectorProps {
  reportType: 'individual' | 'group';
  setReportType: (type: 'individual' | 'group') => void;
  setSelectedStudent?: (student: any) => void;
  setReportData?: (data: any) => void;
}

const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({
  reportType,
  setReportType,
  setSelectedStudent,
  setReportData
}) => {
  const handleTypeChange = (type: 'individual' | 'group') => {
    setReportType(type);
    if (type === 'individual') {
      setSelectedStudent && setSelectedStudent(null);
    }
    setReportData && setReportData(null);
  };

  return (
    <div className="w-full border border-gray-300 overflow-hidden mb-4">
      <div className="h-14 w-full flex flex-row">
        {/* Área izquierda - Reporte Individual */}
        <button
          onClick={() => handleTypeChange('individual')}
          className={`w-1/3 flex flex-col items-center justify-center border-r border-gray-300
            ${reportType === 'individual' ? 'bg-[#0073ea] text-white' : 'bg-[#f0f0f5] text-[#0073ea]'}`}
        >
          <MdPerson size={22} className="mb-0.5" />
          <span className="text-xs font-medium">Individual</span>
        </button>

        {/* Área central - Icono de Reporte */}
        <div className="flex-1 flex items-center justify-center bg-white border-r border-l border-gray-300 px-3">
          <MdBarChart size={28} className="text-[#0073ea] mr-2" />
          <span className="text-base font-medium text-[#0073ea]">Reportes</span>
        </div>
        
        {/* Área derecha - Reporte Grupal */}
        <button
          onClick={() => handleTypeChange('group')}
          className={`w-1/3 flex flex-col items-center justify-center border-l border-gray-300
            ${reportType === 'group' ? 'bg-[#0073ea] text-white' : 'bg-[#f0f0f5] text-[#0073ea]'}`}
        >
          <MdGroups size={22} className="mb-0.5" />
          <span className="text-xs font-medium">Grupal</span>
        </button>
      </div>
    </div>
  );
};

export default ReportTypeSelector;
