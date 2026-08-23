import {
  BrandEntry,
  getAccountCardColor,
  getFaviconUrl,
  i18n,
  isRemoteIcon,
  resolveBrand,
  useAppStore,
} from '@budgetaiapp/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';
import AccountColorPicker from './AccountColorPicker';
import SegmentedControl from '../SegmentedControl';

export type EntryDraft<T extends string> = {
  name: string;
  icon: string;
  type: T;
  customColor?: string | null;
};

type EntryEditorProps<T extends string> = {
  title: string;
  /** Values to start from: an existing row when editing, blanks when creating. */
  initial: EntryDraft<T>;
  typeOptions: { id: T; label: string }[];
  /** Emoji offered by the picker. The first one stands in for a blank icon. */
  iconChoices: string[];
  /** When true, matches the name against `brandDictionary` and swaps in a favicon logo. */
  enableBrandDetect?: boolean;
  isSaving: boolean;
  onSave: (draft: EntryDraft<T>) => void;
  /** Omitted while creating, since there is nothing to remove yet. */
  onDelete?: () => void;
  onCancel: () => void;
};

function initialBrand(name: string, icon: string, enabled: boolean): BrandEntry | null {
  if (!enabled) {
    return null;
  }

  return resolveBrand(name) ?? (isRemoteIcon(icon) ? resolveBrand(name) : null);
}

function initialManualIcon(name: string, icon: string, enabled: boolean): boolean {
  if (!enabled) {
    return false;
  }

  if (isRemoteIcon(icon)) {
    return false;
  }

  return Boolean(icon && !resolveBrand(name));
}

/**
 * Name, icon and type form shared by the account and category editors.
 * Accounts can opt into smart brand detection from the name field.
 */
export default function EntryEditor<T extends string>({
  title,
  initial,
  typeOptions,
  iconChoices,
  enableBrandDetect = false,
  isSaving,
  onSave,
  onDelete,
  onCancel,
}: EntryEditorProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState(
    isRemoteIcon(initial.icon) ? iconChoices[0] : initial.icon || iconChoices[0],
  );
  const [type, setType] = useState<T>(initial.type);
  const [detectedBrand, setDetectedBrand] = useState<BrandEntry | null>(() =>
    initialBrand(initial.name, initial.icon, enableBrandDetect),
  );
  const [manualIcon, setManualIcon] = useState(() =>
    initialManualIcon(initial.name, initial.icon, enableBrandDetect),
  );
  const [logoFailed, setLogoFailed] = useState(false);

  const draftCustomColor = useAppStore((state) => state.draftAccountCustomColor);
  const setDraftCustomColor = useAppStore((state) => state.setDraftAccountCustomColor);
  const resetDraftCustomColor = useAppStore((state) => state.resetDraftAccountCustomColor);

  useEffect(() => {
    if (!enableBrandDetect) {
      return;
    }

    setDraftCustomColor(initial.customColor ?? null);

    return () => {
      resetDraftCustomColor();
    };
  }, [enableBrandDetect, initial.customColor, resetDraftCustomColor, setDraftCustomColor]);

  const previewCardColor = getAccountCardColor({
    name,
    type: type as never,
    custom_color: draftCustomColor,
  });

  const previewLogoColor =
    draftCustomColor ?? detectedBrand?.color ?? previewCardColor;

  const previewOpacity = useRef(new Animated.Value(1)).current;
  const previewScale = useRef(new Animated.Value(1)).current;

  const showBrandLogo = enableBrandDetect && detectedBrand !== null && !manualIcon;

  const animatePreviewSwap = useCallback(
    (apply: () => void) => {
      Animated.parallel([
        Animated.timing(previewOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(previewScale, {
          toValue: 0.92,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }

        apply();

        Animated.parallel([
          Animated.timing(previewOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(previewScale, {
            toValue: 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [previewOpacity, previewScale],
  );

  const handleNameChange = (text: string) => {
    setName(text);

    if (!enableBrandDetect) {
      return;
    }

    const brand = resolveBrand(text);

    if (brand) {
      setLogoFailed(false);
      animatePreviewSwap(() => {
        setDetectedBrand(brand);
        setManualIcon(false);
      });
      return;
    }

    if (detectedBrand) {
      animatePreviewSwap(() => {
        setDetectedBrand(null);
      });
    }
  };

  const handleManualIconPick = (choice: string) => {
    setManualIcon(true);
    setIcon(choice);
    animatePreviewSwap(() => setDetectedBrand(null));
  };

  const handleUseCustomIcon = () => {
    setManualIcon(true);
    animatePreviewSwap(() => setDetectedBrand(null));
  };

  useEffect(() => {
    setLogoFailed(false);
  }, [detectedBrand?.domain]);

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedIcon = showBrandLogo
      ? getFaviconUrl(detectedBrand!.domain)
      : icon.trim();

    if (!trimmedName) {
      Alert.alert(i18n.t('common.errorTitle'), i18n.t('manage.missingName'));
      return;
    }

    if (!trimmedIcon) {
      Alert.alert(i18n.t('common.errorTitle'), i18n.t('manage.missingIcon'));
      return;
    }

    onSave({
      name: trimmedName,
      icon: trimmedIcon,
      type,
      customColor: enableBrandDetect ? draftCustomColor : null,
    });
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerSide} disabled={isSaving}>
          <Text style={styles.headerAction}>{i18n.t('addTransaction.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerSide, styles.headerSideEnd]}
          disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Text style={[styles.headerAction, styles.headerActionStrong]}>
              {i18n.t('addTransaction.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[
              styles.previewWrap,
              { opacity: previewOpacity, transform: [{ scale: previewScale }] },
            ]}>
            {showBrandLogo ? (
              <View
                style={[
                  styles.brandCircle,
                  { backgroundColor: previewLogoColor },
                ]}>
                <View style={styles.brandLogoWell}>
                  {!logoFailed ? (
                    <Image
                      source={{ uri: getFaviconUrl(detectedBrand!.domain) }}
                      style={styles.brandLogo}
                      onError={() => setLogoFailed(true)}
                    />
                  ) : (
                    <Text style={styles.brandFallback}>{detectedBrand!.name.charAt(0)}</Text>
                  )}
                </View>
              </View>
            ) : (
              <TextInput
                value={icon}
                onChangeText={(text) => {
                  setManualIcon(true);
                  setIcon(text);
                }}
                style={styles.iconInput}
                textAlign="center"
                placeholder="🙂"
                placeholderTextColor={colors.placeholderFaint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            )}
          </Animated.View>

          {showBrandLogo ? (
            <View style={styles.brandMeta}>
              <Text style={styles.brandTitle}>
                {i18n.t('manage.brandDetected', { name: detectedBrand!.name })}
              </Text>
              <Text style={styles.brandHint}>{i18n.t('manage.brandDetectedHint')}</Text>
              <TouchableOpacity activeOpacity={0.6} onPress={handleUseCustomIcon}>
                <Text style={styles.brandLink}>{i18n.t('manage.useCustomIcon')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.iconHint}>{i18n.t('manage.iconHint')}</Text>

              <View style={styles.iconGrid}>
                {iconChoices.map((choice) => (
                  <TouchableOpacity
                    key={choice}
                    activeOpacity={0.6}
                    onPress={() => handleManualIconPick(choice)}
                    style={[styles.iconChip, choice === icon && styles.iconChipSelected]}>
                    <Text style={styles.iconChipText}>{choice}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{i18n.t('manage.name')}</Text>
              <TextInput
                value={name}
                onChangeText={handleNameChange}
                style={styles.rowInput}
                placeholder={i18n.t('manage.namePlaceholder')}
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
            {enableBrandDetect ? (
              <AccountColorPicker
                value={draftCustomColor}
                previewColor={previewCardColor}
                onChange={setDraftCustomColor}
                onReset={resetDraftCustomColor}
              />
            ) : null}
            <View style={[styles.row, styles.rowLast, styles.rowStacked]}>
              <Text style={styles.rowLabel}>{i18n.t('manage.kind')}</Text>
              <SegmentedControl options={typeOptions} value={type} onChange={setType} />
            </View>
          </View>

          {onDelete && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onDelete}
              style={styles.delete}
              disabled={isSaving}>
              <Text style={styles.deleteText}>{i18n.t('transactionActions.delete')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerSide: {
      flex: 1,
      minHeight: TOUCH_TARGET,
      justifyContent: 'center',
    },
    headerSideEnd: {
      alignItems: 'flex-end',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    headerAction: {
      fontSize: 17,
      color: colors.tint,
    },
    headerActionStrong: {
      fontWeight: '600',
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    previewWrap: {
      alignSelf: 'center',
    },
    iconInput: {
      width: 88,
      height: 88,
      fontSize: 40,
      lineHeight: 48,
      color: colors.text,
      backgroundColor: colors.surface,
      borderRadius: 44,
    },
    brandCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 6,
    },
    brandLogoWell: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    brandLogo: {
      width: 36,
      height: 36,
      borderRadius: 8,
    },
    brandFallback: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    brandMeta: {
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: -spacing.sm,
    },
    brandTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    brandHint: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    brandLink: {
      marginTop: spacing.xs,
      fontSize: 14,
      fontWeight: '500',
      color: colors.tint,
    },
    iconHint: {
      marginTop: -spacing.sm,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
    },
    iconChip: {
      width: TOUCH_TARGET,
      height: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: TOUCH_TARGET / 2,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: colors.background,
    },
    iconChipSelected: {
      borderColor: colors.tint,
      backgroundColor: colors.brandSurface,
    },
    iconChipText: {
      fontSize: 22,
      lineHeight: 26,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET + 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLabel: {
      fontSize: 16,
      color: colors.text,
    },
    rowInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      textAlign: 'right',
    },
    delete: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: TOUCH_TARGET + 8,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
    },
    deleteText: {
      fontSize: 16,
      color: colors.dangerText,
    },
  });
}
