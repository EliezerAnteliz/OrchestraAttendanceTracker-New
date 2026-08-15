'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { useProgram } from '@/contexts/ProgramContext';
import { useAuth } from '@/contexts/AuthContext';
import RoleSwitcher from '@/components/RoleSwitcher';

// Saludo + fecha/hora en vivo del encabezado — el nombre "bonito" (con
// mayúscula y espacios) vive en user_profiles.full_name, la misma columna
// que ya usa la tabla de Admin/Usuarios; user_metadata.full_name puede no
// existir (cuentas creadas antes del flujo de invitación), así que primero
// se intenta la consulta a user_profiles y solo si falla se cae a
// user_metadata y, en último caso, al usuario del correo tal cual.
function useGreeting() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  const [profileFullName, setProfileFullName] = useState<string | undefined>(undefined);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (mounted && data?.full_name) setProfileFullName(data.full_name);
      });
    return () => { mounted = false; };
  }, [user?.id]);

  const fullName = profileFullName || ((user?.user_metadata as any)?.full_name as string | undefined);
  const name = (fullName?.trim().split(/\s+/)[0]) || user?.email?.split('@')[0] || '';

  const hour = now ? now.getHours() : 12;
  const greetingKey = hour < 12 ? 'greeting_morning' : hour < 19 ? 'greeting_afternoon' : 'greeting_evening';

  const dateTimeLabel = now
    ? `${now.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })} · ${now.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';

  return { name, greetingKey, dateTimeLabel };
}

// Caché en memoria del último resultado por sede (vive mientras dure la
// pestaña del navegador, se pierde al recargar — no usa localStorage).
// El componente se desmonta y se vuelve a montar cada vez que se navega
// a esta pestaña desde el menú, así que sin esto siempre arrancaba desde
// stats en cero y mostraba el skeleton de nuevo. Con la caché, si ya se
// visitó esa sede en esta sesión, se muestran las últimas cifras al
// instante y se refrescan en segundo plano (sin skeleton); el skeleton
// solo aparece la primera vez que se abre esa sede.
type DashboardStats = { totalStudents: number; activeStudents: number; attendanceToday: number; attendanceRate: number; totalOrchestras: number };
type DashboardCacheEntry = { stats: DashboardStats; orchestraStats: Array<{ name: string; studentCount: number }> };
const dashboardStatsCache: Record<string, DashboardCacheEntry> = {};

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { activeProgram, loading: programLoading } = useProgram();
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
    // Esperamos a que ProgramContext resuelva activeProgram — mismo caso
    // que en Estudiantes (14/08): si no, el "!activeProgram?.id" de abajo
    // pone stats en cero un instante antes de que llegue el programa real.
    if (programLoading) return;

    async function fetchDashboardData() {
      const programId = activeProgram?.id;
      const cached = programId ? dashboardStatsCache[programId] : undefined;

      // Ya visitamos esta sede en esta sesión: mostrar lo último conocido
      // de inmediato (sin skeleton) y refrescar en segundo plano más abajo.
      if (cached) {
        setStats(cached.stats);
        setOrchestraStats(cached.orchestraStats);
        setInitialLoad(false);
      }

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
        
        const freshStats: DashboardStats = {
          totalStudents: totalStudents || 0,
          activeStudents: activeStudents || 0,
          attendanceToday,
          attendanceRate,
          totalOrchestras: orchestrasData?.length || 0,
        };
        setStats(freshStats);
        setOrchestraStats(orchestraStatsData);
        if (programId) {
          dashboardStatsCache[programId] = { stats: freshStats, orchestraStats: orchestraStatsData };
        }
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
  }, [activeProgram?.id, programLoading]);

  // Solo mostrar skeleton en la primera carga inicial — mismos colores/
  // estructura que el Dashboard real (bg-[#FFFDFA] + borde [#EAE3D6], sin
  // íconos) para que la transición no salte al modelo gris/azul viejo
  // mientras carga.
  if (programLoading || (loading && initialLoad)) {
    return (
      <div className="p-4 md:p-7 bg-[#FAF7F2] min-h-full animate-fadeIn">
      <div className="max-w-[1420px] mx-auto space-y-6">
        <div className="flex flex-col gap-4 pb-5 border-b border-[#E3DDD1]">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
            <div className="flex-1">
              <div className="h-8 bg-[#EFE9DD] rounded w-64 animate-pulse mb-2"></div>
              <div className="h-4 bg-[#EFE9DD] rounded w-96 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Skeleton para tarjetas de estadísticas — mismo formato que StatCard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-4">
              <div className="h-3 bg-[#EFE9DD] rounded w-20 animate-pulse"></div>
              <div className="h-7 bg-[#EFE9DD] rounded w-12 animate-pulse mt-2.5"></div>
              <div className="h-3 bg-[#EFE9DD] rounded w-24 animate-pulse mt-2"></div>
            </div>
          ))}
        </div>

        {/* Skeleton para orquestas + acceso rápido */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 mt-4">
          <div className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-5">
            <div className="h-4 bg-[#EFE9DD] rounded w-48 animate-pulse mb-5"></div>
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-2 bg-[#EFE9DD] rounded-full animate-pulse"></div>
              ))}
            </div>
          </div>
          <div className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-5">
            <div className="h-4 bg-[#EFE9DD] rounded w-32 animate-pulse mb-4"></div>
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-3 bg-[#EFE9DD] rounded w-full animate-pulse"></div>
              ))}
            </div>
          </div>
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

      {/* Tarjetas de estadísticas — sin ícono, como en el mockup: solo
          etiqueta + número + una línea de contexto debajo. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={t('total_students')}
          value={stats.totalStudents}
          subtitle={lang === 'es' ? 'en todos los sitios' : 'across all sites'}
        />
        <StatCard
          title={t('active_students')}
          value={stats.activeStudents}
          subtitle={lang === 'es' ? `inscritos en ${activeProgram?.name || 'este sitio'}` : `enrolled at ${activeProgram?.name || 'this site'}`}
        />
        <StatCard
          title={t('attendance_today')}
          value={stats.attendanceToday}
          subtitle={lang === 'es' ? 'nada registrado aún hoy' : 'nothing recorded yet today'}
        />
        <StatCard
          title={t('attendance_rate')}
          value={`${stats.attendanceRate.toFixed(1)}%`}
          subtitle={lang === 'es' ? 'hoy, este sitio' : 'today, this site'}
          accent
        />
        <StatCard
          title={lang === 'es' ? 'Orquestas' : 'Orchestras'}
          value={stats.totalOrchestras}
          subtitle={orchestraStats.map((o) => o.name).join(' · ')}
        />
      </div>

      {/* Orquestas + Acceso rápido — una sola fila de 2 columnas (1.15fr /
          1fr), como el mockup: no dos secciones apiladas a todo el ancho. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 mt-4">
        {orchestraStats.length > 0 && (
          <div className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-5">
            <h2 className="text-[14.5px] font-medium text-[#1B1917] mb-5">
              {lang === 'es' ? 'Estudiantes por orquesta' : 'Students per orchestra'}
            </h2>
            <div className="flex flex-col gap-4">
              {orchestraStats.map((orchestra, index) => {
                const maxCount = Math.max(...orchestraStats.map((o) => o.studentCount), 1);
                const pct = Math.round((orchestra.studentCount / maxCount) * 100);
                return (
                  <div key={index} className="grid grid-cols-[92px_minmax(0,1fr)_34px] items-center gap-3.5">
                    <span className="text-[17px] text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif' }}>
                      {orchestra.name}
                    </span>
                    <span className="h-2 rounded-full bg-[#EFE9DD] block relative overflow-hidden">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full block"
                        style={{ width: `${pct}%`, background: index === 0 ? '#C2492B' : '#C2A08B' }}
                      />
                    </span>
                    <span className="text-right text-[20px] text-[#1B1917]" style={{ fontFamily: 'var(--font-newsreader), serif' }}>
                      {orchestra.studentCount}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[#EFE9DD] mt-5 pt-3.5 text-[12.5px] text-[#8A8177]">
              {lang === 'es'
                ? `${orchestraStats.reduce((a, o) => a + o.studentCount, 0)} de ${stats.totalStudents} estudiantes asignados a una orquesta en este sitio`
                : `${orchestraStats.reduce((a, o) => a + o.studentCount, 0)} of ${stats.totalStudents} students assigned to an orchestra at this site`}
            </div>
          </div>
        )}

        <div className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] px-5 pt-5">
          <h2 className="text-[14.5px] font-medium text-[#1B1917] mb-1.5">{t('quick_access')}</h2>
          <QuickAccessCard
            title={t('quick_register_attendance')}
            description={t('quick_register_attendance_desc')}
            href="/dashboard/attendance"
          />
          <QuickAccessCard
            title={t('quick_student_list')}
            description={t('quick_student_list_desc')}
            href="/dashboard/students"
          />
          <QuickAccessCard
            title={t('quick_generate_reports')}
            description={t('quick_generate_reports_desc')}
            href="/dashboard/reports"
            last
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
function StatCard({ title, value, subtitle, accent }: { title: string; value: number | string; subtitle?: string; accent?: boolean }) {
  return (
    <div className="bg-[#FFFDFA] rounded-xl border border-[#EAE3D6] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[#8A8177] font-medium">{title}</p>
      <p
        className="mt-2.5 text-[#1B1917] leading-none"
        style={{ fontFamily: 'var(--font-newsreader), serif', fontWeight: 300, fontSize: 30, color: accent ? '#C2492B' : undefined }}
      >
        {value}
      </p>
      {subtitle ? <p className="text-[12.5px] text-[#6E675E] mt-1.5">{subtitle}</p> : null}
    </div>
  );
}

// Fila de "acceso rápido" — sin ícono, solo texto + descripción + flecha,
// con una línea divisoria arriba de cada fila (igual que el mockup).
function QuickAccessCard({ title, description, href, last }: { title: string; description: string; href: string; last?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-baseline justify-between gap-4 border-t border-[#EFE9DD] py-3.5 group ${last ? 'pb-1' : ''}`}
    >
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[15px] text-[#1B1917] group-hover:text-[#C2492B] transition-colors">{title}</span>
        <span className="text-[12.5px] text-[#8A8177]">{description}</span>
      </span>
      <span className="text-[#C2492B] flex-shrink-0">→</span>
    </Link>
  );
}
