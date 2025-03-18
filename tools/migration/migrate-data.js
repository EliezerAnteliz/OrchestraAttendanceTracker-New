const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config();

// Base de datos anterior
const oldSupabase = createClient(
    'https://pqsdevojljjyhncgmnxq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxc2Rldm9qbGpqeWhuY2dtbnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MjQ3MzUsImV4cCI6MjA1NjAwMDczNX0.OudUl1WwDHjkMSUM1dac1XNSebjrblZRlriO4qg83n4'
);

// Nueva base de datos
const newSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function migrateData() {
    try {
        // 1. Obtener datos de la base de datos anterior
        console.log('Obteniendo datos de la base de datos anterior...');

        const { data: organizations, error: orgError } = await oldSupabase
            .from('organizations')
            .select('*');
        if (orgError) throw orgError;

        const { data: programs, error: progError } = await oldSupabase
            .from('programs')
            .select('*');
        if (progError) throw progError;

        const { data: students, error: studError } = await oldSupabase
            .from('students')
            .select('*');
        if (studError) throw studError;

        const { data: parents, error: parError } = await oldSupabase
            .from('parents')
            .select('*');
        if (parError) throw parError;

        const { data: studentParents, error: spError } = await oldSupabase
            .from('student_parents')
            .select('*');
        if (spError) throw spError;

        const { data: attendanceStatus, error: asError } = await oldSupabase
            .from('attendance_status')
            .select('*');
        if (asError) throw asError;

        // 2. Migrar datos a la nueva base de datos
        console.log('Migrando organizaciones...');
        const { error: newOrgError } = await newSupabase
            .from('organizations')
            .insert(organizations.map(org => ({
                ...org,
                settings: org.settings || {},
                contact_email: org.contact_email || null
            })));
        if (newOrgError) throw newOrgError;

        console.log('Migrando programas...');
        const { error: newProgError } = await newSupabase
            .from('programs')
            .insert(programs.map(prog => ({
                ...prog,
                settings: prog.settings || {},
                description: prog.description || null
            })));
        if (newProgError) throw newProgError;

        console.log('Migrando estados de asistencia...');
        const { error: newAsError } = await newSupabase
            .from('attendance_status')
            .insert(attendanceStatus);
        if (newAsError) throw newAsError;

        console.log('Migrando padres...');
        const { error: newParError } = await newSupabase
            .from('parents')
            .insert(parents.map(parent => ({
                ...parent,
                full_name: parent.full_name.normalize('NFC'),
                phone_number: parent.phone_number || null,
                email: parent.email || null,
                preferred_contact_method: parent.preferred_contact_method || 'phone',
                settings: parent.settings || {}
            })));
        if (newParError) throw newParError;

        console.log('Migrando estudiantes...');
        const { error: newStudError } = await newSupabase
            .from('students')
            .insert(students.map(student => ({
                ...student,
                first_name: student.first_name.trim(),
                last_name: student.last_name.trim(),
                instrument: student.instrument || 'Not Assigned',
                instrument_size: student.instrument_size || 'N/A',
                settings: student.settings || {},
                age: student.age || null,
                current_grade: student.current_grade || null,
                orchestra_position: student.orchestra_position || 'Section'
            })));
        if (newStudError) throw newStudError;

        console.log('Migrando relaciones estudiante-padre...');
        const { error: newSpError } = await newSupabase
            .from('student_parents')
            .insert(studentParents.map(relation => ({
                ...relation,
                relationship: relation.relationship || 'Parent',
                is_primary_contact: relation.is_primary_contact || true
            })));
        if (newSpError) throw newSpError;

        // 3. Guardar backup de los datos
        const backupDir = './backup_data';
        await fs.mkdir(backupDir, { recursive: true });

        await fs.writeFile(`${backupDir}/organizations.json`, JSON.stringify(organizations, null, 2));
        await fs.writeFile(`${backupDir}/programs.json`, JSON.stringify(programs, null, 2));
        await fs.writeFile(`${backupDir}/students.json`, JSON.stringify(students, null, 2));
        await fs.writeFile(`${backupDir}/parents.json`, JSON.stringify(parents, null, 2));
        await fs.writeFile(`${backupDir}/student_parents.json`, JSON.stringify(studentParents, null, 2));
        await fs.writeFile(`${backupDir}/attendance_status.json`, JSON.stringify(attendanceStatus, null, 2));

        console.log('¡Migración completada exitosamente!');
        console.log('Se ha creado un backup de los datos en el directorio backup_data/');

    } catch (error) {
        console.error('Error durante la migración:', error);
    }
}

// Ejecutar la migración
migrateData();
