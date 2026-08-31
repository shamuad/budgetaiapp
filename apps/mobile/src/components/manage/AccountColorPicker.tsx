import {
  gradientMatchesPreset,
  i18n,
  parseCustomColor,
  PREMIUM_CARD_GRADIENTS,
  resolveBrand,
  serializeGradient,
  type CardAppearance,
} from '@budgetaiapp/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ColorValue,
} from 'react-native';

import CardSurface from '../CardSurface';
import { spacing } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';
import HueColorPicker from './HueColorPicker';

type AccountColorPickerProps = {
  value: string | null;
  previewColor: string;
  onChange: (color: string | null) => void;
  onReset: () => void;
  /** Shown on the static card preview — typically the draft account name. */
  accountName?: string;
  /** Optional institution logo for the preview card. */
  faviconUri?: string | null;
};

export default function AccountColorPicker({
  value,
  previewColor,
  onChange,
  onReset,
  accountName = '',
  faviconUri = null,
}: AccountColorPickerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const brand = resolveBrand(accountName);
  const previewTitle = brand?.name ?? (accountName.trim() || i18n.t('manage.name'));
  const showFavicon = Boolean(faviconUri) && !faviconFailed;

  useEffect(() => {
    setFaviconFailed(false);
  }, [faviconUri]);

  const parsedCustom = parseCustomColor(value);
  const previewAppearance = useMemo((): CardAppearance => {
    if (parsedCustom) {
      return parsedCustom;
    }

    return { kind: 'flat', color: previewColor };
  }, [parsedCustom, previewColor]);

  const sliderColor =
    parsedCustom?.kind === 'flat' ? parsedCustom.color : previewAppearance.kind === 'flat'
      ? previewAppearance.color
      : previewAppearance.colors[0];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.label}>{i18n.t('manage.cardColor')}</Text>
        {value ? (
          <TouchableOpacity activeOpacity={0.6} onPress={onReset}>
            <Text style={styles.reset}>{i18n.t('manage.useBankColor')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <HueColorPicker color={sliderColor} onChange={(hex) => onChange(hex)} />

      <Text style={styles.premiumLabel}>{i18n.t('manage.premiumGradients')}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}>
        {PREMIUM_CARD_GRADIENTS.map((preset) => {
          const selected = gradientMatchesPreset(parsedCustom, preset);

          return (
            <TouchableOpacity
              key={preset.id}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={i18n.t(`manage.${preset.labelKey}`)}
              accessibilityState={{ selected }}
              onPress={() => onChange(serializeGradient(preset))}
              style={[styles.presetButton, selected && styles.presetButtonSelected]}>
              <LinearGradient
                colors={preset.colors as unknown as [ColorValue, ColorValue, ...ColorValue[]]}
                start={angleToUnit(preset.angle, -1)}
                end={angleToUnit(preset.angle, 1)}
                style={styles.presetSwatch}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.previewLabel}>{i18n.t('manage.cardPreview')}</Text>

      <View
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel={i18n.t('manage.cardPreview')}>
        <CardSurface appearance={previewAppearance} style={styles.previewCard}>
          <View style={styles.previewSheen} />
          <View style={styles.previewChip} />

          <View style={styles.previewTopRow}>
            <Text style={styles.previewInstitution} numberOfLines={1}>
              {previewTitle}
            </Text>

            <View style={styles.previewBrandMark}>
              {showFavicon ? (
                <Image
                  source={{ uri: faviconUri! }}
                  style={styles.previewFavicon}
                  onError={() => setFaviconFailed(true)}
                />
              ) : (
                <Wallet color={colors.onBrand} size={16} strokeWidth={2} />
              )}
            </View>
          </View>

          <Text style={styles.previewPan}>•••• ••••</Text>
        </CardSurface>
      </View>
    </View>
  );
}

function angleToUnit(angle: number, direction: -1 | 1) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: 0.5 + Math.cos(radians) * 0.5 * direction,
    y: 0.5 + Math.sin(radians) * 0.5 * direction,
  };
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    section: {
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    premiumLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    reset: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.tint,
    },
    presetRow: {
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    presetButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      padding: 2,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    presetButtonSelected: {
      borderColor: colors.tint,
    },
    presetSwatch: {
      flex: 1,
      borderRadius: 20,
    },
    previewLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    previewCard: {
      aspectRatio: 200 / 126,
      borderRadius: 18,
      padding: spacing.lg,
      justifyContent: 'space-between',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    previewSheen: {
      position: 'absolute',
      top: -48,
      right: -32,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    previewChip: {
      position: 'absolute',
      top: spacing.lg + 28,
      left: spacing.lg,
      width: 34,
      height: 24,
      borderRadius: 5,
      backgroundColor: 'rgba(255, 255, 255, 0.28)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.35)',
    },
    previewTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    previewInstitution: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      color: colors.onBrand,
    },
    previewBrandMark: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    previewFavicon: {
      width: 18,
      height: 18,
      borderRadius: 4,
    },
    previewPan: {
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 1.6,
      color: 'rgba(255, 255, 255, 0.72)',
    },
  });
}
