import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { INVENTORY_SUPABASE_CONFIG } from '../../supabase.inventory.config';

/**
 * Cliente de Supabase para el módulo de Inventario/Auditoría.
 *
 * Hasta el 24/07 cada pantalla del módulo creaba su PROPIA instancia con
 * `createClient(INVENTORY_SUPABASE_CONFIG.url, ...)`. Eso tenía sentido
 * mientras Inventario vivía en un proyecto de Supabase de PRUEBA separado
 * (sin login, políticas públicas) — pero ahora que está conectado al MISMO
 * proyecto de producción que el resto de la app (Asistencia), crear una
 * instancia nueva por pantalla generaba 2+ clientes de Auth (GoTrueClient)
 * compitiendo por el mismo storage key del navegador. Eso causó un bug real
 * el 24/07: al crear el primer activo de prueba en producción, la instancia
 * recién creada de esa pantalla todavía no había terminado de cargar la
 * sesión desde localStorage cuando se disparó el INSERT, así que la petición
 * salió sin el token de autenticación → `auth.uid()` nulo en el servidor →
 * "new row violates row-level security policy" (42501), aunque el usuario
 * sí tenía sesión iniciada y rol Admin correcto.
 *
 * Fix: en producción, reutilizar el cliente COMPARTIDO que ya usa el resto
 * de la app (`@/lib/supabase`, que ya está inicializado y con sesión activa
 * para cuando el usuario llega a cualquier pantalla de Inventario) — cero
 * clientes duplicados, cero condición de carrera. En el ambiente de PRUEBA
 * (proyecto separado, sin login) se mantiene una instancia propia, ya que
 * ahí sí es un proyecto distinto y no hay sesión que compartir.
 */
export const inventorySupabase =
  INVENTORY_SUPABASE_CONFIG.environment === 'production'
    ? supabase
    : createClient(INVENTORY_SUPABASE_CONFIG.url, INVENTORY_SUPABASE_CONFIG.anonKey);
