import { supabase } from '../config/supabase';

async function testAttendanceSystem() {
    console.log('🧪 Iniciando pruebas del sistema de asistencia...\n');

    try {
        // 1. Verificar estados de asistencia
        console.log('1️⃣ Verificando estados de asistencia...');
        const { data: statuses, error: statusError } = await supabase
            .from('attendance_status')
            .select('*');

        if (statusError) throw statusError;
        console.log('✅ Estados de asistencia encontrados:', statuses);

        // 2. Obtener algunos estudiantes para la prueba
        console.log('\n2️⃣ Obteniendo estudiantes para la prueba...');
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id, first_name, last_name')
            .limit(3);

        if (studentError) throw studentError;
        console.log('✅ Estudiantes obtenidos:', students);

        // 3. Intentar registrar asistencia
        console.log('\n3️⃣ Probando registro de asistencia...');
        const date = new Date().toISOString().split('T')[0];
        const attendanceRecords = students.map(student => ({
            student_id: student.id,
            status_code: 'A',
            date: date
        }));

        const { data: attendance, error: attendanceError } = await supabase
            .from('attendance')
            .insert(attendanceRecords)
            .select();

        if (attendanceError) throw attendanceError;
        console.log('✅ Asistencia registrada exitosamente:', attendance);

        // 4. Verificar registros de asistencia
        console.log('\n4️⃣ Verificando registros de asistencia...');
        const { data: verification, error: verificationError } = await supabase
            .from('attendance')
            .select(`
                id,
                date,
                status_code,
                students (
                    first_name,
                    last_name
                )
            `)
            .eq('date', date);

        if (verificationError) throw verificationError;
        console.log('✅ Registros de asistencia verificados:', verification);

        // 5. Limpiar registros de prueba
        console.log('\n5️⃣ Limpiando registros de prueba...');
        const { error: cleanupError } = await supabase
            .from('attendance')
            .delete()
            .eq('date', date);

        if (cleanupError) throw cleanupError;
        console.log('✅ Registros de prueba eliminados correctamente');

        console.log('\n✨ Todas las pruebas completadas exitosamente! ✨');

    } catch (error) {
        console.error('\n❌ Error durante las pruebas:', error);
        throw error;
    }
}

// Ejecutar las pruebas
testAttendanceSystem()
    .then(() => console.log('\n🏁 Proceso de pruebas finalizado'))
    .catch(error => console.error('\n💥 Proceso de pruebas fallido:', error));
