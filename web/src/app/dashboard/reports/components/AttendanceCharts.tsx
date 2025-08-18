import React from 'react';
import LoadingIndicator from './LoadingIndicator';
import ErrorDisplay from './ErrorDisplay';
import NoDataDisplay from './NoDataDisplay';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { AttendanceByInstrument, WeeklyStats } from '../services/reportService';

// Registrar componentes de ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

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
  const data = {
    labels: ['Asistencias', 'Faltas Justificadas', 'Faltas Injustificadas'],
    datasets: [
      {
        data: [present, excused, unexcused],
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const total = present + excused + unexcused;
            const value = context.raw;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
  };

  return (
    <div className="bg-white border border-gray-300 rounded-sm p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Distribución de Asistencia</h3>
      <div className="h-64">
        {loading ? (
          <LoadingIndicator size="small" message="Cargando datos..." />
        ) : error ? (
          <ErrorDisplay message={error} severity="error" />
        ) : present === 0 && excused === 0 && unexcused === 0 ? (
          <NoDataDisplay message="No hay datos de asistencia disponibles" />
        ) : (
          <Pie data={data} options={options} />
        )}
      </div>
    </div>
  );
};

export const WeeklyBarChart: React.FC<BarChartProps> = ({ weeklyData, loading = false, error = null }) => {
  const labels = weeklyData.map(week => week.weekLabel);
  
  const data = {
    labels,
    datasets: [
      {
        label: 'Asistencias',
        data: weeklyData.map(week => week.total_attendance),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
      },
      {
        label: 'Faltas Justificadas',
        data: weeklyData.map(week => week.total_excused_absences),
        backgroundColor: 'rgba(255, 206, 86, 0.8)',
      },
      {
        label: 'Faltas Injustificadas',
        data: weeklyData.map(week => week.total_unexcused_absences),
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        stacked: false,
      },
      y: {
        stacked: false,
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
    },
  };

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
          <Bar data={data} options={options} />
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
  
  const labels = topInstruments.map(item => item.instrument);
  
  const data = {
    labels,
    datasets: [
      {
        label: 'Tasa de Asistencia (%)',
        data: topInstruments.map(item => item.attendanceRate.toFixed(1)),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        }
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const instrument = topInstruments[context.dataIndex];
            return [
              `Tasa de Asistencia: ${instrument.attendanceRate.toFixed(1)}%`,
              `Asistencias: ${instrument.present}`,
              `Total de registros: ${instrument.total}`
            ];
          }
        }
      }
    },
  };

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
          <Bar data={data} options={options} />
        )}
      </div>
    </div>
  );
};
