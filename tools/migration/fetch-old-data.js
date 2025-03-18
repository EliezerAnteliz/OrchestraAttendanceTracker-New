import oldSupabase from '../src/config/temp-supabase.js';

async function fetchAllData() {
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

        for (const table of tables) {
            console.log(`\nFetching ${table}...`);
            const { data, error } = await oldSupabase
                .from(table)
                .select('*')
                .limit(1000); // Limitando a 1000 registros por tabla
            
            if (error) {
                if (error.message?.includes('does not exist')) {
                    console.log(`Table ${table} does not exist`);
                } else {
                    console.error(`Error fetching ${table}:`, error);
                }
                continue;
            }

            if (data && data.length > 0) {
                // Save the data to a file for backup
                const fs = await import('fs');
                const path = await import('path');
                
                const backupDir = './backup_data';
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir);
                }

                const filePath = path.join(backupDir, `${table}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                
                console.log(`${table} data found: ${data.length} records`);
                console.log(`${table} data saved to ${filePath}`);
            } else {
                console.log(`No data found in ${table}`);
            }
        }

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchAllData();
