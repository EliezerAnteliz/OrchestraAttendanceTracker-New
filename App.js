import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ThemeProvider } from './src/theme';
import { Provider as PaperProvider } from 'react-native-paper';
import { Stack } from 'expo-router';
import { useAppTheme } from './src/theme';
import { loadFonts } from './src/theme/fonts';
import { LogBox } from 'react-native';

// Ignorar el log específico de VirtualizedList
LogBox.ignoreLogs(['VirtualizedList: You have a large list that is slow to update']);

const AppContent = () => {
    const { theme } = useAppTheme();
    return (
        <PaperProvider theme={theme}>
            <Stack />
        </PaperProvider>
    );
};

export default function App() {
    // Usamos directamente la función loadFonts que devuelve si las fuentes están cargadas
    const fontsLoaded = loadFonts();

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#673AB7" />
            </View>
        );
    }

    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}
