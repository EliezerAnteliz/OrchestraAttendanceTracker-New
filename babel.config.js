module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      '@babel/plugin-proposal-export-namespace-from',
      ['module:react-native-dotenv'],
      ['expo-router/babel', {
        root: __dirname,
        debug: false,
        // Excluir completamente la carpeta student/[id] para evitar conflictos
        ignorePatterns: ['app/student/[id].js', '**/student/[id].js']
      }]
    ],
  };
};