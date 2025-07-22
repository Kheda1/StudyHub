import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
//import mobileAds from 'react-native-google-mobile-ads';
//import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GestureHandlerRootView } from "react-native-gesture-handler";
//import registerNNPushToken from "native-notify";
import { useEffect, useState } from "react";
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { auth } from '@/firebase/FirebaseConfig';
import { onAuthStateChanged } from "firebase/auth";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Thin: require('../assets/fonts/Poppins/Poppins-Thin.ttf'),
    Light: require('../assets/fonts/Poppins/Poppins-Light.ttf'),
    Italic: require('../assets/fonts/Poppins/Poppins-Italic.ttf'),
    Regular: require('../assets/fonts/Poppins/Poppins-Regular.ttf'),
    Medium: require('../assets/fonts/Poppins/Poppins-Medium.ttf'),
    SemiBold: require('../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    Bold: require('../assets/fonts/Poppins/Poppins-Bold.ttf'),
    ExtraBold: require('../assets/fonts/Poppins/Poppins-ExtraBold.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </GestureHandlerRootView>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const MainLayout = () => {
  const router = useRouter();
  const { isSignedIn, setupUser, InitSettings } = useAuth();
  const colorScheme = useColorScheme();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Check first-time user
        const firstTime = await AsyncStorage.getItem("firstTime");
        if (!firstTime) {
          router.push('/');
        }

        // 2. Initialize services
        // registerNNPushToken(30747, 'S1Rjq2892iz0jkRMN8ruyM'); // Push notifications
        
        // await mobileAds().initialize(); // Google Mobile Ads
        
        // GoogleSignin.configure({
        //   webClientId: 'YOUR_STUDYHUB_GOOGLE_CLIENT_ID',
        //   offlineAccess: true,
        // });

        // // 3. Set up auth listener
        // const unsubscribe = onAuthStateChanged(auth, (user) => {
        //   if (user) {
        //     console.log('StudyHub user detected:', user.email);
        //     setupUser(user);
        //   } else {
        //     console.log('No StudyHub user detected');
        //     setupUser(null);
        //   }
        // });

        // 4. Initialize app settings
        await InitSettings();

        // 5. Set up deep linking
        const handleDeepLink = (event: { url: string }) => {
          const url = event.url;
          const path = url.replace("studyhub://", "");
          const allowedRoutes = ["/home", "/study-session", "/resources"];
          if (allowedRoutes.includes(`/${path}`)) {
            router.push(`/(tabs)/resources`);
          }
        };

        Linking.addEventListener("url", handleDeepLink);
        Linking.getInitialURL().then((url) => {
          if (url) handleDeepLink({ url });
        });

        // Hide splash screen when everything is ready
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error("Initialization error:", error);
      }
    };

    initializeApp();

    return () => {
      // Clean up listeners if needed
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colorScheme === 'dark' ? DarkTheme.colors.background : DefaultTheme.colors.background,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="study-session" />
      <Stack.Screen name="resources" />
    </Stack>
  );
};