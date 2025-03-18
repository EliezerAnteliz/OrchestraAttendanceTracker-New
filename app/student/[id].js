import { useLocalSearchParams } from 'expo-router';
import StudentProfileScreen from '../../src/screens/StudentProfileScreen';

export default function StudentProfile() {
    const { id } = useLocalSearchParams();
    console.log('Profile params:', { id });
    return <StudentProfileScreen studentId={id} />;
}
