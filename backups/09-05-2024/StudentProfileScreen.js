import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, SafeAreaView, StatusBar, Linking } from 'react-native';
import { Surface, Text, useTheme, Divider, Card, Avatar, Portal, Dialog, Button, TextInput, List, Appbar, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '../config/supabase';

export default function StudentProfileScreen() {
    const theme = useTheme();
    const isDark = theme.dark;
    const params = useLocalSearchParams();
    const navigation = useNavigation();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editedStudent, setEditedStudent] = useState({});
    const [saving, setSaving] = useState(false);
    
    const instruments = ["Violín", "Viola", "Cello", "Contrabajo", "Flauta", "Clarinete", "Oboe", "Fagot", "Trompeta", "Trombón", "Trompa", "Tuba", "Percusión", "Piano", "Arpa"];
    const positions = ["Principal", "Section", "Concert Master", "Assistant"];

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
                const studentData = {
                    ...data,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    grade: data.current_grade,
                    position: data.orchestra_position,
                    parentName: data.student_parents?.[0]?.parents?.full_name,
                    phone: data.student_parents?.[0]?.parents?.phone_number,
                    age: data.age ? data.age.toString() : ''
                };
                setStudent(studentData);
                setEditedStudent(studentData);
            }
            setLoading(false);
        }

        fetchStudentData();
    }, [params.id]);

    useEffect(() => {
        navigation.setOptions({
            title: 'Perfil del Estudiante',
            headerRight: () => (
                <Appbar.Action icon="pencil" onPress={() => setEditMode(true)} />
            ),
        });
    }, [navigation]);

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            // Convertir la edad a número si es posible
            const updatedStudent = {
                ...editedStudent,
                age: editedStudent.age !== '' ? editedStudent.age : null
            };
            
            // Aquí iría la lógica para guardar los cambios en la base de datos
            // Por ahora solo actualizamos el estado local
            setStudent(updatedStudent);
            setEditMode(false);
        } catch (error) {
            console.error('Error saving changes:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleCall = (phoneNumber) => {
        Linking.openURL(`tel:${phoneNumber}`);
    };
    
    const handleMessage = (phoneNumber) => {
        Linking.openURL(`sms:${phoneNumber}`);
    };

    if (loading) return <ActivityIndicator style={{flex: 1, justifyContent: 'center'}} />;
    if (!student) return <Text>No se encontró el estudiante</Text>;

    const {
        id = '',
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
        <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#121212' : 'white' }]}>
            <StatusBar backgroundColor={isDark ? '#121212' : 'white'} barStyle={isDark ? "light-content" : "dark-content"} />
            
            <ScrollView 
                style={[styles.container, { backgroundColor: isDark ? '#121212' : 'white' }]} 
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    <View style={[styles.header, { backgroundColor: isDark ? '#121212' : 'white' }]}>
                        <Avatar.Text 
                            size={80} 
                            label={initials}
                            style={styles.avatar}
                            color="white"
                            backgroundColor="#673AB7"
                        />
                        <Text variant="headlineMedium" style={[styles.name, { color: isDark ? 'white' : '#333' }]}>
                            {`${firstName} ${lastName}`}
                        </Text>
                    </View>

                    <Card style={[styles.infoCard, { backgroundColor: isDark ? '#1E1E1E' : 'white' }]}>
                        <Card.Content>
                            <Text variant="titleLarge" style={[styles.sectionTitle, { color: '#673AB7' }]}>
                                Información del Estudiante
                            </Text>
                            <Divider style={[styles.divider, { backgroundColor: isDark ? '#333' : '#EEEEEE' }]} />
                            
                            <View style={styles.infoRow}>
                                <Text variant="labelLarge" style={[styles.label, { color: isDark ? '#BBB' : '#666' }]}>Grado:</Text>
                                <Text variant="bodyLarge" style={{ color: isDark ? 'white' : 'black' }}>{grade}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text variant="labelLarge" style={[styles.label, { color: isDark ? '#BBB' : '#666' }]}>Edad:</Text>
                                <Text variant="bodyLarge" style={{ color: isDark ? 'white' : 'black' }}>{age}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text variant="labelLarge" style={[styles.label, { color: isDark ? '#BBB' : '#666' }]}>Instrumento:</Text>
                                <Text variant="bodyLarge" style={{ color: isDark ? 'white' : 'black' }}>{instrument}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text variant="labelLarge" style={[styles.label, { color: isDark ? '#BBB' : '#666' }]}>Posición:</Text>
                                <Text variant="bodyLarge" style={{ color: isDark ? 'white' : 'black' }}>{position}</Text>
                            </View>
                        </Card.Content>
                    </Card>

                    <Card style={[styles.infoCard, { backgroundColor: isDark ? '#1E1E1E' : 'white' }]}>
                        <Card.Content>
                            <Text variant="titleLarge" style={[styles.sectionTitle, { color: '#673AB7' }]}>
                                Información de Contacto
                            </Text>
                            <Divider style={[styles.divider, { backgroundColor: isDark ? '#333' : '#EEEEEE' }]} />
                            
                            <View style={styles.infoRow}>
                                <Text variant="labelLarge" style={[styles.label, { color: isDark ? '#BBB' : '#666' }]}>Padre/Madre:</Text>
                                <Text variant="bodyLarge" style={{ color: isDark ? 'white' : 'black' }}>{parentName}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text variant="labelLarge" style={[styles.label, { color: isDark ? '#BBB' : '#666' }]}>Teléfono:</Text>
                                <Text variant="bodyLarge" style={{ color: isDark ? 'white' : 'black' }}>{phone}</Text>
                            </View>
                        </Card.Content>
                    </Card>
                    
                    <View style={styles.actionButtonsContainer}>
                        <IconButton
                            icon="phone"
                            size={32}
                            iconColor="white"
                            style={styles.callButton}
                            onPress={() => handleCall(phone)}
                        />
                        <Button 
                            icon="pencil" 
                            mode="contained" 
                            onPress={() => setEditMode(true)}
                            style={styles.editButton}
                            labelStyle={{ color: 'white', fontWeight: '500' }}
                        >
                            Editar
                        </Button>
                        <IconButton
                            icon="message-text"
                            size={32}
                            iconColor="white"
                            style={styles.messageButton}
                            onPress={() => handleMessage(phone)}
                        />
                    </View>
                </View>
            </ScrollView>

            <Portal>
                <Dialog
                    visible={editMode}
                    onDismiss={() => setEditMode(false)}
                    style={{ 
                        backgroundColor: isDark ? '#1E1E1E' : 'white',
                        borderRadius: 10,
                        margin: 20,
                    }}
                    dismissable={true}
                    theme={{
                        colors: {
                            backdrop: 'transparent'
                        }
                    }}
                >
                    <Dialog.Title style={[styles.dialogTitle, { color: isDark ? 'white' : '#333' }]}>
                        Editar Información
                    </Dialog.Title>
                    <Dialog.Content>
                        <ScrollView style={styles.dialogScroll}>
                            <Text style={[styles.inputLabel, { color: '#673AB7' }]}>Nombre</Text>
                            <TextInput
                                value={editedStudent.firstName}
                                onChangeText={text => setEditedStudent({...editedStudent, firstName: text})}
                                style={[styles.input, { backgroundColor: isDark ? '#333' : 'white' }]}
                                mode="outlined"
                                outlineColor={isDark ? '#444' : '#E0E0E0'}
                                activeOutlineColor="#6200EE"
                                textColor={isDark ? 'white' : 'black'}
                                theme={{ colors: { placeholder: isDark ? '#999' : '#7c7c7c' } }}
                            />
                            <Text style={[styles.inputLabel, { color: '#673AB7' }]}>Apellido</Text>
                            <TextInput
                                value={editedStudent.lastName}
                                onChangeText={text => setEditedStudent({...editedStudent, lastName: text})}
                                style={[styles.input, { backgroundColor: isDark ? '#333' : 'white' }]}
                                mode="outlined"
                                outlineColor={isDark ? '#444' : '#E0E0E0'}
                                activeOutlineColor="#6200EE"
                                textColor={isDark ? 'white' : 'black'}
                                theme={{ colors: { placeholder: isDark ? '#999' : '#7c7c7c' } }}
                            />
                            <Text style={[styles.inputLabel, { color: '#673AB7' }]}>Grado</Text>
                            <TextInput
                                value={editedStudent.grade}
                                onChangeText={text => setEditedStudent({...editedStudent, grade: text})}
                                style={[styles.input, { backgroundColor: isDark ? '#333' : 'white' }]}
                                mode="outlined"
                                outlineColor={isDark ? '#444' : '#E0E0E0'}
                                activeOutlineColor="#6200EE"
                                textColor={isDark ? 'white' : 'black'}
                                theme={{ colors: { placeholder: isDark ? '#999' : '#7c7c7c' } }}
                            />
                            <Text style={[styles.inputLabel, { color: '#673AB7' }]}>Edad</Text>
                            <TextInput
                                value={typeof editedStudent.age !== 'undefined' && editedStudent.age !== null 
                                    ? String(editedStudent.age) 
                                    : ''}
                                onChangeText={text => setEditedStudent({...editedStudent, age: text})}
                                style={[styles.input, { backgroundColor: isDark ? '#333' : 'white' }]}
                                mode="outlined"
                                outlineColor={isDark ? '#444' : '#E0E0E0'}
                                activeOutlineColor="#6200EE"
                                keyboardType="numeric"
                                placeholder="Ingrese la edad"
                                textColor={isDark ? 'white' : 'black'}
                                theme={{ colors: { placeholder: isDark ? '#999' : '#7c7c7c' } }}
                            />
                            
                            <Text style={[styles.inputLabel, { color: '#673AB7' }]}>Instrumento</Text>
                            <List.Accordion
                                title={editedStudent.instrument || "Seleccionar instrumento"}
                                style={[styles.dropdown, { 
                                    backgroundColor: isDark ? '#333' : 'white',
                                    borderColor: isDark ? '#444' : '#E0E0E0' 
                                }]}
                                titleStyle={{ color: isDark ? 'white' : '#333' }}
                                theme={{ colors: { primary: '#673AB7' } }}
                            >
                                {instruments.map((item) => (
                                    <List.Item
                                        key={item}
                                        title={item}
                                        onPress={() => {
                                            setEditedStudent({...editedStudent, instrument: item});
                                        }}
                                        style={styles.dropdownItem}
                                        titleStyle={{ color: isDark ? 'white' : '#333' }}
                                    />
                                ))}
                            </List.Accordion>
                            
                            <Text style={[styles.inputLabel, { color: '#673AB7' }]}>Posición</Text>
                            <List.Accordion
                                title={editedStudent.position || "Seleccionar posición"}
                                style={[styles.dropdown, { 
                                    backgroundColor: isDark ? '#333' : 'white',
                                    borderColor: isDark ? '#444' : '#E0E0E0' 
                                }]}
                                titleStyle={{ color: isDark ? 'white' : '#333' }}
                                theme={{ colors: { primary: '#673AB7' } }}
                            >
                                {positions.map((item) => (
                                    <List.Item
                                        key={item}
                                        title={item}
                                        onPress={() => {
                                            setEditedStudent({...editedStudent, position: item});
                                        }}
                                        style={styles.dropdownItem}
                                        titleStyle={{ color: isDark ? 'white' : '#333' }}
                                    />
                                ))}
                            </List.Accordion>
                        </ScrollView>
                    </Dialog.Content>
                    <Dialog.Actions style={styles.dialogActions}>
                        <Button 
                            onPress={() => setEditMode(false)}
                            textColor="#F44336"
                            labelStyle={styles.cancelButton}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onPress={handleSaveChanges} 
                            loading={saving}
                            mode="contained"
                            buttonColor="#6200EE"
                            style={styles.saveButton}
                            labelStyle={styles.saveButtonText}
                        >
                            Guardar
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'white',
    },
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        paddingVertical: 40,
    },
    header: {
        padding: 20,
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: 'white',
    },
    avatar: {
        marginBottom: 16,
    },
    name: {
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    infoCard: {
        margin: 16,
        marginTop: 8,
        elevation: 2,
    },
    sectionTitle: {
        marginBottom: 8,
        color: '#673AB7',
        fontWeight: '600',
    },
    divider: {
        marginBottom: 16,
        backgroundColor: '#EEEEEE',
        height: 1,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        color: '#666',
        flex: 1,
    },
    editButtonContainer: {
        marginHorizontal: 16,
        marginVertical: 20,
        alignItems: 'center',
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 24,
        marginVertical: 30,
        paddingHorizontal: 16,
    },
    editButton: {
        borderRadius: 28,
        paddingHorizontal: 16,
        backgroundColor: '#6200EE',
    },
    callButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 50,
        margin: 0,
        width: 60,
        height: 60,
    },
    messageButton: {
        backgroundColor: '#2196F3',
        borderRadius: 50,
        margin: 0,
        width: 60,
        height: 60,
    },
    dialogTitle: {
        textAlign: 'center',
        color: '#333',
        fontSize: 18,
    },
    dialogScroll: {
        maxHeight: 400,
    },
    inputLabel: {
        fontSize: 12,
        color: '#6200EE',
        marginBottom: 4,
        marginLeft: 8,
    },
    input: {
        marginBottom: 12,
        backgroundColor: 'white',
    },
    dropdown: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 4,
        backgroundColor: 'white',
        marginBottom: 12,
    },
    dropdownTitle: {
        color: '#333',
    },
    dropdownItem: {
        paddingVertical: 8,
    },
    dialogActions: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    cancelButton: {
        fontSize: 14,
        fontWeight: '500',
    },
    saveButton: {
        borderRadius: 25,
        paddingHorizontal: 12,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
