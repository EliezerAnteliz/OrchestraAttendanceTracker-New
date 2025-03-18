import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Button, Text, Surface, Portal, IconButton, List, ActivityIndicator, Dialog, Appbar, Chip, SegmentedButtons, RadioButton } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../config/supabase';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAppTheme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const StudentListItem = memo(({ 
    student, 
    attendanceData, 
    onStatusChange,
    isSelected,
    onSelect,
    selectionMode
}) => {
    const { theme } = useAppTheme();
    
    return (
    <TouchableOpacity
        onPress={() => selectionMode ? onSelect(student.id) : null}
        activeOpacity={0.7}
    >
        <Surface
            style={[
                styles.listItem,
                { backgroundColor: theme.colors.surface },
                // Aplicar efectos visuales cuando está seleccionado
                isSelected && selectionMode && {
                    borderColor: theme.colors.primary,
                    borderWidth: 2,
                    elevation: 4,
                    shadowColor: theme.colors.primary,
                    backgroundColor: theme.colors.primaryContainer || 'rgba(103, 80, 164, 0.08)',
                }
            ]}
        >
            <View style={styles.itemContent}>
                <View style={styles.studentInfo}>
                    <Text 
                        style={[
                            styles.studentName, 
                            { color: theme.colors.text },
                            // Cambiar color del texto cuando está seleccionado
                            isSelected && selectionMode && { color: theme.colors.primary, fontWeight: '700' }
                        ]}
                        numberOfLines={1}
                    >
                        {student.first_name} {student.last_name}
                    </Text>
                    <Text 
                        style={[
                            styles.studentInstrument, 
                            { color: theme.colors.text }
                        ]}
                        numberOfLines={1}
                    >
                        {student.instrument || 'Sin instrumento'}
                    </Text>
                </View>
                
                <View style={styles.rightContainer}>
                    {!selectionMode ? (
                        <View style={styles.statusButtons}>
                            <IconButton
                                icon="check"
                                size={18}
                                mode="outlined"
                                selected={attendanceData[student.id] === 'A'}
                                onPress={() => onStatusChange(student.id, 'A')}
                                style={[
                                    styles.statusButton,
                                    attendanceData[student.id] === 'A' && styles.selectedButton
                                ]}
                                iconColor={attendanceData[student.id] === 'A' ? 'white' : theme.colors.attendance.present}
                                containerColor={attendanceData[student.id] === 'A' ? theme.colors.attendance.present : 'transparent'}
                            />
                            <IconButton
                                icon="alert"
                                size={18}
                                mode="outlined"
                                selected={attendanceData[student.id] === 'EA'}
                                onPress={() => onStatusChange(student.id, 'EA')}
                                style={[
                                    styles.statusButton,
                                    attendanceData[student.id] === 'EA' && styles.selectedButton
                                ]}
                                iconColor={attendanceData[student.id] === 'EA' ? 'white' : theme.colors.attendance.justified}
                                containerColor={attendanceData[student.id] === 'EA' ? theme.colors.attendance.justified : 'transparent'}
                            />
                            <IconButton
                                icon="close"
                                size={18}
                                mode="outlined"
                                selected={attendanceData[student.id] === 'UA'}
                                onPress={() => onStatusChange(student.id, 'UA')}
                                style={[
                                    styles.statusButton,
                                    attendanceData[student.id] === 'UA' && styles.selectedButton
                                ]}
                                iconColor={attendanceData[student.id] === 'UA' ? 'white' : theme.colors.attendance.unexcused}
                                containerColor={attendanceData[student.id] === 'UA' ? theme.colors.attendance.unexcused : 'transparent'}
                            />
                        </View>
                    ) : (
                        <View 
                            style={[
                                styles.selectionIndicator,
                                isSelected ? 
                                    { backgroundColor: theme.colors.primary } : 
                                    { borderColor: theme.colors.outline, borderWidth: 1 }
                            ]}
                        >
                            {isSelected && (
                                <Text style={styles.checkmark}>✓</Text>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Surface>
    </TouchableOpacity>
)});

const AttendanceRegistrationScreen = () => {
    const router = useRouter();
    const { theme, isDark } = useAppTheme();
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    });
    const [showCalendar, setShowCalendar] = useState(false);
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(true);
    const [dateLoading, setDateLoading] = useState(false);
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
        try {
            const [studentsResponse, attendanceResponse] = await Promise.all([
                supabase
                    .from('students')
                    .select('*')
                    .order('first_name'),
                supabase
                    .from('attendance')
                    .select('*')
                    .eq('date', formatDate(date))
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
            Alert.alert('Error', 'No se pudieron cargar los datos');
        } finally {
            setLoading(false);
        }
    }, [formatDate]);

    useEffect(() => {
        loadAttendanceData(selectedDate);
    }, [selectedDate, loadAttendanceData]);

    const handleDateSelect = useCallback((date) => {
        setSelectedDate(new Date(date.dateString));
        setShowCalendar(false);
    }, []);

    const handleStatusChange = useCallback(async (studentId, status) => {
        try {
            setAttendanceData(prev => ({
                ...prev,
                [studentId]: status
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
                        status_code: status,
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
                        status_code: status,
                        updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;
            }
        } catch (error) {
            console.error('Error updating attendance:', error);
            Alert.alert('Error', 'No se pudo actualizar la asistencia');
            
            setAttendanceData(prev => ({
                ...prev,
                [studentId]: prev[studentId]
            }));
        }
    }, [selectedDate, formatDate]);

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

    const toggleStudentSelection = useCallback((id) => {
        setSelectedStudents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const renderListItem = useCallback(({ item: student }) => (
        <StudentListItem
            student={student}
            attendanceData={attendanceData}
            onStatusChange={handleStatusChange}
            isSelected={selectedStudents.has(student.id)}
            onSelect={toggleStudentSelection}
            selectionMode={isSelectionMode}
        />
    ), [attendanceData, handleStatusChange, selectedStudents, isSelectionMode, toggleStudentSelection]);

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

    const loadInstruments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('students')
                .select('instrument')
                .not('instrument', 'is', null);

            if (error) throw error;

            // Orden específico para los instrumentos
            const instrumentOrder = ['Violin', 'Viola', 'Cello', 'Bass', 'Not assigned'];
            
            // Obtener instrumentos únicos
            const uniqueInstruments = [...new Set(data.map(item => item.instrument))];
            
            // Ordenar los instrumentos según el orden especificado
            const sortedInstruments = uniqueInstruments.sort((a, b) => {
                const indexA = instrumentOrder.indexOf(a);
                const indexB = instrumentOrder.indexOf(b);
                
                // Si ambos instrumentos están en la lista de orden
                if (indexA >= 0 && indexB >= 0) {
                    return indexA - indexB;
                }
                // Si solo a está en la lista de orden
                if (indexA >= 0) {
                    return -1;
                }
                // Si solo b está en la lista de orden
                if (indexB >= 0) {
                    return 1;
                }
                // Si ninguno está en la lista de orden, ordenar alfabéticamente
                return a.localeCompare(b);
            });

            setInstruments(sortedInstruments);
        } catch (error) {
            console.error('Error cargando instrumentos:', error);
        }
    }, []);

    useEffect(() => {
        loadInstruments();
    }, [loadInstruments]);

    // Filtrar estudiantes por instrumento
    const filteredStudents = useMemo(() => {
        if (selectedInstrument === 'all') return students;
        return students.filter(student => student.instrument === selectedInstrument);
    }, [students, selectedInstrument]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.Content title="Registro de Asistencia" />
                {!loading && (isSelectionMode ? (
                    <>
                        <Appbar.Action 
                            icon="card-multiple-outline" 
                            onPress={() => setSelectedStudents(new Set(filteredStudents.map(s => s.id)))}
                            tooltip="Seleccionar todos"
                            color={selectedStudents.size > 0 ? theme.colors.primary : undefined}
                        />
                        <Appbar.Action 
                            icon="card-off-outline" 
                            onPress={() => setSelectedStudents(new Set())}
                            tooltip="Deseleccionar todos"
                            disabled={selectedStudents.size === 0}
                            color={selectedStudents.size === 0 ? theme.colors.disabled : undefined}
                        />
                        <Appbar.Action 
                            icon="check-circle-outline" 
                            onPress={() => setShowAttendanceDialog(true)}
                            disabled={selectedStudents.size === 0}
                            tooltip="Marcar asistencia"
                            color={selectedStudents.size === 0 ? theme.colors.disabled : theme.colors.primary}
                        />
                        <Appbar.Action 
                            icon="close-circle-outline" 
                            onPress={() => {
                                setIsSelectionMode(false);
                                setSelectedStudents(new Set());
                            }}
                            tooltip="Cancelar selección"
                        />
                    </>
                ) : (
                    <Appbar.Action 
                        icon="clipboard-outline" 
                        onPress={() => setIsSelectionMode(true)}
                        tooltip="Modo selección múltiple"
                    />
                ))}
            </Appbar.Header>
            
            <Surface style={[styles.dateSelector, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.dateRow}>
                    <Button 
                        mode="outlined"
                        onPress={() => !loading && setShowCalendar(true)}
                        style={[
                            styles.dateButton,
                            { borderColor: theme.colors.primary + '50' }
                        ]}
                        contentStyle={styles.dateButtonContent}
                        icon="calendar"
                        disabled={loading}
                        textColor={theme.colors.primary}
                        labelStyle={styles.dateButtonLabel}
                    >
                        {formatDisplayDate(selectedDate)}
                    </Button>
                    <Button 
                        mode="outlined"
                        onPress={() => !loading && setSelectedDate(new Date())}
                        disabled={loading}
                        style={[
                            styles.todayButton,
                            { borderColor: theme.colors.outline }
                        ]}
                        contentStyle={styles.todayButtonContent}
                        icon="calendar-today"
                        textColor={theme.colors.primary}
                        labelStyle={styles.todayButtonLabel}
                    >
                        Hoy
                    </Button>
                </View>
            </Surface>

            <Surface style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.filtersContainer}>
                    <View style={styles.filtersRow}>
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
                        
                        {/* Instrumentos específicos */}
                        {instruments.map((instrument) => (
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
                        ))}
                    </View>
                </View>
            </Surface>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.text }]}>Cargando datos...</Text>
                </View>
            ) : (
                <ScrollView 
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                >
                    {filteredStudents.length > 0 ? (
                        filteredStudents.map(student => (
                            <StudentListItem
                                key={student.id}
                                student={student}
                                attendanceData={attendanceData}
                                onStatusChange={handleStatusChange}
                                isSelected={selectedStudents.has(student.id)}
                                onSelect={toggleStudentSelection}
                                selectionMode={isSelectionMode}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                                No hay estudiantes para el instrumento seleccionado
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}

            <Portal>
                <Dialog
                    visible={showCalendar}
                    onDismiss={() => setShowCalendar(false)}
                    style={{ 
                        borderRadius: 16,
                        backgroundColor: 'white',
                        width: '94%',
                        maxWidth: 420,
                        alignSelf: 'center',
                        overflow: 'hidden',
                        margin: 0,
                        padding: 0,
                        elevation: 4
                    }}
                    dismissable={true}
                    theme={{ colors: { backdrop: 'rgba(0, 0, 0, 0.5)' } }}
                >
                    <View style={{
                        padding: 16,
                        paddingTop: 16,
                        paddingBottom: 16,
                        width: '100%',
                        alignItems: 'center',
                    }}>
                        <Calendar
                            current={formatDate(selectedDate)}
                            onDayPress={handleDateSelect}
                            markedDates={{
                                [formatDate(selectedDate)]: {
                                    selected: true,
                                    selectedColor: theme.colors.primary
                                }
                            }}
                            theme={{
                                backgroundColor: '#ffffff',
                                calendarBackground: '#ffffff',
                                textSectionTitleColor: '#666666',
                                selectedDayBackgroundColor: theme.colors.primary,
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: theme.colors.primary,
                                dayTextColor: '#333333',
                                textDisabledColor: '#d9e1e8',
                                dotColor: theme.colors.primary,
                                selectedDotColor: '#ffffff',
                                arrowColor: theme.colors.primary,
                                monthTextColor: theme.colors.primary,
                                textDayFontSize: 16,
                                textMonthFontSize: 18,
                                textDayHeaderFontSize: 14,
                                'stylesheet.calendar.header': {
                                    dayHeader: {
                                        marginTop: 4,
                                        marginBottom: 6,
                                        textAlign: 'center',
                                        fontSize: 14,
                                        fontWeight: '600',
                                        color: '#666666',
                                        width: 36,
                                        alignSelf: 'center',
                                        paddingHorizontal: 0,
                                    },
                                    header: {
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginBottom: 10,
                                        width: '100%',
                                    },
                                    arrow: {
                                        padding: 0,
                                        margin: 0,
                                        paddingHorizontal: 15,
                                    },
                                    monthText: {
                                        fontSize: 18,
                                        fontWeight: '700',
                                        color: theme.colors.primary,
                                        margin: 0,
                                        padding: 0,
                                    },
                                },
                                'stylesheet.day.basic': {
                                    base: {
                                        width: 36,
                                        height: 36,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    },
                                    selected: {
                                        backgroundColor: theme.colors.primary,
                                        borderRadius: 18,
                                    },
                                    today: {
                                        backgroundColor: 'rgba(103, 80, 164, 0.1)',
                                        borderRadius: 18,
                                    },
                                },
                                'stylesheet.calendar.main': {
                                    week: {
                                        marginVertical: 2,
                                        flexDirection: 'row',
                                        justifyContent: 'space-around',
                                        paddingHorizontal: 20,
                                        width: '100%',
                                    },
                                    container: {
                                        width: '100%',
                                        paddingHorizontal: 10,
                                    }
                                },
                            }}
                            style={{
                                width: '100%',
                                height: 350
                            }}
                            enableSwipeMonths={true}
                            hideExtraDays={false}
                            firstDay={1}
                            showWeekNumbers={false}
                            onPressArrowLeft={subtractMonth => subtractMonth()}
                            onPressArrowRight={addMonth => addMonth()}
                            dayNames={['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']}
                            dayNamesShort={['D', 'L', 'M', 'X', 'J', 'V', 'S']}
                            monthNames={[
                                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                            ]}
                        />
                        
                        <Button 
                            mode="contained"
                            onPress={() => setShowCalendar(false)}
                            style={{
                                marginTop: -30,
                                borderRadius: 24,
                                height: 48,
                                width: '100%',
                                elevation: 2
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
                    onDismiss={() => setShowAttendanceDialog(false)}
                    style={{ 
                        borderRadius: BORDER_RADIUS.lg,
                        backgroundColor: 'white',
                        width: '85%',
                        maxWidth: 320,
                        alignSelf: 'center',
                        elevation: 5,
                        margin: 0
                    }}
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
                                setIsSelectionMode(false);
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
                                setIsSelectionMode(false);
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
                                setIsSelectionMode(false);
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
                            onPress={() => {
                                setShowAttendanceDialog(false);
                            }}
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5', // COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        paddingVertical: SPACING.sm,
    },
    dateSelector: {
        padding: SPACING.md,
        margin: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        ...SHADOWS.small,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(103, 80, 164, 0.08)',
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    dateButton: {
        flex: 1,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        height: 48,
        elevation: 1,
    },
    dateButtonContent: {
        height: 48,
        paddingHorizontal: SPACING.md,
    },
    dateButtonLabel: {
        fontSize: 15,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    todayButton: {
        borderWidth: 1,
        borderColor: 'rgba(103, 80, 164, 0.12)',
        borderRadius: BORDER_RADIUS.lg,
        height: 48,
        minWidth: 100,
    },
    todayButtonContent: {
        height: 48,
        paddingHorizontal: SPACING.md,
    },
    todayButtonLabel: {
        fontSize: 15,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    sectionLabel: {
        ...TYPOGRAPHY.subtitle2,
        marginBottom: SPACING.sm,
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.15,
    },
    listItem: {
        marginHorizontal: SPACING.md,
        marginVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
        ...SHADOWS.small,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
    },
    studentInfo: {
        flex: 1,
        marginRight: SPACING.md,
    },
    studentName: { 
        ...TYPOGRAPHY.body1,
        fontWeight: '600',
        fontSize: 16,
        letterSpacing: 0.15,
    },
    studentInstrument: { 
        ...TYPOGRAPHY.body2,
        marginTop: 2,
        opacity: 0.8,
        fontSize: 14,
        letterSpacing: 0.1,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
        paddingRight: SPACING.xs,
        minWidth: 120,
    },
    statusButton: {
        margin: 0,
        borderWidth: 1,
        width: 32,
        height: 32,
    },
    selectedButton: {
        ...SHADOWS.small,
    },
    selectionIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmark: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dialogContainer: {
        position: 'relative',
        width: '100%',
        maxWidth: 350,
        alignSelf: 'center',
        ...SHADOWS.medium,
        borderRadius: BORDER_RADIUS.lg,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: SPACING.md,
        ...TYPOGRAPHY.body1,
        fontSize: 16,
        letterSpacing: 0.15,
    },
    header: {
        backgroundColor: '#ffffff', // COLORS.surface,
        elevation: 4,
    },
    dialogText: {
        textAlign: 'center',
        marginBottom: SPACING.md,
        ...TYPOGRAPHY.body1,
        fontSize: 16,
        letterSpacing: 0.15,
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
    attendanceDialog: {
        backgroundColor: '#ffffff', // COLORS.surface,
    },
    filterContainer: {
        padding: SPACING.md,
        paddingVertical: SPACING.md,
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.md,
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
    emptyState: {
        flex: 1,
        padding: SPACING.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '50%',
    },
    emptyStateText: {
        ...TYPOGRAPHY.body1,
        textAlign: 'center',
        fontSize: 16,
        letterSpacing: 0.15,
    },
    calendarIconContainer: {
        marginRight: SPACING.sm,
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default memo(AttendanceRegistrationScreen);
