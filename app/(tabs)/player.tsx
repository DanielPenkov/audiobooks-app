import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    ImageBackground,
    AppState
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

    const [bookData, setBookData] = useState(null);
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(1);
    const [speed, setSpeed] = useState(1.0);
    const [isDownloaded, setIsDownloaded] = useState(false);

    // Load book data when navigation params change or from AsyncStorage
    useEffect(() => {
        const loadBookData = async () => {
            if (audioUrl && bookId) {
                // Book was passed from index.js
                const newBookData = {
                    bookId,
                    bookTitle,
                    bookImage,
                    audioUrl,
                    isLocal
                };

                // Save new book in AsyncStorage
                await AsyncStorage.setItem("lastListenedBook", JSON.stringify(newBookData));
                setBookData(newBookData);

                // Stop previous audio and load new
                if (sound) {
                    await sound.unloadAsync();
                    setSound(null);
                }
                loadSound(newBookData);
            } else {
                // Fallback to last listened book
                const lastBook = await AsyncStorage.getItem("lastListenedBook");
                if (lastBook) {
                    const parsedBook = JSON.parse(lastBook);
                    setBookData(parsedBook);
                    loadSound(parsedBook);
                }
            }
        };

        loadBookData();
    }, [audioUrl, bookId]);

    // Configure Audio Mode
    useEffect(() => {
        const configureAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: true,
                    interruptionModeIOS: 1,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    interruptionModeAndroid: 1,
                    playThroughEarpieceAndroid: false,
                });
            } catch (error) {
                console.error("Failed to configure audio:", error);
            }
        };

        configureAudio();
    }, []);

    // Load Audio
    const loadSound = async (book) => {
        try {
            if (!book || !book.audioUrl) {
                console.error("No valid book data or audio source available.");
                setLoading(false);
                return;
            }

            console.log("Loading audio for book:", book.bookTitle);

            // Unload previous sound
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: book.audioUrl },
                { shouldPlay: false }
            );

            setSound(newSound);
            setLoading(false);

            // 👉 Load saved position or start from 0
            const savedPosition = await AsyncStorage.getItem(`audio-progress-${book.bookId}`);
            const startPosition = savedPosition ? parseInt(savedPosition) : 0;
            await newSound.setPositionAsync(startPosition);
            setPosition(startPosition);

            // 👉 Update position while playing only
            let interval = null;

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    setPosition(status.positionMillis);
                    setDuration(status.durationMillis || 1);

                    // Start saving progress only if playing
                    if (status.isPlaying && !interval) {
                        interval = setInterval(async () => {
                            const currentStatus = await newSound.getStatusAsync();
                            if (currentStatus.isLoaded && currentStatus.isPlaying) {
                                await AsyncStorage.setItem(`audio-progress-${book.bookId}`, currentStatus.positionMillis.toString());
                                console.log("Progress saved at:", currentStatus.positionMillis);
                            }
                        }, 5000);
                    }

                    // Clear interval when paused or finished
                    if (!status.isPlaying && interval) {
                        clearInterval(interval);
                        interval = null;
                    }

                    if (status.didJustFinish) {
                        setIsPlaying(false);
                        clearInterval(interval);
                    }
                }
            });

            // 👉 Cleanup interval when unloading
            return () => {
                if (interval) {
                    clearInterval(interval);
                }
            };
        } catch (error) {
            console.error("Error loading audio:", error);
            setLoading(false);
        }
    };

    // Play/Pause Audio
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

    // Download Audio
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

                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: bookData.bookImage }}
                        style={styles.cover}
                        resizeMode="cover"
                        onError={(error) => console.warn("Image load failed:", error.nativeEvent.error)}
                    />
                </View>

                <Text style={styles.remainingTime}>
                    {formatTime(position)}
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
        marginBottom: 50,
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
    imageContainer: {
        width: 180,
        height: 300,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: '',
        marginBottom: 50
    },

    cover: {
        width: 200,
        height: 300,
        borderRadius: 10,
    },
    remainingTime: {
        color: "lightgray",
        fontSize: 14,
        marginBottom: 10,
        textAlign: "right"
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
        bottom: 50,
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