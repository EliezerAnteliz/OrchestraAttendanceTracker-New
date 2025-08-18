import React from 'react';
import { MdCalendarViewWeek, MdCalendarMonth, MdToday } from 'react-icons/md';

interface PeriodSelectorProps {
  periodType: 'week' | 'month' | 'year';
  setPeriodType: (type: 'week' | 'month' | 'year') => void;
  setReportData?: (data: any) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  periodType,
  setPeriodType,
  setReportData
}) => {
  const handlePeriodChange = (period: 'week' | 'month' | 'year') => {
    setPeriodType(period);
    setReportData && setReportData(null);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4 mb-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Período</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handlePeriodChange('week')}
          className={`flex flex-row items-center px-3 py-2 rounded-sm border
            ${periodType === 'week' 
              ? 'bg-[#0073ea] text-white border-[#0073ea]' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          <MdCalendarViewWeek size={18} className="mr-2" />
          <span className="text-sm font-medium">Semanal</span>
        </button>
        
        <button
          onClick={() => handlePeriodChange('month')}
          className={`flex flex-row items-center px-3 py-2 rounded-sm border
            ${periodType === 'month' 
              ? 'bg-[#0073ea] text-white border-[#0073ea]' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          <MdCalendarMonth size={18} className="mr-2" />
          <span className="text-sm font-medium">Mensual</span>
        </button>
        
        <button
          onClick={() => handlePeriodChange('year')}
          className={`flex flex-row items-center px-3 py-2 rounded-sm border
            ${periodType === 'year' 
              ? 'bg-[#0073ea] text-white border-[#0073ea]' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          <MdToday size={18} className="mr-2" />
          <span className="text-sm font-medium">Anual</span>
        </button>
      </div>
    </div>
  );
};

export default PeriodSelector;
