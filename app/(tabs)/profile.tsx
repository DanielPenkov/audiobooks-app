import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Switch, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const ProfileScreen = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [storedUsername, setStoredUsername] = useState(''); // ✅ Store username as email
    const [isDarkTheme, setIsDarkTheme] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const username =  await SecureStore.getItemAsync('username');
                setStoredUsername(username || "No Email Stored");

                const token = await AsyncStorage.getItem('authToken');
                if (!token) {
                    router.replace('/login');
                    return;
                }

                const response = await fetch('https://iskconsofia.com/wp-json/wp/v2/users/me', {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                const data = await response.json();
                if (response.ok) {
                    setUserData(data);
                } else {
                    Alert.alert("Error", "Failed to fetch user data. Logging out...");
                    handleLogout();
                }
            } catch (error) {
                Alert.alert("Error", "An error occurred while fetching profile data.");
            }
            setLoading(false);
        };

        fetchUserData();
    }, []);

    // ✅ Logout Function
    const handleLogout = async () => {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('username'); // ✅ Clear stored username
        router.replace('/login');
    };

    // ✅ Toggle Theme Function
    const toggleTheme = () => setIsDarkTheme((prev) => !prev);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#cb8e5e" />
            </View>
        );
    }

    return (
        <View style={[styles.container, isDarkTheme && styles.darkContainer]}>
            {/* ✅ User Avatar */}
            <Image
                source={{ uri: userData?.avatar_urls?.["96"] || "https://via.placeholder.com/96" }}
                style={styles.avatar}
            />

            {/* ✅ User Info */}
            <Text style={[styles.name, isDarkTheme && styles.darkText]}>
                {userData?.name || "Unknown User"}
            </Text>
            <Text style={[styles.email, isDarkTheme && styles.darkText]}>
                {storedUsername} {/* ✅ Use stored username as email */}
            </Text>

            {/* ✅ Theme Toggle */}
            <View style={styles.themeSwitch}>
                <Text style={[styles.themeText, isDarkTheme && styles.darkText]}>
                    {isDarkTheme ? "Dark Mode" : "Light Mode"}
                </Text>
                <Switch value={isDarkTheme} onValueChange={toggleTheme} />
            </View>

            {/* ✅ Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    darkContainer: {
        backgroundColor: '#222',
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        marginBottom: 10,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    email: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    themeSwitch: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    themeText: {
        fontSize: 18,
        marginRight: 10,
        color: '#333',
    },
    darkText: {
        color: '#fff',
    },
    logoutButton: {
        backgroundColor: '#cb8e5e',
        padding: 10,
        borderRadius: 5,
    },
    logoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});