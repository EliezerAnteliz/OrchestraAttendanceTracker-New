import React from 'react';
import LoadingIndicator from './LoadingIndicator';
import ErrorDisplay from './ErrorDisplay';
import NoDataDisplay from './NoDataDisplay';
import { AttendanceByInstrument, WeeklyStats } from '../services/reportService';

interface PieChartProps {
  present: number;
  excused: number;
  unexcused: number;
  loading?: boolean;
  error?: string | null;
}

interface BarChartProps {
  weeklyData: WeeklyStats[];
  loading?: boolean;
  error?: string | null;
}

interface InstrumentChartProps {
  instrumentData: AttendanceByInstrument[];
  loading?: boolean;
  error?: string | null;
}

export const AttendancePieChart: React.FC<PieChartProps> = ({ present, excused, unexcused, loading = false, error = null }) => {
  const total = present + excused + unexcused;
  const presentPercentage = total > 0 ? (present / total) * 100 : 0;
  const excusedPercentage = total > 0 ? (excused / total) * 100 : 0;
  const unexcusedPercentage = total > 0 ? (unexcused / total) * 100 : 0;

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Distribución de Asistencia</h3>
      <div className="h-64 flex items-center justify-center">
        {loading ? (
          <LoadingIndicator size="small" message="Cargando datos..." />
        ) : error ? (
          <ErrorDisplay message={error} severity="error" />
        ) : total === 0 ? (
          <NoDataDisplay message="No hay datos de asistencia disponibles" />
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth="20"
                  strokeDasharray={`${presentPercentage} ${100 - presentPercentage}`}
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#fbbf24"
                  strokeWidth="20"
                  strokeDasharray={`${excusedPercentage} ${100 - excusedPercentage}`}
                  strokeDashoffset={`${-presentPercentage}`}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#ef4444"
                  strokeWidth="20"
                  strokeDasharray={`${unexcusedPercentage} ${100 - unexcusedPercentage}`}
                  strokeDashoffset={`${-(presentPercentage + excusedPercentage)}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-700">{total}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 mr-2 rounded"></div>
                <span>Asistencias: {present} ({presentPercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-400 mr-2 rounded"></div>
                <span>Faltas Justificadas: {excused} ({excusedPercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 mr-2 rounded"></div>
                <span>Faltas Injustificadas: {unexcused} ({unexcusedPercentage.toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const WeeklyBarChart: React.FC<BarChartProps> = ({ weeklyData, loading = false, error = null }) => {
  const maxValue = Math.max(
    ...weeklyData.flatMap(week => [
      week.total_attendance,
      week.total_excused_absences,
      week.total_unexcused_absences
    ])
  );

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Tendencia Semanal</h3>
      <div className="h-64">
        {loading ? (
          <LoadingIndicator size="small" message="Cargando tendencias..." />
        ) : error ? (
          <ErrorDisplay message={error} severity="error" />
        ) : !weeklyData || weeklyData.length === 0 ? (
          <NoDataDisplay message="No hay datos semanales disponibles" />
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex items-end justify-around space-x-2 mb-4">
              {weeklyData.map((week, index) => {
                const total = week.total_attendance + week.total_excused_absences + week.total_unexcused_absences;
                const attendanceHeight = maxValue > 0 ? (week.total_attendance / maxValue) * 180 : 0;
                const excusedHeight = maxValue > 0 ? (week.total_excused_absences / maxValue) * 180 : 0;
                const unexcusedHeight = maxValue > 0 ? (week.total_unexcused_absences / maxValue) * 180 : 0;
                
                return (
                  <div key={index} className="flex flex-col items-center space-y-1">
                    <div className="flex space-x-1">
                      <div
                        className="w-6 bg-blue-500 rounded-t"
                        style={{ height: `${attendanceHeight}px` }}
                        title={`Asistencias: ${week.total_attendance}`}
                      ></div>
                      <div
                        className="w-6 bg-yellow-400 rounded-t"
                        style={{ height: `${excusedHeight}px` }}
                        title={`Faltas Justificadas: ${week.total_excused_absences}`}
                      ></div>
                      <div
                        className="w-6 bg-red-500 rounded-t"
                        style={{ height: `${unexcusedHeight}px` }}
                        title={`Faltas Injustificadas: ${week.total_unexcused_absences}`}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600 text-center">{week.weekLabel}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center space-x-4 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 mr-1 rounded"></div>
                <span>Asistencias</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-400 mr-1 rounded"></div>
                <span>Faltas Justificadas</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 mr-1 rounded"></div>
                <span>Faltas Injustificadas</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const InstrumentBarChart: React.FC<InstrumentChartProps> = ({ instrumentData, loading = false, error = null }) => {
  // Ordenar por tasa de asistencia descendente y limitar a los 5 principales
  const topInstruments = [...instrumentData]
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 5);

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Asistencia por Instrumento</h3>
      <div className="h-64">
        {loading ? (
          <LoadingIndicator size="small" message="Cargando datos por instrumento..." />
        ) : error ? (
          <ErrorDisplay message={error} severity="error" />
        ) : !instrumentData || instrumentData.length === 0 ? (
          <NoDataDisplay message="No hay datos por instrumento disponibles" />
        ) : (
          <div className="h-full flex flex-col justify-between">
            <div className="space-y-3">
              {topInstruments.map((instrument, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-24 text-sm text-gray-600 truncate mr-3">
                    {instrument.instrument}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${instrument.attendanceRate}%` }}
                    >
                      <span className="text-white text-xs font-medium">
                        {instrument.attendanceRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 text-xs text-gray-500">
                    {instrument.present}/{instrument.total}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 text-center mt-4">
              Mostrando los 5 instrumentos con mayor tasa de asistencia
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
