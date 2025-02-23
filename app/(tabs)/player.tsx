import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
} from "react-native";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { isFileDownloaded, getFileUri, fetchNewSignedUrl, downloadFile } from "../../utils/fileManager";

const PlayerScreen = () => {
    const router = useRouter();
    const { audioUrl, isLocal, bookId, bookTitle, bookImage } = useLocalSearchParams();

    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(1);
    const [speed, setSpeed] = useState(1.0);

    useEffect(() => {
        if (!audioUrl && !isLocal) {
            console.error("No valid audio source provided.");
            setLoading(false);
            return;
        }

        const loadSound = async () => {
            try {
                let finalUrl = null;

                if (isLocal) {
                    // Check for local file
                    const localUri = getFileUri(bookId);
                    const fileInfo = await FileSystem.getInfoAsync(localUri);

                    if (fileInfo.exists) {
                        finalUrl = localUri;
                    } else {
                        console.warn("Local file not found, falling back to web URL.");
                    }
                }

                // If no local file, use the web URL
                if (!finalUrl) {
                    finalUrl = audioUrl;
                }

                // Ensure we have a valid URL
                if (!finalUrl) {
                    console.error("No valid audio source available.");
                    setLoading(false);
                    return;
                }

                // Load the sound
                const { sound } = await Audio.Sound.createAsync(
                    { uri: finalUrl },
                    { shouldPlay: false }
                );

                setSound(sound);
                setLoading(false);

                // Restore saved position
                const savedPosition = await AsyncStorage.getItem(`audio-progress-${bookId}`);
                if (savedPosition) {
                    await sound.setPositionAsync(parseInt(savedPosition));
                    setPosition(parseInt(savedPosition));
                }

                // Playback status update
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded) {
                        setPosition(status.positionMillis);
                        setDuration(status.durationMillis || 1);
                        if (status.didJustFinish) {
                            setIsPlaying(false);
                        }
                    }
                });
            } catch (error) {
                console.error("Error loading audio:", error);
                setLoading(false);
            }
        };

        if (isLocal) {
            loadSound(getFileUri(bookId));
        } else {
            loadSound(audioUrl);
        }

        return () => {
            if (sound) sound.unloadAsync();
        };
    }, []);

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

    const handleSeek = async (value) => {
        if (sound) {
            await sound.setPositionAsync(value);
            setPosition(value);
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

    useEffect(() => {
        const saveProgress = async () => {
            if (bookId && position > 0) {
                await AsyncStorage.setItem(`audio-progress-${bookId}`, position.toString());
            }
        };
        const interval = setInterval(saveProgress, 5000);
        return () => clearInterval(interval);
    }, [position]);

    const formatTime = (millis) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    if (loading) {
        return <ActivityIndicator size="large" color="#007bff" style={styles.loading} />;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-down" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>{bookTitle}</Text>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-vertical" size={24} color="white" />
                </TouchableOpacity>
            </View>

            {bookImage && <Image source={{ uri: bookImage }} style={styles.cover} />}

            <Text style={styles.progressText}>{formatTime(position)} / {formatTime(duration)}</Text>
            <Slider
                style={styles.progressBar}
                minimumValue={0}
                maximumValue={duration}
                value={position}
                onValueChange={handleSeek}
                minimumTrackTintColor="white"
                maximumTrackTintColor="gray"
                thumbTintColor="white"
            />

            <View style={styles.controls}>
                <TouchableOpacity onPress={handleSpeedChange}>
                    <Text style={styles.controlText}>{speed}x</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSkipBackward}>
                    <Ionicons name="play-back" size={35} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="black" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSkipForward}>
                    <Ionicons name="play-forward" size={35} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default PlayerScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#131313",
        alignItems: "center",
        paddingTop: 40,
    },
    header: {
        flexDirection: "row",
        width: "100%",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        alignItems: "center",
        marginBottom: 20,
    },
    title: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
    },
    cover: {
        width: 250,
        height: 250,
        borderRadius: 10,
    },
    progressText: {
        color: "white",
        fontSize: 14,
        marginTop: 10,
    },
    progressBar: {
        width: "90%",
        marginTop: 5,
    },
});