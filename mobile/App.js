import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import MainTabs from './src/navigation/MainTabs';
import LoginScreen from './src/screens/LoginScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SubscriptionDetailScreen from './src/screens/SubscriptionDetailScreen';
import { configurePurchases } from './src/services/purchases';
import { useTheme } from './src/theme';

configurePurchases();

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { authReady } = useAuth();

  if (!authReady) {
    return null;
  }

  // MainTabs her zaman kök ekran: katalog herkese açık olduğu için misafir de
  // sekmeler arasında gezinebilir. Login/Register, "Seç" gibi bir eylem
  // giriş gerektirdiğinde üstte modal olarak açılır ve başarılı girişte
  // navigation.goBack() ile kapanıp altındaki ekrana (Home/Profile/Catalog)
  // döner.
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetailScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}

function ThemedNavigationContainer() {
  const { colors, isDark } = useTheme();
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.divider,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemedNavigationContainer />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
