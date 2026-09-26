import { Children, Fragment } from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../theme";
import { Card } from "./Card";

export function GroupedList({ children, style }) {
  const { colors } = useTheme();
  const items = Children.toArray(children);

  return (
    <Card noPadding style={style}>
      {items.map((child, index) => (
        <Fragment key={child.key ?? index}>
          {child}
          {index < items.length - 1 && (
            <View style={{ height: 1, backgroundColor: colors.divider }} />
          )}
        </Fragment>
      ))}
    </Card>
  );
}

export function GroupedListRow({ children, onPress, style, disabled = false }) {
  const { spacing } = useTheme();
  const rowStyle = [
    {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 60,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.6 }]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{children}</View>;
}
