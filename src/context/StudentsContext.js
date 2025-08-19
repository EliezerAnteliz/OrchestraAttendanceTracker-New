import React, { createContext, useState, useContext, useCallback } from 'react';
import { supabase } from '../config/supabase';

const StudentsContext = createContext(null);

export const StudentsProvider = ({ children }) => {
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const loadStudents = useCallback(async (forceRefresh = false) => {
        // Si tenemos datos y no han pasado 5 minutos, usamos el caché
        if (!forceRefresh && students.length > 0 && lastUpdate && (Date.now() - lastUpdate < 300000)) {
            return students;
        }

        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .order('first_name');

            if (error) throw error;

            setStudents(data);
            setLastUpdate(Date.now());
            setLoading(false);
            return data;
        } catch (error) {
            console.error('Error loading students:', error);
            setLoading(false);
            return students; // Retornamos los datos existentes en caso de error
        }
    }, [students, lastUpdate]);

    const loadAttendanceForDate = useCallback(async (date) => {
        try {
            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', date);

            if (error) throw error;

            const newAttendanceData = {};
            data.forEach(record => {
                newAttendanceData[record.student_id] = record.status_code;
            });

            setAttendanceData(prev => ({
                ...prev,
                [date]: newAttendanceData
            }));

            return newAttendanceData;
        } catch (error) {
            console.error('Error loading attendance:', error);
            return {};
        }
    }, []);

    const updateAttendance = useCallback(async (studentId, date, status) => {
        try {
            const { error } = await supabase
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    date: date,
                    status_code: status,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            setAttendanceData(prev => ({
                ...prev,
                [date]: {
                    ...prev[date],
                    [studentId]: status
                }
            }));

            return true;
        } catch (error) {
            console.error('Error updating attendance:', error);
            return false;
        }
    }, []);

    const value = {
        students,
        attendanceData,
        loading,
        loadStudents,
        loadAttendanceForDate,
        updateAttendance
    };

    return (
        <StudentsContext.Provider value={value}>
            {children}
        </StudentsContext.Provider>
    );
};

export const useStudents = () => {
    const context = useContext(StudentsContext);
    if (!context) {
        throw new Error('useStudents must be used within a StudentsProvider');
    }
    return context;
}; 