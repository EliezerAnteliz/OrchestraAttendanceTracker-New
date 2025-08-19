import React, { useCallback, useEffect, useState, memo, useMemo } from 'react';
import { View, RefreshControl, StyleSheet, Alert, LogBox, SafeAreaView, StatusBar, Platform, TouchableOpacity, FlatList } from 'react-native';
import { ActivityIndicator, Appbar, Portal, Dialog, Button, Text, Surface, List, IconButton, Chip, Icon, FAB } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useRouter } from 'expo-router';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, THEME_NAMES } from '../theme';
import { StudentItem, MondayStudentItem, ThemeToggleButton, StatusFilters } from '../components';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';

// Ignorar advertencias específicas de rendimiento
LogBox.ignoreLogs(['VirtualizedList: You have a large list that is slow to update']);

// IDs correctos de la base de datos
const ORGANIZATION_ID = 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4';
const PROGRAM_ID = '9d7dc91c-7bbe-49cd-bc64-755467bf91da';

const CACHE_KEYS = {
    STUDENTS: 'cached_students',
    ATTENDANCE: 'cached_attendance',
    LAST_FETCH: 'last_fetch_timestamp'
};

const CACHE_DURATION = 1000 * 60 * 5; // 5 minutos

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
                marginRight: 12, // Aumentar el margen entre chips
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

const StudentsListScreen = () => {
    const router = useRouter();
    const { theme, themeType, toggleTheme, setTheme } = useAppTheme();
    const isDark = themeType.includes('dark');
    const isMondayTheme = themeType === THEME_NAMES.MONDAY;
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);
    const [selectedInstrument, setSelectedInstrument] = useState('all');
    const [activeFilter, setActiveFilter] = useState('all');
    const [attendanceStatus, setAttendanceStatus] = useState({});
    const [isAttendanceMode, setIsAttendanceMode] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [instruments, setInstruments] = useState([]);
    const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
    
    // Ya no necesitamos extraer instrumentos porque usamos una lista fija ordenada
    // pero mantenemos la función por si queremos validar los instrumentos disponibles
    const extractInstruments = useCallback((studentData) => {
        const uniqueInstruments = new Set();
        
        studentData.forEach(student => {
            if (student.instrument && 
                student.instrument !== 'Not assigned' && 
                student.instrument !== 'not assigned' && 
                student.instrument !== '' && 
                student.instrument !== null) {
                // Normalizar el formato del instrumento
                const normalizedInstrument = student.instrument.toLowerCase();
                uniqueInstruments.add(normalizedInstrument);
            }
        });
        
        // Ahora ya no usamos el resultado para la UI, solo para estadísticas
        return Array.from(uniqueInstruments).sort();
    }, []);

    // Cargar datos desde caché
    const loadFromCache = useCallback(async () => {
        try {
            const cachedStudents = await AsyncStorage.getItem(CACHE_KEYS.STUDENTS);
            const cachedAttendance = await AsyncStorage.getItem(CACHE_KEYS.ATTENDANCE);
            
            if (cachedStudents && cachedAttendance) {
                setStudents(JSON.parse(cachedStudents));
                setAttendanceStatus(JSON.parse(cachedAttendance));
                setLoading(false);
            }
            
            // Siempre fetchear datos frescos después de cargar el caché
            fetchStudents(false);
        } catch (error) {
            console.error('Error loading from cache:', error);
            fetchStudents(true);
        }
    }, []);

    // Guardar datos en caché
    const saveToCache = useCallback(async (studentsData, attendanceData) => {
        try {
            await Promise.all([
                AsyncStorage.setItem(CACHE_KEYS.STUDENTS, JSON.stringify(studentsData)),
                AsyncStorage.setItem(CACHE_KEYS.ATTENDANCE, JSON.stringify(attendanceData)),
                AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH, Date.now().toString())
            ]);
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }, []);

    // Obtener asistencia para una fecha específica
    const fetchAttendanceForDate = async (date) => {
            const { data, error } = await supabase
            .from('attendance')
                .select('*')
            .eq('date', date);

        if (error) {
            console.error('Error fetching attendance:', error);
            return {};
        }

        return data.reduce((acc, record) => {
            acc[record.student_id] = record.status_code;
            return acc;
        }, {});
    };

    // Cargar estudiantes y asistencia
    const fetchStudents = useCallback(async (showLoader = true) => {
        if (showLoader) {
            setLoading(true);
        }

        try {
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            // Consulta simplificada, similar a AttendanceRegistrationScreen.js
            const [studentsResponse, attendanceResponse] = await Promise.all([
                supabase
                    .from('students')
                    .select('*')
                    .order('first_name', { ascending: true }),
                supabase
                .from('attendance')
                    .select('*')
                    .eq('date', formattedDate)
            ]);

            if (studentsResponse.error) throw studentsResponse.error;
            if (attendanceResponse.error) throw attendanceResponse.error;

            // Verificar cuántos estudiantes no tienen instrumento asignado
            const studentsWithoutInstrument = studentsResponse.data.filter(student => 
                student.instrument === null || 
                student.instrument === undefined || 
                student.instrument === '' || 
                student.instrument === 'Not assigned' ||
                !student.instrument
            );

            const attendanceMap = {};
            attendanceResponse.data.forEach(record => {
                attendanceMap[record.student_id] = record.status_code;
            });

            const studentsData = studentsResponse.data || [];
            setStudents(studentsData);
            setAttendanceStatus(attendanceMap);
            
            // Extraer instrumentos únicos de los estudiantes
            const uniqueInstruments = extractInstruments(studentsData);
            setInstruments(uniqueInstruments);

            // Guardar en caché
            await Promise.all([
                AsyncStorage.setItem(CACHE_KEYS.STUDENTS, JSON.stringify(studentsData)),
                AsyncStorage.setItem(CACHE_KEYS.ATTENDANCE, JSON.stringify(attendanceMap))
            ]);
        } catch (error) {
            console.error('Error fetching students:', error);
            if (!students.length) {
                Alert.alert('Error', 'No se pudieron cargar los estudiantes');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Cargar instrumentos
    const loadInstruments = useCallback(async () => {
        try {
            // Consulta simplificada, similar a AttendanceRegistrationScreen.js
            const { data, error } = await supabase
                .from('students')
                .select('instrument');

            if (error) throw error;

            // Orden específico para los instrumentos - asegurando que Not assigned esté al final
            const instrumentOrder = ['Violin', 'Viola', 'Cello', 'Bass', 'Not assigned'];
            
            // Obtener instrumentos únicos y manejar valores nulos o vacíos
            const uniqueInstruments = [...new Set(data.map(item => {
                // Convertir null o cadena vacía a "Not assigned"
                if (item.instrument === null || item.instrument === undefined || item.instrument === '') {
                    return 'Not assigned';
                }
                return item.instrument;
            }))];
            
            // Asegurarse de que "Not assigned" siempre esté disponible
            if (!uniqueInstruments.includes('Not assigned')) {
                uniqueInstruments.push('Not assigned');
            }
            
            // Ordenar los instrumentos según el orden especificado
            const sortedInstruments = uniqueInstruments.sort((a, b) => {
                const indexA = instrumentOrder.indexOf(a);
                const indexB = instrumentOrder.indexOf(b);
                
                if (indexA >= 0 && indexB >= 0) {
                    return indexA - indexB;
                }
                if (indexA >= 0) return -1;
                if (indexB >= 0) return 1;
                return a.localeCompare(b);
            });

            setInstruments(sortedInstruments);
        } catch (error) {
            console.error('Error cargando instrumentos:', error);
        }
    }, []);

    // Inicialización
    useEffect(() => {
        loadFromCache();
        loadInstruments();
    }, [loadFromCache, loadInstruments]);

    // Actualizar al obtener foco
    useFocusEffect(
        useCallback(() => {
            fetchStudents(false);
        }, [fetchStudents])
    );

    // Manejar refresh
    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchStudents(false);
    }, [fetchStudents]);

    // Manejar cambio de estado de asistencia
    const handleStatusChange = useCallback(async (studentId, status) => {
        try {
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            const { data: existingRecord, error: checkError } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('date', formattedDate)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingRecord) {
                const { error: updateError } = await supabase
                    .from('attendance')
                    .update({ 
                        status_code: status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('student_id', studentId)
                    .eq('date', formattedDate);

                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('attendance')
                    .insert({
                        student_id: studentId,
                        date: formattedDate,
                    status_code: status,
                    updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;
            }

            // Recargar los datos después de la actualización
            fetchStudents();
        } catch (error) {
            console.error('Error updating attendance:', error);
            Alert.alert('Error', 'No se pudo actualizar la asistencia');
        }
    }, [fetchStudents]);

    // Manejar selección de estudiantes
    const toggleStudentSelection = useCallback((studentId) => {
        setSelectedStudents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    }, []);

    // Filtrado optimizado


    const filteredStudents = useMemo(() => {
        // Primero aplicamos el filtro de estado (activo/inactivo)
        let filtered = students;
        
        // Aplicar filtro de estado
        if (activeFilter === 'active') {
            filtered = students.filter(student => student.is_active !== false);
        } else if (activeFilter === 'inactive') {
            filtered = students.filter(student => student.is_active === false);
        }

        // Luego aplicamos el filtro de instrumento
        if (selectedInstrument === 'all') {
            return filtered;
        }
        
        if (selectedInstrument === 'Not assigned') {
            // Mostrar estudiantes sin instrumento asignado
            return filtered.filter(student => {
                const hasNoInstrument = 
                    !student.instrument || 
                    student.instrument === null || 
                    student.instrument === undefined || 
                    student.instrument === '' || 
                    student.instrument === 'Not assigned' ||
                    student.instrument === 'not assigned' ||
                    student.instrument === 'Not Assigned' ||
                    student.instrument === 'not Assigned' ||
                    student.instrument === 'NOT ASSIGNED' ||
                    student.instrument === 'Sin asignar' ||
                    student.instrument === 'sin asignar' ||
                    student.instrument === 'Sin Asignar' ||
                    student.instrument === 'SIN ASIGNAR' ||
                    student.instrument === 'None' ||
                    student.instrument === 'none' ||
                    student.instrument === 'NONE';
                
                return hasNoInstrument;
            });
        }
        
        // Filtrar por instrumento específico (ignorando mayúsculas/minúsculas)
        return filtered.filter(student => {
            if (!student.instrument) return false;
            return student.instrument.toLowerCase() === selectedInstrument.toLowerCase();
        });
    }, [students, selectedInstrument, activeFilter]);

    // Optimizaciones para FlatList
    const keyExtractor = useCallback((item) => item.id.toString(), []);

    const renderItem = useCallback(({ item }) => {
        // Usar el componente MondayStudentItem cuando el tema Monday está activo
        if (themeType === THEME_NAMES.MONDAY) {
            return (
                <MondayStudentItem
                    key={item.id}
                    item={item}
                    onPress={() => handleStudentPress(item)}
                    isSelected={selectedStudents.has(item.id)}
                    status={attendanceStatus[item.id] || ''}
                    attendanceMode={isAttendanceMode}
                />
            );
        }
        
        // Mantener el componente original para el tema por defecto
        return (
            <StudentItem
                key={item.id}
                item={item}
                onPress={() => handleStudentPress(item)}
                isSelected={selectedStudents.has(item.id)}
                status={attendanceStatus[item.id] || ''}
                attendanceMode={isAttendanceMode}
            />
        );
    }, [selectedStudents, isAttendanceMode, attendanceStatus, handleStudentPress, themeType]);

    const ListEmptyComponent = useCallback(() => (
        <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>
                No hay estudiantes para el instrumento seleccionado
            </Text>
        </View>
    ), [theme.colors.text]);

    const getItemLayout = useCallback((data, index) => ({
        length: 80, // Altura aproximada de cada elemento
        offset: 80 * index,
        index,
    }), []);

    // Manejar presión en estudiante
    const handleStudentPress = (student) => {
        if (isAttendanceMode) {
            // Si estamos en modo asistencia, manejamos la selección
            toggleStudentSelection(student.id);
            
            // Proporcionar retroalimentación táctil si está disponible
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50); // Vibración sutil de 50ms
            }
        } else {
            // Si no estamos en modo asistencia, navegamos al perfil
            // Usamos la ruta /profile/[id] para evitar conflictos con la estructura anterior
            router.push({
                pathname: `/profile/${student.id}`,
                params: {
                    firstName: student.first_name,
                    lastName: student.last_name,
                    grade: student.current_grade,
                    age: student.age,
                    instrument: student.instrument,
                    position: student.orchestra_position,
                }
            });
        }
    };

    // Optimizar la selección múltiple
    const selectAllStudents = useCallback(() => {
        const allIds = new Set(
            filteredStudents.map(student => student.id)
        );
        setSelectedStudents(allIds);
    }, [filteredStudents]);

    // Función para deseleccionar todos
    const deselectAllStudents = useCallback(() => {
        setSelectedStudents(new Set());
    }, []);

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        loaderContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
        },
        loaderText: {
            marginTop: SPACING.md,
            color: theme.colors.primary,
            ...TYPOGRAPHY.body1,
        },
        listContent: {
            paddingVertical: SPACING.sm,
        },
        emptyList: {
            flexGrow: 1,
        },
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: SPACING.xxl,
            marginTop: '50%',
        },
        emptyText: {
            textAlign: 'center',
            ...TYPOGRAPHY.body1,
            color: theme.colors.text,
        },
        dialog: {
            backgroundColor: theme.colors.surface,
            borderRadius: themeType === THEME_NAMES.MONDAY ? BORDER_RADIUS.sm : BORDER_RADIUS.md,
            maxHeight: '80%',
            elevation: themeType === THEME_NAMES.MONDAY ? 0 : 4,
            borderWidth: themeType === THEME_NAMES.MONDAY ? 1 : 0,
            borderColor: themeType === THEME_NAMES.MONDAY ? theme.colors.outline : 'transparent',
            margin: SPACING.lg,
            overflow: 'hidden',
            width: '85%',
            alignSelf: 'center',
        },
        dialogTitle: {
            ...TYPOGRAPHY.subtitle1,
            marginBottom: SPACING.xs,
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 20,
            paddingTop: SPACING.sm,
        },
        dialogText: {
            textAlign: 'center',
            marginBottom: SPACING.xs,
            ...TYPOGRAPHY.body1,
            fontSize: 16,
        },
        dialogActions: {
            flexDirection: 'column',
            padding: SPACING.md,
            paddingTop: 0,
            paddingBottom: 16,
            gap: 8
        },
        button: {
            width: '100%',
            marginVertical: SPACING.xxs,
            borderRadius: BORDER_RADIUS.lg,
            height: 48,
            justifyContent: 'center',
        },
        buttonContent: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonIcon: {
            marginRight: SPACING.xs,
        },
        buttonLabel: {
            fontSize: 16,
            fontWeight: '600',
            letterSpacing: 0.5,
        },
        cancelButton: {
            marginTop: SPACING.xs,
        },
        filterContainer: {
            padding: SPACING.md,
            paddingVertical: SPACING.md,
            marginHorizontal: SPACING.md,
            marginVertical: SPACING.md,
            borderRadius: BORDER_RADIUS.md,
            backgroundColor: theme.colors.elevation.level1,
            ...SHADOWS.small,
            elevation: 3,
        },
        filtersContainer: {
            marginHorizontal: SPACING.md,
        },
        filtersRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            gap: SPACING.xs,
            width: '100%',
        },
        instrumentChip: {
            marginVertical: SPACING.xs,
            height: 40,
            borderRadius: 20,
            paddingHorizontal: 6,
            borderWidth: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        header: {
            backgroundColor: theme.colors.surface,
            elevation: 4,
        },
        themeToggle: {
            marginRight: SPACING.xs,
            transform: [{ scale: 1.1 }],
        },
        headerContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: SPACING.md,
            marginHorizontal: SPACING.md,
            borderRadius: BORDER_RADIUS.md,
            backgroundColor: theme.colors.surface,
            elevation: 3,
        },
        filterTitle: {
            fontSize: 16,
            fontWeight: '500',
            color: theme.colors.onSurfaceVariant,
            marginBottom: SPACING.xs,
        },
        filterChip: {
            marginVertical: SPACING.xs,
            height: 40,
            borderRadius: 20,
            paddingHorizontal: 6,
            justifyContent: 'center',
            alignItems: 'center',
        },
        filterSection: {
            overflow: 'hidden',
        },
        dateSelector: {
            padding: SPACING.md,
        },
    });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? 30 : 0 }]}>
                {/* Header idéntico a AttendanceRegistrationScreen */}
                <Surface style={[
                    styles.dateSelector, 
                    { 
                        backgroundColor: theme.colors.surface, 
                        elevation: isMondayTheme ? 0 : 3, 
                        borderWidth: isMondayTheme ? 1 : 0, 
                        borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                        borderRadius: 0, // Completamente cuadrado
                        marginTop: Platform.OS === 'ios' ? 15 : 25, // Aumentar margen superior
                        marginBottom: SPACING.md, // Espaciado consistente
                        marginHorizontal: SPACING.md,
                        padding: SPACING.md
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

                        {/* Controles de tema - Centro */}
                        <View
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
                            {/* Botón para alternar entre tema Monday y Material */}
                            <TouchableOpacity 
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: isMondayTheme ? theme.colors.primaryContainer : 'transparent',
                                    paddingVertical: 6,
                                    paddingHorizontal: 12,
                                    borderRadius: 20,
                                    marginRight: 8
                                }}
                                onPress={() => {
                                    const nextTheme = isMondayTheme ? THEME_NAMES.DEFAULT : THEME_NAMES.MONDAY;
                                    AsyncStorage.setItem('theme_name', nextTheme);
                                    setTheme(nextTheme);
                                }}
                            >
                                <Icon 
                                    source={isMondayTheme ? "check-circle" : "circle-outline"} 
                                    size={20} 
                                    color={theme.colors.primary} 
                                    style={{ marginRight: 4 }} 
                                />
                                <Text style={{ 
                                    color: theme.colors.primary,
                                    fontSize: 14,
                                    fontWeight: '500'
                                }}>
                                    Monday
                                </Text>
                            </TouchableOpacity>
                            
                            {/* Botón para alternar entre modo claro y oscuro */}
                            <ThemeToggleButton 
                                size={20} 
                                style={{
                                    width: 36,
                                    height: 36,
                                    backgroundColor: isDark ? theme.colors.surface : theme.colors.background,
                                }} 
                            />
                        </View>
                        
                        {/* Botón con total de alumnos registrados - Derecha */}
                        <View
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
                                fontWeight: 'bold',
                                fontSize: 20
                            }}>
                                68
                            </Text>
                            <Text style={{
                                color: 'white',
                                fontSize: 13,
                                fontWeight: '500'
                            }}>
                                Total
                            </Text>
                        </View>
                    </View>
                </Surface>

                <View style={styles.filtersContainer}>
                    {/* Filtro por instrumento */}
                    <Surface style={[
                        styles.filterSection,
                        {
                            marginBottom: SPACING.md, // Espaciado consistente
                            borderRadius: 0, // Completamente cuadrado
                            borderWidth: isMondayTheme ? 1 : 0,
                            borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                            elevation: isMondayTheme ? 0 : 1,
                            backgroundColor: 'white',
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
                        {/* Todos siempre primero */}
                        <InstrumentFilterChip
                            label="Todos"
                            selected={selectedInstrument === 'all'}
                            onPress={() => setSelectedInstrument('all')}
                            theme={theme}
                            isMondayTheme={isMondayTheme}
                        />
                        {/* Instrumentos en orden específico */}
                        {['violin', 'viola', 'cello', 'bass'].map(instrumentName => (
                            <InstrumentFilterChip
                                key={instrumentName}
                                label={instrumentName.charAt(0).toUpperCase() + instrumentName.slice(1)}
                                selected={selectedInstrument === instrumentName}
                                onPress={() => setSelectedInstrument(instrumentName)}
                                theme={theme}
                                isMondayTheme={isMondayTheme}
                            />
                        ))}
                        {/* Not Assigned siempre al final */}
                        <InstrumentFilterChip
                            label="Not Assigned"
                            selected={selectedInstrument === 'Not assigned'}
                            onPress={() => setSelectedInstrument('Not assigned')}
                            theme={theme}
                            isMondayTheme={isMondayTheme}
                        />
                    </ScrollView>
                </Surface>

                {/* Filtros por estado */}
                <Surface style={[
                    styles.filterSection,
                    {
                        marginTop: 0, // Sin espacio adicional entre secciones
                        marginBottom: SPACING.md, // Espaciado consistente
                        borderRadius: 0, // Completamente cuadrado
                        borderWidth: isMondayTheme ? 1 : 0,
                        borderColor: isMondayTheme ? theme.colors.outline : 'transparent',
                        elevation: isMondayTheme ? 0 : 1,
                        backgroundColor: 'white',
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
                        Estado
                    </Text>
                    <StatusFilters
                        activeFilter={activeFilter}
                        setActiveFilter={setActiveFilter}
                        theme={theme}
                        isMondayTheme={isMondayTheme}
                        SPACING={SPACING}
                    />
                </Surface>
                </View>

                {/* Lista de estudiantes */}
                {loading ? (
                    <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={[styles.loaderText, { color: theme.colors.text }]}>Cargando estudiantes...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredStudents}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ 
                            paddingBottom: 80, 
                            paddingTop: isMondayTheme ? 0 : SPACING.xs,
                            paddingHorizontal: isMondayTheme ? 0 : SPACING.sm 
                        }}
                        ListEmptyComponent={ListEmptyComponent}
                        initialNumToRender={10}
                        maxToRenderPerBatch={8}
                        windowSize={5}
                        removeClippedSubviews={true}
                        getItemLayout={getItemLayout}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                colors={[theme.colors.primary]}
                                tintColor={theme.colors.primary}
                                progressBackgroundColor={theme.colors.surface}
                            />
                        }
                    />
                )}

                {/* Diálogo de asistencia */}
                {/* Portales para los diálogos */}
            <Portal>


                    {/* Diálogo de asistencia */}
                <Dialog
                    visible={showAttendanceDialog}
                    onDismiss={() => setShowAttendanceDialog(false)}
                        style={[
                            styles.dialog, 
                            themeType === THEME_NAMES.MONDAY && { 
                                borderWidth: 1, 
                                borderColor: theme.colors.outline,
                                borderRadius: BORDER_RADIUS.sm,
                                elevation: 0
                            }
                        ]}
                        dismissable={true}
                        theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.5)' } }}
                    >
                        <Dialog.Title style={{ color: theme.colors.text, textAlign: 'center', fontSize: 18, marginTop: 4 }}>
                            Marcar Asistencia
                        </Dialog.Title>
                    <Dialog.Content>
                            <Text style={{ color: theme.colors.text, textAlign: 'center', marginBottom: SPACING.sm, fontSize: 14 }}>
                            ¿Qué estado deseas asignar a los {selectedStudents.size} estudiantes seleccionados?
                        </Text>
                    </Dialog.Content>
                        <Dialog.Actions style={{
                            flexDirection: 'column',
                            paddingHorizontal: 16,
                            paddingTop: 0,
                            paddingBottom: 16,
                            gap: 8
                        }}>
                        <Button 
                            mode="contained" 
                            onPress={() => {
                                    Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'A'));
                                setShowAttendanceDialog(false);
                                    setSelectedStudents(new Set());
                                    setIsAttendanceMode(false);
                                }}
                                style={{
                                    width: '100%',
                                    borderRadius: 4,
                                    height: 44,
                                    justifyContent: 'center',
                                    marginBottom: 8,
                                    elevation: 1
                                }}
                            buttonColor={theme.colors.attendance.present}
                                contentStyle={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                                icon="check"
                        >
                            Presente (A)
                        </Button>
                        <Button 
                            mode="contained"
                            onPress={() => {
                                    Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'EA'));
                                setShowAttendanceDialog(false);
                                    setSelectedStudents(new Set());
                                    setIsAttendanceMode(false);
                                }}
                                style={{
                                    width: '100%',
                                    borderRadius: 4,
                                    height: 44,
                                    justifyContent: 'center',
                                    marginBottom: 8,
                                    elevation: 1
                                }}
                            buttonColor={theme.colors.attendance.justified}
                                contentStyle={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                                icon="alert"
                        >
                            Ausencia Justificada (EA)
                        </Button>
                        <Button 
                            mode="contained"
                            onPress={() => {
                                    Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'UA'));
                                setShowAttendanceDialog(false);
                                    setSelectedStudents(new Set());
                                    setIsAttendanceMode(false);
                                }}
                                style={{
                                    width: '100%',
                                    borderRadius: 4,
                                    height: 44,
                                    justifyContent: 'center',
                                    marginBottom: 12,
                                    elevation: 1
                                }}
                            buttonColor={theme.colors.attendance.unexcused}
                                contentStyle={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                                icon="close"
                        >
                            Ausencia Injustificada (UA)
                        </Button>
                        <Button 
                                mode="text"
                            onPress={() => setShowAttendanceDialog(false)}
                                style={{
                                    width: '100%',
                                    borderRadius: 4,
                                    height: 44,
                                    justifyContent: 'center'
                                }}
                                textColor={theme.colors.primary}
                                contentStyle={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                labelStyle={{
                                    fontSize: 15,
                                    fontWeight: '500',
                                    letterSpacing: 0.5
                                }}
                                icon="close"
                        >
                            Cancelar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            
            {/* FAB para ir a la pantalla de registro de estudiantes */}
            <FAB
                icon="account-plus"
                label="Nuevo"
                color="white"
                onPress={() => router.push('/register')}
                style={{
                    position: 'absolute',
                    margin: 16,
                    right: 0,
                    bottom: 0,
                    backgroundColor: theme.colors.primary,
                    elevation: isMondayTheme ? 0 : 4,
                    borderWidth: isMondayTheme ? 1 : 0,
                    borderColor: isMondayTheme ? theme.colors.primary : 'transparent',
                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : 28,
                }}
                uppercase={false}
            />
        </View>
        </SafeAreaView>
    );
};

// Definición de estilos
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dateSelector: {
        padding: SPACING.md,
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
    filterChip: {
        marginRight: SPACING.xs,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: SPACING.md,
    },
    dialog: {
        borderRadius: BORDER_RADIUS.md,
    }
});

export default memo(StudentsListScreen);
