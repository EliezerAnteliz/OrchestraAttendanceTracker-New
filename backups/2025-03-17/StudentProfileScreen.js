import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Linking, Image, Alert } from 'react-native';
import { Surface, Text, Divider, Card, Avatar, Button, Appbar, Chip, Portal, Dialog, RadioButton, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../config/supabase';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme';
import { useAppTheme } from '../theme';
import ThemeToggleButton from '../components/ThemeToggleButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function StudentProfileScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { theme, isDark } = useAppTheme();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [showAttendanceHistory, setShowAttendanceHistory] = useState(false);

    useEffect(() => {
        async function fetchStudentData() {
            if (!params.id) return;
            
            const { data, error } = await supabase
                .from('students')
                .select(`
                    *,
                    student_parents!inner(
                        parents(
                            full_name,
                            phone_number,
                            email
                        )
                    )
                `)
                .eq('id', params.id)
                .single();

            if (error) {
                console.error('Error fetching student:', error);
                return;
            }

            if (data) {
                setStudent({
                    ...data,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    grade: data.current_grade,
                    position: data.orchestra_position,
                    parentName: data.student_parents?.[0]?.parents?.full_name,
                    phone: data.student_parents?.[0]?.parents?.phone_number
                });
            }
            setLoading(false);
        }

        fetchStudentData();
    }, [params.id]);

    const handleCall = () => {
        if (student?.phone) {
            Linking.openURL(`tel:${student.phone}`);
        }
    };

    const handleMessage = () => {
        if (student?.phone) {
            Linking.openURL(`sms:${student.phone}`);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                    <Appbar.BackAction onPress={() => router.back()} />
                    <Appbar.Content title="Perfil de Estudiante" />
                    <ThemeToggleButton style={styles.themeToggle} />
                </Appbar.Header>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Cargando información...</Text>
                </View>
            </View>
        );
    }

    if (!student) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                    <Appbar.BackAction onPress={() => router.back()} />
                    <Appbar.Content title="Perfil de Estudiante" />
                    <ThemeToggleButton style={styles.themeToggle} />
                </Appbar.Header>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No se encontró información del estudiante</Text>
                </View>
            </View>
        );
    }

    const {
        firstName = '',
        lastName = '',
        grade = '',
        age = '',
        instrument = '',
        position = '',
        parentName = '',
        phone = ''
    } = student;

    const initials = `${firstName[0] || ''}${lastName[0] || ''}`;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={`${firstName} ${lastName}`} />
                <ThemeToggleButton style={styles.themeToggle} />
            </Appbar.Header>
            <ScrollView>
                <Surface style={[styles.headerContent, { backgroundColor: theme.colors.primary }]}>
                    <Avatar.Text 
                        size={80} 
                        label={initials}
                        style={styles.avatar}
                        color={theme.colors.primary}
                        backgroundColor={theme.colors.surface}
                    />
                    <Text variant="headlineMedium" style={styles.name}>
                        {`${firstName} ${lastName}`}
                    </Text>
                </Surface>

                <Card style={styles.infoCard}>
                    <Card.Content>
                        <Text variant="titleLarge" style={styles.sectionTitle}>
                            Información del Estudiante
                        </Text>
                        <Divider style={styles.divider} />
                        
                        <View style={styles.infoRow}>
                            <Text variant="labelLarge" style={styles.label}>Grado:</Text>
                            <Text variant="bodyLarge" style={styles.value}>{grade}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelLarge" style={styles.label}>Edad:</Text>
                            <Text variant="bodyLarge" style={styles.value}>{age}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelLarge" style={styles.label}>Instrumento:</Text>
                            <Text variant="bodyLarge" style={styles.value}>{instrument}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelLarge" style={styles.label}>Posición:</Text>
                            <Text variant="bodyLarge" style={styles.value}>{position}</Text>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.infoCard}>
                    <Card.Content>
                        <Text variant="titleLarge" style={styles.sectionTitle}>
                            Información de Contacto
                        </Text>
                        <Divider style={styles.divider} />
                        
                        <View style={styles.infoRow}>
                            <Text variant="labelLarge" style={styles.label}>Padre/Madre:</Text>
                            <Text variant="bodyLarge" style={styles.value}>{parentName}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelLarge" style={styles.label}>Teléfono:</Text>
                            <Text variant="bodyLarge" style={styles.value}>{phone}</Text>
                        </View>
                    </Card.Content>
                </Card>

                <View style={styles.buttonContainer}>
                    <Button 
                        mode="contained" 
                        onPress={handleCall} 
                        style={styles.button}
                        icon="phone"
                        disabled={!phone}
                    >
                        Llamar al Padre/Madre
                    </Button>
                    <Button 
                        mode="contained" 
                        onPress={handleMessage} 
                        style={styles.button}
                        icon="message"
                        disabled={!phone}
                    >
                        Enviar Mensaje
                    </Button>
                </View>
            </ScrollView>

            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.BackAction onPress={() => setEditMode(true)} />
                <Appbar.Content title="Editar Estudiante" />
                <ThemeToggleButton style={styles.themeToggle} />
            </Appbar.Header>

            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.BackAction onPress={() => setShowAttendanceHistory(true)} />
                <Appbar.Content title="Historial de Asistencia" />
                <ThemeToggleButton style={styles.themeToggle} />
            </Appbar.Header>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.surface,
        elevation: 4,
    },
    themeToggle: {
        marginRight: SPACING.xs,
    },
    headerContent: {
        padding: SPACING.lg,
        alignItems: 'center',
        ...SHADOWS.medium,
        marginBottom: SPACING.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: SPACING.md,
        ...TYPOGRAPHY.body1,
        color: COLORS.text.secondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    emptyText: {
        ...TYPOGRAPHY.body1,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },
    avatar: {
        marginBottom: SPACING.md,
    },
    name: {
        color: COLORS.surface,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    infoCard: {
        margin: SPACING.md,
        marginTop: SPACING.sm,
        ...SHADOWS.small,
        borderRadius: BORDER_RADIUS.sm,
    },
    sectionTitle: {
        marginBottom: SPACING.sm,
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    divider: {
        marginBottom: SPACING.md,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    label: {
        color: COLORS.text.secondary,
        flex: 1,
    },
    value: {
        flex: 2,
        textAlign: 'right',
    },
    buttonContainer: {
        padding: SPACING.md,
        paddingTop: SPACING.sm,
    },
    button: {
        marginBottom: SPACING.sm,
    },
});
