import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Cargando...',
  size = 'medium',
  overlay = false
}) => {
  const sizeClasses = {
    small: 'w-4 h-4 border-2',
    medium: 'w-8 h-8 border-2',
    large: 'w-12 h-12 border-4'
  };

  const spinner = (
    <div className={`${sizeClasses[size]} border-t-[#0073ea] border-r-[#0073ea] border-b-gray-200 border-l-gray-200 rounded-full animate-spin`}></div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-md shadow-lg flex flex-col items-center">
          {spinner}
          {message && <p className="mt-3 text-gray-700">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6">
      {spinner}
      {message && <p className="mt-3 text-gray-600 text-sm">{message}</p>}
    </div>
  );
};

export default LoadingIndicator;
