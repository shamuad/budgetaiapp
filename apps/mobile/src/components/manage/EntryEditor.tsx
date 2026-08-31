import {
  BrandEntry,
  getAccountCardColor,
  getFaviconUrl,
  i18n,
  isRemoteIcon,
  MAX_STATEMENT_DAY,
  MIN_STATEMENT_DAY,
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
  /** Only meaningful when the caller passed `groupOptions` — the 50/30/20 tier for an expense category. */
  group?: string | null;
  /** Only meaningful when the caller passed `showPaymentClue` — how a receipt names this account. */
  paymentClue?: string | null;
  /** Only meaningful when the caller passed `showCreditFacility` — revolving credit vs debit. */
  isCredit?: boolean;
  /** Inclusive cutoff 1–28. Only set when `isCredit`. */
  statementDay?: number | null;
};

type EntryEditorProps<T extends string> = {
  title: string;
  /** Values to start from: an existing row when editing, blanks when creating. */
  initial: EntryDraft<T>;
  /** The row's original icon, if known — shows a "Reset to default" link once it's been changed. */
  defaultIcon?: string | null;
  typeOptions: { id: T; label: string }[];
  /** Emoji offered by the picker. The first one stands in for a blank icon. */
  iconChoices: string[];
  /** When true, matches the name against `brandDictionary` and swaps in a favicon logo. */
  enableBrandDetect?: boolean;
  /**
   * Renders a required "Budget Group" segmented control (e.g. Needs/Wants)
   * while `type` equals `groupRequiredForType` — used only for expense
   * categories, which is why this stays a plain string rather than another
   * generic: there's exactly one caller that needs it.
   */
  groupOptions?: { id: string; label: string }[];
  groupRequiredForType?: T;
  /** Adds the optional receipt-matching field, which only accounts have. */
  showPaymentClue?: boolean;
  /** Adds debit/credit + statement day, shown only while the kind is `card`. */
  showCreditFacility?: boolean;
  isSaving: boolean;
  onSave: (draft: EntryDraft<T>) => void;
  /** Omitted while creating, since there is nothing to remove yet. */
  onDelete?: () => void;
  /** Overrides the bottom button's label — e.g. "Hide" instead of "Delete" for a soft-deletable row. */
  deleteLabel?: string;
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
  defaultIcon,
  typeOptions,
  iconChoices,
  enableBrandDetect = false,
  groupOptions,
  groupRequiredForType,
  showPaymentClue = false,
  showCreditFacility = false,
  isSaving,
  onSave,
  onDelete,
  deleteLabel,
  onCancel,
}: EntryEditorProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState(
    isRemoteIcon(initial.icon) ? iconChoices[0] : initial.icon || iconChoices[0],
  );
  const [type, setType] = useState<T>(initial.type);
  // Empty string, not null, so it never accidentally matches a real option id
  // and forces an explicit tap before a new expense category can be saved.
  const [group, setGroup] = useState(initial.group ?? '');
  const [paymentClue, setPaymentClue] = useState(initial.paymentClue ?? '');
  const [isCredit, setIsCredit] = useState(Boolean(initial.isCredit));
  const [statementDay, setStatementDay] = useState(
    initial.statementDay != null ? String(initial.statementDay) : '',
  );
  const showGroupRow = Boolean(groupOptions) && type === groupRequiredForType;
  const showCardFacility = showCreditFacility && type === 'card';
  const showStatementDay = showCardFacility && isCredit;
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

  const canResetIcon = Boolean(defaultIcon) && icon !== defaultIcon;

  const handleResetIcon = () => {
    setManualIcon(true);
    setIcon(defaultIcon!);
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

    if (showGroupRow && !group) {
      Alert.alert(i18n.t('common.errorTitle'), i18n.t('manage.missingGroup'));
      return;
    }

    let parsedStatementDay: number | null = null;

    if (showStatementDay) {
      parsedStatementDay = Number.parseInt(statementDay, 10);

      if (
        !Number.isInteger(parsedStatementDay) ||
        parsedStatementDay < MIN_STATEMENT_DAY ||
        parsedStatementDay > MAX_STATEMENT_DAY
      ) {
        Alert.alert(i18n.t('common.errorTitle'), i18n.t('manage.missingStatementDay'));
        return;
      }
    }

    onSave({
      name: trimmedName,
      icon: trimmedIcon,
      type,
      customColor: enableBrandDetect ? draftCustomColor : null,
      group: groupOptions ? group || null : undefined,
      paymentClue: showPaymentClue ? paymentClue.trim() || null : undefined,
      isCredit: showCreditFacility ? showCardFacility && isCredit : undefined,
      statementDay: showCreditFacility ? parsedStatementDay : undefined,
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

              {canResetIcon ? (
                <TouchableOpacity activeOpacity={0.6} onPress={handleResetIcon} style={styles.resetIconLink}>
                  <Text style={styles.resetIconText}>{i18n.t('manage.resetIcon')}</Text>
                </TouchableOpacity>
              ) : null}

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
            {showPaymentClue ? (
              <View style={[styles.row, styles.rowStacked]}>
                <Text style={styles.rowLabel}>{i18n.t('manage.paymentClue')}</Text>
                <TextInput
                  value={paymentClue}
                  onChangeText={setPaymentClue}
                  style={styles.rowInputStacked}
                  placeholder={i18n.t('manage.paymentCluePlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  // A clue is a card fragment or a brand, never a sentence.
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                <Text style={styles.rowCaption}>{i18n.t('manage.paymentClueHint')}</Text>
              </View>
            ) : null}
            {enableBrandDetect ? (
              <AccountColorPicker
                value={draftCustomColor}
                previewColor={previewCardColor}
                onChange={setDraftCustomColor}
                onReset={resetDraftCustomColor}
                accountName={name}
                faviconUri={
                  showBrandLogo && detectedBrand ? getFaviconUrl(detectedBrand.domain) : null
                }
              />
            ) : null}
            <View
              style={[
                styles.row,
                !showGroupRow && !showCardFacility && styles.rowLast,
                styles.rowStacked,
              ]}>
              <Text style={styles.rowLabel}>{i18n.t('manage.kind')}</Text>
              <SegmentedControl
                options={typeOptions}
                value={type}
                onChange={(next) => {
                  setType(next);
                  if (next !== 'card') {
                    setIsCredit(false);
                    setStatementDay('');
                  }
                }}
              />
            </View>
            {showCardFacility ? (
              <View
                style={[
                  styles.row,
                  !showStatementDay && !showGroupRow && styles.rowLast,
                  styles.rowStacked,
                ]}>
                <Text style={styles.rowLabel}>{i18n.t('manage.cardFacility')}</Text>
                <SegmentedControl
                  options={[
                    { id: 'debit', label: i18n.t('manage.debit') },
                    { id: 'credit', label: i18n.t('manage.credit') },
                  ]}
                  value={isCredit ? 'credit' : 'debit'}
                  onChange={(next) => {
                    const credit = next === 'credit';
                    setIsCredit(credit);
                    if (!credit) {
                      setStatementDay('');
                    }
                  }}
                />
              </View>
            ) : null}
            {showStatementDay ? (
              <View style={[styles.row, !showGroupRow && styles.rowLast, styles.rowStacked]}>
                <Text style={styles.rowLabel}>{i18n.t('manage.statementDay')}</Text>
                <TextInput
                  value={statementDay}
                  onChangeText={(text) => setStatementDay(text.replace(/[^\d]/g, '').slice(0, 2))}
                  style={styles.rowInputStacked}
                  placeholder={i18n.t('manage.statementDayPlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  keyboardType="number-pad"
                  maxLength={2}
                  returnKeyType="done"
                />
                <Text style={styles.rowCaption}>{i18n.t('manage.statementDayHint')}</Text>
              </View>
            ) : null}
            {showGroupRow ? (
              <View style={[styles.row, styles.rowLast, styles.rowStacked]}>
                <Text style={styles.rowLabel}>{i18n.t('manage.budgetGroup')}</Text>
                <SegmentedControl options={groupOptions!} value={group} onChange={setGroup} />
              </View>
            ) : null}
          </View>

          {onDelete && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onDelete}
              style={styles.delete}
              disabled={isSaving}>
              <Text style={styles.deleteText}>{deleteLabel ?? i18n.t('transactionActions.delete')}</Text>
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
    resetIconLink: {
      alignSelf: 'center',
    },
    resetIconText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.tint,
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
    // A stacked row puts its label above the field, so this one reads from the
    // left edge instead of hugging the right the way the inline rows do.
    rowInputStacked: {
      fontSize: 16,
      color: colors.text,
    },
    rowCaption: {
      fontSize: 13,
      color: colors.textMuted,
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
