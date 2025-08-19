import { createClient } from '@supabase/supabase-js';

// Estas variables deben estar en un archivo .env.local
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = envUrl || 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseAnonKey = envKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';

// Custom fetch para instrumentar todas las llamadas (cliente y servidor)
const instrumentedFetch: typeof fetch = async (input: any, init?: RequestInit) => {
  try {
    const url = typeof input === 'string' ? input : (input?.url ?? input?.toString?.());
    if (url && typeof url === 'string') {
      try {
        const u = new URL(url);
        // Solo marcar exactamente el recurso /attendance, no /attendance_status
        if (!u.pathname.endsWith('/attendance')) {
          return fetch(input as any, init);
        }
        const dateParams = u.searchParams.getAll('date');
        const hasEq = dateParams.some(v => v.startsWith('eq.'));
        const hasRange = dateParams.some(v => v.startsWith('gte.') || v.startsWith('lt.'));
        if (!hasEq || hasRange) {
          // Logs aparecerán en consola del navegador o en logs del servidor según el entorno
          console.warn('[ATTN/SB] Attendance request sospechosa:', url);
          console.warn('[ATTN/SB] method=', init?.method || 'GET');
        }
      } catch {}
    }
  } catch {}
  return fetch(input as any, init);
};

// Creamos el cliente de Supabase con fetch instrumentado
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: instrumentedFetch },
});

// Logs de diagnóstico (solo en navegador)
if (typeof window !== 'undefined') {
  const usingDefaults = !envUrl || !envKey;
  // No exponemos la key completa en logs
  const anonKeyPrefix = (envKey || supabaseAnonKey).slice(0, 8);
  console.log('[Supabase] URL ->', supabaseUrl);
  console.log('[Supabase] AnonKey prefix ->', anonKeyPrefix, usingDefaults ? '(fallback por defecto)' : '');
  if (usingDefaults) {
    console.warn('[Supabase] ADVERTENCIA: Usando valores por defecto. Configura .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY del proyecto correcto y reinicia el servidor.');
  }
}

export { supabase };
