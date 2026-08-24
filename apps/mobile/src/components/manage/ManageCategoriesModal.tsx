import {
  Category,
  CategoryType,
  countCategoryTransactions,
  DEFAULT_CATEGORY_ICONS,
  i18n,
  resolveCategoryName,
  sortCategoriesByName,
  useCategories,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useHideCategoryMutation,
  useRestoreCategoryMutation,
  useTransactionsQuery,
  useUpdateCategoryMutation,
} from '@budgetaiapp/shared';
import { ChevronLeft, ChevronRight, Globe, Plus, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { categoryTypeOptions } from '../../lib/labels';
import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';
import SegmentedControl from '../SegmentedControl';
import EntryEditor, { EntryDraft } from './EntryEditor';

// Covers both directions: everyday spending plus the usual income sources.
const CATEGORY_ICONS = [
  '🍔', '🛒', '🚗', '🏠', '💡', '📱', '🎬', '✈️',
  '🏥', '👕', '🎓', '☕', '⛽', '🎁', '🐾', '🏋️',
  '💼', '💰', '📈', '🧾',
];

const NEW_CATEGORY = 'new' as const;

type ManageCategoriesModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function ManageCategoriesModal({ visible, onClose }: ManageCategoriesModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Unfiltered on purpose: the "Inactive Defaults" section below needs the
  // hidden rows too, and this same list backs old transactions whose category
  // may have since been hidden from new picks.
  const { categories } = useCategories();
  const { transactions } = useTransactionsQuery();
  const createCategoryMutation = useCreateCategoryMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();
  const deleteCategoryMutation = useDeleteCategoryMutation();
  const hideCategoryMutation = useHideCategoryMutation();
  const restoreCategoryMutation = useRestoreCategoryMutation();

  const [filter, setFilter] = useState<CategoryType>('expense');
  const [target, setTarget] = useState<Category | typeof NEW_CATEGORY | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isCreating = target === NEW_CATEGORY;
  const closeEditor = () => setTarget(null);

  const filtered = useMemo(
    () => categories.filter((category) => category.type === filter),
    [categories, filter],
  );
  const activeCategories = sortCategoriesByName(filtered.filter((category) => category.is_active !== false));
  const inactiveCategories = sortCategoriesByName(filtered.filter((category) => category.is_active === false));

  const usageCount = (categoryId: string) =>
    transactions.filter((row) => row.category_id === categoryId).length;

  // Renaming a default category severs it from its `translation_key` for
  // good, but changing only its icon or kind should not — that way "Reset to
  // default icon" keeps working and the name keeps following the app's
  // language, for as long as the user never touches it.
  const staysDefault = (original: Category, draft: EntryDraft<CategoryType>) =>
    !original.is_custom && Boolean(original.translation_key) && draft.name === resolveCategoryName(original);

  const handleSave = async (draft: EntryDraft<CategoryType>) => {
    setIsSaving(true);

    try {
      if (isCreating) {
        await createCategoryMutation.mutateAsync({ name: draft.name, type: draft.type, icon: draft.icon });
      } else if (target) {
        const keepsDefault = staysDefault(target, draft);

        await updateCategoryMutation.mutateAsync({
          id: target.id,
          input: {
            name: draft.name,
            type: draft.type,
            icon: draft.icon,
            is_custom: !keepsDefault,
            translation_key: keepsDefault ? target.translation_key : null,
          },
        });
      }

      closeEditor();
    } catch (error) {
      Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // Custom categories still hard-delete (with the usual "still in use" guard).
  // Defaults are soft-deleted instead — always safe, since hiding one never
  // touches the transactions that already point at it.
  const handleDeleteOrHide = () => {
    if (!target || isCreating) {
      return;
    }

    const entry = target;
    const displayName = resolveCategoryName(entry);

    if (!entry.is_custom) {
      Alert.alert(i18n.t('manage.hideTitle', { name: displayName }), i18n.t('manage.hideMessage'), [
        { text: i18n.t('addTransaction.cancel'), style: 'cancel' },
        {
          text: i18n.t('manage.hideCategory'),
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);

            try {
              await hideCategoryMutation.mutateAsync(entry.id);
              closeEditor();
            } catch (error) {
              Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]);
      return;
    }

    Alert.alert(i18n.t('manage.deleteTitle', { name: displayName }), i18n.t('manage.deleteMessage'), [
      { text: i18n.t('addTransaction.cancel'), style: 'cancel' },
      {
        text: i18n.t('transactionActions.delete'),
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);

          try {
            const used = await countCategoryTransactions(entry.id);

            if (used > 0) {
              Alert.alert(
                i18n.t('manage.inUseTitle'),
                i18n.t('manage.inUseMessage', { name: displayName, count: used }),
              );

              return;
            }

            await deleteCategoryMutation.mutateAsync(entry.id);
            closeEditor();
          } catch (error) {
            Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const handleRestore = (entry: Category) => {
    restoreCategoryMutation.mutate(entry.id, {
      onError: (error: Error) => Alert.alert(i18n.t('common.errorTitle'), error.message),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={target ? closeEditor : onClose}
      // Android Modal is a separate native root; gestures need their own provider.
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            {target ? (
              <EntryEditor
                // Remounts per row so the fields always start from the right values.
                key={isCreating ? NEW_CATEGORY : target.id}
                title={isCreating ? i18n.t('manage.newCategory') : i18n.t('manage.editCategory')}
                initial={
                  isCreating
                    ? { name: '', icon: '', type: filter, customColor: null }
                    : {
                        name: resolveCategoryName(target),
                        icon: target.icon ?? '',
                        type: target.type,
                        customColor: null,
                      }
                }
                defaultIcon={
                  !isCreating && target.translation_key ? DEFAULT_CATEGORY_ICONS[target.translation_key] : null
                }
                typeOptions={categoryTypeOptions()}
                iconChoices={CATEGORY_ICONS}
                isSaving={isSaving}
                onSave={handleSave}
                onDelete={isCreating ? undefined : handleDeleteOrHide}
                deleteLabel={!isCreating && !target.is_custom ? i18n.t('manage.hideCategory') : undefined}
                onCancel={closeEditor}
              />
            ) : (
              <>
                <View style={styles.header}>
                  <TouchableOpacity onPress={onClose} style={styles.headerSide}>
                    <ChevronLeft color={colors.tint} size={28} />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>{i18n.t('manage.categories')}</Text>
                  <View style={styles.headerSide} />
                </View>

                <SegmentedControl
                  options={categoryTypeOptions()}
                  value={filter}
                  onChange={setFilter}
                  style={styles.filter}
                />

                <ScrollView contentContainerStyle={styles.content}>
                  <Text style={styles.sectionTitle}>{i18n.t('manage.activeCategories')}</Text>

                  {activeCategories.length === 0 ? (
                    <Text style={styles.empty}>{i18n.t('manage.empty')}</Text>
                  ) : (
                    <View style={styles.card}>
                      {activeCategories.map((category, index) => (
                        <TouchableOpacity
                          key={category.id}
                          activeOpacity={0.6}
                          onPress={() => setTarget(category)}
                          style={[styles.row, index > 0 && styles.rowDivided]}>
                          <Text style={styles.rowIcon}>{category.icon}</Text>
                          <View style={styles.rowText}>
                            <View style={styles.rowNameLine}>
                              <Text style={styles.rowName} numberOfLines={1}>
                                {resolveCategoryName(category)}
                              </Text>
                              {!category.is_custom && (
                                <Globe
                                  color={colors.textMuted}
                                  size={13}
                                  accessibilityLabel={i18n.t('manage.translatable')}
                                />
                              )}
                            </View>
                            <Text style={styles.rowSubtitle} numberOfLines={1}>
                              {i18n.t('manage.usage', { count: usageCount(category.id) })}
                            </Text>
                          </View>
                          <ChevronRight color={colors.chevron} size={18} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {inactiveCategories.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
                        {i18n.t('manage.inactiveCategories')}
                      </Text>
                      <View style={styles.card}>
                        {inactiveCategories.map((category, index) => (
                          <View key={category.id} style={[styles.row, index > 0 && styles.rowDivided]}>
                            <Text style={[styles.rowIcon, styles.rowIconInactive]}>{category.icon}</Text>
                            <View style={styles.rowText}>
                              <Text style={styles.rowNameInactive} numberOfLines={1}>
                                {resolveCategoryName(category)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => handleRestore(category)}
                              style={styles.restoreButton}>
                              <RotateCcw color={colors.tint} size={14} />
                              <Text style={styles.restoreButtonText}>{i18n.t('manage.restore')}</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </ScrollView>

                <View style={styles.footer}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setTarget(NEW_CATEGORY)}
                    style={styles.addButton}>
                    <Plus color={colors.onBrand} size={20} />
                    <Text style={styles.addButtonText}>{i18n.t('manage.addCategory')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    gestureRoot: {
      flex: 1,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
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
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    filter: {
      margin: spacing.lg,
      marginBottom: 0,
    },
    content: {
      padding: spacing.lg,
      paddingTop: spacing.md,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: spacing.sm,
    },
    sectionTitleSpaced: {
      marginTop: spacing.xl,
    },
    empty: {
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    // A hairline glass edge stands in for the shadow the flat light-mode card used,
    // which disappears against a dark canvas.
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      paddingHorizontal: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET + 12,
    },
    rowDivided: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowIcon: {
      width: 28,
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
    },
    rowIconInactive: {
      opacity: 0.4,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowNameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rowName: {
      fontSize: 16,
      color: colors.text,
    },
    rowNameInactive: {
      fontSize: 16,
      color: colors.textMuted,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
    },
    restoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.brandSurface,
    },
    restoreButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.tint,
    },
    footer: {
      padding: spacing.lg,
      paddingTop: spacing.sm,
    },
    // `brand` rather than `tint`: a saturated indigo reads as a deliberate,
    // premium call to action in both modes instead of the flatter system blue.
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: TOUCH_TARGET + 6,
      backgroundColor: colors.brand,
      borderRadius: radius.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 3,
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onBrand,
    },
  });
}
