import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationState } from '@react-navigation/native';

export default function TabsLayout() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                router.replace('/login');
            } else {
                setIsAuthenticated(true);
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return isAuthenticated ? (
        <Tabs
            initialRouteName="index"
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'index') {
                        iconName = focused ? 'library' : 'library-outline';
                    } else if (route.name === 'player') {
                        iconName = focused ? 'headset' : 'headset-outline';
                    } else if (route.name === 'profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={30} color={color} />;
                },
                tabBarActiveTintColor: '#cb8e5e',
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: { backgroundColor: '#fff', paddingBottom: 5 },
            })}
        >
            <Tabs.Screen
                name="index"
                options={{
                    href: '/',
                    title: "My Books",  // Custom header for the Library tab
                    headerShown: true,  // Enable header only for this tab
                    headerStyle: {
                        backgroundColor: '#FAF7F5',  // Header background color
                        elevation: 0,  // Remove shadow on Android
                        shadowOpacity: 0,  // Remove shadow on iOS
                    },
                    headerTintColor: '#333',  // Title text color
                    headerTitleAlign: 'center',  // Center the header title
                }}
            />
            <Tabs.Screen name="player" options={{ href: '/player', title: "Player" }} />
            <Tabs.Screen name="profile" options={{ href: '/profile', title: "Profile" }} />
        </Tabs>
    ) : null;
}