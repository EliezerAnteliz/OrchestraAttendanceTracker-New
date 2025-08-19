import React from 'react';

interface AttendanceStatusIndicatorProps {
  statusCode: string | null | undefined;
}

const AttendanceStatusIndicator: React.FC<AttendanceStatusIndicatorProps> = ({ statusCode }) => {
  if (!statusCode || (typeof statusCode === 'string' && statusCode.trim() === '')) {
    return <span className="text-sm font-medium text-gray-900">No registrado</span>;
  }

  let displayName = "";
  let bgColor = "";
  let dotColor = "";
  let textColor = "text-sm font-medium text-gray-900";

  switch (statusCode.toUpperCase()) {
    case "A":
      displayName = "Asistió";
      bgColor = "bg-green-100";
      dotColor = "bg-green-500";
      textColor = "text-sm font-medium text-green-800";
      break;
    case "EA":
      displayName = "Excusa";
      bgColor = "bg-yellow-100";
      dotColor = "bg-yellow-500";
      textColor = "text-sm font-medium text-yellow-800";
      break;
    case "UA":
      displayName = "Falta";
      bgColor = "bg-red-100";
      dotColor = "bg-red-500";
      textColor = "text-sm font-medium text-red-800";
      break;
    default:
      displayName = statusCode;
      bgColor = "bg-gray-100";
      dotColor = "bg-gray-500";
      textColor = "text-sm font-medium text-gray-900";
  }

  return (
    <span className={`inline-flex items-center space-x-2 px-2 py-1 rounded ${bgColor}`}>
      <span className={`inline-block w-3 h-3 rounded-full ${dotColor}`}></span>
      <span className={`${textColor}`}>{displayName}</span>
    </span>
  );
};

export default AttendanceStatusIndicator;
