import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Chip, PillButton, SearchField, ServiceLogo } from "../../components";
import { CATEGORIES } from "../../config/categories";
import { useTheme } from "../../theme";
import { CatalogStatus, KivirikPrompt, OnboardingLayout } from "./OnboardingLayout";
import { useOnboarding } from "./OnboardingContext";

const COLUMNS = 3;

function CheckIcon({ color }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ServiceTile({ group, selected, width, onPress }) {
  const { colors, spacing, radius, brand } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={group.app_name}
      style={({ pressed }) => ({
        width,
        alignItems: "center",
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
        backgroundColor: colors.card,
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: selected ? brand.safran : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <ServiceLogo
        domain={group.domain}
        logoUrl={group.logo_url}
        name={group.app_name}
        category={group.plans[0]?.category}
        size={48}
      />
      <Text
        numberOfLines={1}
        style={{
          color: colors.text,
          fontSize: 13,
          fontWeight: "600",
          marginTop: spacing.sm,
          textAlign: "center",
        }}
      >
        {group.app_name}
      </Text>

      {selected ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: brand.safran,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckIcon color={brand.ink} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function SelectServicesScreen({ navigation }) {
  const { catalog, catalogLoading, catalogError, selectedApps, isSelected, toggleApp, finish } =
    useOnboarding();
  const { colors, spacing } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);

  const tileWidth = (screenWidth - spacing.md * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS;

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return catalog.filter(
      (group) =>
        (!category || group.plans.some((plan) => plan.category === category)) &&
        (!term || group.app_name.toLocaleLowerCase("tr-TR").includes(term))
    );
  }, [catalog, query, category]);

  const count = selectedApps.length;

  return (
    <OnboardingLayout
      step="SelectServices"
      footer={
        <>
          <PillButton
            title={`${count} seçildi · Devam`}
            disabled={count === 0}
            onPress={() => navigation.navigate("ConfirmPlans")}
          />
          <Text
            onPress={() => finish(navigation)}
            accessibilityRole="link"
            style={{
              color: colors.text2,
              fontSize: 13,
              textAlign: "center",
              opacity: 0.75,
              marginTop: spacing.md,
            }}
          >
            Önce uygulamayı gezeyim
          </Text>
        </>
      }
    >
      <View style={{ paddingHorizontal: spacing.md }}>
        <KivirikPrompt text="Hangi servisleri kullanıyorsun? Birden fazla seçebilirsin." />
        <SearchField value={query} onChangeText={setQuery} style={{ marginBottom: spacing.md }} />
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
          }}
        >
          <Chip label="Tümü" selected={category === null} onPress={() => setCategory(null)} />
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>
      </View>

      {catalogLoading || catalogError ? (
        <CatalogStatus />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(group) => group.app_name}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.text2, marginTop: spacing.xl }}>
              Sonuç bulunamadı
            </Text>
          }
          renderItem={({ item }) => (
            <ServiceTile
              group={item}
              width={tileWidth}
              selected={isSelected(item.app_name)}
              onPress={() => toggleApp(item.app_name)}
            />
          )}
        />
      )}
    </OnboardingLayout>
  );
}
