import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYW5sZGhibXVhYm15YnRsa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NjU4NjIsImV4cCI6MjA1NjA0MTg2Mn0.ofneEtGGq3v7EAsuTVwywhuUMwMInbuONmu-nwgyXvM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
