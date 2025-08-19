import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Alert, Platform } from 'react-native';

const supabaseUrl = 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    // Configuración para mejorar la estabilidad de red
    global: {
        headers: {
            'X-Client-Info': 'OrchestraAttendanceTracker',
        },
        fetch: async (...args) => {
            // Verificar conexión antes de intentar peticiones
            const hasConnection = await checkConnection();
            if (!hasConnection) {
                throw new Error('No hay conexión a Internet');
            }
            
            // Configuramos un timeout más largo para entornos con mala conexión
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
            
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
    }
});

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
