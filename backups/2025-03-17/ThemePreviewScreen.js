import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, Text, Card, Button, Chip, Switch, Divider, List, Surface } from 'react-native-paper';
import { useAppTheme } from '../theme';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Pantalla de vista previa del tema
 * Muestra los diferentes componentes de la aplicación con el tema actual
 */
const ThemePreviewScreen = () => {
    const { theme, isDark, toggleTheme } = useAppTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.Content title="Vista Previa del Tema" />
                <ThemeToggleButton />
            </Appbar.Header>

            <ScrollView style={styles.scrollView}>
                <Card style={styles.card}>
                    <Card.Title title="Tema Actual" subtitle={isDark ? 'Modo Oscuro' : 'Modo Claro'} />
                    <Card.Content>
                        <View style={styles.themeToggleContainer}>
                            <MaterialCommunityIcons name="weather-sunny" size={24} color={theme.colors.text} />
                            <Switch
                                value={isDark}
                                onValueChange={toggleTheme}
                                color={theme.colors.primary}
                            />
                            <MaterialCommunityIcons name="weather-night" size={24} color={theme.colors.text} />
                        </View>
                        <Text style={styles.description}>
                            Cambia entre el tema claro y oscuro para ver cómo se adapta la interfaz.
                        </Text>
                    </Card.Content>
                </Card>

                <Card style={styles.card}>
                    <Card.Title title="Colores del Tema" />
                    <Card.Content>
                        <View style={styles.colorRow}>
                            <ColorSwatch color={theme.colors.primary} name="Primary" />
                            <ColorSwatch color={theme.colors.secondary} name="Secondary" />
                            <ColorSwatch color={theme.colors.error} name="Error" />
                        </View>
                        <View style={styles.colorRow}>
                            <ColorSwatch color={theme.colors.background} name="Background" />
                            <ColorSwatch color={theme.colors.surface} name="Surface" />
                            <ColorSwatch color={theme.colors.text} name="Text" />
                        </View>
                        <Divider style={styles.divider} />
                        <Text style={styles.subtitle}>Colores de Asistencia</Text>
                        <View style={styles.colorRow}>
                            <ColorSwatch color={theme.colors.attendance.present} name="Presente" />
                            <ColorSwatch color={theme.colors.attendance.justified} name="Justificada" />
                            <ColorSwatch color={theme.colors.attendance.unexcused} name="Injustificada" />
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.card}>
                    <Card.Title title="Tipografía" />
                    <Card.Content>
                        <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold' }]}>Título 1</Text>
                        <Text style={[styles.text, { fontSize: 20, fontWeight: 'bold' }]}>Título 2</Text>
                        <Text style={[styles.text, { fontSize: 18, fontWeight: '500' }]}>Subtítulo 1</Text>
                        <Text style={[styles.text, { fontSize: 16, fontWeight: '500' }]}>Subtítulo 2</Text>
                        <Text style={[styles.text, { fontSize: 16 }]}>Texto normal (Body 1)</Text>
                        <Text style={[styles.text, { fontSize: 14 }]}>Texto pequeño (Body 2)</Text>
                        <Text style={[styles.text, { fontSize: 12, color: theme.colors.disabled }]}>Texto de ayuda (Caption)</Text>
                    </Card.Content>
                </Card>

                <Card style={styles.card}>
                    <Card.Title title="Componentes" />
                    <Card.Content>
                        <View style={styles.buttonRow}>
                            <Button mode="contained" style={styles.button}>
                                Primario
                            </Button>
                            <Button mode="outlined" style={styles.button}>
                                Secundario
                            </Button>
                            <Button mode="text" style={styles.button}>
                                Texto
                            </Button>
                        </View>

                        <Divider style={styles.divider} />
                        
                        <View style={styles.chipRow}>
                            <Chip icon="check" style={styles.chip}>Presente</Chip>
                            <Chip icon="alert" style={styles.chip}>Justificada</Chip>
                            <Chip icon="close" style={styles.chip}>Injustificada</Chip>
                        </View>

                        <Divider style={styles.divider} />
                        
                        <Surface style={styles.surface} elevation={2}>
                            <Text style={styles.text}>Surface con elevación</Text>
                        </Surface>

                        <Divider style={styles.divider} />
                        
                        <List.Section>
                            <List.Subheader>Lista de elementos</List.Subheader>
                            <List.Item
                                title="Elemento 1"
                                description="Descripción del elemento"
                                left={props => <List.Icon {...props} icon="account" />}
                            />
                            <List.Item
                                title="Elemento 2"
                                description="Descripción del elemento"
                                left={props => <List.Icon {...props} icon="folder" />}
                            />
                        </List.Section>
                    </Card.Content>
                </Card>
            </ScrollView>
        </View>
    );
};

// Componente para mostrar un color del tema
const ColorSwatch = ({ color, name }) => {
    const { theme } = useAppTheme();
    
    return (
        <View style={styles.colorSwatch}>
            <View style={[styles.colorSquare, { backgroundColor: color }]} />
            <Text style={[styles.colorName, { color: theme.colors.text }]}>{name}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        elevation: 4,
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    card: {
        marginBottom: 16,
    },
    themeToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
    },
    description: {
        textAlign: 'center',
        marginTop: 8,
    },
    colorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 8,
    },
    colorSwatch: {
        alignItems: 'center',
        width: '30%',
    },
    colorSquare: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    colorName: {
        fontSize: 12,
        textAlign: 'center',
    },
    divider: {
        marginVertical: 16,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    text: {
        marginVertical: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 8,
    },
    button: {
        marginHorizontal: 4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginVertical: 8,
    },
    chip: {
        margin: 4,
    },
    surface: {
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 8,
    },
});

export default ThemePreviewScreen; 