import React from 'react';

interface StatisticsCardProps {
  title: string;
  value: number;
  percentage?: number;
  color: string;
  icon: React.ReactNode;
  isPercentage?: boolean;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({
  title,
  value,
  percentage,
  color,
  icon,
  isPercentage = false
}) => {
  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4 flex flex-col h-full">
      <div className="flex items-center mb-3">
        <div className={`p-2 rounded-sm mr-3`} style={{ backgroundColor: `${color}20` }}>
          <div style={{ color: color }}>{icon}</div>
        </div>
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      
      <div className="flex-1 flex flex-col justify-between">
        <div className="text-2xl font-bold" style={{ color }}>
          {isPercentage ? `${value.toFixed(1)}%` : value}
        </div>
        
        {percentage !== undefined && (
          <div className="mt-2 text-xs flex items-center">
            <span 
              className={`font-medium ${percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%
            </span>
            <span className="ml-1 text-gray-500">vs. período anterior</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsCard;
