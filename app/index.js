import { LogBox } from 'react-native';

// Ignorar el log específico de VirtualizedList
LogBox.ignoreLogs(['VirtualizedList: You have a large list that is slow to update']);

import StudentsListScreen from '../src/screens/StudentsListScreen';

export default function Index() {
    return <StudentsListScreen />;
}
