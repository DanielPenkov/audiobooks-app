import React, {useEffect, useRef, useState} from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    ImageBackground
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { getFileUri, fetchNewSignedUrl, isFileDownloaded, deleteFile } from "../../utils/fileManager";
import TrackPlayer, {
    Capability,
    useProgress,
    useTrackPlayerEvents,
    Event,
    State,
} from 'react-native-track-player';

const PlayerScreen = () => {
    const router = useRouter();
    const { audioUrl, bookId, bookTitle, bookImage, bookAuthor, bookNarrator } = useLocalSearchParams();
    const [bookData, setBookData] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [speed, setSpeed] = useState(1.0);
    const { position, duration } = useProgress(500);
    const positionRef = useRef(0);

    useEffect(() => {
        const loadBookData = async () => {
            if (audioUrl && bookId) {
                const imageFileName = `${bookId}-cover.jpg`;
                const imageLocalUri = FileSystem.documentDirectory + imageFileName;

                const fileInfo = await FileSystem.getInfoAsync(imageLocalUri);
                if (!fileInfo.exists && bookImage) {
                    await FileSystem.downloadAsync(bookImage, imageLocalUri);
                }

                const newBookData = {
                    bookId,
                    bookTitle,
                    bookImage: imageLocalUri,
                    bookAuthor,
                    bookNarrator,
                    audioUrl,
                };

                await AsyncStorage.setItem("lastListenedBook", JSON.stringify(newBookData));
                setBookData(newBookData);
                setLoading(false);
            } else {
                const lastBook = await AsyncStorage.getItem("lastListenedBook");
                if (lastBook) {
                    const parsedBook = JSON.parse(lastBook);
                    setBookData(parsedBook);
                    setLoading(false);
                } else {
                    setBookData(null);
                    setLoading(false);
                }
            }
        };

        loadBookData();

    }, [audioUrl, bookId]);

    useEffect(() => {
        if (!bookData) return;

        const setupPlayer = async () => {
            await TrackPlayer.setupPlayer();

            await TrackPlayer.updateOptions({
                stopWithApp: false,
                capabilities: [
                    Capability.Play,
                    Capability.Pause,
                    Capability.SeekTo,
                    Capability.SkipToNext,
                    Capability.SkipToPrevious,
                ],
                compactCapabilities: [Capability.Play, Capability.Pause],
            });

            const fileExists = await isFileDownloaded(bookData.bookId);
            setIsDownloaded(fileExists);
            const audioSource = fileExists ? getFileUri(bookData.bookId) : bookData.audioUrl;

            await TrackPlayer.reset();
            await TrackPlayer.add({
                id: bookData.bookId,
                url: audioSource,
                title: bookData.bookTitle,
                artist: bookData.bookNarrator || bookData.bookAuthor,
                artwork: bookData.bookImage,
            });

            const savedPosition = await AsyncStorage.getItem(`audio-progress-${bookData.bookId}`);
            if (savedPosition) {
                await TrackPlayer.seekTo(parseInt(savedPosition));
            }
        };

        setupPlayer();

        const interval = setInterval(async () => {
            await AsyncStorage.setItem(
                `audio-progress-${bookData.bookId}`,
                Math.floor(positionRef.current).toString()
            );
        }, 5000);

        return () => clearInterval(interval);
    }, [bookData]);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useTrackPlayerEvents([Event.PlaybackQueueEnded], async (event) => {
        if (event.position > 0) {
            await TrackPlayer.seekTo(0);
            await TrackPlayer.pause();
            setIsPlaying(false);

            await AsyncStorage.setItem(
                `audio-progress-${bookData.bookId}`,
                '0'
            );
        }
    });

    const handlePlayPause = async () => {
        const state = await TrackPlayer.getState();

        if (state === State.Playing) {
            await TrackPlayer.pause();
            setIsPlaying(false);
        } else {
            await TrackPlayer.play();
            setIsPlaying(true);
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
                await AsyncStorage.setItem(`audio-path-${bookData.bookId}`, `${bookData.bookId}.mp3`);
                setIsDownloaded(true);
            }
        } catch (error) {
        }
    };

    const handleSkipForward = async () => {
        const currentPosition = await TrackPlayer.getPosition();
        const currentDuration = await TrackPlayer.getDuration();

        const newPos = Math.min(currentPosition + 15, currentDuration);
        await TrackPlayer.seekTo(newPos);
    }

    const handleSkipBackward = async () => {
        const currentPosition = await TrackPlayer.getPosition();
        const newPos = Math.max(currentPosition - 15, 0);
        await TrackPlayer.seekTo(newPos);
    };

    const handleSpeedChange = async () => {
        const newSpeed = speed === 1.0 ? 1.5 : speed === 1.5 ? 2.0 : 1.0;
        setSpeed(newSpeed);
        await TrackPlayer.setRate(newSpeed);
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
            <View style={styles.noBookContainer}>
                <Text style={styles.noBookText}>Няма избрана книга.</Text>
                <TouchableOpacity onPress={() => router.replace("/")} style={styles.returnButton}>
                    <Text style={styles.returnButtonText}>Върнете се към началото</Text>
                </TouchableOpacity>
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
                </View>

                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: bookData.bookImage }}
                        style={styles.cover}
                        resizeMode="cover"
                        onError={(error) => console.warn("Image load failed:", error.nativeEvent.error)}
                    />
                </View>

                <View style={styles.bookInfoContainer}>
                    <Text style={styles.authorText}>{bookData.bookAuthor || "Unknown Author"}</Text>
                    <Text style={styles.narratorText}>{bookData.bookNarrator ? `Прочетено от ${bookData.bookNarrator}` : "Narrator Unknown"}</Text>
                </View>

                <View style={styles.progressContainer}>
                    <Text style={styles.timeText}>{formatTime(position * 1000)}</Text>
                    <View style={styles.sliderContainer}>
                        <Slider
                            style={styles.progressBar}
                            minimumValue={0}
                            maximumValue={duration}
                            value={position}
                            onSlidingComplete={(value) => TrackPlayer.seekTo(value)}
                            minimumTrackTintColor="white"
                            maximumTrackTintColor="gray"
                            thumbTintColor="white"
                        />
                    </View>
                    <Text style={styles.timeText}>{formatTime(duration * 1000)}</Text>
                </View>

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
                    <TouchableOpacity onPress={handleDownload} style={styles.headerButton}>
                        <Ionicons
                            name={isDownloaded ? "trash-outline" : "cloud-download-outline"}
                            size={30}
                            color="white"
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
};

export default PlayerScreen;

const styles = StyleSheet.create({
    bookInfoContainer: {
        alignItems: "center",
        marginBottom: 10, // Space before the progress bar
    },
    authorText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 2, // Space between author and narrator
    },
    progressContainer: {
        flexDirection: "row",
        alignItems: "center",
        width: "90%",  // Ensures even spacing
        justifyContent: "space-between",
        marginTop: 10,
    },

    sliderContainer: {
        flex: 1,  // Makes sure slider takes all available space
        alignItems: "center",
    },

    progressBar: {
        width: "100%",  // Ensures slider fills the space
    },

    timeText: {
        color: "white",
        fontSize: 14,
        minWidth: 40,  // Prevents numbers from getting squeezed
        textAlign: "center",
    },
    narratorText: {
        color: "lightgray",
        fontSize: 14,
        textAlign: "center",
    },
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
    noBookContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f9f4ef",
    },
    noBookText: {
        color: "black",
        fontSize: 18,
        textAlign: "center",
        marginBottom: 20,
    },
    returnButton: {
        backgroundColor: "#cb8e5e",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
});