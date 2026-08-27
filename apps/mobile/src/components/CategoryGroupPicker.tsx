import {
  BUDGET_GROUP_TONE,
  budgetGroupLabel,
  Category,
  CategoryType,
  getCategoryColor,
  groupCategoriesByBudgetGroup,
  i18n,
  isRemoteIcon,
  resolveCategoryName,
  sortCategoriesByName,
} from '@budgetaiapp/shared';
import { Check, ChevronLeft, Sparkles } from 'lucide-react-native';
import { useMemo } from 'react';
import { Image, Modal, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { categoryTypeOptions } from '../lib/labels';
import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import SegmentedControl from './SegmentedControl';

type CategorySection = {
  group: string;
  title: string | null;
  tone: string | null;
  data: Category[];
};

type CategoryGroupPickerProps = {
  visible: boolean;
  categories: Category[];
  selectedId?: string;
  /** The category `ask-gemini` just suggested for the title being typed, so its row can carry a sparkle. */
  suggestedId?: string | null;
  tab: CategoryType;
  onChangeTab: (tab: CategoryType) => void;
  onSelect: (category: Category) => void;
  onClose: () => void;
};

/**
 * Full-screen category picker. Expense categories are grouped into their
 * 50/30/20 tier (Needs / Wants) under an unclickable sticky header, each row
 * tinted with the category's own color for quick scanning. Income has no
 * tier, so it stays a single flat list.
 */
export default function CategoryGroupPicker({
  visible,
  categories,
  selectedId,
  suggestedId,
  tab,
  onChangeTab,
  onSelect,
  onClose,
}: CategoryGroupPickerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sections: CategorySection[] = useMemo(() => {
    const ofType = sortCategoriesByName(categories.filter((category) => category.type === tab));

    if (tab === 'income') {
      return [{ group: 'income', title: null, tone: null, data: ofType }];
    }

    return groupCategoriesByBudgetGroup(ofType).map(({ group, items }) => ({
      group,
      title: group === 'other' ? i18n.t('manage.categories') : budgetGroupLabel(group),
      tone: group === 'other' ? null : BUDGET_GROUP_TONE[group],
      data: items,
    }));
  }, [categories, tab]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal renders outside the app's view tree, so it needs its own provider for insets. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerSide}>
              <ChevronLeft color={colors.tint} size={28} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{i18n.t('addTransaction.categories')}</Text>
            <View style={styles.headerSide} />
          </View>

          <SegmentedControl
            options={categoryTypeOptions()}
            value={tab}
            onChange={onChangeTab}
            style={styles.tabs}
          />

          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled
            contentContainerStyle={styles.content}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View
                  style={[
                    styles.sectionHeader,
                    section.tone ? { borderLeftColor: section.tone } : styles.sectionHeaderNoTone,
                  ]}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
              ) : null
            }
            renderItem={({ item, index, section }) => {
              const isLast = index === section.data.length - 1;
              const color = getCategoryColor(item.name, item.type, item.color_code);

              return (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => onSelect(item)}
                  style={[styles.row, isLast && styles.rowLast]}>
                  <View style={[styles.iconBubble, { backgroundColor: `${color}22` }]}>
                    <CategoryIcon icon={item.icon} styles={styles} />
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {resolveCategoryName(item)}
                  </Text>
                  <View style={styles.rowTrailing}>
                    {suggestedId === item.id && (
                      <Sparkles
                        color={colors.tint}
                        size={16}
                        accessibilityLabel={i18n.t('addTransaction.aiSuggestedCategory')}
                      />
                    )}
                    {selectedId === item.id && <Check color={colors.tint} size={20} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

type PickerStyles = ReturnType<typeof createStyles>;

function CategoryIcon({ icon, styles }: { icon: string | null; styles: PickerStyles }) {
  if (icon && isRemoteIcon(icon)) {
    return <Image source={{ uri: icon }} style={styles.itemIconImage} />;
  }

  return (
    <Text style={styles.itemIcon} numberOfLines={1}>
      {icon}
    </Text>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    tabs: {
      margin: spacing.lg,
      marginBottom: spacing.sm,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 36,
      paddingLeft: spacing.sm,
      borderLeftWidth: 3,
      backgroundColor: colors.background,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    sectionHeaderNoTone: {
      borderLeftColor: colors.border,
    },
    sectionHeaderText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemIcon: {
      fontSize: 18,
      lineHeight: 22,
      textAlign: 'center',
    },
    itemIconImage: {
      width: 22,
      height: 22,
      borderRadius: 5,
    },
    itemName: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    rowTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
  });
}
