import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";
import { fetchNewSignedUrl } from "../../utils/fileManager";
import { useTheme } from '../ThemeContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SURECART_API_KEY = process.env.EXPO_PUBLIC_SURECART_API_KEY;

const HomeScreen = () => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [noBooks, setNoBooks] = useState(false);
    const { isDarkTheme } = useTheme(); // Get theme state

    useEffect(() => {
        fetchLibrary();
    }, []);

    const fetchLibrary = async () => {
        try {
            const authToken = await AsyncStorage.getItem("authToken");
            if (!authToken) throw new Error("Auth token not found");

            const userResponse = await axios.get(`${API_URL}/wp/v2/users/me`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            const customerId = userResponse.data.meta?.sc_customer_ids?.test;
            if (!customerId) {
                setNoBooks(true);
                return;
            }

            const purchaseResponse = await axios.get(
                `https://api.surecart.com/v1/purchases?customer_ids[]=${customerId}`,
                { headers: { Authorization: `Bearer ${SURECART_API_KEY}` } }
            );

            const purchases = purchaseResponse.data.data;

            if (purchases.length === 0) {
                setNoBooks(true);
                return;
            }

            const bookDetails = await Promise.all(
                purchases.map(async (purchase) => {
                    const productId = purchase.product;
                    const productResponse = await axios.get(
                        `https://api.surecart.com/v1/products/${productId}`,
                        { headers: { Authorization: `Bearer ${SURECART_API_KEY}` } }
                    );

                    const product = productResponse.data;
                    const galleryIds = JSON.parse(product.metadata.gallery_ids);

                    let metaData = {};
                    try {
                        const cleanedData = product.metadata.meta_description
                            ?.replace(/\\n/g, '')
                            ?.replace(/\\u[\dA-Fa-f]{4}/g, '')
                            ?.trim();

                        if (cleanedData) {
                            metaData = JSON.parse(cleanedData);
                        }
                    } catch (error) {}

                    let imageUrl = "";
                    if (galleryIds.length > 0) {
                        const mediaResponse = await axios.get(
                            `${API_URL}/wp/v2/media/${galleryIds[0]}`,
                            { headers: { Authorization: `Bearer ${authToken}` } }
                        );
                        imageUrl = mediaResponse.data.source_url;
                    }

                    return {
                        id: productId,
                        name: product.name,
                        author: metaData.author || "By: Unknown",
                        narrator: metaData.narrator || "With: Unknown",
                        duration: metaData.duration || "Audio • Unknown duration",
                        image: imageUrl,
                    };
                })
            );

            const uniqueBooks = bookDetails.filter((book, index, self) =>
                index === self.findIndex((b) => b.id === book.id)
            );

            setBooks(uniqueBooks);
        } catch (error) {
            Alert.alert("Грешка", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleListenNow = async (book) => {
        if (global.currentSound) {
            await global.currentSound.unloadAsync();
            global.currentSound = null;
        }

        const signedUrl = await fetchNewSignedUrl(book.id);

        const bookData = {
            bookId: book.id,
            bookTitle: book.name,
            bookImage: book.image,
            bookAuthor: book.author,
            bookNarrator: book.narrator,
            audioUrl: signedUrl,
        };

        await AsyncStorage.setItem("lastListenedBook", JSON.stringify(bookData));
        router.push({
            pathname: "/player",
            params: bookData,
        });
    };

    if (loading) return <ActivityIndicator size="large" color="#007bff" style={styles.loading} />;

    if (noBooks) {
        return (
            <View style={[styles.noBooksContainer, isDarkTheme && styles.darkContainer]}>
                <Text style={[styles.noBooksText, isDarkTheme && styles.darkText]}>Нямате закупени книги.</Text>
                <Text style={[styles.noBooksSubtitle, isDarkTheme && styles.darkText]}>Моля, посетете сайта, за да закупите книги.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, isDarkTheme && styles.darkContainer]}>
            <FlatList
                data={books}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => handleListenNow(item)} style={[styles.bookItem, isDarkTheme && styles.darkBookItem]}>
                        <Image source={{ uri: item.image }} style={styles.bookImage} />
                        <View style={styles.bookDetails}>
                            <Text style={[styles.bookTitle, isDarkTheme && styles.darkText]}>{item.name}</Text>
                            <Text style={[styles.bookInfo, isDarkTheme && styles.darkText]}>{item.author}</Text>
                            <Text style={[styles.bookInfo, isDarkTheme && styles.darkText]}>{item.narrator}</Text>
                            <Text style={[styles.bookInfo, isDarkTheme && styles.darkText]}>{item.duration}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FAF7F5",
        paddingTop: 20,
    },
    darkContainer: {
        backgroundColor: "#121212", // Dark mode background
    },
    loading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    noBooksContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
    },
    noBooksText: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        textAlign: "center",
    },
    noBooksSubtitle: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginTop: 10,
    },
    darkText: {
        color: "#FFF", // White text for dark mode
    },
    listContainer: {
        paddingHorizontal: 10,
        paddingBottom: 20,
    },
    bookItem: {
        flexDirection: "row",
        padding: 15,
        alignItems: "center",
        borderBottomWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "#FFF",
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    darkBookItem: {
        backgroundColor: "#1E1E1E", // Dark mode card background
        borderColor: "#333", // Darker border
    },
    bookImage: {
        width: 90,
        height: 130,
        borderRadius: 10,
    },
    bookDetails: {
        flex: 1,
        marginLeft: 15,
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    bookInfo: {
        fontSize: 14,
        color: "#666",
    },
});