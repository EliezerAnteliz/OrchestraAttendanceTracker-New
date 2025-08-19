// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Excluir los archivos problemáticos con [id].js
config.resolver.blockList = [
  /app\/student\/\[id\]\.js$/,
];

module.exports = config;
