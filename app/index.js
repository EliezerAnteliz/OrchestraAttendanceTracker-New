import { useAuth } from '../src/contexts/AuthContext';
import LoginScreen from '../src/screens/LoginScreen';
import StudentsListScreen from '../src/screens/StudentsListScreen';

export default function Index() {
    const { user } = useAuth();

    if (!user) {
        return <LoginScreen />;
    }

    return <StudentsListScreen />;
}