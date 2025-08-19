import { Tabs } from 'expo-router';
import { Provider as PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeProvider, useAppTheme } from '../src/theme';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';

// Componente principal que utiliza el ThemeProvider
export default function AppLayout() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

// Componente que consume el tema
function AppContent() {
    // Obtenemos el tema y el estado del modo oscuro del contexto
    const { theme, isDark, themeType } = useAppTheme();
    const isMondayTheme = themeType === 'MONDAY';

    return (
        <View style={styles.container}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <PaperProvider theme={theme}>
                <Tabs 
                    screenOptions={{
                        headerShown: false,
                        tabBarActiveTintColor: theme.colors.primary,
                        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                        tabBarStyle: {
                            height: 80,
                            paddingBottom: 15,
                            paddingTop: 10,
                            borderTopColor: isMondayTheme ? theme.colors.primary : theme.colors.outline,
                            borderTopWidth: isMondayTheme ? 2 : 1,
                            backgroundColor: theme.colors.surface,
                            elevation: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -3 },
                            shadowOpacity: 0.1,
                            shadowRadius: 3,
                        },
                        tabBarLabelStyle: {
                            fontSize: 12,
                            marginTop: 4,
                        },
                        tabBarIconStyle: {
                            marginBottom: 0,
                        },
                        tabBarLabelPosition: 'below-icon',
                        tabBarShowLabel: true,
                    }}
                >
                    <Tabs.Screen
                        name="index"
                        options={{
                            title: 'Estudiantes',
                            tabBarIcon: ({ color }) => (
                                <MaterialCommunityIcons 
                                    name="account-group" 
                                    size={28} 
                                    color={color} 
                                />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="attendance/register"
                        options={{
                            title: 'Asistencia',
                            tabBarIcon: ({ color }) => (
                                <MaterialCommunityIcons 
                                    name="calendar-check" 
                                    size={28} 
                                    color={color} 
                                />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="reports"
                        options={{
                            title: 'Reportes',
                            tabBarIcon: ({ color }) => (
                                <MaterialCommunityIcons 
                                    name="file-chart" 
                                    size={28} 
                                    color={color} 
                                />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="theme-preview"
                        options={{
                            href: null, // Esto ocultará la pestaña del menú inferior
                        }}
                    />
                    <Tabs.Screen
                        name="student"
                        options={{
                            href: null, // Deshabilitar completamente la ruta student para evitar conflictos
                        }}
                    />
                    <Tabs.Screen
                        name="profile"
                        options={{
                            href: null, // Ocultar tab pero permitir navegación por código
                        }}
                    />
                </Tabs>
            </PaperProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
}); 