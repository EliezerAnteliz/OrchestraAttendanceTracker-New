import React from 'react';
import { MdError, MdRefresh } from 'react-icons/md';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  severity?: 'error' | 'warning' | 'info';
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  message,
  onRetry,
  severity = 'error'
}) => {
  const getStyles = () => {
    switch (severity) {
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600'
        };
      case 'info':
        return {
          container: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600'
        };
      default:
        return {
          container: 'bg-red-50 border-red-200',
          text: 'text-red-700',
          icon: 'text-red-600'
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.container} p-4 rounded-sm border flex items-start`}>
      <MdError className={`${styles.icon} mt-0.5 mr-3 flex-shrink-0`} size={20} />
      <div className="flex-grow">
        <p className={styles.text}>{message}</p>
      </div>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="ml-4 flex items-center px-3 py-1 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 text-sm"
        >
          <MdRefresh className="mr-1" size={16} />
          Reintentar
        </button>
      )}
    </div>
  );
};

export default ErrorDisplay;
