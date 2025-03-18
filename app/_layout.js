import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <PaperProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen 
                            name="student/[id]" 
                            options={{
                                headerShown: true,
                                title: 'Perfil del Estudiante',
                                headerStyle: {
                                    backgroundColor: '#6200ee',
                                },
                                headerTintColor: '#fff',
                                presentation: 'modal'
                            }}
                        />
                    </Stack>
                </PaperProvider>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}