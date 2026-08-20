import { i18n } from '@budgetaiapp/shared';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '../../theme';
import SegmentedControl from '../SegmentedControl';

export type EntryDraft<T extends string> = {
  name: string;
  icon: string;
  type: T;
};

type EntryEditorProps<T extends string> = {
  title: string;
  /** Values to start from: an existing row when editing, blanks when creating. */
  initial: EntryDraft<T>;
  typeOptions: { id: T; label: string }[];
  /** Emoji offered by the picker. The first one stands in for a blank icon. */
  iconChoices: string[];
  isSaving: boolean;
  onSave: (draft: EntryDraft<T>) => void;
  /** Omitted while creating, since there is nothing to remove yet. */
  onDelete?: () => void;
  onCancel: () => void;
};

/**
 * Name, icon and type form shared by the account and category editors.
 * Rendered in place of the list rather than in its own modal, which keeps the
 * settings stack shallow and behaves like a native push.
 */
export default function EntryEditor<T extends string>({
  title,
  initial,
  typeOptions,
  iconChoices,
  isSaving,
  onSave,
  onDelete,
  onCancel,
}: EntryEditorProps<T>) {
  const [name, setName] = useState(initial.name);
  // Tapped from a fixed set, so this is never empty and needs no validation.
  const [icon, setIcon] = useState(initial.icon || iconChoices[0]);
  const [type, setType] = useState<T>(initial.type);

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(i18n.t('common.errorTitle'), i18n.t('manage.missingName'));
      return;
    }

    onSave({ name: trimmedName, icon, type });
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
          <View style={styles.iconPreview}>
            <Text style={styles.iconPreviewText}>{icon}</Text>
          </View>

          <View style={styles.iconGrid}>
            {iconChoices.map((choice) => (
              <TouchableOpacity
                key={choice}
                activeOpacity={0.6}
                onPress={() => setIcon(choice)}
                style={[styles.iconChip, choice === icon && styles.iconChipSelected]}>
                <Text style={styles.iconChipText}>{choice}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{i18n.t('manage.name')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.rowInput}
                placeholder={i18n.t('manage.namePlaceholder')}
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
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

const styles = StyleSheet.create({
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
  iconPreview: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 44,
  },
  iconPreviewText: {
    fontSize: 40,
    lineHeight: 48,
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
    // Always bordered so selecting one cannot nudge the grid's layout.
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
