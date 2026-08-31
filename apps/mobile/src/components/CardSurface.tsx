import type { CardAppearance } from '@budgetaiapp/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ColorValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type CardSurfaceProps = {
  appearance: CardAppearance;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Renders a wallet card background as flat color or a linear gradient. */
export default function CardSurface({ appearance, style, children }: CardSurfaceProps) {
  if (appearance.kind === 'gradient') {
    return (
      <LinearGradient
        colors={appearance.colors as [ColorValue, ColorValue, ...ColorValue[]]}
        start={angleToStart(appearance.angle)}
        end={angleToEnd(appearance.angle)}
        style={[styles.fill, style]}>
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: appearance.color }, style]}>{children}</View>
  );
}

function angleToStart(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: 0.5 - Math.cos(radians) * 0.5,
    y: 0.5 - Math.sin(radians) * 0.5,
  };
}

function angleToEnd(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: 0.5 + Math.cos(radians) * 0.5,
    y: 0.5 + Math.sin(radians) * 0.5,
  };
}

const styles = StyleSheet.create({
  fill: {
    overflow: 'hidden',
  },
});
