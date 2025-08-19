import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';

// Usar variables de entorno para las credenciales de Supabase
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 
                   process.env.EXPO_PUBLIC_SUPABASE_URL || 
                   'https://lbanldhbmuabmybtlkbs.supabase.co';

const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 
                       process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';

// NOTA: Este proyecto usa Transaction pooler de Supabase para
// garantizar compatibilidad con redes IPv4. Esto está configurado
// directamente en el dashboard de Supabase y no requiere cambios
// en la URL de conexión en este código.

// Comprueba conexión a Internet antes de realizar solicitudes
const checkConnection = async () => {
  if (Platform.OS !== 'web') {
    try {
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  return true; // En web, asumimos que hay conexión
};

// Configuración de opciones extendidas para el cliente
const supabaseClientOptions = {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    global: {
        headers: {
            'X-Client-Info': 'OrchestraAttendanceTracker-ReactNative',
        },
        fetch: async (...args) => {
            // Verificar conexión antes de intentar peticiones
            const hasConnection = await checkConnection();
            if (!hasConnection) {
                throw new Error('No hay conexión a Internet');
            }
            
            // Configuramos un timeout más largo para entornos con mala conexión
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('⚠️ Timeout alcanzado en petición a Supabase (60s)');
                controller.abort();
            }, 60000); // Aumentado a 60 segundos para bases de datos que están "despertando"
            
            try {
                const response = await fetch(...args, { 
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                // Rethrow para que lo maneje el código de retry
                throw error;
            }
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 1, // Limitar eventos RT para evitar sobrecarga
        }
    },
    db: {
        schema: 'public',
    },
};

// Crear cliente con opciones extendidas
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseClientOptions);

// Función alternativa de ping que accede directamente a la API REST
export const pingSupabase = async () => {
    try {
        // Intentar una conexión directa a la API REST (esto suele funcionar incluso cuando el cliente no)
        const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
            }
        });
        
        if (response.ok) {
            return { success: true, status: response.status };
        } else {
            console.error('Error en conexión REST:', response.status);
            return { success: false, status: response.status, error: 'Error de respuesta' };
        }
    } catch (error) {
        console.error('Error en conexión REST:', error);
        return { success: false, error };
    }
};

// Función auxiliar para realizar peticiones con reintentos
export const fetchWithRetry = async (fetchFunction, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fetchFunction();
        } catch (error) {
            console.log(`Intento ${attempt + 1} fallido:`, error);
            lastError = error;
            
            // Esperar antes de reintentar (tiempo exponencial)
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    
    throw lastError;
};

// Función para probar la conectividad básica a Supabase
export const testSupabaseConnection = async () => {
    try {
        // 1. Probar respuesta HTTP básica del servidor de Supabase (sin autenticación)
        try {
            // Usamos AbortController para manejar el timeout manualmente
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.error('⚠️ Timeout alcanzado en prueba HTTP básica');
                controller.abort();
            }, 30000); // 30 segundos
            
            const httpTest = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const status = httpTest.status;
        } catch (error) {
            console.error('Error en prueba HTTP básica:', error);
            
            if (error.name === 'AbortError') {
                console.error('La conexión a Supabase ha tomado demasiado tiempo');
                console.error('Esto suele ocurrir cuando un proyecto gratuito de Supabase ha estado inactivo');
                console.error('y necesita tiempo para "despertar" (puede tardar hasta 2 minutos).');
            }
            
            return { 
                success: false, 
                error, 
                stage: 'http',
                message: 'La base de datos podría estar inactiva y reiniciándose. Puede tardar hasta 2 minutos en responder.'
            };
        }
        
        // 2. Probar autenticación
        const { data: authData, error: authError } = await supabase.auth.getSession();
        
        if (authError) {
            console.error('Error de autenticación:', authError);
            return { success: false, error: authError, stage: 'auth' };
        }
        
        // 3. Prueba de acceso a tablas
        const { data, error } = await supabase.from('students').select('id').limit(1);
        
        if (error) {
            console.error('Error accediendo a tabla:', error);
            return { success: false, error, stage: 'data' };
        }
        
        return { success: true, data };
        
    } catch (error) {
        console.error('Error durante prueba de conexión:', error);
        return { success: false, error, stage: 'fetch' };
    }
};
