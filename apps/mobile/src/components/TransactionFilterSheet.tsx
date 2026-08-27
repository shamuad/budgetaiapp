import {
  Category,
  formatDate,
  getCategoryColor,
  i18n,
  resolveCategoryName,
  sortCategoriesByName,
} from '@budgetaiapp/shared';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Calendar, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { getPeriodRange } from '../lib/analyticsPeriod';
import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

export type TransactionFilterDraft = {
  categoryIds: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
};

type DatePreset = 'week' | 'month' | 'year' | 'all';

function datePresetOptions(): { id: DatePreset; label: string }[] {
  return [
    { id: 'week', label: i18n.t('transactions.filterThisWeek') },
    { id: 'month', label: i18n.t('transactions.filterThisMonth') },
    { id: 'year', label: i18n.t('transactions.filterThisYear') },
    { id: 'all', label: i18n.t('transactions.filterAllTime') },
  ];
}

// `getPeriodRange`'s `end` is the exclusive start of the *next* period (local
// midnight) — shifting back one calendar day gives the last inclusive day,
// which is how `dateTo` is compared everywhere else in this sheet/screen.
// The plain Date constructor normalizes day 0 to "last day of the previous
// month", so this also holds correctly across month/year boundaries.
function lastInclusiveDay(end: Date): Date {
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
}

function presetRange(preset: Exclude<DatePreset, 'all'>): { dateFrom: Date; dateTo: Date } {
  const { start, end } = getPeriodRange(preset, new Date());
  return { dateFrom: start, dateTo: lastInclusiveDay(end) };
}

// Reads which quick-select preset (if any) the current draft dates match, so
// the pill row stays in sync no matter how the dates were set.
function matchPreset(dateFrom: Date | null, dateTo: Date | null): DatePreset | null {
  if (dateFrom === null && dateTo === null) {
    return 'all';
  }

  for (const preset of ['week', 'month', 'year'] as const) {
    const range = presetRange(preset);
    if (dateFrom?.getTime() === range.dateFrom.getTime() && dateTo?.getTime() === range.dateTo.getTime()) {
      return preset;
    }
  }

  return null;
}

type TransactionFilterSheetProps = {
  visible: boolean;
  categories: Category[];
  value: TransactionFilterDraft;
  onApply: (draft: TransactionFilterDraft) => void;
  onClose: () => void;
};

type ActivePicker = 'from' | 'to' | null;

/**
 * Category + date-range filters for the Transactions list. Mirrors the
 * Modal/backdrop/SafeAreaView bottom-sheet pattern already used by
 * `OptionsModal`, so no new bottom-sheet dependency is introduced.
 */
export default function TransactionFilterSheet({
  visible,
  categories,
  value,
  onApply,
  onClose,
}: TransactionFilterSheetProps) {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draft, setDraft] = useState<TransactionFilterDraft>(value);
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Re-seeds the draft from the applied filters every time the sheet opens,
  // so a dismissed edit never leaks into the next time it's opened. Only
  // auto-expands the custom range section when the applied dates don't match
  // any quick-select preset, so a plain "This Month" filter opens tidy.
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setActivePicker(null);
      setIsCustomOpen(
        matchPreset(value.dateFrom, value.dateTo) === null && (value.dateFrom !== null || value.dateTo !== null),
      );
    }
  }, [visible, value]);

  // Hidden (soft-deleted) defaults stay out of the filter chips too — same
  // active-only rule as the "New Transaction" picker.
  const expenseCategories = useMemo(
    () => sortCategoriesByName(categories.filter((c) => c.type === 'expense' && c.is_active !== false)),
    [categories],
  );
  const incomeCategories = useMemo(
    () => sortCategoriesByName(categories.filter((c) => c.type === 'income' && c.is_active !== false)),
    [categories],
  );
  const activePreset = useMemo(() => matchPreset(draft.dateFrom, draft.dateTo), [draft.dateFrom, draft.dateTo]);

  function toggleCategory(id: string) {
    setDraft((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(id)
        ? current.categoryIds.filter((existing) => existing !== id)
        : [...current.categoryIds, id],
    }));
  }

  function selectPreset(preset: DatePreset) {
    setActivePicker(null);
    setDraft((current) => ({
      ...current,
      ...(preset === 'all' ? { dateFrom: null, dateTo: null } : presetRange(preset)),
    }));
  }

  function handleDateChange(field: 'from' | 'to') {
    return (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
      setDraft((current) => ({ ...current, [field === 'from' ? 'dateFrom' : 'dateTo']: selectedDate }));

      if (Platform.OS === 'android') {
        setActivePicker(null);
      }
    };
  }

  function clearDate(field: 'from' | 'to') {
    setDraft((current) => ({ ...current, [field === 'from' ? 'dateFrom' : 'dateTo']: null }));
  }

  function handleReset() {
    setDraft({ categoryIds: [], dateFrom: null, dateTo: null });
    setActivePicker(null);
    setIsCustomOpen(false);
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaProvider>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={['bottom']} style={styles.sheet}>
              <View style={styles.grabber} />
              <Text style={styles.title}>{i18n.t('transactions.filterTitle')}</Text>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {expenseCategories.length > 0 && (
                  <FilterSection
                    label={i18n.t('transactions.filterCategoriesExpense')}
                    categories={expenseCategories}
                    type="expense"
                    selectedIds={draft.categoryIds}
                    onToggle={toggleCategory}
                    styles={styles}
                    colors={colors}
                  />
                )}

                {incomeCategories.length > 0 && (
                  <FilterSection
                    label={i18n.t('transactions.filterCategoriesIncome')}
                    categories={incomeCategories}
                    type="income"
                    selectedIds={draft.categoryIds}
                    onToggle={toggleCategory}
                    styles={styles}
                    colors={colors}
                  />
                )}

                <Text style={styles.sectionLabel}>{i18n.t('transactions.filterDateRange')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                  <View style={styles.presetRow}>
                    {datePresetOptions().map((option) => {
                      const isSelected = activePreset === option.id;

                      return (
                        <TouchableOpacity
                          key={option.id}
                          activeOpacity={0.7}
                          onPress={() => selectPreset(option.id)}
                          style={[styles.presetPill, isSelected && styles.presetPillActive]}>
                          <Text style={[styles.presetPillLabel, isSelected && styles.presetPillLabelActive]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setIsCustomOpen((current) => !current)}
                  style={styles.customToggle}>
                  <Text style={styles.customToggleText}>{i18n.t('transactions.filterCustomRange')}</Text>
                  {isCustomOpen ? (
                    <ChevronUp color={colors.textMuted} size={16} />
                  ) : (
                    <ChevronDown color={colors.textMuted} size={16} />
                  )}
                </TouchableOpacity>

                {isCustomOpen && (
                  <>
                    <View style={styles.dateRow}>
                      <DateField
                        label={i18n.t('transactions.filterFrom')}
                        date={draft.dateFrom}
                        isActive={activePicker === 'from'}
                        onPress={() => setActivePicker(activePicker === 'from' ? null : 'from')}
                        onClear={() => clearDate('from')}
                        styles={styles}
                        colors={colors}
                      />
                      <DateField
                        label={i18n.t('transactions.filterTo')}
                        date={draft.dateTo}
                        isActive={activePicker === 'to'}
                        onPress={() => setActivePicker(activePicker === 'to' ? null : 'to')}
                        onClear={() => clearDate('to')}
                        styles={styles}
                        colors={colors}
                      />
                    </View>

                    {activePicker && (
                      <View style={styles.pickerCard}>
                        <DateTimePicker
                          value={(activePicker === 'from' ? draft.dateFrom : draft.dateTo) ?? new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          themeVariant={scheme}
                          onValueChange={handleDateChange(activePicker)}
                          onDismiss={() => setActivePicker(null)}
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity style={styles.pickerDone} onPress={() => setActivePicker(null)}>
                            <Text style={styles.pickerDoneText}>{i18n.t('addTransaction.done')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity activeOpacity={0.7} onPress={handleReset} style={styles.resetButton}>
                  <Text style={styles.resetButtonText}>{i18n.t('transactions.filterReset')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={handleApply} style={styles.applyButton}>
                  <Text style={styles.applyButtonText}>{i18n.t('transactions.filterApply')}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </SafeAreaProvider>
    </Modal>
  );
}

type SheetStyles = ReturnType<typeof createStyles>;

function FilterSection({
  label,
  categories,
  type,
  selectedIds,
  onToggle,
  styles,
  colors,
}: {
  label: string;
  categories: Category[];
  type: 'expense' | 'income';
  selectedIds: string[];
  onToggle: (id: string) => void;
  styles: SheetStyles;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {categories.map((category) => {
          const isSelected = selectedIds.includes(category.id);
          const accent = getCategoryColor(category.name, type, category.color_code);

          return (
            <TouchableOpacity
              key={category.id}
              activeOpacity={0.7}
              onPress={() => onToggle(category.id)}
              style={[
                styles.chip,
                { borderColor: isSelected ? accent : colors.borderGlass },
                isSelected && { backgroundColor: `${accent}26` },
              ]}>
              {category.icon ? <Text style={styles.chipIcon}>{category.icon}</Text> : null}
              <Text style={[styles.chipLabel, isSelected && { color: colors.text, fontWeight: '700' }]}>
                {resolveCategoryName(category)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DateField({
  label,
  date,
  isActive,
  onPress,
  onClear,
  styles,
  colors,
}: {
  label: string;
  date: Date | null;
  isActive: boolean;
  onPress: () => void;
  onClear: () => void;
  styles: SheetStyles;
  colors: ColorTokens;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.dateField, isActive && { borderColor: colors.brand }]}>
      <Calendar color={colors.textMuted} size={16} />
      <View style={styles.dateFieldTexts}>
        <Text style={styles.dateFieldLabel}>{label}</Text>
        <Text style={styles.dateFieldValue}>
          {date ? formatDate(date, 'short') : i18n.t('transactions.filterAnyDate')}
        </Text>
      </View>
      {date && (
        <TouchableOpacity hitSlop={8} onPress={onClear}>
          <X color={colors.textMuted} size={16} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      maxHeight: '85%',
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      marginTop: spacing.sm,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    title: {
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      gap: spacing.lg,
      paddingBottom: spacing.md,
    },
    section: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      backgroundColor: colors.surfaceElevated,
    },
    chipIcon: {
      fontSize: 14,
    },
    chipLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
    },
    presetScroll: {
      flexGrow: 0,
    },
    presetRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    presetPill: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
    },
    presetPillActive: {
      backgroundColor: colors.brand,
    },
    presetPillLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    presetPillLabelActive: {
      color: colors.onBrand,
    },
    customToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      paddingVertical: spacing.xs,
    },
    customToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.tint,
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dateField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.borderGlass,
      backgroundColor: colors.surfaceElevated,
    },
    dateFieldTexts: {
      flex: 1,
      gap: 2,
    },
    dateFieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    dateFieldValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    pickerCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      paddingHorizontal: spacing.lg,
    },
    pickerDone: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pickerDoneText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.tint,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    resetButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: TOUCH_TARGET,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
    },
    resetButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    applyButton: {
      flex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: TOUCH_TARGET,
      borderRadius: radius.lg,
      backgroundColor: colors.brand,
    },
    applyButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.onBrand,
    },
  });
}
