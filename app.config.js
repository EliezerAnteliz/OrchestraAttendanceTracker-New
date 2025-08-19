export default {
  expo: {
    name: 'Orchestra Attendance',
    slug: 'orchestra-attendance',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'orchestra-attendance',
    platforms: ["ios", "android"],
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.orchestraattendance.app",
      versionCode: 1,
      newArchEnabled: true,
      enableHermes: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      permissions: [
        "android.permission.DETECT_SCREEN_CAPTURE"
      ]
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [],
    sdkVersion: "48.0.0",
    updates: {
      fallbackToCacheTimeout: 0
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  }
};
