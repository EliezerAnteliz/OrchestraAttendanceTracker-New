import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Appbar, Text, Card, Button, Chip, Switch, Divider, List, Surface, SegmentedButtons } from 'react-native-paper';
import { useAppTheme, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, THEME_NAMES, mondayStyles } from '../theme';
import { ThemeToggleButton, StyledInput, StyledCard } from '../components';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Pantalla de vista previa del tema
 * Muestra los diferentes componentes de la aplicación con el tema actual
 */
const ThemePreviewScreen = () => {
    const { theme, isDark, toggleTheme, themeType, setTheme } = useAppTheme();
    const [inputValue, setInputValue] = useState('');
    const [hasError, setHasError] = useState(false);

    // Función para renderizar un componente de tarjeta Monday
    const renderMondayCard = () => {
        if (themeType !== THEME_NAMES.MONDAY) return null;
        
        return (
            <View style={mondayStyles.card(theme)}>
                <View style={styles.mondayCardHeader}>
                    <View style={[mondayStyles.statusIndicator(theme.colors.primary)]} />
                    <Text style={[TYPOGRAPHY.h3, {color: theme.colors.text}]}>Tarjeta estilo Monday</Text>
                </View>
                
                <View style={mondayStyles.dataRow(theme)}>
                    <Text style={[TYPOGRAPHY.subtitle1, {width: 100}]}>Estado:</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={[mondayStyles.statusIndicator(theme.colors.attendance.present)]} />
                        <Text>Presente</Text>
                    </View>
                </View>
                
                <View style={mondayStyles.dataRow(theme)}>
                    <Text style={[TYPOGRAPHY.subtitle1, {width: 100}]}>Prioridad:</Text>
                    <View style={{
                        backgroundColor: theme.colors.accent, 
                        paddingHorizontal: 8, 
                        paddingVertical: 4,
                        borderRadius: 4
                    }}>
                        <Text style={{color: '#fff'}}>Alta</Text>
                    </View>
                </View>
                
                <View style={mondayStyles.dataRow(theme)}>
                    <Text style={[TYPOGRAPHY.subtitle1, {width: 100}]}>Fecha:</Text>
                    <Text>25 de marzo, 2025</Text>
                </View>
                
                <View style={{flexDirection: 'row', marginTop: SPACING.md}}>
                    <TouchableOpacity 
                        style={[mondayStyles.button(theme), {
                            backgroundColor: theme.colors.primary,
                            marginRight: SPACING.sm
                        }]}
                    >
                        <Text style={{color: '#fff'}}>Aceptar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[mondayStyles.button(theme), {
                            backgroundColor: 'transparent',
                            borderWidth: 1,
                            borderColor: theme.colors.outline
                        }]}
                    >
                        <Text style={{color: theme.colors.text}}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <Appbar.Content title="Vista Previa del Tema" />
                <ThemeToggleButton />
            </Appbar.Header>

            <ScrollView style={styles.scrollView}>
                <Card style={styles.card}>
                    <Card.Title title="Tema Actual" subtitle={`${themeType === THEME_NAMES.MONDAY ? 'Monday' : 'Default'} - ${isDark ? 'Modo Oscuro' : 'Modo Claro'}`} />
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
                        
                        <Divider style={styles.divider} />
                        
                        <Text style={[TYPOGRAPHY.subtitle1, {textAlign: 'center', marginBottom: SPACING.sm}]}>
                            Selecciona el tipo de tema:
                        </Text>
                        
                        <SegmentedButtons
                            value={themeType}
                            onValueChange={(value) => setTheme(value)}
                            buttons={[
                                {
                                    value: THEME_NAMES.DEFAULT,
                                    label: 'Original',
                                },
                                {
                                    value: THEME_NAMES.MONDAY,
                                    label: 'Monday',
                                }
                            ]}
                            style={{marginBottom: SPACING.md}}
                        />
                        
                        <Text style={styles.description}>
                            Cambia entre los temas para ver cómo se adapta la interfaz.
                        </Text>
                    </Card.Content>
                </Card>
                
                {/* Componente de tarjeta estilo Monday */}
                {renderMondayCard()}

                {/* Nuevos componentes estilizados */}
                <StyledCard 
                    title="Componentes Estilizados" 
                    subtitle="Nuevos componentes unificados"
                    style={styles.card}
                    elevation={2}
                >
                    <Text style={[styles.subtitle, { color: theme.colors.primary }]}>
                        StyledInput
                    </Text>
                    <StyledInput
                        label="Campo de entrada estilizado"
                        value={inputValue}
                        onChangeText={text => {
                            setInputValue(text);
                            setHasError(text.length < 3 && text.length > 0);
                        }}
                        placeholder="Escribe algo..."
                        error={hasError ? "El texto debe tener al menos 3 caracteres" : ""}
                    />
                    
                    <Divider style={styles.divider} />
                    
                    <Text style={[styles.subtitle, { color: theme.colors.primary }]}>
                        StyledCard
                    </Text>
                    <Text style={styles.description}>
                        Este componente que estás viendo es un StyledCard con elevación 2.
                        Incluye soporte para títulos, subtítulos y contenido.
                    </Text>
                    
                    <View style={styles.cardElevations}>
                        <View style={styles.elevationItem}>
                            <Surface style={[styles.elevationSample, { ...SHADOWS.none }]}>
                                <Text style={styles.elevationText}>Sin elevación</Text>
                            </Surface>
                            <Text style={styles.colorName}>Nivel 0</Text>
                        </View>
                        <View style={styles.elevationItem}>
                            <Surface style={[styles.elevationSample, { ...SHADOWS.small }]}>
                                <Text style={styles.elevationText}>Pequeña</Text>
                            </Surface>
                            <Text style={styles.colorName}>Nivel 1</Text>
                        </View>
                        <View style={styles.elevationItem}>
                            <Surface style={[styles.elevationSample, { ...SHADOWS.medium }]}>
                                <Text style={styles.elevationText}>Media</Text>
                            </Surface>
                            <Text style={styles.colorName}>Nivel 2</Text>
                        </View>
                        <View style={styles.elevationItem}>
                            <Surface style={[styles.elevationSample, { ...SHADOWS.large }]}>
                                <Text style={styles.elevationText}>Grande</Text>
                            </Surface>
                            <Text style={styles.colorName}>Nivel 3</Text>
                        </View>
                    </View>
                </StyledCard>

                <Card style={styles.card}>
                    <Card.Title title="Colores del Tema" />
                    <Card.Content>
                        <View style={styles.colorSection}>
                            <View style={styles.colorItem}>
                                <View style={[styles.colorSwatch, { backgroundColor: theme.colors.primary }]} />
                                <Text style={styles.colorName}>Primary</Text>
                            </View>
                            <View style={styles.colorItem}>
                                <View style={[styles.colorSwatch, { backgroundColor: theme.colors.accent }]} />
                                <Text style={styles.colorName}>Accent</Text>
                            </View>
                            <View style={styles.colorItem}>
                                <View style={[styles.colorSwatch, { backgroundColor: theme.colors.error }]} />
                                <Text style={styles.colorName}>Error</Text>
                            </View>
                        </View>
                        
                        {themeType === THEME_NAMES.MONDAY && (
                            <>
                                <View style={styles.colorSection}>
                                    <View style={styles.colorItem}>
                                        <View style={[styles.colorSwatch, { backgroundColor: theme.colors.secondary }]} />
                                        <Text style={styles.colorName}>Secondary</Text>
                                    </View>
                                    <View style={styles.colorItem}>
                                        <View style={[styles.colorSwatch, { backgroundColor: theme.colors.warning }]} />
                                        <Text style={styles.colorName}>Warning</Text>
                                    </View>
                                    <View style={styles.colorItem}>
                                        <View style={[styles.colorSwatch, { backgroundColor: theme.colors.info }]} />
                                        <Text style={styles.colorName}>Info</Text>
                                    </View>
                                </View>
                            </>
                        )}
                        
                        <Divider style={styles.divider} />
                        <Text style={styles.subtitle}>Colores de Asistencia</Text>
                        <View style={styles.colorSection}>
                            <View style={styles.colorItem}>
                                <View style={[styles.colorSwatch, { backgroundColor: theme.colors.attendance?.present }]} />
                                <Text style={styles.colorName}>Presente</Text>
                            </View>
                            <View style={styles.colorItem}>
                                <View style={[styles.colorSwatch, { backgroundColor: theme.colors.attendance?.justified }]} />
                                <Text style={styles.colorName}>Justificada</Text>
                            </View>
                            <View style={styles.colorItem}>
                                <View style={[styles.colorSwatch, { backgroundColor: theme.colors.attendance?.unexcused }]} />
                                <Text style={styles.colorName}>Injustificada</Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.card}>
                    <Card.Title title="Tipografía" />
                    <Card.Content>
                        <Text style={[styles.text, { ...TYPOGRAPHY.h1 }]}>Título 1</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.h2 }]}>Título 2</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.h3 }]}>Título 3</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.subtitle1 }]}>Subtítulo 1</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.subtitle2 }]}>Subtítulo 2</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.body1 }]}>Texto normal (Body 1)</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.body2 }]}>Texto pequeño (Body 2)</Text>
                        <Text style={[styles.text, { ...TYPOGRAPHY.caption, color: theme.colors.disabled }]}>Texto de ayuda (Caption)</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        elevation: 4,
    },
    scrollView: {
        flex: 1,
        padding: SPACING.md,
    },
    card: {
        marginBottom: SPACING.md,
    },
    themeToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: SPACING.md,
    },
    description: {
        ...TYPOGRAPHY.body2,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
    colorSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: SPACING.sm,
    },
    colorItem: {
        alignItems: 'center',
        width: '30%',
    },
    colorSwatch: {
        width: 50,
        height: 50,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    colorName: {
        ...TYPOGRAPHY.caption,
        textAlign: 'center',
    },
    divider: {
        marginVertical: SPACING.md,
    },
    subtitle: {
        ...TYPOGRAPHY.subtitle1,
        marginBottom: SPACING.sm,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
    },
    button: {
        margin: SPACING.xs,
    },
    chipRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
    },
    chip: {
        margin: SPACING.xs,
    },
    surface: {
        padding: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.md,
    },
    text: {
        marginVertical: SPACING.xxs,
    },
    // Nuevos estilos para elevaciones
    cardElevations: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginTop: SPACING.md,
    },
    elevationItem: {
        alignItems: 'center',
        width: '23%',
        marginVertical: SPACING.sm,
    },
    elevationSample: {
        width: 70,
        height: 70,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    elevationText: {
        ...TYPOGRAPHY.caption,
        textAlign: 'center',
    },
    // Estilos para componentes Monday
    mondayCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
});

export default ThemePreviewScreen;