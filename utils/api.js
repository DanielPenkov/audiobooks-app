import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const API_BASE_URL = "https://iskconsofia.com/wp-json";

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
});

export const saveCredentials = async (email, password) => {
    await SecureStore.setItemAsync('username', email);
    await SecureStore.setItemAsync('password', password);
};


export const getCredentials = async () => {
    const email = await SecureStore.getItemAsync('username');
    const password = await SecureStore.getItemAsync('password');
    return { email, password };
};

export const deleteCredentials = async () => {
    await SecureStore.deleteItemAsync('username');
    await SecureStore.deleteItemAsync('password');
};

export const loginUser = async (email, password) => {
    try {
        await AsyncStorage.removeItem('authToken');

        const response = await api.post('/jwt-auth/v1/token', {
            'username': email,
            'password': password
        });

        const { token } = response.data;
        if (!token) throw new Error("No token received.");

        await AsyncStorage.setItem('authToken', token);
        await saveCredentials(email, password);

        return { success: true, token };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

export const refreshAccessToken = async () => {
    try {
        const { email, password } = await getCredentials();

        if (!email || !password) {
            router.replace('/login');
            return null;
        }

        const response = await api.post('/jwt-auth/v1/token', {
            'username': email,
            'password': password
        });

        const { token: newAccessToken } = response.data;
        if (!newAccessToken) throw new Error("No new token received.");

        await AsyncStorage.setItem('authToken', newAccessToken);

        return newAccessToken;
    } catch (error) {
        await AsyncStorage.removeItem('authToken');
        await deleteCredentials();
        router.replace('/login');
        return null;
    }
};

api.interceptors.response.use(
    response => response,
    async (error) => {
        const originalRequest = error.config;
        if (!originalRequest._retry) {
            originalRequest._retry = true;
            const newToken = await refreshAccessToken();

            if (!newToken) {
                return Promise.reject(error);
            }

            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
        }

        return Promise.reject(error);
    }
);

export default api;