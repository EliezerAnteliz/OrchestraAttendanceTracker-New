const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

async function runMigration() {
    try {
        console.log('Iniciando migración de datos...');
        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Las tablas ya deberían estar creadas en Supabase a través del dashboard
        // Procedemos directamente con la migración de datos
        require('./migrate-data.js');

    } catch (error) {
        console.error('Error durante el proceso de migración:', error);
    }
}

runMigration();
