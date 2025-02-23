
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router } from "expo-router";
import { isFileDownloaded, fetchNewSignedUrl } from "../../utils/fileManager";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const SURECART_API_KEY = process.env.EXPO_PUBLIC_SURECART_API_KEY;

const HomeScreen = () => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);

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
            if (!customerId) throw new Error("Customer ID not found");

            const purchaseResponse = await axios.get(
                `https://api.surecart.com/v1/purchases?customer_ids[]=${customerId}`,
                { headers: { Authorization: `Bearer ${SURECART_API_KEY}` } }
            );

            const purchases = purchaseResponse.data.data;

            const bookDetails = await Promise.all(
                purchases.map(async (purchase) => {
                    const productId = purchase.product;
                    const productResponse = await axios.get(
                        `https://api.surecart.com/v1/products/${productId}`,
                        { headers: { Authorization: `Bearer ${SURECART_API_KEY}` } }
                    );

                    const product = productResponse.data;
                    const galleryIds = JSON.parse(product.metadata.gallery_ids);

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
                        author: "By: Unknown",
                        narrator: "With: Unknown",
                        duration: "Audio • 8h 56m",
                        image: imageUrl,
                    };
                })
            );

            const uniqueBooks = bookDetails.filter((book, index, self) =>
                index === self.findIndex((b) => b.id === book.id)
            );

            setBooks(uniqueBooks);
        } catch (error) {
            console.error("Error fetching books:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleListenNow = async (book) => {
        const signedUrl = await fetchNewSignedUrl(book.id);
        const isDownloaded = await isFileDownloaded(book.id);

        // Save the last book details in AsyncStorage
        await AsyncStorage.setItem("lastListenedBook", JSON.stringify({
            bookId: book.id,
            bookTitle: book.name,
            bookImage: book.image,
            audioUrl: signedUrl,
            isLocal: isDownloaded,
        }));

        // Navigate to Player with the current book
        router.push({
            pathname: "/player",
            params: {
                audioUrl: signedUrl,
                isLocal: isDownloaded,
                bookId: book.id,
                bookTitle: book.name,
                bookImage: book.image,
            },
        });
    };

    if (loading) return <ActivityIndicator size="large" color="#007bff" style={styles.loading} />;

    return (
        <View style={styles.container}>
            <FlatList
                data={books}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => handleListenNow(item)} style={styles.bookItem}>
                        <Image source={{ uri: item.image }} style={styles.bookImage} />
                        <View style={styles.bookDetails}>
                            <Text style={styles.bookTitle}>{item.name}</Text>
                            <Text style={styles.bookInfo}>{item.author}</Text>
                            <Text style={styles.bookInfo}>{item.narrator}</Text>
                            <Text style={styles.bookInfo}>{item.duration}</Text>
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
    loading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
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
