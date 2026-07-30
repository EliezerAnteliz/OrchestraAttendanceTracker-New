'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { MdPeople, MdCheckCircle, MdCalendarToday, MdShowChart,
         MdAssignmentTurnedIn, MdGroup, MdInsertChart, MdMusicNote } from 'react-icons/md';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';
import { useAuth } from '@/contexts/AuthContext';
import RoleSwitcher from '@/components/RoleSwitcher';

// Saludo + fecha/hora en vivo del encabezado — nombre viene de
// user_metadata.full_name (lo mismo que ya guarda la invitación de
// usuarios, ver api/admin/users/invite-user/route.ts), sin ninguna
// consulta nueva a Supabase. Si no hay full_name, cae al usuario del correo.
function useGreeting() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const fullName = (user?.user_metadata as any)?.full_name as string | undefined;
  const name = (fullName?.trim().split(/\s+/)[0]) || user?.email?.split('@')[0] || '';

  const hour = now ? now.getHours() : 12;
  const greetingKey = hour < 12 ? 'greeting_morning' : hour < 19 ? 'greeting_afternoon' : 'greeting_evening';

  const dateTimeLabel = now
    ? `${now.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · ${now.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';

  return { name, greetingKey, dateTimeLabel };
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { activeProgram } = useProgram();
  const { name, greetingKey, dateTimeLabel } = useGreeting();
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
    <div className="p-4 md:p-7 animate-fadeIn bg-[#FAF7F2] min-h-full">
    <div className="max-w-[1420px] mx-auto space-y-6">
      <div className="flex flex-col gap-4 pb-5 border-b border-[#E3DDD1]">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div className="flex-1">
            <h1
              className="text-[28px] md:text-[32px] leading-tight text-[#1B1917]"
              style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {t(greetingKey, { name })}
            </h1>
            <p className="text-[#8A8177] mt-2 text-sm">
              {t('dashboard_summary')}{dateTimeLabel ? ` · ${dateTimeLabel}` : ''}
            </p>
          </div>
          <div className="sm:ml-4">
            <RoleSwitcher />
          </div>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={t('total_students')}
          value={stats.totalStudents}
          icon={<MdPeople size={22} />}
        />
        <StatCard
          title={t('active_students')}
          value={stats.activeStudents}
          icon={<MdCheckCircle size={22} />}
        />
        <StatCard
          title={t('attendance_today')}
          value={stats.attendanceToday}
          icon={<MdCalendarToday size={22} />}
        />
        <StatCard
          title={t('attendance_rate')}
          value={`${stats.attendanceRate.toFixed(1)}%`}
          icon={<MdShowChart size={22} />}
          accent
        />
        <StatCard
          title={lang === 'es' ? 'Orquestas' : 'Orchestras'}
          value={stats.totalOrchestras}
          icon={<MdMusicNote size={22} />}
        />
      </div>

      {/* Sección de Orquestas */}
      {orchestraStats.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[15px] font-medium text-[#1B1917] mb-4">
            {lang === 'es' ? 'Estudiantes por Orquesta' : 'Students per Orchestra'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {orchestraStats.map((orchestra, index) => (
              <div
                key={index}
                className="bg-[#FFFDFA] rounded-xl p-5 border border-[#EAE3D6]"
              >
                <div className="flex items-center">
                  <div className="bg-[#EFE9DD] p-3 rounded-full mr-4">
                    <MdMusicNote className="text-[#C2492B]" size={22} />
                  </div>
                  <div>
                    <p className="text-sm text-[#8A8177] font-medium">{orchestra.name}</p>
                    <p
                      className="text-2xl text-[#1B1917] mt-0.5"
                      style={{ fontFamily: 'var(--font-newsreader), serif' }}
                    >
                      {orchestra.studentCount}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de acceso rápido */}
      <div className="mt-8">
        <h2 className="text-[15px] font-medium text-[#1B1917] mb-4">{t('quick_access')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAccessCard
            title={t('quick_register_attendance')}
            description={t('quick_register_attendance_desc')}
            href="/dashboard/attendance"
            icon={<MdAssignmentTurnedIn size={22} />}
          />
          <QuickAccessCard
            title={t('quick_student_list')}
            description={t('quick_student_list_desc')}
            href="/dashboard/students"
            icon={<MdGroup size={22} />}
          />
          <QuickAccessCard
            title={t('quick_generate_reports')}
            description={t('quick_generate_reports_desc')}
            href="/dashboard/reports"
            icon={<MdInsertChart size={22} />}
          />
        </div>
      </div>
    </div>
    </div>
  );
}

// Tarjetas del Dashboard con la paleta cálida del rediseño (30/07/26) —
// mismo patrón (crema + acento terracota) en toda la fila de estadísticas
// en vez de un color distinto por tarjeta. `accent` colorea el valor en
// terracota para la métrica destacada (tasa de asistencia).
function StatCard({ title, value, icon, accent }: { title: string; value: number | string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#8A8177] font-medium">{title}</p>
          <p
            className="mt-2 text-[#1B1917]"
            style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300, fontSize: 30, color: accent ? '#C2492B' : undefined }}
          >
            {value}
          </p>
        </div>
        <div className="bg-[#EFE9DD] p-2.5 rounded-full text-[#C2492B]">
          {icon}
        </div>
      </div>
    </div>
  );
}

// Tarjetas de acceso rápido — mismo lenguaje visual que StatCard de arriba.
function QuickAccessCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-[#FFFDFA] rounded-xl p-5 border border-[#EAE3D6] hover:border-[#C2492B] transition-colors flex items-start"
    >
      <div className="bg-[#EFE9DD] p-3 rounded-full mr-4 flex-shrink-0 text-[#C2492B]">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-[#1B1917]">{title}</h3>
        <p className="text-sm text-[#8A8177] mt-1">{description}</p>
      </div>
    </Link>
  );
}
