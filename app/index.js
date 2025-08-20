import { LogBox } from 'react-native';

// Ignorar el log específico de VirtualizedList
LogBox.ignoreLogs(['VirtualizedList: You have a large list that is slow to update']);

import LoginScreen from '../src/screens/LoginScreen';

export default function Index() {
    return <LoginScreen />;
}
