import React, { useCallback, useEffect, useState, memo, useMemo } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Appbar, Portal, Dialog, Button, Text, Surface, List, IconButton, Chip } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAppTheme } from '../theme';
import StudentItem from '../components/StudentItem';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';
import ThemeToggleButton from '../components/ThemeToggleButton';

// IDs correctos de la base de datos
const ORGANIZATION_ID = 'a0d1e7a6-87ad-45d1-9cb5-f08f083f24c4';
const PROGRAM_ID = '9d7dc91c-7bbe-49cd-bc64-755467bf91da';

const CACHE_KEYS = {
    STUDENTS: 'cached_students',
    ATTENDANCE: 'cached_attendance',
    LAST_FETCH: 'last_fetch_timestamp'
};

const CACHE_DURATION = 1000 * 60 * 5; // 5 minutos

const StudentsListScreen = () => {
    const router = useRouter();
    const { theme, isDark } = useAppTheme();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [attendanceStatus, setAttendanceStatus] = useState({});
    const [isAttendanceMode, setIsAttendanceMode] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
    const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
    const [selectedInstrument, setSelectedInstrument] = useState('all');
    const [instruments, setInstruments] = useState([]);

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
            const today = new Date().toISOString().split('T')[0];
            
            // Consulta simplificada, similar a AttendanceRegistrationScreen.js
            const [studentsResponse, attendanceResponse] = await Promise.all([
                supabase
                    .from('students')
                    .select('*')
                    .order('first_name', { ascending: true }),
                supabase
                .from('attendance')
                    .select('*')
                    .eq('date', today)
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

            setStudents(studentsResponse.data || []);
            setAttendanceStatus(attendanceMap);

            // Guardar en caché
            await Promise.all([
                AsyncStorage.setItem(CACHE_KEYS.STUDENTS, JSON.stringify(studentsResponse.data)),
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
            const today = new Date().toISOString().split('T')[0];
            
            const { data: existingRecord, error: checkError } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('date', today)
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
                    .eq('date', today);

                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('attendance')
                    .insert({
                        student_id: studentId,
                        date: today,
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
        if (selectedInstrument === 'all') {
            return students;
        }
        
        if (selectedInstrument === 'Not assigned') {
            // Mostrar estudiantes sin instrumento asignado - usando una condición extremadamente permisiva
            const filtered = students.filter(student => {
                // Verificar si el instrumento es nulo, indefinido, cadena vacía, exactamente "Not assigned" o cualquier otro caso
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
            
            return filtered;
        }
        
        // Filtrar por instrumento específico
        const filtered = students.filter(student => student.instrument === selectedInstrument);
        return filtered;
    }, [students, selectedInstrument]);

    // Optimizaciones para FlatList
    const keyExtractor = useCallback((item) => item.id.toString(), []);

    const renderItem = useCallback(({ item }) => (
        <StudentItem
            key={item.id}
            item={item}
            onPress={() => handleStudentPress(item)}
            isSelected={selectedStudents.has(item.id)}
            status={attendanceStatus[item.id] || ''}
            attendanceMode={isAttendanceMode}
        />
    ), [selectedStudents, isAttendanceMode, attendanceStatus, handleStudentPress]);

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
            router.push({
                pathname: `/student/${student.id}`,
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
            backgroundColor: COLORS.background,
        },
        loaderContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: COLORS.background,
        },
        loaderText: {
            marginTop: SPACING.md,
            color: COLORS.primary,
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
            color: COLORS.text.secondary,
        },
        dialog: {
            backgroundColor: COLORS.surface,
            borderRadius: BORDER_RADIUS.md,
            maxHeight: '80%',
            ...SHADOWS.medium,
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
            gap: SPACING.xs,
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
            ...SHADOWS.small,
            elevation: 3,
        },
        filtersContainer: {
            flexDirection: 'column',
            width: '100%',
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
            backgroundColor: COLORS.surface,
            elevation: 4,
        },
        themeToggle: {
            marginRight: SPACING.xs,
            transform: [{ scale: 1.1 }],
        },
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.Content title="Estudiantes" />
                <ThemeToggleButton style={styles.themeToggle} />
                <Appbar.Action 
                    icon={isAttendanceMode ? "clipboard-check-outline" : "clipboard-outline"}
                    onPress={() => {
                        // Limpiar selecciones al cambiar de modo
                        if (isAttendanceMode) {
                            setSelectedStudents(new Set());
                        }
                        setIsAttendanceMode(!isAttendanceMode);
                    }} 
                    color={isAttendanceMode ? theme.colors.primary : undefined}
                />
                {isAttendanceMode && (
                    <>
                        <Appbar.Action 
                            icon="card-multiple-outline"
                            onPress={selectAllStudents}
                            tooltip="Seleccionar todos"
                            color={selectedStudents.size > 0 ? theme.colors.primary : undefined}
                        />
                        <Appbar.Action 
                            icon="card-off-outline"
                            onPress={deselectAllStudents}
                            tooltip="Deseleccionar todos"
                            disabled={selectedStudents.size === 0}
                            color={selectedStudents.size === 0 ? theme.colors.disabled : undefined}
                        />
                        <Appbar.Action 
                            icon="check-circle-outline"
                            onPress={() => setShowAttendanceDialog(true)}
                            disabled={selectedStudents.size === 0}
                            color={selectedStudents.size === 0 ? theme.colors.disabled : theme.colors.primary}
                        />
                    </>
                )}
            </Appbar.Header>

            {/* Filtro de instrumentos */}
            <Surface style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.filtersContainer}>
                    {/* Todos los filtros en una sola línea con orden específico */}
                    <View style={styles.filtersRow}>
                        {/* Primero: Instrumentos específicos (Violin, Viola, Cello, Bass) */}
                        {['Violin', 'Viola', 'Cello', 'Bass'].map((instrument) => {
                            if (instruments.includes(instrument)) {
                                return (
                                    <Chip
                                        key={instrument}
                                        selected={selectedInstrument === instrument}
                                        onPress={() => setSelectedInstrument(instrument)}
                                        style={[
                                            styles.instrumentChip,
                                            selectedInstrument === instrument && { 
                                                backgroundColor: 'rgba(103, 80, 164, 0.08)',
                                                borderColor: theme.colors.primary 
                                            }
                                        ]}
                                        mode="outlined"
                                        selectedColor={theme.colors.primary}
                                        textStyle={{ 
                                            color: selectedInstrument === instrument ? theme.colors.primary : theme.colors.text,
                                            fontSize: 15,
                                            fontWeight: selectedInstrument === instrument ? '600' : '500',
                                            paddingHorizontal: 2,
                                            textAlign: 'center',
                                            textAlignVertical: 'center',
                                            lineHeight: 20
                                        }}
                                    >
                                        {instrument}
                                    </Chip>
                                );
                            }
                            return null;
                        })}
                        
                        {/* Segundo: Botón "Todos" */}
                        <Chip
                            selected={selectedInstrument === 'all'}
                            onPress={() => setSelectedInstrument('all')}
                            style={[
                                styles.instrumentChip,
                                selectedInstrument === 'all' && { 
                                    backgroundColor: 'rgba(103, 80, 164, 0.08)',
                                    borderColor: theme.colors.primary 
                                }
                            ]}
                            mode="outlined"
                            selectedColor={theme.colors.primary}
                            textStyle={{ 
                                color: selectedInstrument === 'all' ? theme.colors.primary : theme.colors.text,
                                fontSize: 15,
                                fontWeight: selectedInstrument === 'all' ? '600' : '500',
                                paddingHorizontal: 2,
                                textAlign: 'center',
                                textAlignVertical: 'center',
                                lineHeight: 20
                            }}
                        >
                            Todos
                        </Chip>
                        
                        {/* Tercero: Botón "Not Assigned" - siempre visible */}
                        <Chip
                            selected={selectedInstrument === 'Not assigned'}
                            onPress={() => {
                                setSelectedInstrument('Not assigned');
                            }}
                            style={[
                                styles.instrumentChip,
                                selectedInstrument === 'Not assigned' && { 
                                    backgroundColor: 'rgba(103, 80, 164, 0.08)',
                                    borderColor: theme.colors.primary 
                                }
                            ]}
                            mode="outlined"
                            selectedColor={theme.colors.primary}
                            textStyle={{ 
                                color: selectedInstrument === 'Not assigned' ? theme.colors.primary : theme.colors.text,
                                fontSize: 15,
                                fontWeight: selectedInstrument === 'Not assigned' ? '600' : '500',
                                paddingHorizontal: 2,
                                textAlign: 'center',
                                textAlignVertical: 'center',
                                lineHeight: 20
                            }}
                        >
                            Not Assigned
                        </Chip>
                    </View>
                </View>
            </Surface>

            {/* Lista de estudiantes */}
            {loading ? (
                <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loaderText, { color: theme.colors.text }]}>Cargando estudiantes...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredStudents}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    getItemLayout={getItemLayout}
                    initialNumToRender={7}
                    maxToRenderPerBatch={5}
                    windowSize={3}
                    removeClippedSubviews={true}
                    updateCellsBatchingPeriod={50}
                    ListEmptyComponent={ListEmptyComponent}
                    maintainVisibleContentPosition={{
                        minIndexForVisible: 0,
                        autoscrollToTopThreshold: 10
                    }}
                    contentContainerStyle={[
                        styles.listContent,
                        !filteredStudents.length && styles.emptyList
                    ]}
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
            <Portal>
                <Dialog
                    visible={showAttendanceDialog}
                    onDismiss={() => setShowAttendanceDialog(false)}
                    style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
                    dismissable={true}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.5)' } }}
                >
                    <Dialog.Title style={[styles.dialogTitle, { color: theme.colors.text }]}>
                        Marcar Asistencia
                    </Dialog.Title>
                    <Dialog.Content>
                        <Text style={[styles.dialogText, { color: theme.colors.text }]}>
                            ¿Qué estado deseas asignar a los {selectedStudents.size} estudiantes seleccionados?
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions style={styles.dialogActions}>
                        <Button 
                            mode="contained" 
                            onPress={() => {
                                Array.from(selectedStudents).forEach(id => handleStatusChange(id, 'A'));
                                setShowAttendanceDialog(false);
                                setSelectedStudents(new Set());
                                setIsAttendanceMode(false);
                            }}
                            style={styles.button}
                            buttonColor={theme.colors.attendance.present}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                            icon={({size, color}) => (
                                <View style={styles.buttonIcon}>
                                    <IconButton
                                        icon="check-circle"
                                        size={22}
                                        iconColor={color}
                                        style={{margin: 0, padding: 0}}
                                    />
                                </View>
                            )}
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
                            style={styles.button}
                            buttonColor={theme.colors.attendance.justified}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                            icon={({size, color}) => (
                                <View style={styles.buttonIcon}>
                                    <IconButton
                                        icon="alert-circle"
                                        size={22}
                                        iconColor={color}
                                        style={{margin: 0, padding: 0}}
                                    />
                                </View>
                            )}
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
                            style={styles.button}
                            buttonColor={theme.colors.attendance.unexcused}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                            icon={({size, color}) => (
                                <View style={styles.buttonIcon}>
                                    <IconButton
                                        icon="close-circle"
                                        size={22}
                                        iconColor={color}
                                        style={{margin: 0, padding: 0}}
                                    />
                                </View>
                            )}
                        >
                            Ausencia Injustificada (UA)
                        </Button>
                        <Button 
                            mode="outlined"
                            onPress={() => setShowAttendanceDialog(false)}
                            style={[styles.button, styles.cancelButton]}
                            textColor={theme.colors.primary}
                            contentStyle={styles.buttonContent}
                            labelStyle={styles.buttonLabel}
                            icon={({size, color}) => (
                                <View style={styles.buttonIcon}>
                                    <IconButton
                                        icon="close"
                                        size={22}
                                        iconColor={color}
                                        style={{margin: 0, padding: 0}}
                                    />
                                </View>
                            )}
                        >
                            Cancelar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

export default memo(StudentsListScreen);
