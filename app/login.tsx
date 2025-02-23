import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginUser } from '../utils/api';

const LoginScreen = () => {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailError, setEmailError] = useState('');

    const validateEmail = (inputEmail) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(inputEmail);
    };

    const handleLogin = async () => {
        setEmailError('');
        if (!validateEmail(email)) {
            setEmailError("❌ Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            const { success, token } = await loginUser(email, password);

            if (!success) {
                throw new Error("Login failed. Please try again.");
            }

            router.replace("/");

        } catch (error) {
            Alert.alert("❌ Login Failed", error.message);
        }
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <Image source={require('../assets/images/login-icon.png')} style={styles.logo} />
            <Text style={styles.title}>Hare Krishna!</Text>
            <Text style={styles.subtitle}>Login to continue</Text>

            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                placeholderTextColor="#666"
            />

            <TouchableOpacity onPress={handleLogin} style={styles.loginButton}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Login</Text>}
            </TouchableOpacity>
        </View>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f9f4ef",
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    logo: {
        width: 100,
        height: 100,
        resizeMode: 'contain',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: "#cb8e5e",
    },
    subtitle: {
        fontSize: 16,
        color: "#666",
        marginBottom: 30,
    },
    input: {
        width: '100%',
        padding: 15,
        borderWidth: 1,
        borderColor: "#cb8e5e",
        borderRadius: 10,
        marginBottom: 15,
        backgroundColor: "#fff",
        fontSize: 16,
        color: "#333",
    },
    errorText: {
        color: "red",
        marginBottom: 10,
        fontSize: 14,
    },
    loginButton: {
        width: '100%',
        backgroundColor: "#cb8e5e",
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: 'bold',
    },
});