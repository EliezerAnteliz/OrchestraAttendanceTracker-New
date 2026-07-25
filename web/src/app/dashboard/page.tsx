'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdPeople, MdCheckCircle, MdCalendarToday, MdShowChart, 
         MdAssignmentTurnedIn, MdGroup, MdInsertChart, MdMusicNote } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';
import RoleSwitcher from '@/components/RoleSwitcher';

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { activeProgram } = useProgram();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    attendanceToday: 0,
    attendanceRate: 0,
    totalOrchestras: 0,
  });
  const [orchestraStats, setOrchestraStats] = useState<Array<{name: string, studentCount: number}>>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        if (!activeProgram?.id) {
          setStats({ totalStudents: 0, activeStudents: 0, attendanceToday: 0, attendanceRate: 0, totalOrchestras: 0 });
          setOrchestraStats([]);
          setLoading(false);
          return;
        }
        
        // Obtener el total de estudiantes
        const { count: totalStudents, error: studentsError, status: studentsStatus } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('program_id', activeProgram.id);
        if (studentsError) {
          console.error('[Dashboard] students total error ->', studentsError?.message || studentsError, { studentsStatus, studentsError });
          throw studentsError;
        }
        
        // Obtener estudiantes activos
        const { count: activeStudents, error: activeError, status: activeStatus } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('program_id', activeProgram.id);
        if (activeError) {
          console.error('[Dashboard] students active error ->', activeError?.message || activeError, { activeStatus, activeError });
          throw activeError;
        }
        
        // Calcular asistencia de HOY con datos reales de la tabla 'attendance'
        // 1) Obtener IDs de estudiantes activos
        const { data: activeIdsData, error: activeIdsError } = await supabase
          .from('students')
          .select('id')
          .eq('is_active', true)
          .eq('program_id', activeProgram.id);
        if (activeIdsError) {
          console.warn('No se pudieron obtener IDs de estudiantes activos:', activeIdsError);
        }
        const activeIds = new Set((activeIdsData || []).map((s: any) => s.id));
        const safeActiveStudents = activeIds.size;

        // 2) Fecha local de hoy (YYYY-MM-DD) sin desplazamientos por zona horaria
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // 3) Traer registros de asistencia de hoy
        // Usar rango [hoy, mañana) para cubrir columnas tipo DATE o TIMESTAMP
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const y2 = tomorrow.getFullYear();
        const m2 = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const d2 = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = `${y2}-${m2}-${d2}`;

        const { data: todayAttendance, error: todayErr, status: attendanceStatus } = await supabase
          .from('attendance')
          .select('student_id, date, status_code')
          .gte('date', todayStr)
          .lt('date', tomorrowStr);
        if (todayErr) {
          console.warn('[Dashboard] attendance today error ->', todayErr?.message || todayErr, { attendanceStatus, todayErr });
        }

        // 4) Contar asistencias (A) solo de estudiantes activos
        let attendanceToday = 0;
        (todayAttendance || []).forEach((r: any) => {
          if (!r || !activeIds.has(r.student_id)) return;
          let code = '';
          if (r.status_code) code = String(r.status_code).toUpperCase();
          if (code === 'A') attendanceToday += 1;
        });

        const attendanceRate = safeActiveStudents > 0 ? (attendanceToday / safeActiveStudents) * 100 : 0;
        
        // Obtener estadísticas de orquestas
        const { data: orchestrasData, error: orchestrasError } = await supabase
          .from('orchestras')
          .select('id, name')
          .eq('program_id', activeProgram.id)
          .eq('is_active', true);
        
        if (orchestrasError) {
          console.warn('Error al cargar orquestas:', orchestrasError);
        }
        
        // Contar estudiantes por orquesta
        const orchestraStatsData = await Promise.all(
          (orchestrasData || []).map(async (orchestra) => {
            const { count } = await supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('orchestra_id', orchestra.id)
              .eq('is_active', true);
            
            return {
              name: orchestra.name,
              studentCount: count || 0
            };
          })
        );
        
        // Ordenar por cantidad de estudiantes descendente
        orchestraStatsData.sort((a, b) => b.studentCount - a.studentCount);
        
        setStats({
          totalStudents: totalStudents || 0,
          activeStudents: activeStudents || 0,
          attendanceToday,
          attendanceRate,
          totalOrchestras: orchestrasData?.length || 0,
        });
        setOrchestraStats(orchestraStatsData);
      } catch (err: any) {
        const msg = err?.message || err?.hint || err?.details || 'No fue posible cargar los datos del dashboard.';
        console.error('Error al cargar datos del dashboard:', msg, err);
        setError(msg);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    }
    
    fetchDashboardData();
  }, [activeProgram?.id]);

  // Solo mostrar skeleton en la primera carga inicial
  if (loading && initialLoad) {
    return (
      <div className="p-4 md:p-6 space-y-6 animate-fadeIn">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Skeleton para tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="bg-gray-200 p-3 rounded-full mr-4 animate-pulse w-12 h-12"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton para sección de orquestas */}
        <div className="mt-8">
          <div className="h-6 bg-gray-200 rounded w-64 animate-pulse mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-200">
                <div className="flex items-center">
                  <div className="bg-gray-200 p-3 rounded-full mr-4 animate-pulse w-12 h-12"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-20 animate-pulse mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-50 p-4 rounded-md border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{t('welcome_dashboard')}</h1>
            <p className="text-gray-600 mt-1">
              {t('dashboard_summary')}
            </p>
          </div>
          <div className="sm:ml-4">
            <RoleSwitcher />
          </div>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title={t('total_students')}
          value={stats.totalStudents}
          icon={<MdPeople size={24} />}
          color="blue"
        />
        <StatCard
          title={t('active_students')}
          value={stats.activeStudents}
          icon={<MdCheckCircle size={24} />}
          color="green"
        />
        <StatCard
          title={t('attendance_today')}
          value={stats.attendanceToday}
          icon={<MdCalendarToday size={24} />}
          color="purple"
        />
        <StatCard
          title={t('attendance_rate')}
          value={`${stats.attendanceRate.toFixed(1)}%`}
          icon={<MdShowChart size={24} />}
          color="orange"
        />
        <StatCard
          title={lang === 'es' ? 'Orquestas' : 'Orchestras'}
          value={stats.totalOrchestras}
          icon={<MdMusicNote size={24} />}
          color="indigo"
        />
      </div>

      {/* Sección de Orquestas */}
      {orchestraStats.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {lang === 'es' ? 'Estudiantes por Orquesta' : 'Students per Orchestra'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {orchestraStats.map((orchestra, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500"
              >
                <div className="flex items-center">
                  <div className="bg-indigo-100 p-3 rounded-full mr-4">
                    <MdMusicNote className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{orchestra.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{orchestra.studentCount}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de acceso rápido */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('quick_access')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAccessCard
            title={t('quick_register_attendance')}
            description={t('quick_register_attendance_desc')}
            href="/dashboard/attendance"
            icon={<MdAssignmentTurnedIn size={24} />}
            color="blue"
          />
          <QuickAccessCard
            title={t('quick_student_list')}
            description={t('quick_student_list_desc')}
            href="/dashboard/students"
            icon={<MdGroup size={24} />}
            color="green"
          />
          <QuickAccessCard
            title={t('quick_generate_reports')}
            description={t('quick_generate_reports_desc')}
            href="/dashboard/reports"
            icon={<MdInsertChart size={24} />}
            color="orange"
          />
        </div>
      </div>
    </div>
  );
}

// Componente para las tarjetas de estadísticas
// Mismo patrón visual que las tarjetas del Dashboard de Inventario: borde
// izquierdo de color + ícono en círculo pastel (en vez del círculo de color
// sólido con ícono blanco que tenía antes).
const STAT_CARD_COLORS: Record<string, { border: string; iconBg: string; iconText: string }> = {
  blue: { border: 'border-blue-500', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
  green: { border: 'border-green-500', iconBg: 'bg-green-100', iconText: 'text-green-600' },
  purple: { border: 'border-purple-500', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  orange: { border: 'border-orange-500', iconBg: 'bg-orange-100', iconText: 'text-orange-600' },
  indigo: { border: 'border-indigo-500', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
};

function StatCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) {
  const styles = STAT_CARD_COLORS[color] || STAT_CARD_COLORS.blue;
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${styles.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${styles.iconBg} p-3 rounded-full`}>
          <span className={styles.iconText}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

// Componente para las tarjetas de acceso rápido — mismo lenguaje visual que
// las StatCard de arriba (borde izquierdo de color + ícono en círculo pastel),
// en vez del borde gris plano + lila fijo que tenía antes.
function QuickAccessCard({ title, description, href, icon, color }: { title: string; description: string; href: string; icon: React.ReactNode; color: string }) {
  const styles = STAT_CARD_COLORS[color] || STAT_CARD_COLORS.blue;
  return (
    <a
      href={href}
      className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${styles.border} hover:shadow-lg transition-shadow flex items-start`}
    >
      <div className={`${styles.iconBg} p-3 rounded-full mr-4 flex-shrink-0`}>
        <span className={styles.iconText}>{icon}</span>
      </div>
      <div>
        <h3 className="font-medium text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </a>
  );
}
