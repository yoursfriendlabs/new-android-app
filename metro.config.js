const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// expo-sqlite's browser worker loads its database engine from a WASM asset.
config.resolver.assetExts.push('wasm');
module.exports = config;
