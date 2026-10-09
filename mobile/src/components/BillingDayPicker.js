import { Pressable, Text, View } from "react-native";

import { fontFamily, useTheme } from "../theme";
import { MONTH_NAMES, maxDayOfMonth } from "../utils/billing";

const COLUMNS = 7;
const MONTH_COLUMNS = 4;

function GridButton({ label, selected, onPress, accessibilityLabel, columns }) {
  const { colors } = useTheme();

  return (
    <View style={{ width: `${100 / columns}%`, padding: 3 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.primary : colors.field,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: fontFamily.bold,
            fontSize: 15,
            fontVariant: ["tabular-nums"],
            color: selected ? colors.onPrimary : colors.text,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

// Ödeme günü seçici: aylık planda 1–31 hızlı seçim, yıllıkta önce ay sonra
// gün (gün listesi seçilen ayın uzunluğuna göre kısalır). Onboarding'deki
// gün adımı, ekleme sayfası ve eksik gün akışı bu bileşeni paylaşır.
// onChange({ day, month }) — aylıkta month her zaman null.
export function BillingDayPicker({ yearly = false, day, month, onChange }) {
  const { colors, spacing } = useTheme();
  const maxDay = yearly && month ? maxDayOfMonth(month) : 31;

  function selectMonth(nextMonth) {
    // Önceden seçilen gün yeni ayda yoksa ayın son gününe çekilir.
    const nextDay = day ? Math.min(day, maxDayOfMonth(nextMonth)) : null;
    onChange({ day: nextDay, month: nextMonth });
  }

  function selectDay(nextDay) {
    onChange({ day: nextDay, month: yearly ? month ?? null : null });
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {yearly ? (
        <>
          <Text style={{ color: colors.text2, fontSize: 13, fontWeight: "600" }}>Ay</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -3 }}>
            {MONTH_NAMES.map((name, index) => (
              <GridButton
                key={name}
                label={name.slice(0, 3)}
                accessibilityLabel={name}
                selected={month === index + 1}
                onPress={() => selectMonth(index + 1)}
                columns={MONTH_COLUMNS}
              />
            ))}
          </View>
          <Text style={{ color: colors.text2, fontSize: 13, fontWeight: "600", marginTop: spacing.xs }}>
            Gün
          </Text>
        </>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -3 }}>
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((value) => (
          <GridButton
            key={value}
            label={String(value)}
            selected={day === value}
            onPress={() => selectDay(value)}
            columns={COLUMNS}
          />
        ))}
      </View>

      {day >= 29 ? (
        <Text style={{ color: colors.text2, fontSize: 12.5 }}>
          Bu gün olmayan aylarda ödeme ayın son günü sayılır.
        </Text>
      ) : null}
    </View>
  );
}
