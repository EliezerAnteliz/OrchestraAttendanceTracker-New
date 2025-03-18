import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { List, Searchbar, ActivityIndicator, Appbar } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { router } from 'expo-router';

export default function StudentsListScreen() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            console.log('Fetching students...');
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .order('first_name');

            if (error) throw error;
            console.log('Students fetched:', data.length);
            setStudents(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(student => {
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    const handleStudentPress = (student) => {
        console.log('Navigating to student profile:', student.id);
        router.push(`/student/${student.id}`);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.header}>
                <Appbar.Content title="Orchestra Attendance" />
            </Appbar.Header>
            <Searchbar
                placeholder="Buscar estudiante..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
            />
            <FlatList
                data={filteredStudents}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <List.Item
                        title={`${item.first_name} ${item.last_name}`}
                        description={`ID: ${item.student_id}`}
                        onPress={() => handleStudentPress(item)}
                        style={styles.listItem}
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: '#6200ee',
    },
    searchBar: {
        margin: 16,
    },
    listItem: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 8,
    },
});
