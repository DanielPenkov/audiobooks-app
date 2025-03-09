import * as FileSystem from "expo-file-system";
import axios from "axios";

export const getFileUri = (bookId: string) => `${FileSystem.documentDirectory}${bookId}.mp3`;

/**
 * Checks if a book is already downloaded.
 */
export const isFileDownloaded = async (bookId: string) => {
    const fileUri = getFileUri(bookId);
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    return fileInfo.exists;
};

/**
 * Downloads an audio file and saves it securely.
 */
export const downloadFile = async (bookId: string, signedUrl: string) => {
    try {
        const fileUri = getFileUri(bookId);
        const downloadResumable = FileSystem.createDownloadResumable(signedUrl, fileUri);
        await downloadResumable.downloadAsync();
        return fileUri; // Return the saved file path
    } catch (error) {
        return null;
    }
};

/**
 * Deletes a downloaded file to free up space.
 */
export const deleteFile = async (bookId: string) => {
    try {
        const fileUri = getFileUri(bookId);
        await FileSystem.deleteAsync(fileUri);
    } catch (error) {
    }
};

/**
 * Fetches a new signed URL from the server (if expired).
 */
export const fetchNewSignedUrl = async (bookId: string) => {
    try {
        const response = await axios.get(
            `https://iskconsofia.com/wp-json/audio-books/v1/get-signed-url/${bookId}`,
            { headers: { "Cache-Control": "no-cache" } }
        );

        return response.data.signed_url;
    } catch (error) {
        return null;
    }
};