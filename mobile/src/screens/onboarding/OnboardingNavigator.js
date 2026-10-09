import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BillingDaysScreen from "./BillingDaysScreen";
import ConfirmPlansScreen from "./ConfirmPlansScreen";
import { OnboardingProvider } from "./OnboardingContext";
import SaveScreen from "./SaveScreen";
import SelectServicesScreen from "./SelectServicesScreen";
import SummaryScreen from "./SummaryScreen";
import WelcomeScreen from "./WelcomeScreen";

const Stack = createNativeStackNavigator();

// İlk açılış akışı. Kök stack'te "Onboarding" rotası olarak durur; taslak
// (route.params.draft) varsa seçimler oradan yüklenir, adım ise
// buildOnboardingRoute ile kurulan iç stack durumundan gelir.
export default function OnboardingNavigator({ route }) {
  return (
    <OnboardingProvider initialDraft={route.params?.draft}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SelectServices" component={SelectServicesScreen} />
        <Stack.Screen name="ConfirmPlans" component={ConfirmPlansScreen} />
        <Stack.Screen name="BillingDays" component={BillingDaysScreen} />
        <Stack.Screen name="Summary" component={SummaryScreen} />
        <Stack.Screen name="Save" component={SaveScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
