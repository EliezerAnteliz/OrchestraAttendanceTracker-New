const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

async function verifyData() {
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Verificar organizaciones
        const { data: organizations, error: orgError } = await supabase
            .from('organizations')
            .select('*');
        if (orgError) throw orgError;
        console.log('\nOrganizaciones:', organizations.length);
        console.log(organizations[0]);

        // Verificar programas
        const { data: programs, error: progError } = await supabase
            .from('programs')
            .select('*');
        if (progError) throw progError;
        console.log('\nProgramas:', programs.length);
        console.log(programs[0]);

        // Verificar estudiantes
        const { data: students, error: studError } = await supabase
            .from('students')
            .select('*');
        if (studError) throw studError;
        console.log('\nEstudiantes:', students.length);
        console.log(students[0]);

        // Verificar padres
        const { data: parents, error: parError } = await supabase
            .from('parents')
            .select('*');
        if (parError) throw parError;
        console.log('\nPadres:', parents.length);
        console.log(parents[0]);

        // Verificar relaciones estudiante-padre
        const { data: studentParents, error: spError } = await supabase
            .from('student_parents')
            .select('*');
        if (spError) throw spError;
        console.log('\nRelaciones Estudiante-Padre:', studentParents.length);
        console.log(studentParents[0]);

        // Verificar estados de asistencia
        const { data: attendanceStatus, error: asError } = await supabase
            .from('attendance_status')
            .select('*');
        if (asError) throw asError;
        console.log('\nEstados de Asistencia:', attendanceStatus.length);
        console.log(attendanceStatus);

    } catch (error) {
        console.error('Error al verificar datos:', error);
    }
}

verifyData();
