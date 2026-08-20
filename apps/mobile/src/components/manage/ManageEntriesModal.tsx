import { i18n } from '@budgetaiapp/shared';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, TOUCH_TARGET } from '../../theme';
import SegmentedControl from '../SegmentedControl';
import EntryEditor, { EntryDraft } from './EntryEditor';

export type ManageEntry<T extends string> = {
  id: string;
  name: string;
  icon: string | null;
  type: T;
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
  /** Adds a segmented control that narrows the list to one type. */
  filterable?: boolean;
  addLabel: string;
  createTitle: string;
  editTitle: string;
  onCreate: (draft: EntryDraft<T>) => Promise<void>;
  onUpdate: (id: string, draft: EntryDraft<T>) => Promise<void>;
  /** Returns false when the row was kept, having already said why. */
  onDelete: (entry: ManageEntry<T>) => Promise<boolean>;
  onClose: () => void;
};

const NEW_ENTRY = 'new' as const;

/** Settings list with add, edit and delete, shared by accounts and categories. */
export default function ManageEntriesModal<T extends string>({
  visible,
  title,
  entries,
  typeOptions,
  iconChoices,
  filterable = false,
  addLabel,
  createTitle,
  editTitle,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: ManageEntriesModalProps<T>) {
  const [filter, setFilter] = useState<T>(typeOptions[0].id);
  const [target, setTarget] = useState<ManageEntry<T> | typeof NEW_ENTRY | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const visibleEntries = filterable ? entries.filter((entry) => entry.type === filter) : entries;
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={target ? closeEditor : onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          {target ? (
            <EntryEditor
              // Remounts per row so the fields always start from the right values.
              key={isCreating ? NEW_ENTRY : target.id}
              title={isCreating ? createTitle : editTitle}
              initial={
                isCreating
                  ? { name: '', icon: '', type: filterable ? filter : typeOptions[0].id }
                  : { name: target.name, icon: target.icon ?? '', type: target.type }
              }
              typeOptions={typeOptions}
              iconChoices={iconChoices}
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

              <ScrollView contentContainerStyle={styles.content}>
                {visibleEntries.length === 0 ? (
                  <Text style={styles.empty}>{i18n.t('manage.empty')}</Text>
                ) : (
                  <View style={styles.card}>
                    {visibleEntries.map((entry, index) => (
                      <TouchableOpacity
                        key={entry.id}
                        activeOpacity={0.6}
                        onPress={() => setTarget(entry)}
                        style={[styles.row, index === visibleEntries.length - 1 && styles.rowLast]}>
                        <Text style={styles.rowIcon}>{entry.icon}</Text>
                        <View style={styles.rowText}>
                          <Text style={styles.rowName}>{entry.name}</Text>
                          <Text style={styles.rowSubtitle}>{entry.subtitle}</Text>
                        </View>
                        <ChevronRight color={colors.chevron} size={18} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
  empty: {
    marginTop: spacing.xl,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
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
    minHeight: TOUCH_TARGET + 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 28,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + 6,
    backgroundColor: colors.tint,
    borderRadius: radius.lg,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onBrand,
  },
});
