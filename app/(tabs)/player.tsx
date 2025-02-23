
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    ImageBackground,
} from "react-native";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { getFileUri, fetchNewSignedUrl, isFileDownloaded, downloadFile, deleteFile } from "../../utils/fileManager";

const PlayerScreen = () => {
    const router = useRouter();
    const { audioUrl, isLocal, bookId, bookTitle, bookImage } = useLocalSearchParams();

    // Book data state to manage current book details (initialized as null)
    const [bookData, setBookData] = useState(null);
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(1);
    const [speed, setSpeed] = useState(1.0);
    const [isDownloaded, setIsDownloaded] = useState(false);

    // Load last listened book on initial render
    useEffect(() => {
        const loadLastBook = async () => {
            const lastBook = await AsyncStorage.getItem("lastListenedBook");
            if (lastBook) {
                const parsedBook = JSON.parse(lastBook);
                console.log("Loading last book:", parsedBook.bookTitle);
                setBookData(parsedBook);
            }
        };

        loadLastBook();
    }, []);

    // Load sound only when bookData is available
    useEffect(() => {
        if (bookData) {
            loadSound();
        }

        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [bookData]);

    const loadSound = async () => {
        try {
            if (!bookData || !bookData.audioUrl) {
                console.error("No valid book data or audio source available.");
                setLoading(false);
                return;
            }

            console.log("Book data for audio loading:", bookData);

            let finalUrl = bookData.audioUrl;

            // Check if local file exists
            const savedPath = await AsyncStorage.getItem(`audio-path-${bookData.bookId}`);
            if (savedPath) {
                const localUri = `${FileSystem.documentDirectory}${savedPath}`;
                const fileInfo = await FileSystem.getInfoAsync(localUri);
                if (fileInfo.exists) {
                    finalUrl = localUri;
                }
            }

            console.log("Attempting to load audio from:", finalUrl);

            const { sound } = await Audio.Sound.createAsync(
                { uri: finalUrl },
                { shouldPlay: false }
            );

            setSound(sound);
            setLoading(false);

            const savedPosition = await AsyncStorage.getItem(`audio-progress-${bookData.bookId}`);
            if (savedPosition) {
                await sound.setPositionAsync(parseInt(savedPosition));
                setPosition(parseInt(savedPosition));
            }

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    setPosition(status.positionMillis);
                    setDuration(status.durationMillis || 1);
                    if (status.didJustFinish) setIsPlaying(false);
                }
            });
        } catch (error) {
            console.error("Error loading audio:", error);
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        const fileUri = `${FileSystem.documentDirectory}${bookData.bookId}.mp3`;

        if (isDownloaded) {
            await deleteFile(bookData.bookId);
            setIsDownloaded(false);
            await AsyncStorage.removeItem(`audio-path-${bookData.bookId}`);
            return;
        }

        const signedUrl = await fetchNewSignedUrl(bookData.bookId);
        const downloadResumable = FileSystem.createDownloadResumable(signedUrl, fileUri);

        try {
            const { uri } = await downloadResumable.downloadAsync();
            if (uri) {
                console.log("File successfully downloaded to:", uri);
                await AsyncStorage.setItem(`audio-path-${bookData.bookId}`, `${bookData.bookId}.mp3`);
                setIsDownloaded(true);
            }
        } catch (error) {
            console.error("Failed to download file:", error);
        }
    };

    const handleDelete = async () => {
        const savedPath = await AsyncStorage.getItem(`audio-path-${bookData.bookId}`);
        if (savedPath) {
            const fileUri = `${FileSystem.documentDirectory}${savedPath}`;
            await FileSystem.deleteAsync(fileUri);
            await AsyncStorage.removeItem(`audio-path-${bookData.bookId}`);
            setIsDownloaded(false);
            console.log("File deleted:", fileUri);
        }
    };

    const handlePlayPause = async () => {
        if (sound) {
            if (isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
            } else {
                await sound.playAsync();
                setIsPlaying(true);
            }
        }
    };

    const handleSkipForward = async () => {
        if (sound) {
            const newPosition = Math.min(position + 15000, duration);
            await sound.setPositionAsync(newPosition);
            setPosition(newPosition);
        }
    };

    const handleSkipBackward = async () => {
        if (sound) {
            const newPosition = Math.max(position - 15000, 0);
            await sound.setPositionAsync(newPosition);
            setPosition(newPosition);
        }
    };

    const handleSpeedChange = async () => {
        const newSpeed = speed === 1.0 ? 1.5 : speed === 1.5 ? 2.0 : 1.0;
        setSpeed(newSpeed);
        if (sound) await sound.setRateAsync(newSpeed, true);
    };

    const formatTime = (millis) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    if (loading) {
        return <ActivityIndicator size="large" color="#007bff" style={styles.loading} />;
    }

    if (!bookData) {
        return (
            <View style={styles.container}>
                <Text style={{ color: "white" }}>No book selected. Please choose a book to play.</Text>
            </View>
        );
    }

    return (
        <ImageBackground
            source={{ uri: bookData.bookImage }}
            style={styles.background}
            blurRadius={20}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                        <Ionicons name="chevron-down" size={30} color="white" />
                    </TouchableOpacity>

                    <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                        {bookData.bookTitle}
                    </Text>

                    <TouchableOpacity onPress={handleDownload} style={styles.headerButton}>
                        <Ionicons
                            name={isDownloaded ? "trash-outline" : "cloud-download-outline"}
                            size={25}
                            color="white"
                        />
                    </TouchableOpacity>
                </View>

                <Image
                    source={{ uri: bookData.bookImage, cache: 'force-cache' }}
                    style={styles.cover}
                    onError={() => console.warn("Failed to load image.")}
                    resizeMode="cover"
                />

                <Text style={styles.remainingTime}>
                    {formatTime(duration - position)} remaining
                </Text>

                <Slider
                    style={styles.progressBar}
                    minimumValue={0}
                    maximumValue={duration}
                    value={position}
                    onValueChange={(value) => sound?.setPositionAsync(value)}
                    minimumTrackTintColor="white"
                    maximumTrackTintColor="gray"
                    thumbTintColor="white"
                />

                <View style={styles.controlsContainer}>
                    <TouchableOpacity onPress={handleSpeedChange} style={styles.controlButton}>
                        <Text style={styles.controlText}>{speed}x</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSkipBackward} style={styles.controlButton}>
                        <Ionicons name="play-back" size={30} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                        <Ionicons name={isPlaying ? "pause" : "play"} size={35} color="black" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSkipForward} style={styles.controlButton}>
                        <Ionicons name="play-forward" size={30} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.controlButton}>
                        <Ionicons name="moon" size={30} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
};

export default PlayerScreen;

const styles = StyleSheet.create({
    background: {
        flex: 1,
        resizeMode: "cover",
    },
    container: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        alignItems: "center",
        paddingTop: 40,
    },
    header: {
        flexDirection: "row",
        width: "100%",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    headerButton: {
        padding: 5,
    },
    title: {
        flex: 1,
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
    },
    cover: {
        width: 300,
        height: 300,
        borderRadius: 10,
        marginBottom: 10,
        marginTop: 10,
    },
    remainingTime: {
        color: "lightgray",
        fontSize: 14,
        marginBottom: 10,
    },
    progressBar: {
        width: "90%",
        marginVertical: 10,
    },
    controlsContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        width: "100%",
        paddingVertical: 10,
        position: "absolute",
        bottom: 20,
    },
    controlButton: {
        padding: 10,
    },
    playButton: {
        backgroundColor: "white",
        borderRadius: 50,
        padding: 15,
    },
    controlText: {
        color: "white",
        fontSize: 16,
    },
});
