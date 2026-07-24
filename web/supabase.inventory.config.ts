/**
 * CONFIGURACIÓN DE SUPABASE PARA EL MÓDULO DE INVENTARIO
 *
 * Decisión 24/07: las credenciales de PRODUCCIÓN se leen de variables de
 * entorno dedicadas (NEXT_PUBLIC_INVENTORY_SUPABASE_URL /
 * NEXT_PUBLIC_INVENTORY_SUPABASE_ANON_KEY), no de texto plano en el código.
 *
 * IMPORTANTE — a propósito NO se reutilizan las variables
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY que ya usa el
 * resto de la app (Asistencia), aunque el plan confirmado es que Inventario
 * termine conectado al MISMO proyecto de producción. Esas variables ya
 * existen hoy en el entorno de Eliezer (las necesita Asistencia para
 * funcionar en local, que siempre corre contra producción real) — si
 * Inventario las reutilizara directamente, se reconectaría solo a
 * producción en el próximo `npm run dev`, sin que nadie lo decidiera a
 * propósito. Con variables propias, el cambio a producción solo ocurre
 * cuando alguien defina estas 2 variables nuevas de forma explícita
 * (en `.env.local` y en Vercel).
 *
 * Mientras NEXT_PUBLIC_INVENTORY_SUPABASE_URL/ANON_KEY no estén definidas,
 * se usa el proyecto de PRUEBA dedicado de Inventario (rrajmmykivbzzobljqmm)
 * — mismo comportamiento que hasta ahora, nada se rompe.
 */

const TEST_URL = 'https://rrajmmykivbzzobljqmm.supabase.co';
const TEST_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyYWptbXlraXZienpvYmxqcW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2ODE5OTgsImV4cCI6MjEwMDI1Nzk5OH0.iLTsfYwatvvb9G7aLTwHVY4iRDq3y_4z697Sa5eOqfo';
const TEST_PROJECT_ID = 'rrajmmykivbzzobljqmm';

const envUrl = process.env.NEXT_PUBLIC_INVENTORY_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_INVENTORY_SUPABASE_ANON_KEY;
const usingProduction = Boolean(envUrl && envAnonKey);

export const INVENTORY_SUPABASE_CONFIG = {
  url: envUrl || TEST_URL,
  anonKey: envAnonKey || TEST_ANON_KEY,
  projectId: usingProduction ? 'producción' : TEST_PROJECT_ID,
  region: usingProduction ? null : 'us-west-2',
  environment: usingProduction ? 'production' : 'test',
  description: usingProduction
    ? 'Producción — credenciales tomadas de NEXT_PUBLIC_INVENTORY_SUPABASE_*'
    : 'Proyecto de prueba exclusivo para desarrollo del módulo de inventario'
} as const;

// Tipo para TypeScript
export type InventorySupabaseConfig = typeof INVENTORY_SUPABASE_CONFIG;
