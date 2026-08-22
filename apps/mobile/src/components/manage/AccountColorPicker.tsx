import { i18n } from '@budgetaiapp/shared';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import HueColorPicker from './HueColorPicker';

type AccountColorPickerProps = {
  value: string | null;
  previewColor: string;
  onChange: (color: string | null) => void;
  onReset: () => void;
};

export default function AccountColorPicker({
  value,
  previewColor,
  onChange,
  onReset,
}: AccountColorPickerProps) {
  const activeColor = value ?? previewColor;

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

      <HueColorPicker color={activeColor} onChange={onChange} />

      <View style={[styles.preview, { backgroundColor: previewColor }]}>
        <Text style={styles.previewText}>{i18n.t('manage.cardPreview')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  reset: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.tint,
  },
  preview: {
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onBrand,
  },
});
