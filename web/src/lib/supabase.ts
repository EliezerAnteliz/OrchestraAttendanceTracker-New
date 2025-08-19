import { createClient } from '@supabase/supabase-js';

// Estas variables deben estar en un archivo .env.local
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = envUrl || 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseAnonKey = envKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';

// Creamos el cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
