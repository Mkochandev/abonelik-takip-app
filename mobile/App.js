import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReminderPromptHost } from './src/components';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import MainTabs from './src/navigation/MainTabs';
import GuestLimitScreen from './src/screens/GuestLimitScreen';
import LoginScreen from './src/screens/LoginScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import RefundStepsScreen from './src/screens/RefundStepsScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SubscriptionDetailScreen from './src/screens/SubscriptionDetailScreen';
import OnboardingNavigator from './src/screens/onboarding/OnboardingNavigator';
import { buildOnboardingRoute } from './src/screens/onboarding/steps';
import { refreshKivirikCount } from './src/services/kivirik';
import { configurePurchases } from './src/services/purchases';
import { configureNotifications, rescheduleAll, setReminderToken } from './src/services/reminders';
import { recordAppOpen } from './src/services/storeReview';
import { loadSubscriptions } from './src/services/subscriptionsSource';
import { isOnboardingDone, loadOnboardingDraft, setOnboardingDone } from './src/storage/onboarding';
import { useTheme } from './src/theme';

configurePurchases();
configureNotifications();

// Ödeme hatırlatmalarını açılışta, oturum değiştiğinde ve uygulama ön plana
// her geldiğinde baştan planlar (fiyat/gün değişiklikleri böylece yansır).
function useReminderSync() {
  const { authReady, token } = useAuth();

  // Kıvırık rozeti de aynı anlarda (açılış, oturum, ön plana dönüş) yenilenir.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!authReady) {
      return;
    }
    setReminderToken(token);
    rescheduleAll();
    refreshKivirikCount(token, { force: true });
  }, [authReady, token]);

  useEffect(() => {
    // Puanlama isteği için farklı açılış günleri sayılır.
    recordAppOpen();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        recordAppOpen();
        rescheduleAll();
        refreshKivirikCount(tokenRef.current, { force: true });
      }
    });
    return () => subscription.remove();
  }, []);
}

// Hatırlatma bildirimine dokununca (ör. "Bugün ... bırakmayı planlamıştın")
// ilgili aboneliğin detay ekranı açılır.
function useNotificationNavigation(navigationRef, ready) {
  const { token } = useAuth();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!ready) {
      return undefined;
    }

    async function openFromResponse(response) {
      const data = response?.notification?.request?.content?.data;
      if (!data?.subscriptionId) {
        return;
      }
      try {
        const subscriptions = await loadSubscriptions(tokenRef.current);
        const subscription = subscriptions.find((item) => item.id === data.subscriptionId);
        if (subscription && navigationRef.isReady()) {
          navigationRef.navigate('SubscriptionDetail', { subscription });
        }
      } catch (err) {
        // Liste yüklenemezse uygulama olduğu yerde açılır.
      }
    }

    // Uygulama kapalıyken dokunulduysa açılışta bir kez.
    Notifications.getLastNotificationResponseAsync().then(openFromResponse).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => subscription.remove();
  }, [ready]);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();

function RootNavigator() {
  // MainTabs her zaman kök ekran: katalog herkese açık olduğu için misafir de
  // sekmeler arasında gezinebilir. Login/Register, kullanıcı hesap
  // oluşturmak ya da giriş yapmak istediğinde üstte modal olarak açılır ve
  // başarılı girişte
  // navigation.goBack() ile kapanıp altındaki ekrana (Home/Profile/Catalog)
  // döner.
  //
  // Onboarding ilk açılışta (initialState ile) gösterilir ve bitince
  // navigation.reset ile MainTabs'a geçilir; Login/Register/Paywall
  // modalları onboarding sırasında da kullanılabilsin diye aynı stack'te.
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingNavigator}
        options={{ animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetailScreen} />
      <Stack.Screen name="RefundSteps" component={RefundStepsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="GuestLimit" component={GuestLimitScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}

// onboarding_done bayrağını ve yarım kalmış taslağı açılışta bir kez okur.
function useOnboardingBoot() {
  const [boot, setBoot] = useState(null);

  useEffect(() => {
    Promise.all([isOnboardingDone(), loadOnboardingDraft()]).then(([done, draft]) =>
      setBoot({ done, draft })
    );
  }, []);

  return boot;
}

function ThemedNavigationContainer() {
  const { colors, isDark } = useTheme();
  const { authReady, isAuthenticated, subscriptionCount } = useAuth();
  const onboardingBoot = useOnboardingBoot();
  useReminderSync();
  const navigationRef = useNavigationContainerRef();
  useNotificationNavigation(navigationRef, authReady && onboardingBoot !== null);
  const initialStateRef = useRef(undefined);
  const ready = authReady && onboardingBoot !== null;

  // Uygulamayı yeniden kuran, hâlâ oturumu açık ve sunucuda aboneliği olan
  // kullanıcıya onboarding gösterilmez.
  const skipForExistingUser =
    ready && !onboardingBoot.done && isAuthenticated && subscriptionCount > 0;

  useEffect(() => {
    if (skipForExistingUser) {
      setOnboardingDone().catch(() => {});
    }
  }, [skipForExistingUser]);

  if (!ready) {
    return null;
  }

  // Başlangıç durumu yalnızca ilk render'da hesaplanır; sonraki auth
  // değişiklikleri navigasyonu sıfırlamaz.
  if (initialStateRef.current === undefined) {
    const showOnboarding = !onboardingBoot.done && !skipForExistingUser;
    initialStateRef.current = showOnboarding
      ? { index: 0, routes: [buildOnboardingRoute(onboardingBoot.draft)] }
      : null;
  }

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
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      initialState={initialStateRef.current ?? undefined}
    >
      <RootNavigator />
      <ReminderPromptHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
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
