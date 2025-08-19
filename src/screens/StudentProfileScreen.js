import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, SafeAreaView, StatusBar, Linking, Alert, TextInput } from 'react-native';
import { Surface, Text, Divider, Avatar, Portal, Dialog, Button, List, Appbar, IconButton, Switch, Menu } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, theme as defaultTheme, THEME_NAMES } from '../theme';
import { StyledCard, StyledInput } from '../components';
import { supabase } from '../config/supabase';

/**
 * Pantalla de perfil del estudiante
 * Muestra la información detallada de un estudiante y permite editar sus datos
 */
const styles = StyleSheet.create({
    // Estilos estáticos que no dependen del tema
    safeArea: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
    },
    contentContainer: {
        padding: SPACING.sm,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md + 20,
    },
    profileHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    avatarContainer: {
        marginRight: SPACING.lg,
    },
    headerTextContainer: {
        flex: 1,
    },
    nameText: {
        fontWeight: 'bold',
        fontSize: TYPOGRAPHY.fontSizeXl,
        marginBottom: SPACING.xs,
    },
    subtitleText: {
        fontSize: TYPOGRAPHY.fontSizeLg,
    },
    card: {
        marginBottom: SPACING.md,
        padding: SPACING.md,
    },
    cardTitle: {
        fontSize: TYPOGRAPHY.fontSizeLg,
        fontWeight: '700',
        marginBottom: SPACING.sm,
    },
    dataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 3,
    },
    dataLabel: {
        width: 120,
        fontSize: TYPOGRAPHY.fontSizeMd,
        fontWeight: '600',
    },
    dataValue: {
        flex: 1,
        fontSize: TYPOGRAPHY.fontSizeMd,
        paddingLeft: 16,
    },
    divider: {
        marginVertical: SPACING.xs,
        height: 1.5,
    },
    toggleContainerCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.xs,
        marginBottom: 0,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIcon: {
        margin: 0,
        marginRight: 4,
    },
    statusTextCompact: {
        fontSize: TYPOGRAPHY.fontSizeLg,
        fontWeight: '600',
    },
    deactivationDateCompact: {
        fontSize: TYPOGRAPHY.fontSizeMd,
    },
    reasonContainerCompact: {
        marginTop: SPACING.xs,
    },
    reasonLabel: {
        fontSize: TYPOGRAPHY.fontSizeLg,
        fontWeight: '500',
    },
    reasonText: {
        fontStyle: 'italic',
        fontSize: TYPOGRAPHY.fontSizeMd,
        marginTop: SPACING.xs,
    },
    actionButtonsContainer: {
        padding: SPACING.sm,
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    actionButtonsGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '90%',
        maxWidth: 360,
    },
    callButton: {
        borderRadius: 50,
        width: 64,
        height: 64,
        margin: 0,
    },
    messageButton: {
        borderRadius: 50,
        width: 64,
        height: 64,
        margin: 0,
    },
    editButton: {
        borderRadius: 30,
        minWidth: 120,
        height: 50,
    },
    dialog: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    dialogBackdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    dialogTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 0,
        textAlign: 'center',
        paddingTop: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
    },
    dialogContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    menuButton: {
        marginTop: 4,
        marginBottom: 12,
        height: 48,
    },
    menuButtonText: {
        paddingHorizontal: SPACING.sm,
        fontSize: 15,
    },
    inputStyle: {
        marginBottom: 12,
        fontSize: 15,
        height: 48,
        paddingHorizontal: 8,
    },
    inputLabelStyle: {
        fontSize: 14,
        paddingHorizontal: 4,
    },
    cancelButton: {
        marginRight: SPACING.sm,
        paddingHorizontal: 8,
    },
    saveButton: {
        paddingHorizontal: 16,
    },
    dialogActions: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        justifyContent: 'space-between',
        borderTopWidth: 1,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    toggleStatusText: {
        fontSize: TYPOGRAPHY.fontSizeSm,
        fontWeight: '500',
    },
    deactivationDateText: {
        fontSize: TYPOGRAPHY.fontSizeSm,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: SPACING.sm,
        fontSize: TYPOGRAPHY.fontSizeMd,
    },
    appBar: {
        // Los estilos de borderBottom y elevation se aplicarán inline
    },
    appBarContent: {
        fontWeight: '600',
        fontSize: TYPOGRAPHY.fontSizeMd,
    },
});

const StudentProfileScreen = () => {
    // Obtener parámetros y navegación
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme, themeType } = useAppTheme();
    const isMondayTheme = themeType === THEME_NAMES.MONDAY;

    // Estados del componente principal
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState(null);

    // Estados para diálogos
    const [isEditing, setIsEditing] = useState(false);
    const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
    const [showReactivateDialog, setShowReactivateDialog] = useState(false);

    // Estados para formularios
    const [deactivationReason, setDeactivationReason] = useState('');
    const [editedValues, setEditedValues] = useState({
        firstName: '',
        lastName: '',
        currentGrade: '',
        age: '',
        instrument: '',
        position: '',
        is_active: true
    });

    // Estados para menús de selección
    const [instrumentMenuVisible, setInstrumentMenuVisible] = useState(false);
    const [positionMenuVisible, setPositionMenuVisible] = useState(false);

    // Estados para campos individuales del formulario
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [grade, setGrade] = useState('');
    const [ageValue, setAgeValue] = useState('');
    const [instrumentValue, setInstrumentValue] = useState('');
    const [positionValue, setPositionValue] = useState('');

    // Datos estáticos de referencia
    const INSTRUMENTS = [
        // Instrumentos principales
        "Violin", "Viola", "Cello", "Bass", "Not assigned"
    ];

    const POSITIONS = [
        "Concert Master", "Associate Principal", "Principal", "Section"
    ];

    // Cargar datos del estudiante
    const loadStudent = useCallback(async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Primero consultamos los datos del estudiante
            let { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('id', id)
                .single();

            if (studentError) {
                setError('No se pudo cargar la información del estudiante');
                setLoading(false);
                return;
            }

            // Luego consultamos la relación con padres
            const { data: parentsRelation, error: parentsError } = await supabase
                .from('student_parents')
                .select(`
                    *,
                    parents(*)
                `)
                .eq('student_id', id);

            if (parentsError) {
            }

            // Si hay datos de padres, los añadimos al objeto de estudiante
            if (parentsRelation && parentsRelation.length > 0) {
                studentData.student_parents = parentsRelation;
            } else {
                studentData.student_parents = [];
            }

            setStudent(studentData);
            setIsActive(studentData.is_active !== false);

            // Inicializar valores de edición para el formulario
            setFirstName(studentData.first_name || '');
            setLastName(studentData.last_name || '');
            setGrade(studentData.current_grade || '');
            setAgeValue(studentData.age ? studentData.age.toString() : '');
            setInstrumentValue(studentData.instrument || '');
            setPositionValue(studentData.orchestra_position || '');

            // También mantener el formato anterior para compatibilidad
            setEditedValues({
                firstName: studentData.first_name || '',
                lastName: studentData.last_name || '',
                currentGrade: studentData.current_grade || '',
                age: studentData.age ? studentData.age.toString() : '',
                instrument: studentData.instrument || '',
                position: studentData.orchestra_position || '',
                is_active: studentData.is_active !== false
            });
        } catch (catchError) {
            setError('Error inesperado al cargar datos');
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Función para gestionar el estado activo/inactivo
    const handleToggleActive = useCallback(() => {
        if (isActive) {
            setShowDeactivateDialog(true);
        } else {
            setShowReactivateDialog(true);
        }
    }, [isActive]);

    // Función para desactivar estudiante
    const deactivateStudent = useCallback(async () => {
        if (!student || !student.id) return;

        try {
            setLoading(true);

            const { error } = await supabase
                .from('students')
                .update({ 
                    is_active: false,
                    deactivation_reason: deactivationReason || null
                })
                .eq('id', student.id);

            if (error) throw error;

            setIsActive(false);
            setShowDeactivateDialog(false);
            setDeactivationReason('');

            setStudent(prev => prev ? {
                ...prev,
                is_active: false,
                deactivation_reason: deactivationReason || null
            } : null);

        } catch (error) {
            Alert.alert('Error', 'No se pudo desactivar el estudiante');
        } finally {
            setLoading(false);
        }
    }, [student, deactivationReason]);

    // Función para reactivar estudiante
    const reactivateStudent = useCallback(async () => {
        if (!student || !student.id) return;

        try {
            setLoading(true);

            const { error } = await supabase
                .from('students')
                .update({ 
                    is_active: true
                })
                .eq('id', student.id);

            if (error) throw error;

            setIsActive(true);
            setShowReactivateDialog(false);

            setStudent(prev => prev ? {
                ...prev,
                is_active: true,
                deactivation_reason: null
            } : null);

        } catch (error) {
            Alert.alert('Error', 'No se pudo reactivar el estudiante');
        } finally {
            setLoading(false);
        }
    }, [student]);

    // Función para cargar datos en formulario
    const loadFormData = useCallback(() => {
        if (!student) return;

        setFirstName(student.first_name || '');
        setLastName(student.last_name || '');
        setGrade(student.current_grade || '');
        setAgeValue(student.age ? student.age.toString() : '');
        setInstrumentValue(student.instrument || '');
        setPositionValue(student.orchestra_position || '');
    }, [student]);

    // Función para actualizar estudiante
    const handleUpdate = useCallback(async () => {
        try {
            setLoading(true);

            // Recopilar todos los valores actualizados
            const updatedValues = {
                first_name: firstName,
                last_name: lastName,
                current_grade: grade,
                age: ageValue ? parseInt(ageValue, 10) : null,
                instrument: instrumentValue,
                orchestra_position: positionValue
            };

            // Enviar actualización a Supabase
            const { error } = await supabase
                .from('students')
                .update(updatedValues)
                .eq('id', student.id);

            if (error) throw error;

            // Actualizar el estado local con los nuevos valores
            setStudent(prev => ({
                ...prev,
                ...updatedValues
            }));

            setIsEditing(false);
            Alert.alert('Éxito', 'Información actualizada correctamente');

        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la información del estudiante');
        } finally {
            setLoading(false);
        }
    }, [firstName, lastName, grade, ageValue, instrumentValue, positionValue, student]);

    // Función para llamar al estudiante o padre
    const handleCall = useCallback(() => {
        if (!student) return;

        let phoneNumber = student.phone_number;

        // Si hay padre con teléfono, ofrecer opciones
        if (student.student_parents && 
            student.student_parents.length > 0 && 
            student.student_parents[0].parents &&
            student.student_parents[0].parents.phone_number) {

            Alert.alert(
                'Llamar a',
                '¿A quién deseas llamar?',
                [
                    {
                        text: `Estudiante (${student.phone_number || 'No disponible'})`,
                        onPress: () => student.phone_number ? 
                            Linking.openURL(`tel:${student.phone_number}`) : 
                            Alert.alert('Error', 'Número no disponible')
                    },
                    {
                        text: `Padre/Madre (${student.student_parents[0].parents.phone_number})`,
                        onPress: () => Linking.openURL(`tel:${student.student_parents[0].parents.phone_number}`)
                    },
                    {
                        text: 'Cancelar',
                        style: 'cancel'
                    },
                ]
            );
            return;
        }

        // Si solo hay número del estudiante
        if (phoneNumber) {
            Linking.openURL(`tel:${phoneNumber}`);
        } else {
            Alert.alert('Error', 'No hay número de teléfono disponible');
        }
    }, [student]);

    // Función para enviar mensaje
    const handleMessage = useCallback(() => {
        if (!student) return;

        let phoneNumber = student.phone_number;

        // Si hay padre con teléfono, ofrecer opciones
        if (student.student_parents && 
            student.student_parents.length > 0 && 
            student.student_parents[0].parents &&
            student.student_parents[0].parents.phone_number) {

            Alert.alert(
                'Enviar mensaje a',
                '¿A quién deseas enviar un mensaje?',
                [
                    {
                        text: `Estudiante (${student.phone_number || 'No disponible'})`,
                        onPress: () => student.phone_number ? 
                            Linking.openURL(`sms:${student.phone_number}`) : 
                            Alert.alert('Error', 'Número no disponible')
                    },
                    {
                        text: `Padre/Madre (${student.student_parents[0].parents.phone_number})`,
                        onPress: () => Linking.openURL(`sms:${student.student_parents[0].parents.phone_number}`)
                    },
                    {
                        text: 'Cancelar',
                        style: 'cancel'
                    },
                ]
            );
            return;
        }

        // Si solo hay número del estudiante
        if (phoneNumber) {
            Linking.openURL(`sms:${phoneNumber}`);
        } else {
            Alert.alert('Error', 'No hay número de teléfono disponible');
        }
    }, [student]);

    // Función para abrir/cerrar el diálogo de edición
    const toggleEdit = useCallback(() => {
        if (isEditing) {
            setIsEditing(false);
        } else {
            // Asegurarse de que los valores del formulario estén actualizados
            loadFormData();
            setIsEditing(true);
        }
    }, [isEditing, loadFormData]);

    // Función para volver a la pantalla anterior
    const goBack = useCallback(() => {
        router.back();
    }, [router]);

    // Configurar navegación y cargar datos iniciales
    useEffect(() => {
        loadStudent();
    }, [loadStudent]);

    // Configurar opciones de navegación
    useEffect(() => {
        // Expo Router no utiliza setOptions de la misma manera que React Navigation
        // Esta parte se maneja a través del Appbar.Header que ya tenemos
    }, [student, theme, isMondayTheme]);

    // Cargar datos cuando se abre el diálogo de edición
    useEffect(() => {
        if (isEditing && student) {
            loadFormData();
        }
    }, [isEditing, student, loadFormData]);

    // Derivar iniciales y otros datos
    const { first_name, last_name } = student || {};
    const firstInitial = first_name && first_name.length > 0 ? first_name[0] : '';
    const lastInitial = last_name && last_name.length > 0 ? last_name[0] : '';
    const initials = `${firstInitial}${lastInitial}`.toUpperCase();

    // Si está cargando, mostrar indicador
    if (loading && !student) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#673AB7" />
                </View>
            </SafeAreaView>
        );
    }

    // Si hay error sin datos
    if (error && !student) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center', color: theme.colors.error }}>
                        {error}
                    </Text>
                    <Button 
                        mode={isMondayTheme ? "outlined" : "contained"} 
                        onPress={loadStudent} 
                        style={isMondayTheme ? {
                            borderColor: theme.colors.primary,
                            borderWidth: 2
                        } : { 
                            backgroundColor: theme.colors.primary 
                        }}
                        labelStyle={{ 
                            color: isMondayTheme ? theme.colors.primary : theme.colors.onPrimary 
                        }}
                    >
                        Reintentar
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
            <StatusBar backgroundColor={isMondayTheme ? theme.colors.background : "#FFFFFF"} barStyle={isMondayTheme && theme.isDark ? "light-content" : "dark-content"} />
            
            <Appbar.Header 
                style={[
                    styles.appBar, 
                    isMondayTheme ? {
                        backgroundColor: theme.colors.surface,
                        elevation: 0,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.outline,
                    } : {
                        backgroundColor: theme.colors.surface,
                        elevation: 4,
                        borderBottomWidth: 0,
                        borderBottomColor: 'transparent',
                    }
                ]}
            >
                <Appbar.BackAction 
                    onPress={goBack}
                    color={theme.colors.onSurface} 
                />
                <Appbar.Content 
                    title="Perfil del Estudiante" 
                    titleStyle={{
                        fontSize: 18,
                        color: theme.colors.onSurface,
                        fontWeight: '600'
                    }}
                />
                {!loading && (
                    <Appbar.Action 
                        icon={isEditing ? "close" : "pencil"} 
                        onPress={toggleEdit}
                        disabled={loading}
                        color={theme.colors.onSurfaceVariant}
                    />
                )}
            </Appbar.Header>
            
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
                {/* Perfil - Avatar e información general */}
                <Surface 
                    style={[
                        styles.card,
                        isMondayTheme ? {
                            borderRadius: BORDER_RADIUS.xs,
                            padding: SPACING.md,
                            backgroundColor: theme.colors.surface,
                            borderWidth: 1,
                            borderColor: theme.colors.outline,
                            elevation: 0,
                        } : {
                            borderRadius: BORDER_RADIUS.md,
                            padding: SPACING.md,
                            backgroundColor: theme.colors.surface,
                            borderWidth: 0,
                            borderColor: 'transparent',
                            elevation: 2,
                        }
                    ]}
                >
                    <View style={styles.profileHeaderContainer}>
                        <View style={styles.avatarContainer}>
                            <Avatar.Text 
                                size={80} 
                                label={initials} 
                                style={{ 
                                    backgroundColor: theme.colors.primary,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : 40
                                }}
                                labelStyle={{ 
                                    color: theme.colors.onPrimary 
                                }}
                            />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={[
                                styles.nameText, 
                                isMondayTheme && { color: theme.colors.onSurface }
                            ]}>
                                {student?.first_name} {student?.last_name}
                            </Text>
                            <View style={styles.toggleContainerCompact}>
                                <View style={styles.toggleInfo}>
                                    <IconButton
                                        icon="circle"
                                        size={13}
                                        iconColor={isActive ? theme.colors.attendance.present : theme.colors.attendance.unexcused}
                                        style={styles.statusIcon}
                                    />
                                    <Text style={{ fontSize: 14, color: isActive ? theme.colors.attendance.present : theme.colors.attendance.unexcused }}>
                                        {isActive ? 'Activo' : 'Inactivo'}
                                    </Text>
                                </View>
                                <Switch
                                    value={isActive}
                                    onValueChange={handleToggleActive}
                                    color={isMondayTheme ? theme.colors.primary : '#673AB7'}
                                />
                            </View>
                        </View>
                    </View>
                </Surface>

                {/* Información del Estudiante */}
                <Surface 
                    style={[
                        styles.card,
                        isMondayTheme ? {
                            borderRadius: BORDER_RADIUS.xs,
                            padding: SPACING.md,
                            backgroundColor: theme.colors.surface,
                            borderWidth: 1,
                            borderColor: theme.colors.outline,
                            elevation: 0,
                        } : {
                            borderRadius: BORDER_RADIUS.md,
                            padding: SPACING.md,
                            backgroundColor: theme.colors.surface,
                            borderWidth: 0,
                            borderColor: 'transparent',
                            elevation: 1,
                        }
                    ]}
                >
                    <Text style={[
                        styles.cardTitle, 
                        isMondayTheme && { color: theme.colors.primary }
                    ]}>
                        Información Personal
                    </Text>
                    <Divider style={[
                        styles.divider, 
                        isMondayTheme && { backgroundColor: `${theme.colors.primary}20` }
                    ]} />
                    
                    <View style={styles.dataRow}>
                        <Text style={[
                            styles.dataLabel, 
                            isMondayTheme && { color: theme.colors.primary }
                        ]}>
                            Instrumento:
                        </Text>
                        <Text style={[
                            styles.dataValue, 
                            isMondayTheme && { color: theme.colors.onSurface }
                        ]}>
                            {student?.instrument || 'No especificado'}
                        </Text>
                    </View>
                    
                    <View style={styles.dataRow}>
                        <Text style={[
                            styles.dataLabel, 
                            isMondayTheme && { color: theme.colors.primary }
                        ]}>
                            Posición:
                        </Text>
                        <Text style={[
                            styles.dataValue, 
                            isMondayTheme && { color: theme.colors.onSurface }
                        ]}>
                            {student?.orchestra_position || 'No especificada'}
                        </Text>
                    </View>
                    
                    <View style={styles.dataRow}>
                        <Text style={[
                            styles.dataLabel, 
                            isMondayTheme && { color: theme.colors.primary }
                        ]}>
                            Edad:
                        </Text>
                        <Text style={[
                            styles.dataValue, 
                            isMondayTheme && { color: theme.colors.onSurface }
                        ]}>
                            {student?.age ? `${student.age} años` : 'No especificada'}
                        </Text>
                    </View>
                    
                    <View style={styles.dataRow}>
                        <Text style={[
                            styles.dataLabel, 
                            isMondayTheme && { color: theme.colors.primary }
                        ]}>
                            Grado:
                        </Text>
                        <Text style={[
                            styles.dataValue, 
                            isMondayTheme && { color: theme.colors.onSurface }
                        ]}>
                            {student?.current_grade ? `${student.current_grade}° Grado` : 'No especificado'}
                        </Text>
                    </View>
                </Surface>

                {/* Información de contacto */}
                {student && student.student_parents && student.student_parents.length > 0 && (
                    <Surface 
                        style={[
                            styles.card,
                            isMondayTheme ? {
                                borderRadius: BORDER_RADIUS.xs,
                                padding: SPACING.md,
                                backgroundColor: theme.colors.surface,
                                borderWidth: 1,
                                borderColor: theme.colors.outline,
                                elevation: 0,
                            } : {
                                borderRadius: BORDER_RADIUS.md,
                                padding: SPACING.md,
                                backgroundColor: theme.colors.surface,
                                borderWidth: 0,
                                borderColor: 'transparent',
                                elevation: 1,
                            }
                        ]}
                    >
                        <Text style={[
                            styles.cardTitle, 
                            isMondayTheme && { color: theme.colors.primary }
                        ]}>
                            Información de Contacto
                        </Text>
                        <Divider style={[
                            styles.divider, 
                            isMondayTheme && { backgroundColor: `${theme.colors.primary}20` }
                        ]} />
                        
                        {student.student_parents[0]?.parents?.full_name && (
                            <View style={styles.dataRow}>
                                <Text style={[
                                    styles.dataLabel, 
                                    isMondayTheme && { color: theme.colors.primary }
                                ]}>
                                    Padre/Madre:
                                </Text>
                                <Text style={[
                                    styles.dataValue, 
                                    isMondayTheme && { color: theme.colors.onSurface }
                                ]}>
                                    {student.student_parents[0].parents.full_name}
                                </Text>
                            </View>
                        )}
                        
                        {student.student_parents[0]?.parents?.phone_number && (
                            <View style={styles.dataRow}>
                                <Text style={[
                                    styles.dataLabel, 
                                    isMondayTheme && { color: theme.colors.primary }
                                ]}>
                                    Teléfono:
                                </Text>
                                <Text style={[
                                    styles.dataValue, 
                                    isMondayTheme && { color: theme.colors.onSurface }
                                ]}>
                                    {student.student_parents[0].parents.phone_number}
                                </Text>
                            </View>
                        )}
                    </Surface>
                )}
            </ScrollView>
            
            {/* Botones posicionados encima de la barra de navegación */}
            <View style={{
                position: 'absolute',
                bottom: 200, // Aumentado significativamente para alejar mucho más de la barra de navegación
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'space-around',
                paddingHorizontal: 20,
                backgroundColor: 'transparent',
                zIndex: 1000,
                height: 70 // Aumentado para dar más espacio a los botones
            }}>
                <IconButton
                    icon="phone"
                    size={30} // Botones más grandes
                    onPress={handleCall}
                    style={{
                        backgroundColor: theme.colors.primary,
                        width: 65, // Botones más grandes
                        height: 65, // Botones más grandes
                        margin: 0,
                        borderRadius: BORDER_RADIUS.xs,
                        borderWidth: 1,
                        borderColor: theme.colors.outline
                    }}
                    iconColor="#fff"
                />
                
                <IconButton
                    icon="pencil"
                    size={30} // Botones más grandes
                    onPress={() => setIsEditing(true)}
                    style={{
                        backgroundColor: theme.colors.primary,
                        width: 65, // Botones más grandes
                        height: 65, // Botones más grandes
                        margin: 0,
                        borderRadius: BORDER_RADIUS.xs,
                        borderWidth: 1,
                        borderColor: theme.colors.outline
                    }}
                    iconColor="#fff"
                />
                
                <IconButton
                    icon="message"
                    size={30} // Botones más grandes
                    onPress={handleMessage}
                    style={{
                        backgroundColor: theme.colors.primary,
                        width: 65, // Botones más grandes
                        height: 65, // Botones más grandes
                        margin: 0,
                        borderRadius: BORDER_RADIUS.xs,
                        borderWidth: 1,
                        borderColor: theme.colors.outline
                    }}
                    iconColor="#fff"
                />
            </View>
            
            {/* Diálogo para editar información */}
            <Portal>
                <Dialog
                    visible={isEditing}
                    onDismiss={() => setIsEditing(false)}
                    style={[
                        styles.dialog,
                        { backgroundColor: theme.colors.surface }
                    ]}
                >
                    <Text style={[
                        styles.dialogTitle,
                        { 
                            color: theme.colors.primary,
                            borderBottomColor: theme.colors.outlineVariant
                        }
                    ]}>
                        Editar Información
                    </Text>
                    <Dialog.Content style={styles.dialogContent}>
                        <Text style={{ color: theme.colors.onSurface, marginBottom: 10 }}>Datos Personales</Text>
                        <StyledInput
                            label="Nombre"
                            value={firstName}
                            onChangeText={setFirstName}
                            style={[
                                styles.inputStyle,
                                {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                                }
                            ]}
                        />
                        <StyledInput
                            label="Apellido"
                            value={lastName}
                            onChangeText={setLastName}
                            style={[
                                styles.inputStyle,
                                {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                                }
                            ]}
                        />
                        <StyledInput
                            label="Grado Actual"
                            value={grade}
                            onChangeText={setGrade}
                            keyboardType="number-pad"
                            style={[
                                styles.inputStyle,
                                {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                                }
                            ]}
                        />
                        <StyledInput
                            label="Edad"
                            value={ageValue}
                            onChangeText={setAgeValue}
                            keyboardType="number-pad"
                            style={[
                                styles.inputStyle,
                                {
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                                }
                            ]}
                        />

                        <Text style={{ color: theme.colors.onSurface, marginBottom: 10, marginTop: 15 }}>Información de Orquesta</Text>
                        <Button
                            mode="outlined"
                            onPress={() => setInstrumentMenuVisible(true)}
                            style={[
                                styles.menuButton,
                                { 
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderWidth: 1,
                                    borderColor: theme.colors.outline,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                                }
                            ]}
                        >
                            <Text style={[styles.menuButtonText, { color: theme.colors.onSurface }]}>
                                {instrumentValue || 'Seleccionar Instrumento'}
                            </Text>
                        </Button>

                        <Menu
                            visible={instrumentMenuVisible}
                            onDismiss={() => setInstrumentMenuVisible(false)}
                            anchor={{ x: 0, y: 0 }}
                            style={{ width: '100%' }}
                        >
                            {INSTRUMENTS.map((option) => (
                                <Menu.Item
                                    key={option}
                                    onPress={() => {
                                        setInstrumentValue(option);
                                        setInstrumentMenuVisible(false);
                                    }}
                                    title={option}
                                />
                            ))}
                        </Menu>

                        <Button
                            mode="outlined"
                            onPress={() => setPositionMenuVisible(true)}
                            style={[
                                styles.menuButton,
                                { 
                                    backgroundColor: theme.colors.surfaceVariant,
                                    borderWidth: 1,
                                    borderColor: theme.colors.outline,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm
                                }
                            ]}
                        >
                            <Text style={[styles.menuButtonText, { color: theme.colors.onSurface }]}>
                                {positionValue || 'Seleccionar Posición'}
                            </Text>
                        </Button>

                        <Menu
                            visible={positionMenuVisible}
                            onDismiss={() => setPositionMenuVisible(false)}
                            anchor={{ x: 0, y: 0 }}
                            style={{ width: '100%' }}
                        >
                            {POSITIONS.map((option) => (
                                <Menu.Item
                                    key={option}
                                    onPress={() => {
                                        setPositionValue(option);
                                        setPositionMenuVisible(false);
                                    }}
                                    title={option}
                                />
                            ))}
                        </Menu>
                    </Dialog.Content>
                    <Dialog.Actions style={[
                        styles.dialogActions,
                        { borderTopColor: theme.colors.outlineVariant }
                    ]}>
                        <Button 
                            onPress={() => setIsEditing(false)} 
                            style={styles.cancelButton}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            mode="contained" 
                            onPress={handleUpdate}
                            style={[
                                styles.saveButton,
                                { 
                                    backgroundColor: theme.colors.primary,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                                    elevation: 2
                                }
                            ]}
                        >
                            Guardar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            
            {/* Diálogo de confirmación para desactivar estudiante */}
            <Portal>
                <Dialog
                    visible={showDeactivateDialog}
                    onDismiss={() => setShowDeactivateDialog(false)}
                    style={[
                        styles.dialog,
                        { backgroundColor: theme.colors.surface }
                    ]}
                >
                    <Text style={[
                        styles.dialogTitle,
                        { 
                            color: theme.colors.primary,
                            borderBottomColor: theme.colors.outlineVariant
                        }
                    ]}>
                        Confirmar Desactivación
                    </Text>
                    <Dialog.Content style={styles.dialogContent}>
                        <Text style={{ color: theme.colors.onSurface }}>
                            ¿Estás seguro que deseas desactivar a este estudiante? 
                            El estudiante no aparecerá en las listas activas pero sus datos se conservarán.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions style={[
                        styles.dialogActions,
                        { borderTopColor: theme.colors.outlineVariant }
                    ]}>
                        <Button 
                            onPress={() => setShowDeactivateDialog(false)} 
                            style={styles.cancelButton}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            mode="contained" 
                            onPress={deactivateStudent}
                            style={[
                                styles.saveButton,
                                { 
                                    backgroundColor: theme.colors.error,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                                    elevation: 2
                                }
                            ]}
                        >
                            Desactivar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Diálogo de confirmación para reactivar estudiante */}
            <Portal>
                <Dialog
                    visible={showReactivateDialog}
                    onDismiss={() => setShowReactivateDialog(false)}
                    style={[
                        styles.dialog,
                        { backgroundColor: theme.colors.surface }
                    ]}
                >
                    <Text style={[
                        styles.dialogTitle,
                        { 
                            color: theme.colors.primary,
                            borderBottomColor: theme.colors.outlineVariant
                        }
                    ]}>
                        Confirmar Reactivación
                    </Text>
                    <Dialog.Content style={styles.dialogContent}>
                        <Text style={{ color: theme.colors.onSurface }}>
                            ¿Estás seguro que deseas reactivar a este estudiante? 
                            El estudiante volverá a aparecer en las listas activas.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions style={[
                        styles.dialogActions,
                        { borderTopColor: theme.colors.outlineVariant }
                    ]}>
                        <Button 
                            onPress={() => setShowReactivateDialog(false)} 
                            style={styles.cancelButton}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            mode="contained" 
                            onPress={reactivateStudent}
                            style={[
                                styles.saveButton,
                                { 
                                    backgroundColor: theme.colors.primary,
                                    borderRadius: isMondayTheme ? BORDER_RADIUS.xs : BORDER_RADIUS.sm,
                                    elevation: 2
                                }
                            ]}
                        >
                            Reactivar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </SafeAreaView>
    );
}

export default StudentProfileScreen;
