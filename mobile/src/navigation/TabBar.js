import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { tabIconPaths } from "./tabIcons";

function TabIcon({ name, color }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d={tabIconPaths[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TabBar({ state, descriptors, navigation }) {
  const { colors, brand } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 10,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const color = focused ? colors.text : colors.text2;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            style={{ flex: 1, alignItems: "center" }}
          >
            <View
              style={{
                width: 44,
                height: 3,
                borderRadius: 2,
                marginBottom: 8,
                backgroundColor: focused ? brand.safran : "transparent",
              }}
            />
            <TabIcon name={route.name} color={color} />
            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: focused ? "700" : "500",
                color,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
