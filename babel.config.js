module.exports = {
    presets: ["babel-preset-expo"],
    assumptions: {
        // Ensure global variables are not wrongly stripped
        noDocumentAll: true,
    }
};