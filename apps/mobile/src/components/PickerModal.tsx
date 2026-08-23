import { isRemoteIcon } from '@budgetaiapp/shared';
import { Check, ChevronLeft } from 'lucide-react-native';
import { ReactNode, useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';

type PickerItem = {
  id: string;
  name: string;
  icon: string | null;
};

type PickerStyles = ReturnType<typeof createStyles>;

type PickerModalProps<T extends PickerItem> = {
  visible: boolean;
  title: string;
  items: T[];
  selectedId?: string;
  onSelect: (item: T) => void;
  onClose: () => void;
  /** Controls rendered between the header and the list, such as the category tabs. */
  children?: ReactNode;
};

/** Full-screen list picker shared by the category and account selectors. */
export default function PickerModal<T extends PickerItem>({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  children,
}: PickerModalProps<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Modal renders outside the app's view tree, so it needs its own provider for insets. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerSide}>
              <ChevronLeft color={colors.tint} size={28} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerSide} />
          </View>

          {children}

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.6}
                  onPress={() => onSelect(item)}
                  style={[styles.row, index === items.length - 1 && styles.rowLast]}>
                  <PickerItemIcon icon={item.icon} styles={styles} />
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={styles.rowValue}>
                    {selectedId === item.id && <Check color={colors.tint} size={20} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function PickerItemIcon({ icon, styles }: { icon: string | null; styles: PickerStyles }) {
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
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
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
      minHeight: TOUCH_TARGET,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowValue: {
      flex: 1,
      alignItems: 'flex-end',
    },
    itemIcon: {
      width: 28,
      minWidth: 28,
      fontSize: 18,
      lineHeight: 22,
      textAlign: 'center',
    },
    itemIconImage: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    itemName: {
      fontSize: 15,
      color: colors.text,
    },
  });
}
