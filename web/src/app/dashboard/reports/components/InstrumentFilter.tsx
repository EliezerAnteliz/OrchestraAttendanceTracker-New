import React from 'react';

interface InstrumentFilterProps {
  selectedInstrument: string;
  setSelectedInstrument: (instrument: string) => void;
  instruments: string[];
  setReportData?: (data: any) => void;
}

const InstrumentFilter: React.FC<InstrumentFilterProps> = ({
  selectedInstrument,
  setSelectedInstrument,
  instruments,
  setReportData
}) => {
  const handleInstrumentChange = (instrument: string) => {
    setSelectedInstrument(instrument);
    setReportData && setReportData(null);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4 mb-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Instrumento</h2>
      <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <button
          onClick={() => handleInstrumentChange('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-sm border text-sm
            ${selectedInstrument === 'all' 
              ? 'bg-[#0073ea20] text-[#0073ea] border-[#0073ea]' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          Todos
        </button>
        
        {instruments.map((instrument) => (
          <button
            key={instrument}
            onClick={() => handleInstrumentChange(instrument)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-sm border text-sm
              ${selectedInstrument === instrument 
                ? 'bg-[#0073ea20] text-[#0073ea] border-[#0073ea]' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {instrument}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InstrumentFilter;
