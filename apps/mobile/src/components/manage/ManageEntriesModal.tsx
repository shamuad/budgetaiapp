import { i18n, isRemoteIcon } from '@budgetaiapp/shared';
import { ChevronLeft, ChevronRight, GripVertical, Plus } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import ReorderableList, {
  useIsActive,
  useReorderableDrag,
  type ReorderableListRenderItemInfo,
} from '../reorder/ReorderableList';
import { radius, spacing, TOUCH_TARGET } from '../../theme';
import { useAppTheme, type ColorTokens } from '../../theming';
import SegmentedControl from '../SegmentedControl';
import EntryEditor, { EntryDraft } from './EntryEditor';

export type ManageEntry<T extends string> = {
  id: string;
  name: string;
  icon: string | null;
  type: T;
  customColor?: string | null;
  /** How a receipt names this row, for accounts that opted into clue matching. */
  paymentClue?: string | null;
  isCredit?: boolean;
  statementDay?: number | null;
  /** The row's original icon, if it has one — lets the editor offer "Reset to default". */
  defaultIcon?: string | null;
  /** Secondary line, such as the account kind or how often the row is used. */
  subtitle: string;
};

type ManageEntriesModalProps<T extends string> = {
  visible: boolean;
  title: string;
  entries: ManageEntry<T>[];
  typeOptions: { id: T; label: string }[];
  /** Emoji the editor offers for this kind of row. */
  iconChoices: string[];
  /** Enables smart bank logo detection in the editor (accounts only). */
  enableBrandDetect?: boolean;
  /** Adds the editor's receipt-matching field (accounts only). */
  showPaymentClue?: boolean;
  /** Adds debit/credit + statement day (accounts only). */
  showCreditFacility?: boolean;
  /** Adds a segmented control that narrows the list to one type. */
  filterable?: boolean;
  /** Enables drag-and-drop reordering with a grip handle on each row. */
  reorderable?: boolean;
  addLabel: string;
  createTitle: string;
  editTitle: string;
  onCreate: (draft: EntryDraft<T>) => Promise<void>;
  onUpdate: (id: string, draft: EntryDraft<T>) => Promise<void>;
  /** Returns false when the row was kept, having already said why. */
  onDelete: (entry: ManageEntry<T>) => Promise<boolean>;
  /** Called with the new id order after the user finishes a drag. */
  onReorder?: (orderedIds: string[]) => Promise<void>;
  onClose: () => void;
};

const NEW_ENTRY = 'new' as const;

type ManageStyles = ReturnType<typeof createStyles>;

function EntryRowIcon({ icon, styles }: { icon: string | null; styles: ManageStyles }) {
  if (icon && isRemoteIcon(icon)) {
    return <Image source={{ uri: icon }} style={styles.rowIconImage} />;
  }

  return <Text style={styles.rowIcon}>{icon}</Text>;
}

type EntryRowProps<T extends string> = {
  entry: ManageEntry<T>;
  /** Dividers sit on top of a row so the first and the lifted row stay clean. */
  showDivider: boolean;
  isActive?: boolean;
  onPress: (entry: ManageEntry<T>) => void;
  /** Supplying this swaps the chevron for a drag handle. */
  onDragStart?: () => void;
  colors: ColorTokens;
  styles: ManageStyles;
};

function EntryRowBase<T extends string>({
  entry,
  showDivider,
  isActive = false,
  onPress,
  onDragStart,
  colors,
  styles,
}: EntryRowProps<T>) {
  return (
    <View style={[styles.row, showDivider && !isActive && styles.rowDivided]}>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => onPress(entry)}
        disabled={isActive}
        style={styles.rowMain}>
        <EntryRowIcon icon={entry.icon} styles={styles} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, isActive && styles.rowNameActive]} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {entry.subtitle}
          </Text>
        </View>
        {!onDragStart && <ChevronRight color={colors.chevron} size={18} />}
      </TouchableOpacity>

      {onDragStart && (
        <TouchableOpacity
          // A dedicated handle can grab on press-in, which feels instant on both platforms.
          onPressIn={onDragStart}
          activeOpacity={0.6}
          style={[styles.dragHandle, isActive && styles.dragHandleActive]}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('manage.reorderHandle')}
          accessibilityHint={i18n.t('manage.reorderHint')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <GripVertical color={isActive ? colors.tint : colors.placeholderFaint} size={20} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const EntryRow = memo(EntryRowBase) as typeof EntryRowBase;

/** Reads its own drag state from the list, so a drag re-renders one row instead of all. */
function ReorderableEntryRow<T extends string>(
  props: Pick<EntryRowProps<T>, 'entry' | 'showDivider' | 'onPress' | 'colors' | 'styles'>,
) {
  const isActive = useIsActive();
  const drag = useReorderableDrag();

  return <EntryRow {...props} isActive={isActive} onDragStart={drag} />;
}

/** Settings list with add, edit and delete, shared by accounts and categories. */
export default function ManageEntriesModal<T extends string>({
  visible,
  title,
  entries,
  typeOptions,
  iconChoices,
  enableBrandDetect = false,
  showPaymentClue = false,
  showCreditFacility = false,
  filterable = false,
  reorderable = false,
  addLabel,
  createTitle,
  editTitle,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onClose,
}: ManageEntriesModalProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<T>(typeOptions[0].id);
  const [target, setTarget] = useState<ManageEntry<T> | typeof NEW_ENTRY | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const visibleEntries = useMemo(
    () => (filterable ? entries.filter((entry) => entry.type === filter) : entries),
    [entries, filterable, filter],
  );
  const isCreating = target === NEW_ENTRY;

  const closeEditor = () => setTarget(null);

  const handleSave = async (draft: EntryDraft<T>) => {
    setIsSaving(true);

    try {
      if (isCreating) {
        await onCreate(draft);
      } else if (target) {
        await onUpdate(target.id, draft);
      }

      closeEditor();
    } catch (error) {
      Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!target || isCreating) {
      return;
    }

    const entry = target;

    Alert.alert(
      i18n.t('manage.deleteTitle', { name: entry.name }),
      i18n.t('manage.deleteMessage'),
      [
        { text: i18n.t('addTransaction.cancel'), style: 'cancel' },
        {
          text: i18n.t('transactionActions.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);

            try {
              if (await onDelete(entry)) {
                closeEditor();
              }
            } catch (error) {
              Alert.alert(i18n.t('common.errorTitle'), (error as Error).message);
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleReorder = useCallback(
    (next: ManageEntry<T>[]) => {
      onReorder?.(next.map((entry) => entry.id))?.catch((error: Error) =>
        Alert.alert(i18n.t('common.errorTitle'), error.message),
      );
    },
    [onReorder],
  );

  const renderRow = useCallback(
    ({ item, index }: ReorderableListRenderItemInfo<ManageEntry<T>>) => (
      <ReorderableEntryRow
        entry={item}
        showDivider={index > 0}
        onPress={setTarget}
        colors={colors}
        styles={styles}
      />
    ),
    [colors, styles],
  );

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
              key={isCreating ? NEW_ENTRY : target.id}
              title={isCreating ? createTitle : editTitle}
              initial={
                isCreating
                  ? {
                      name: '',
                      icon: '',
                      type: filterable ? filter : typeOptions[0].id,
                      customColor: null,
                      paymentClue: null,
                      isCredit: false,
                      statementDay: null,
                    }
                  : {
                      name: target.name,
                      icon: target.icon ?? '',
                      type: target.type,
                      customColor: target.customColor ?? null,
                      paymentClue: target.paymentClue ?? null,
                      isCredit: target.isCredit ?? false,
                      statementDay: target.statementDay ?? null,
                    }
              }
              defaultIcon={isCreating ? null : target.defaultIcon}
              typeOptions={typeOptions}
              iconChoices={iconChoices}
              enableBrandDetect={enableBrandDetect}
              showPaymentClue={showPaymentClue}
              showCreditFacility={showCreditFacility}
              isSaving={isSaving}
              onSave={handleSave}
              onDelete={isCreating ? undefined : handleDelete}
              onCancel={closeEditor}
            />
          ) : (
            <>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerSide}>
                  <ChevronLeft color={colors.tint} size={28} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={styles.headerSide} />
              </View>

              {filterable && (
                <SegmentedControl
                  options={typeOptions}
                  value={filter}
                  onChange={setFilter}
                  style={styles.filter}
                />
              )}

              {visibleEntries.length === 0 ? (
                <Text style={styles.empty}>{i18n.t('manage.empty')}</Text>
              ) : reorderable ? (
                <View style={styles.listArea}>
                  <View style={styles.card}>
                    <ReorderableList
                      data={visibleEntries}
                      onReorder={handleReorder}
                      renderItem={renderRow}
                    />
                  </View>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.content}>
                  <View style={styles.card}>
                    {visibleEntries.map((entry, index) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        showDivider={index > 0}
                        onPress={setTarget}
                        colors={colors}
                        styles={styles}
                      />
                    ))}
                  </View>
                </ScrollView>
              )}

              <View style={styles.footer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setTarget(NEW_ENTRY)}
                  style={styles.addButton}>
                  <Plus color={colors.onBrand} size={20} />
                  <Text style={styles.addButtonText}>{addLabel}</Text>
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
    listArea: {
      flex: 1,
      padding: spacing.lg,
    },
    content: {
      padding: spacing.lg,
    },
    empty: {
      marginTop: spacing.xl,
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    // A hairline glass edge stands in for the shadow the flat light-mode card used,
    // which disappears against a dark canvas.
    card: {
      flex: 1,
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
    rowNameActive: {
      fontWeight: '600',
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET + 12,
    },
    dragHandle: {
      minWidth: TOUCH_TARGET,
      minHeight: TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    dragHandleActive: {
      backgroundColor: colors.brandSurface,
    },
    rowIcon: {
      width: 28,
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
    },
    rowIconImage: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowName: {
      fontSize: 16,
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
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
