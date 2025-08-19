const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const dotenv = require('dotenv');

dotenv.config();

// Base de datos anterior
const oldSupabase = createClient(
    'https://pqsdevojljjyhncgmnxq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxc2Rldm9qbGpqeWhuY2dtbnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MjQ3MzUsImV4cCI6MjA1NjAwMDczNX0.OudUl1WwDHjkMSUM1dac1XNSebjrblZRlriO4qg83n4'
);

// Nueva base de datos (usar SERVICE KEY para bypass RLS en migración)
const newSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

function chunkArray(arr, size) {
    const res = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
}

// Mapear varios formatos a códigos estándar A / EA / UA
function normalizeStatusCode(input, validCodes) {
    if (!input) return null;
    const s = String(input).trim().toUpperCase();
    if (validCodes?.has(s)) return s;
    const presentMatches = new Set(['A', 'PRESENT', 'PRESENTE', 'ASISTIO', 'ASISTIÓ']);
    const excusedMatches = new Set(['EA', 'EXCUSED', 'EXCUSED ABSENCE', 'FALTA JUSTIFICADA']);
    const unexcusedMatches = new Set(['UA', 'UNEXCUSED', 'UNEXCUSED ABSENCE', 'FALTA INJUSTIFICADA']);
    if (presentMatches.has(s)) return 'A';
    if (excusedMatches.has(s)) return 'EA';
    if (unexcusedMatches.has(s)) return 'UA';
    return null;
}

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

        const { data: attendance, error: attError } = await oldSupabase
            .from('attendance')
            .select('*');
        if (attError) throw attError;

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

        // Preparar utilitarios para asistencia
        console.log('Preparando migración de asistencia...');
        const validCodesSet = new Set(
            (attendanceStatus || []).map(s => String(s.code).toUpperCase())
        );
        const oldStudentProgramById = new Map(
            (students || []).map(s => [s.id, s.program_id || null])
        );

        // Obtener ID de Stafford en la nueva base
        const { data: staffRows, error: staffErr } = await newSupabase
            .from('programs')
            .select('id')
            .eq('name', 'Stafford')
            .limit(1);
        if (staffErr) throw staffErr;
        const staffordId = staffRows && staffRows[0] ? staffRows[0].id : null;
        if (!staffordId) {
            throw new Error('No se encontró el programa "Stafford" en la nueva base de datos. Crea el programa antes de migrar asistencia.');
        }

        // Transformar registros de asistencia
        const transformedAttendance = (attendance || []).map(rec => {
            // Derivar status_code
            let code = null;
            if (rec.status_code) code = normalizeStatusCode(rec.status_code, validCodesSet);
            if (!code && rec.status) code = normalizeStatusCode(rec.status, validCodesSet);
            if (!code && rec.code) code = normalizeStatusCode(rec.code, validCodesSet);
            if (!code) code = 'A'; // fallback seguro

            // Derivar program_id
            let program_id = rec.program_id || oldStudentProgramById.get(rec.student_id) || staffordId;

            // Construir payload limpiando campos ambiguos
            const { status, status_id, attendance_status_id, ...rest } = rec;
            return {
                ...rest,
                status_code: code,
                program_id,
            };
        });

        console.log(`Migrando asistencia: ${transformedAttendance.length} registros...`);
        const chunks = chunkArray(transformedAttendance, 1000);
        for (let i = 0; i < chunks.length; i++) {
            const { error: insErr } = await newSupabase
                .from('attendance')
                .insert(chunks[i]);
            if (insErr) {
                console.error(`Error insertando chunk ${i + 1}/${chunks.length}:`, insErr);
                throw insErr;
            }
            console.log(`Chunk ${i + 1}/${chunks.length} insertado (${chunks[i].length} filas)`);
        }

        // 3. Guardar backup de los datos
        const backupDir = './backup_data';
        await fs.mkdir(backupDir, { recursive: true });

        await fs.writeFile(`${backupDir}/organizations.json`, JSON.stringify(organizations, null, 2));
        await fs.writeFile(`${backupDir}/programs.json`, JSON.stringify(programs, null, 2));
        await fs.writeFile(`${backupDir}/students.json`, JSON.stringify(students, null, 2));
        await fs.writeFile(`${backupDir}/parents.json`, JSON.stringify(parents, null, 2));
        await fs.writeFile(`${backupDir}/student_parents.json`, JSON.stringify(studentParents, null, 2));
        await fs.writeFile(`${backupDir}/attendance_status.json`, JSON.stringify(attendanceStatus, null, 2));
        await fs.writeFile(`${backupDir}/attendance.json`, JSON.stringify(attendance, null, 2));

        console.log('¡Migración completada exitosamente!');
        console.log('Se ha creado un backup de los datos en el directorio backup_data/');

    } catch (error) {
        console.error('Error durante la migración:', error);
    }
}

// Ejecutar la migración
migrateData();
