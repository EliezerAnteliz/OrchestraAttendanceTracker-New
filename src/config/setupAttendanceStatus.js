import { supabase } from './supabase';

export async function setupAttendanceStatus() {
    const statuses = [
        { code: 'A', description: 'Present' },
        { code: 'EA', description: 'Excused Absence' },
        { code: 'UA', description: 'Unexcused Absence' }
    ];

    try {
        // Primero verificamos si ya existen los registros
        const { data: existingStatuses, error: fetchError } = await supabase
            .from('attendance_status')
            .select('code');

        if (fetchError) throw fetchError;

        // Si no hay registros, los insertamos
        if (!existingStatuses || existingStatuses.length === 0) {
            const { error: insertError } = await supabase
                .from('attendance_status')
                .insert(statuses);

            if (insertError) throw insertError;
            console.log('Attendance statuses configured successfully');
        } else {
            console.log('Attendance statuses already configured');
        }
    } catch (error) {
        console.error('Error configuring attendance statuses:', error);
    }
}
