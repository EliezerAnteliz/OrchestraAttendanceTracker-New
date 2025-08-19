const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración de Supabase usando las variables del .env
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lbanldhbmuabmybtlkbs.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL de Supabase:', supabaseUrl);
console.log('Clave API usada:', supabaseAnonKey ? 'Clave disponible' : 'Clave no disponible');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function exportCurrentData() {
    try {
        const tables = [
            'organizations',
            'students',
            'attendance',
            'attendance_reports',
            'attendance_settings',
            'attendance_status',
            'communications',
            'parents',
            'programs',
            'student_parents',
            'users'
        ];

        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const exportDir = path.resolve(`./backup_data/${date}`);
        
        // Asegurarse de que el directorio exista
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        for (const table of tables) {
            console.log(`\nExportando ${table}...`);
            
            // Consultar todos los datos de la tabla
            const { data, error } = await supabase
                .from(table)
                .select('*');
            
            if (error) {
                console.error(`Error al obtener datos de ${table}:`, error);
                continue;
            }
            
            if (!data || data.length === 0) {
                console.log(`No se encontraron datos en ${table}.`);
                continue;
            }
            
            // Escribir los datos a un archivo JSON
            const filePath = path.join(exportDir, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            
            console.log(`✅ ${data.length} registros exportados a ${filePath}`);
        }
        
        console.log('\n✅ Exportación completada exitosamente.');
    } catch (error) {
        console.error('Error durante la exportación:', error);
    }
}

// Ejecutar la función
exportCurrentData(); 