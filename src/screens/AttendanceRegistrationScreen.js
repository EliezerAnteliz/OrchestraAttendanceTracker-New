import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, LogBox, FlatList, SafeAreaView, StatusBar, Platform } from 'react-native';
import { Button, Text, Surface, Portal, IconButton, List, ActivityIndicator, Dialog, Appbar, Chip, SegmentedButtons, RadioButton, Icon, FAB, Tooltip, Snackbar } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { supabase, testSupabaseConnection, pingSupabase } from '../config/supabase';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, THEME_NAMES, mondayStyles } from '../theme';
import { useAppTheme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MondayStudentItem } from '../components';
import { useFocusEffect } from '@react-navigation/native';

// Ignorar advertencias específicas de rendimiento
LogBox.ignoreLogs(['VirtualizedList: You have a large list that is slow to update']);

// Mapa de estados a códigos para la base de datos (varchar(2))
const STATUS_CODES = {
    present: 'A',
    excused: 'EA',
    unexcused: 'UA',
    unset: 'US'
};

// Mapa inverso para convertir códigos a estados
const CODE_TO_STATUS = {
    A: 'present',
    EA: 'excused',
    UA: 'unexcused',
    US: 'unset'
};

// Componente principal para cada elemento de estudiante en la lista
const StudentListItem = memo(({ 
    student, 
    attendanceData, 
    onStatusChange, 
    isSelected = false,
    onSelect,
    isSelectionMode = false,
    themeType
}) => {
    const { theme } = useAppTheme();
    const isMondayTheme = themeType === THEME_NAMES.MONDAY;
    
    // Obtener el estado de asistencia actual de este estudiante
    let code = attendanceData[student.id] || 'US';
    const status = CODE_TO_STATUS[code] || 'unset';
    
    // Determinar colores según el estado de asistencia
    const getStatusColor = (statusCode) => {
        switch (statusCode) {
            case 'A':
                return theme.colors.attendance.present;
            case 'EA':
                return theme.colors.attendance.justified;
            case 'UA':
                return theme.colors.attendance.unexcused;
            default:
                return theme.colors.surfaceDisabled;
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={isSelectionMode ? 0.7 : 1}
            onPress={isSelectionMode ? () => onSelect(student.id) : undefined}
            style={{ marginVertical: isMondayTheme ? 0 : 4 }}
        >
            <Surface
                style={{
                    marginHorizontal: SPACING.md,
                    marginVertical: isMondayTheme ? 0 : 6,
                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.md,
                    backgroundColor: isSelected 
                        ? theme.colors.primaryContainer 
                        : theme.colors.surface,
                    overflow: 'hidden',
                    borderWidth: isMondayTheme ? 1 : 0,
                    borderColor: isMondayTheme 
                        ? (isSelected ? theme.colors.primary : theme.colors.outline)
                        : 'transparent',
                    borderBottomWidth: isMondayTheme ? 1 : 0,
                    elevation: isMondayTheme ? 0 : (isSelected ? 3 : 1)
                }}
            >
                <View 
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: SPACING.md
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ 
                            fontSize: 16, 
                            fontWeight: '500',
                            color: isSelected 
                                ? theme.colors.onPrimaryContainer 
                                : theme.colors.onSurface 
                        }}>
                            {student.first_name} {student.last_name}
                        </Text>
                        <Text style={{ 
                            fontSize: 14, 
                            color: isSelected 
                                ? theme.colors.onPrimaryContainer 
                                : theme.colors.onSurfaceVariant 
                        }}>
                            {student.instrument || 'Not Assigned'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {isSelectionMode ? (
                            <View
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: isMondayTheme ? 4 : 12,
                                    borderWidth: 2,
                                    borderColor: theme.colors.outline,
                                    backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {isSelected && (
                                    <Icon 
                                        source="check" 
                                        size={16} 
                                        color="white" 
                                    />
                                )}
                            </View>
                        ) : (
                            <>
                                {/* Botón para marcar presente */}
                                <TouchableOpacity
                                    onPress={() => onStatusChange(student.id, 'present')}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: isMondayTheme ? 4 : 18,
                                        backgroundColor: status === 'present' 
                                            ? theme.colors.attendance.present 
                                            : theme.colors.surfaceVariant,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: theme.colors.attendance.present,
                                    }}
                                >
                                    <Icon 
                                        source="check" 
                                        size={20} 
                                        color={status === 'present' ? 'white' : theme.colors.attendance.present} 
                                    />
                                </TouchableOpacity>
                                
                                {/* Botón para marcar falta justificada */}
                                <TouchableOpacity
                                    onPress={() => onStatusChange(student.id, 'excused')}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: isMondayTheme ? 4 : 18,
                                        backgroundColor: status === 'excused' 
                                            ? theme.colors.attendance.justified 
                                            : theme.colors.surfaceVariant,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: theme.colors.attendance.justified,
                                    }}
                                >
                                    <Icon 
                                        source="alert-circle-outline" 
                                        size={20} 
                                        color={status === 'excused' ? 'white' : theme.colors.attendance.justified} 
                                    />
                                </TouchableOpacity>
                                
                                {/* Botón para marcar falta injustificada */}
                                <TouchableOpacity
                                    onPress={() => onStatusChange(student.id, 'unexcused')}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: isMondayTheme ? 4 : 18,
                                        backgroundColor: status === 'unexcused' 
                                            ? theme.colors.attendance.unexcused 
                                            : theme.colors.surfaceVariant,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: theme.colors.attendance.unexcused,
                                    }}
                                >
                                    <Icon 
                                        source="close" 
                                        size={20} 
                                        color={status === 'unexcused' ? 'white' : theme.colors.attendance.unexcused} 
                                    />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Surface>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Verificación profunda para prevenir re-renderizados innecesarios
    return prevProps.student.id === nextProps.student.id && 
           prevProps.isSelected === nextProps.isSelected &&
           prevProps.isSelectionMode === nextProps.isSelectionMode &&
           prevProps.attendanceData[prevProps.student.id] === nextProps.attendanceData[nextProps.student.id];
});

// Componente para el calendario con estilo adaptado al tema
const ThemedCalendar = ({ theme, isMondayTheme, selectedDate, onDayPress }) => {
    const calendarTheme = {
        // Colores principales
        selectedDayBackgroundColor: theme.colors.primary,
        todayTextColor: theme.colors.primary,
        arrowColor: theme.colors.primary,
        monthTextColor: theme.colors.onSurface,
        
        // Texto y tamaños
        textDayFontSize: 16,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14,
        
        // Fondos
        backgroundColor: '#ffffff',
        calendarBackground: '#ffffff',
        
        // Colores de texto
        dayTextColor: theme.colors.onSurface,
        textSectionTitleColor: theme.colors.onSurface,
        selectedDotColor: '#ffffff',
        dotColor: theme.colors.primary,
        textDefaultColor: theme.colors.onSurface,
        selectedDayTextColor: '#ffffff',
        textDisabledColor: theme.colors.disabled,
        
        // Monday theme específico - con prioridad más alta para forzar estilos
        'stylesheet.day.single': {
            base: {
                width: 36, // Mayor tamaño
                height: 36, // Mayor tamaño
                alignItems: 'center',
                justifyContent: 'center',
            },
            selected: {
                backgroundColor: theme.colors.primary,
                // Cuadrado en lugar de círculo para Monday - reduciendo mucho el radio
                borderRadius: isMondayTheme ? 2 : 18,
            },
            today: {
                borderWidth: 1,
                borderColor: theme.colors.primary,
                borderRadius: isMondayTheme ? 2 : 18,
            },
            leftFiller: {
                width: 4,
                height: 36,
            },
            rightFiller: {
                width: 4,
                height: 36,
            },
        },
        'stylesheet.day.period': {
            base: {
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
            },
            fillerStyle: {
                backgroundColor: theme.colors.primaryContainer, 
                borderRadius: 0,
            },
        },
        'stylesheet.calendar.header': {
            header: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingLeft: 10,
                paddingRight: 10,
                marginTop: 8,
                alignItems: 'center',
                backgroundColor: isMondayTheme ? theme.colors.surface : 'transparent',
                borderBottomWidth: isMondayTheme ? 1 : 0,
                borderBottomColor: isMondayTheme ? theme.colors.outline : 'transparent',
                paddingBottom: 10,
            },
            monthText: {
                fontSize: 18,
                fontWeight: '600',
                color: theme.colors.onSurface,
                margin: 10
            },
            arrow: {
                padding: 6,
                backgroundColor: isMondayTheme ? 'transparent' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: isMondayTheme ? 2 : 12,
            }
        },
        'stylesheet.calendar.main': {
            week: {
                marginTop: 7,
                marginBottom: 7,
                flexDirection: 'row',
                justifyContent: 'space-around'
            },
            dayContainer: {
                flex: 1, // Para que cada día ocupe espacio igual
                alignItems: 'center',
            }
        },
    };
    
    return (
        <Surface
            style={{
                width: '100%', // Ocupar todo el ancho disponible
                marginBottom: SPACING.md,
                borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                overflow: 'hidden',
                borderWidth: isMondayTheme ? 1 : 0,
                borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                elevation: isMondayTheme ? 0 : 2
            }}
        >
            <Calendar
                current={selectedDate}
                onDayPress={onDayPress}
                markedDates={{
                    [selectedDate]: { 
                        selected: true,
                        customStyles: {
                            container: {
                                borderRadius: isMondayTheme ? 2 : 18, // Más cuadrado
                                backgroundColor: theme.colors.primary,
                            },
                            text: {
                                color: 'white',
                                fontWeight: 'bold'
                            }
                        }
                    }
                }}
                markingType={'custom'}
                theme={calendarTheme}
                enableSwipeMonths={true}
            />
        </Surface>
    );
};

// Componente para los chips de filtro por instrumento
const InstrumentFilterChip = ({ label, selected, onPress, theme, isMondayTheme }) => {
    return (
        <TouchableOpacity
            style={{
                backgroundColor: selected 
                    ? (isMondayTheme ? theme.colors.primaryContainer : theme.colors.primary + '15')
                    : (isMondayTheme ? '#f0f0f5' : 'transparent'),
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginRight: 10,
                minWidth: 80,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0, // Completamente cuadrado
                borderWidth: 1,
                borderColor: selected 
                    ? (isMondayTheme ? theme.colors.primary : 'transparent')
                    : (isMondayTheme ? theme.colors.outline : theme.colors.outline + '80'),
                elevation: isMondayTheme ? 0 : (selected ? 2 : 0),
            }}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={{
                color: selected ? theme.colors.primary : theme.colors.onSurfaceVariant,
                fontWeight: selected ? '600' : '400',
                fontSize: 14,
                textAlign: 'center'
            }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};

// Componente para los chips de filtro por estado de estudiante
const StatusFilterChip = ({ icon, label, selected, onPress, theme, isMondayTheme }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                borderWidth: 1,
                borderColor: selected 
                    ? (isMondayTheme ? theme.colors.primary : 'transparent')
                    : (isMondayTheme ? theme.colors.outline : 'transparent'),
                elevation: isMondayTheme ? 0 : (selected ? 2 : 1),
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <Icon 
                source={icon} 
                size={16} 
                color={selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant} 
                style={{ marginRight: 6 }}
            />
            <Text 
                style={{ 
                    color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                    fontWeight: selected ? '600' : '400',
                    fontSize: 13,
                }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
};

const AttendanceRegistrationScreen = () => {
    const router = useRouter();
    const { theme, themeType } = useAppTheme();
    const isMondayTheme = themeType === THEME_NAMES.MONDAY;
    
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    });
    const [showCalendar, setShowCalendar] = useState(false);
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(true);
    const [dateLoading, setDateLoading] = useState(false);
    const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'awakening', 'ready', 'error'
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
    const [selectedInstrument, setSelectedInstrument] = useState('all');
    const [instruments, setInstruments] = useState([]);
    const [showYearSelector, setShowYearSelector] = useState(false);
    const [currentYearMonth, setCurrentYearMonth] = useState(() => {
        const today = new Date();
        return { year: today.getFullYear(), month: today.getMonth() + 1 };
    });
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [noSelectionSnackbarVisible, setNoSelectionSnackbarVisible] = useState(false);
    
    const formatDate = useCallback((date) => {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        return date.toISOString().split('T')[0];
    }, []);

    // Nuevo método para formatear la fecha de manera más amigable
    const formatDisplayDate = useCallback((date) => {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        // Nombres de los meses en español (abreviados para ahorrar espacio)
        const meses = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];
        
        const dia = date.getDate();
        const mes = meses[date.getMonth()];
        const año = date.getFullYear();
        
        return `${dia} de ${mes}, ${año}`;
    }, []);

    // Función para manejar el cambio de mes en el calendario
    const handleMonthChange = useCallback((month) => {
        setCurrentYearMonth(prev => ({ ...prev, month: month.month, year: month.year }));
    }, []);

    // Función para manejar la selección de año
    const handleYearSelect = useCallback((year) => {
        setCurrentYearMonth(prev => ({ ...prev, year }));
        setShowYearSelector(false);
    }, []);

    const loadAttendanceData = useCallback(async (date) => {
        setLoading(true);
        
        // Función para realizar petición con reintentos
        const fetchWithRetry = async (fetchFunction, maxRetries = 3) => {
            let lastError;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    return await fetchFunction();
                } catch (error) {
                    lastError = error;
                    
                    // Esperar antes de reintentar (tiempo exponencial)
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                    }
                }
            }
            
            throw lastError;
        };
        
        try {
            // Intentar cargar estudiantes con reintentos
            const [studentsResponse, attendanceResponse] = await Promise.all([
                fetchWithRetry(() => 
                    supabase
                        .from('students')
                        .select('*')
                        .order('first_name')
                ),
                fetchWithRetry(() => 
                    supabase
                        .from('attendance')
                        .select('*')
                        .eq('date', formatDate(date))
                )
            ]);

            if (studentsResponse.error) throw studentsResponse.error;
            if (attendanceResponse.error) throw attendanceResponse.error;

            const attendance = {};
            attendanceResponse.data.forEach(record => {
                attendance[record.student_id] = record.status_code;
            });

            setStudents(studentsResponse.data || []);
            setAttendanceData(attendance);
        } catch (error) {
            console.error('Error cargando datos:', error);
            Alert.alert(
                'Error de conexión', 
                'No se pudo conectar a la base de datos. Verifica tu conexión a internet e intenta nuevamente.',
                [
                    { 
                        text: 'Reintentar', 
                        onPress: () => loadAttendanceData(date) 
                    },
                    { 
                        text: 'Entendido', 
                        style: 'cancel' 
                    }
                ]
            );
        } finally {
            setLoading(false);
        }
    }, [formatDate]);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        setDbStatus('connecting');
        
        try {
            // Intentar conexión directa REST primero (a menudo funciona mejor)
            const pingResult = await pingSupabase();
            
            if (pingResult.success) {
                try {
                    // Si el ping REST fue exitoso, intentar cargar estudiantes directamente
                    const { data, error } = await supabase
                        .from('students')
                        .select('*')
                        .order('first_name');
                    
                    if (error) {
                        throw error;
                    }
                    
                    setStudents(data || []);
                    setDbStatus('ready');
                    return;
                } catch (directError) {
                    // Continuar con el método completo de prueba de conexión
                }
            }
            
            // Test completo de conexión (método original)
            const connectionTest = await testSupabaseConnection();
            
            if (!connectionTest.success) {
                // Si el error es de HTTP y posiblemente relacionado con base de datos inactiva
                if (connectionTest.stage === 'http') {
                    setDbStatus('awakening');
                    throw new Error(`La base de datos parece estar inactiva: ${connectionTest.message || 'Reintentando...'}`);
                }
                
                throw new Error(`Error de conexión en etapa: ${connectionTest.stage}`);
            }
            
            // Función para realizar petición con reintentos
            const fetchWithRetry = async (fetchFunction, maxRetries = 5) => { 
                let lastError;
                
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        return await fetchFunction();
                    } catch (error) {
                        lastError = error;
                        
                        // Esperar antes de reintentar (tiempo exponencial)
                        if (attempt < maxRetries - 1) {
                            const waitTime = attempt === 0 ? 10000 : 5000 * Math.pow(2, attempt); 
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                }
                
                throw lastError;
            };
            
            const studentsResponse = await fetchWithRetry(() => 
                supabase
                    .from('students')
                    .select('*')
                    .order('first_name')
            );

            if (studentsResponse.error) {
                throw studentsResponse.error;
            }
            
            setStudents(studentsResponse.data || []);
            setDbStatus('ready');
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            
            // Mensaje personalizado según el error
            let errorMessage = 'No se pudo conectar a la base de datos.';
            
            if (error.message && error.message.includes('inactiva')) {
                errorMessage = 'La base de datos está inactiva después de un período sin uso y necesita tiempo para reiniciarse. Esto puede tardar hasta 2 minutos la primera vez. ¿Deseas reintentar?';
                setDbStatus('awakening');
            } else if (error.message && error.message.includes('etapa: auth')) {
                errorMessage = 'Problema con la autenticación a Supabase. Intenta cerrar sesión y volver a iniciar.';
                setDbStatus('error');
            } else if (error.message && error.message.includes('etapa: data')) {
                errorMessage = 'No se pudo acceder a los datos de estudiantes. Verifica los permisos en la base de datos.';
                setDbStatus('error');
            } else if (error.message && error.message.includes('etapa: fetch')) {
                errorMessage = 'Problemas de red al conectar con Supabase. Verifica tu conexión a internet.';
                setDbStatus('error');
            } else {
                setDbStatus('error');
            }
            
            Alert.alert(
                'Error de conexión', 
                errorMessage,
                [
                    { 
                        text: 'Reintentar', 
                        onPress: () => fetchStudents() 
                    },
                    { 
                        text: 'Entendido', 
                        style: 'cancel' 
                    }
                ]
            );
        } finally {
            setLoading(false);
        }
    }, []);
    
    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    useFocusEffect(
        useCallback(() => {
            // Recargar completamente los datos cuando la pantalla recibe el foco
            fetchStudents();
            loadAttendanceData(selectedDate);
        }, [fetchStudents, selectedDate, loadAttendanceData])
    );

    const handleDateSelect = useCallback((date) => {
        // Crear una nueva fecha partiendo de la cadena de fecha seleccionada en el calendario
        // Asegurarnos de usar la fecha local para evitar problemas de zona horaria
        // El formato de date.dateString es 'YYYY-MM-DD'
        const parts = date.dateString.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-11
        const day = parseInt(parts[2], 10);
        
        // Crear un nuevo objeto Date con los componentes
        const selectedDay = new Date(year, month, day);
        
        setSelectedDate(selectedDay);
        setShowCalendar(false);
    }, []);

    const handleStatusChange = useCallback(async (studentId, status) => {
        try {
            setAttendanceData(prev => ({
                ...prev,
                [studentId]: STATUS_CODES[status]
            }));

            // Primero intentamos actualizar si existe
            const { data: existingRecord, error: checkError } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('date', formatDate(selectedDate))
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingRecord) {
                // Si existe, actualizamos
                const { error: updateError } = await supabase
            .from('attendance')
                    .update({
                        status_code: STATUS_CODES[status],
                        updated_at: new Date().toISOString()
                    })
                    .eq('student_id', studentId)
                    .eq('date', formatDate(selectedDate));

                if (updateError) throw updateError;
            } else {
                // Si no existe, insertamos
                const { error: insertError } = await supabase
            .from('attendance')
                    .insert({
                        student_id: studentId,
                        date: formatDate(selectedDate),
                        status_code: STATUS_CODES[status],
                        updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;
            }
            
            // Aquí agregamos el feedback visual para una asistencia individual
            if (isSelectionMode === false) {
                const student = students.find(s => s.id === studentId);
                if (student) {
                    const statusText = status === 'present' ? 'presente' : 
                                      status === 'excused' ? 'falta justificada' : 
                                      status === 'unexcused' ? 'falta injustificada' : '';
                    
                    setSnackbarMessage(`${student.first_name} ${student.last_name} marcado como ${statusText}`);
                    setSnackbarVisible(true);
                }
            }
        } catch (error) {
            console.error('Error actualizando asistencia:', error);
            Alert.alert('Error', 'No se pudo actualizar la asistencia');
        }
    }, [formatDate, selectedDate, students, isSelectionMode]);

    // Nuevo método para manejar asistencia grupal con feedback
    const handleGroupStatusChange = useCallback((status) => {
        if (selectedStudents.size > 0) {
            Array.from(selectedStudents).forEach(id => handleStatusChange(id, status));
            
            // Feedback visual para grupo
            const statusText = status === 'present' ? 'presentes' : 
                              status === 'excused' ? 'falta justificada' : 
                              status === 'unexcused' ? 'falta injustificada' : '';
            
            setSnackbarMessage(`${selectedStudents.size} estudiantes marcados como ${statusText}`);
            setSnackbarVisible(true);
            
            // Cerrar el modo selección después de un breve retraso para que el usuario vea los cambios
            setTimeout(() => {
                setIsSelectionMode(false);
                setSelectedStudents(new Set());
            }, 1000);
        } else {
            Alert.alert('Información', 'Selecciona al menos un estudiante');
        }
    }, [selectedStudents, handleStatusChange]);
    
    const getStatusColor = (status) => {
        switch (status) {
            case 'A':
                return theme.colors.attendance.present;
            case 'EA':
                return theme.colors.attendance.justified;
            case 'UA':
                return theme.colors.attendance.unexcused;
            default:
                return theme.colors.disabled;
        }
    };

    const toggleStudentSelection = useCallback((studentId) => {
        setSelectedStudents(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(studentId)) {
                newSelected.delete(studentId);
            } else {
                newSelected.add(studentId);
            }
            return newSelected;
        });
    }, []);

    const renderListItem = useCallback(({ item: student }) => {
        return (
            <StudentListItem
                student={student}
                attendanceData={attendanceData}
                onStatusChange={handleStatusChange}
                isSelected={selectedStudents.has(student.id)}
                onSelect={() => toggleStudentSelection(student.id)}
                isSelectionMode={isSelectionMode}
                themeType={themeType}
            />
        );
    }, [attendanceData, handleStatusChange, selectedStudents, isSelectionMode, toggleStudentSelection, themeType]);

    const calendarTheme = useMemo(() => ({
        selectedDayBackgroundColor: theme.colors.primary,
        todayTextColor: theme.colors.primary,
        arrowColor: theme.colors.primary,
        monthTextColor: theme.colors.primary,
        textDayFontSize: 16,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14,
        backgroundColor: '#ffffff',
        calendarBackground: '#ffffff',
        dayTextColor: '#333333',
        textSectionTitleColor: '#333333',
        selectedDotColor: '#ffffff',
        dotColor: theme.colors.primary,
        textDefaultColor: '#333333',
        selectedDayTextColor: '#ffffff',
        textDisabledColor: 'rgba(0, 0, 0, 0.4)',
    }), [theme]);

    // Función para normalizar los nombres de instrumentos (quitar acentos, minúsculas)
    const normalizeInstrumentName = (instrument) => {
        if (!instrument) return '';
        return instrument
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    };

    // Extraer instrumentos únicos normalizados
    const uniqueNormalizedInstruments = useMemo(() => {
        const instrumentMap = new Map(); // Usamos Map para mantener la forma original
        
        students.forEach(student => {
            if (student.instrument) {
                const normalizedName = normalizeInstrumentName(student.instrument);
                // Solo guardamos el primer nombre encontrado para cada instrumento normalizado
                if (!instrumentMap.has(normalizedName)) {
                    instrumentMap.set(normalizedName, student.instrument);
                }
            }
        });
        
        // Orden específico para los instrumentos
        const instrumentOrder = ['violin', 'viola', 'cello', 'bass', 'not assigned'];
        
        // Convertir el Map a un array y ordenarlo
        const instrumentEntries = Array.from(instrumentMap.entries());
        return instrumentEntries
            .sort((a, b) => {
                const indexA = instrumentOrder.indexOf(a[0]);
                const indexB = instrumentOrder.indexOf(b[0]);
                
                // Si ambos instrumentos están en la lista de orden
                if (indexA >= 0 && indexB >= 0) {
                    return indexA - indexB;
                }
                // Si solo a está en la lista de orden
                if (indexA >= 0) return -1;
                // Si solo b está en la lista de orden
                if (indexB >= 0) return 1;
                // Si ninguno está en la lista de orden, ordenar alfabéticamente
                return a[0].localeCompare(b[0]);
            })
            .map(entry => entry[1]); // Devolvemos los nombres originales ordenados
    }, [students]);

    // Filtrado de estudiantes por instrumento y estado activo
    useEffect(() => {
        if (students.length > 0) {
            let filtered = [...students];
            
            // Mostrar solo estudiantes activos (is_active !== false)
            filtered = filtered.filter(student => student.is_active !== false);
            
            // Aplicar filtro por instrumento
            if (selectedInstrument !== 'all') {
                filtered = filtered.filter(student => 
                    normalizeInstrumentName(student.instrument) === selectedInstrument
                );
            }
            
            setFilteredStudents(filtered);
        }
    }, [students, selectedInstrument]);

    // Función para manejar acción grupal con validación
    const handleGroupActionWithValidation = (action) => {
        if (selectedStudents.size === 0) {
            setNoSelectionSnackbarVisible(true);
            return;
        }
        
        if (action === 'present' || action === 'excused' || action === 'unexcused') {
            handleGroupStatusChange(action);
        }
    };

    // Componente de estado de carga personalizado
    const renderLoadingState = () => {
        if (!loading) return null;
        
        let message = 'Cargando estudiantes...';
        let icon = 'loading';
        
        if (dbStatus === 'awakening') {
            message = 'La base de datos se está reactivando después de un período de inactividad.\nEsto puede tardar hasta 2 minutos la primera vez.';
            icon = 'database-sync';
        } else if (dbStatus === 'error') {
            message = 'Error al conectar con la base de datos.\nIntenta nuevamente o contacta al administrador.';
            icon = 'database-remove';
        }
        
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <View style={{height: 20}} />
                <Text style={styles.loadingText}>{message}</Text>
                {dbStatus === 'awakening' && (
                    <Button 
                        mode="text" 
                        onPress={() => fetchStudents()}
                        style={{marginTop: 16}}
                    >
                        Reintentar conexión
                    </Button>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
            <StatusBar backgroundColor={theme.colors.background} barStyle="dark-content" />
            
            <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: Platform.OS === 'android' ? 30 : 0 }]}>
                {/* Selector de fecha con contador de estudiantes */}
                <Surface style={[
                    styles.dateSelector, 
                    { 
                        backgroundColor: theme.colors.surface, 
                        elevation: isMondayTheme ? 0 : 3, 
                        borderWidth: isMondayTheme ? 1 : 0, 
                        borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                        borderRadius: 0, // Completamente cuadrado
                        marginTop: Platform.OS === 'ios' ? 15 : 25, // Aumentar margen superior
                        marginBottom: SPACING.md,
                        marginHorizontal: SPACING.md,
                    }
                ]}>
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'stretch',
                        height: 50, // Altura fija para todos los elementos
                    }}>
                        {/* Contador de estudiantes activos - Izquierda */}
                        <View style={{
                            width: '25%',
                            backgroundColor: theme.colors.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRightWidth: 1,
                            borderRightColor: '#fff',
                        }}>
                            <Text style={{
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: 20
                            }}>
                                {filteredStudents.length}
                            </Text>
                            <Text style={{
                                color: 'white',
                                fontSize: 13,
                                fontWeight: '500'
                            }}>
                                Activos
                            </Text>
                        </View>

                        {/* Selector de fecha - Centro */}
                        <TouchableOpacity 
                            onPress={() => setShowCalendar(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1,
                                paddingHorizontal: 12,
                                backgroundColor: 'white',
                                borderLeftWidth: 1,
                                borderRightWidth: 1,
                                borderLeftColor: theme.colors.outline,
                                borderRightColor: theme.colors.outline,
                            }}
                        >
                            <Icon 
                                source="calendar" 
                                size={24} 
                                color={theme.colors.primary} 
                                style={{ 
                                    marginRight: 8, 
                                }} 
                            />
                            <Text style={{ 
                                color: theme.colors.primary,
                                fontSize: 16,
                                fontWeight: '500'
                            }}>
                                {formatDisplayDate(selectedDate)}
                            </Text>
                        </TouchableOpacity>
                        
                        {/* Botón Hoy - Derecha */}
                        <TouchableOpacity
                            onPress={() => {
                                // Crear una nueva fecha usando el mismo patrón para consistencia
                                const now = new Date();
                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                setSelectedDate(today);
                            }}
                            style={{
                                width: '25%',
                                backgroundColor: theme.colors.primary,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderLeftWidth: 1,
                                borderLeftColor: '#fff',
                            }}
                        >
                            <Text style={{
                                color: 'white',
                                fontSize: 18,
                                fontWeight: '600'
                            }}>
                                Hoy
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Surface>

                <View style={styles.filtersContainer}>
                    {/* Filtro por instrumento */}
                    <Surface style={[
                        styles.filterSection,
                        {
                            marginBottom: SPACING.md,
                            borderRadius: 0, // Completamente cuadrado
                            borderWidth: isMondayTheme ? 1 : 0,
                            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                            elevation: isMondayTheme ? 0 : 1,
                        }
                    ]}>
                        <Text style={[
                            styles.filterTitle, 
                            { 
                                color: theme.colors.onSurfaceVariant,
                                paddingHorizontal: SPACING.md,
                                paddingTop: SPACING.sm,
                                paddingBottom: SPACING.xs,
                                fontWeight: '500',
                                fontSize: 15
                            }
                        ]}>
                            Filtrar por Instrumento
                        </Text>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ 
                                paddingHorizontal: SPACING.md, 
                                paddingBottom: SPACING.sm,
                                paddingTop: SPACING.xs
                            }}
                        >
                            <InstrumentFilterChip
                                label="Todos"
                                selected={selectedInstrument === 'all'}
                                onPress={() => setSelectedInstrument('all')}
                                theme={theme}
                                isMondayTheme={isMondayTheme}
                            />
                            {/* Mostrar instrumentos en orden específico */}
                            {['violin', 'viola', 'cello', 'bass'].map(instrument => (
                                <InstrumentFilterChip
                                    key={instrument}
                                    label={instrument.charAt(0).toUpperCase() + instrument.slice(1)}
                                    selected={selectedInstrument === instrument}
                                    onPress={() => setSelectedInstrument(instrument)}
                                    theme={theme}
                                    isMondayTheme={isMondayTheme}
                                />
                            ))}
                            <InstrumentFilterChip
                                label="Not Assigned"
                                selected={selectedInstrument === 'not assigned'}
                                onPress={() => setSelectedInstrument('not assigned')}
                                theme={theme}
                                isMondayTheme={isMondayTheme}
                            />
                        </ScrollView>
                    </Surface>
                </View>
                {/* Lista de estudiantes */}
                {renderLoadingState()}
                {filteredStudents.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg }}>
                        <View style={{ alignItems: 'center', marginTop: 16 }}>
                            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 16, marginBottom: 8 }}>
                                No se encontraron estudiantes
                            </Text>
                            <Icon source="close-circle-outline" size={48} color={theme.colors.onSurfaceVariant} />
                        </View>
                    </View>
                ) : (
                    <FlatList
                        data={filteredStudents}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            renderListItem({ item })
                        )}
                        contentContainerStyle={{ 
                            paddingBottom: 80, 
                            paddingTop: isMondayTheme ? 0 : SPACING.xs,
                            paddingHorizontal: isMondayTheme ? 0 : SPACING.sm 
                        }}
                        ListEmptyComponent={
                            <View style={{ padding: SPACING.lg, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 16, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                                    No hay estudiantes registrados
                                </Text>
                            </View>
                        }
                        initialNumToRender={10}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        removeClippedSubviews={true}
                        getItemLayout={(data, index) => ({
                            length: 75, // altura aproximada de cada elemento
                            offset: 75 * index,
                            index,
                        })}
                    />
                )}
                <Portal>
                    <Dialog
                        visible={showCalendar}
                        onDismiss={() => setShowCalendar(false)}
                        style={{ 
                            borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.lg,
                            backgroundColor: 'white',
                            width: '100%', // Usar todo el ancho disponible
                            maxWidth: 460, // Mayor tamaño máximo
                            alignSelf: 'center',
                            overflow: 'hidden',
                            margin: 0,
                            padding: 0,
                            elevation: isMondayTheme ? 0 : 4,
                            borderWidth: isMondayTheme ? 1 : 0,
                            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                        }}
                        dismissable={true}
                        theme={{ 
                            colors: { 
                                backdrop: 'rgba(0, 0, 0, 0.5)',
                                // Forzar a que los elementos internos sigan el mismo radio
                                elevation: { level0: 0 }
                            },
                            roundness: isMondayTheme ? 1 : BORDER_RADIUS.lg // Más cuadrado con roundness 1
                        }}
                    >
                        <View style={{
                            padding: 12, // Menos padding
                            width: '100%',
                            alignItems: 'center',
                        }}>
                            <ThemedCalendar 
                                theme={theme} 
                                isMondayTheme={isMondayTheme} 
                                selectedDate={formatDate(selectedDate)} 
                                onDayPress={handleDateSelect}
                            />
                            
                            <Button 
                                mode="contained"
                                onPress={() => setShowCalendar(false)}
                                style={{
                                    marginTop: 16,
                                    borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.lg, // Más cuadrado
                                    height: 48,
                                    width: '100%',
                                    elevation: isMondayTheme ? 0 : 2,
                                    borderWidth: isMondayTheme ? 1 : 0,
                                    borderColor: isMondayTheme ? theme.colors.primary : 'transparent',
                                }}
                                buttonColor={theme.colors.primary}
                                icon="check"
                                labelStyle={{
                                    fontSize: 16,
                                    fontWeight: '600',
                                    letterSpacing: 0.5,
                                }}
                            >
                                Aceptar
                            </Button>
                        </View>
                    </Dialog>

                    <Dialog
                        visible={showAttendanceDialog}
                        onDismiss={() => {
                            setShowAttendanceDialog(false);
                            setSelectedStudents(new Set());
                            setIsSelectionMode(false);
                        }}
                        style={{ 
                            borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.lg,
                            borderWidth: isMondayTheme ? 1 : 0,
                            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                        }}
                    >
                        <Dialog.Title style={{ fontSize: 18 }}>
                            Marcar asistencia ({selectedStudents.size} estudiantes)
                        </Dialog.Title>
                        
                        <Dialog.Content style={styles.dialogContent}>
                            <Text style={{ marginBottom: SPACING.md, color: theme.colors.onSurfaceVariant }}>
                                Selecciona el estado de asistencia para los estudiantes seleccionados:
                            </Text>
                            
                            <Button 
                                mode="contained" 
                                onPress={() => {
                                    Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'present'));
                                    setShowAttendanceDialog(false);
                                    setSelectedStudents(new Set());
                                    setIsSelectionMode(false);
                                }}
                                style={{ 
                                    backgroundColor: theme.colors.attendance.present,
                                    marginTop: SPACING.md,
                                    marginBottom: SPACING.sm,
                                    borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                                    borderWidth: isMondayTheme ? 1 : 0,
                                    borderColor: isMondayTheme ? theme.colors.attendance.present : 'transparent',
                                    elevation: isMondayTheme ? 0 : 2
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                            >
                                Presente
                            </Button>
                            
                            <Button 
                                mode="contained"
                                onPress={() => {
                                    Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'excused'));
                                    setShowAttendanceDialog(false);
                                    setSelectedStudents(new Set());
                                    setIsSelectionMode(false);
                                }}
                                style={{ 
                                    backgroundColor: theme.colors.attendance.justified,
                                    marginVertical: SPACING.sm,
                                    borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                                    borderWidth: isMondayTheme ? 1 : 0,
                                    borderColor: isMondayTheme ? theme.colors.attendance.justified : 'transparent',
                                    opacity: selectedStudents.size === 0 ? 0.7 : 1,
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                            >
                                Falta Justificada
                            </Button>
                            
                            <Button 
                                mode="contained"
                                onPress={() => {
                                    Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'unexcused'));
                                    setShowAttendanceDialog(false);
                                    setSelectedStudents(new Set());
                                    setIsSelectionMode(false);
                                }}
                                style={{ 
                                    backgroundColor: theme.colors.attendance.unexcused,
                                    marginVertical: SPACING.sm,
                                    borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                                    borderWidth: isMondayTheme ? 1 : 0,
                                    borderColor: isMondayTheme ? theme.colors.attendance.unexcused : 'transparent',
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                            >
                                Falta Injustificada
                            </Button>
                        </Dialog.Content>
                    </Dialog>
                </Portal>
                {/* Modo de selección - Acciones de asistencia con FABs independientes */}
                {isSelectionMode && (
                    <View style={{ position: 'absolute', right: 16, bottom: 80, zIndex: 10 }}>
                        <View style={{ alignItems: 'flex-end', marginBottom: 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ 
                                    color: '#000000', 
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    fontSize: 14,
                                    fontWeight: '500'
                                }}>
                                    Seleccionar todos
                                </Text>
                                <FAB
                                    icon="select-all"
                                    color="white"
                                    style={{
                                        backgroundColor: theme.colors.secondary,
                                        borderRadius: isMondayTheme ? 2 : 28,
                                    }}
                                    onPress={() => setSelectedStudents(new Set(filteredStudents.map(s => s.id)))}
                                />
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ 
                                    color: '#000000', 
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    fontSize: 14,
                                    fontWeight: '500'
                                }}>
                                    Desmarcar todos
                                </Text>
                                <FAB
                                    icon="select-remove"
                                    color="white"
                                    style={{
                                        backgroundColor: theme.colors.secondary,
                                        borderRadius: isMondayTheme ? 2 : 28,
                                    }}
                                    onPress={() => setSelectedStudents(new Set())}
                                />
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ 
                                    color: '#000000', 
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    fontSize: 14,
                                    fontWeight: '500',
                                    opacity: selectedStudents.size === 0 ? 0.5 : 1
                                }}>
                                    Marcar presentes
                                </Text>
                                <FAB
                                    icon="check-circle"
                                    disabled={selectedStudents.size === 0}
                                    color="white"
                                    style={{
                                        backgroundColor: theme.colors.attendance.present,
                                        borderRadius: isMondayTheme ? 2 : 28,
                                    }}
                                    onPress={() => handleGroupActionWithValidation('present')}
                                />
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ 
                                    color: '#000000', 
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    fontSize: 14,
                                    fontWeight: '500',
                                    opacity: selectedStudents.size === 0 ? 0.5 : 1
                                }}>
                                    Falta justificada
                                </Text>
                                <FAB
                                    icon="alert-circle"
                                    disabled={selectedStudents.size === 0}
                                    color="white"
                                    style={{
                                        backgroundColor: theme.colors.attendance.justified,
                                        borderRadius: isMondayTheme ? 2 : 28,
                                    }}
                                    onPress={() => handleGroupActionWithValidation('excused')}
                                />
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ 
                                    color: '#000000', 
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    fontSize: 14,
                                    fontWeight: '500',
                                    opacity: selectedStudents.size === 0 ? 0.5 : 1
                                }}>
                                    Falta injustificada
                                </Text>
                                <FAB
                                    icon="close-circle"
                                    disabled={selectedStudents.size === 0}
                                    color="white"
                                    style={{
                                        backgroundColor: theme.colors.attendance.unexcused,
                                        borderRadius: isMondayTheme ? 2 : 28,
                                    }}
                                    onPress={() => handleGroupActionWithValidation('unexcused')}
                                />
                            </View>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ 
                                    color: '#000000', 
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    marginRight: 8,
                                    fontSize: 14,
                                    fontWeight: '500'
                                }}>
                                    Cancelar
                                </Text>
                                <FAB
                                    icon="close"
                                    color="white"
                                    style={{
                                        backgroundColor: theme.colors.error,
                                        borderRadius: isMondayTheme ? 2 : 28,
                                    }}
                                    onPress={() => {
                                        setIsSelectionMode(false);
                                        setSelectedStudents(new Set());
                                    }}
                                />
                            </View>
                        </View>
                    </View>
                )}
                
                {!isSelectionMode && (
                    <FAB
                        icon="account-multiple-check"
                        label="Asistencia"
                        color="white"
                        onPress={() => setIsSelectionMode(true)}
                        style={{
                            position: 'absolute',
                            margin: 16,
                            right: 0,
                            bottom: 0,
                            backgroundColor: theme.colors.primary,
                            elevation: isMondayTheme ? 0 : 4,
                            borderWidth: isMondayTheme ? 1 : 0,
                            borderColor: isMondayTheme ? theme.colors.primary : 'transparent',
                            borderRadius: isMondayTheme ? 2 : 28,
                        }}
                        uppercase={false}
                    />
                )}
                
                {/* Snackbar para feedback visual */}
                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={() => setSnackbarVisible(false)}
                    duration={2000}
                    style={{
                        backgroundColor: theme.colors.surfaceVariant,
                        borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                        borderWidth: isMondayTheme ? 1 : 0,
                        borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                        marginBottom: 70, // Espacio para evitar que se superponga con los botones
                    }}
                    action={{
                        label: 'OK',
                        onPress: () => setSnackbarVisible(false),
                    }}
                >
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>{snackbarMessage}</Text>
                </Snackbar>
                
                {/* Snackbar para notificación de estudiantes no seleccionados */}
                <Snackbar
                    visible={noSelectionSnackbarVisible}
                    onDismiss={() => setNoSelectionSnackbarVisible(false)}
                    duration={3000}
                    style={{
                        backgroundColor: '#f8d7da', // Fondo rojo claro para alerta
                        borderRadius: isMondayTheme ? 2 : BORDER_RADIUS.md,
                        borderWidth: 1,
                        borderColor: '#f5c6cb',
                        marginBottom: 140, // Posición más alta para no interferir con otras acciones
                    }}
                    action={{
                        label: 'Entendido',
                        onPress: () => setNoSelectionSnackbarVisible(false),
                    }}
                >
                    <Text style={{ color: '#721c24', fontWeight: '500' }}>
                        No hay estudiantes seleccionados. Por favor, selecciona al menos un estudiante.
                    </Text>
                </Snackbar>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    dateSelector: {
        padding: SPACING.md,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateButton: {
        marginRight: SPACING.xs,
        height: 40,
    },
    dateButtonContent: {
        paddingHorizontal: SPACING.sm,
    },
    dateButtonLabel: {
        fontSize: 16,
    },
    todayButton: {
        height: 40,
    },
    todayButtonContent: {
        paddingHorizontal: SPACING.sm,
    },
    todayButtonLabel: {
        fontSize: 16,
    },
    filtersContainer: {
        marginHorizontal: SPACING.md,
    },
    filterSection: {
        overflow: 'hidden',
    },
    filterTitle: {
        fontSize: 14,
        marginBottom: SPACING.xs,
    },
    studentsList: {
        paddingHorizontal: SPACING.md,
    },
    studentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '500',
    },
    studentInstrument: {
        fontSize: 14,
        marginTop: 2,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusButton: {
        marginHorizontal: 4,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        flexDirection: 'row',
    },
    dialogContent: {
        minWidth: 250,
    },
    bottomActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
        elevation: 4,
        zIndex: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    loadingText: {
        fontSize: 16,
        color: '#333333',
        textAlign: 'center',
        marginTop: 16,
    },
});

export default memo(AttendanceRegistrationScreen);
