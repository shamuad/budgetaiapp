import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getSupabase, i18n } from '@budgetaiapp/shared';
import {
  ArrowUpDown,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Folder,
  Mic,
  Type,
} from 'lucide-react-native';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: 'expense' | 'income';
};

export type TransactionDraft = {
  title: string;
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  date: string;
  category_id: string | null;
};

type AddTransactionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (draft: TransactionDraft) => Promise<void>;
};

type FormRowProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  isLast?: boolean;
  onPress?: () => void;
};

// Local calendar day, so a late-night entry is not pushed to tomorrow by UTC.
function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function FormRow({ icon, label, children, isLast, onPress }: FormRowProps) {
  const content = (
    <>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
      {onPress ? <ChevronRight color="#C7C7CC" size={18} /> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={onPress}
        style={[styles.row, isLast && styles.rowLast]}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.row, isLast && styles.rowLast]}>{content}</View>;
}

export default function AddTransactionModal({
  visible,
  onClose,
  onSubmit,
}: AddTransactionModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await getSupabase().from('categories').select('id, name, icon, type');

        setCategories((data ?? []) as Category[]);
      } catch {
        setCategories([]);
      }
    }

    loadCategories();
  }, []);

  const visibleCategories = categories.filter((category) => category.type === categoryTab);
  const parsedAmount = Number(amount.replace(',', '.'));
  const canSave = title.trim().length > 0 && parsedAmount > 0 && !isSaving;
  const amountColor = type === 'expense' ? styles.expense : styles.income;

  function handleSelectCategory() {
    Keyboard.dismiss();
    setCategoryTab(type);
    setShowCategoryPicker(true);
  }

  function handlePickCategory(category: Category) {
    setSelectedCategory(category);
    setType(category.type);
    setShowCategoryPicker(false);
  }

  function handleSelectDate() {
    Keyboard.dismiss();
    setShowDatePicker(true);
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    // Android shows a dialog that closes itself, iOS stays inline until "Done".
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      setDate(selectedDate);
    }
  }

  async function handleSubmit() {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setSaveFailed(false);

    try {
      await onSubmit({
        title: title.trim(),
        amount: parsedAmount,
        currency: 'EUR',
        type,
        date: toISODate(date),
        category_id: selectedCategory?.id ?? null,
      });

      setTitle('');
      setAmount('');
      setType('expense');
      setDate(new Date());
      setSelectedCategory(null);
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      {/* Modal renders outside the app's view tree, so it needs its own provider for insets. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerSide}>
              <Text style={styles.headerCancel}>{i18n.t('addTransaction.cancel')}</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{i18n.t('addTransaction.title')}</Text>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSave}
              style={[styles.headerSide, styles.headerSideRight]}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={[styles.headerSave, !canSave && styles.headerSaveDisabled]}>
                  {i18n.t('addTransaction.save')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.amountSection}>
              <Text style={[styles.currency, amountColor]}>€</Text>
              <TextInput
                style={[styles.amountInput, amountColor]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0,00"
                placeholderTextColor="#D1D5DB"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {saveFailed && (
              <Text style={styles.saveError}>{i18n.t('addTransaction.saveError')}</Text>
            )}

            <View style={styles.card}>
              <FormRow
                icon={<Type color="#6B7280" size={20} />}
                label={i18n.t('addTransaction.titleLabel')}>
                <TextInput
                  style={styles.rowInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={i18n.t('addTransaction.titlePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                />
              </FormRow>

              <FormRow
                icon={<ArrowUpDown color="#6B7280" size={20} />}
                label={i18n.t('addTransaction.type')}>
                <View style={styles.toggle}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setType('expense')}
                    style={[styles.toggleOption, type === 'expense' && styles.toggleOptionActive]}>
                    <Text
                      style={[styles.toggleText, type === 'expense' && styles.toggleTextExpense]}>
                      {i18n.t('addTransaction.expense')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setType('income')}
                    style={[styles.toggleOption, type === 'income' && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, type === 'income' && styles.toggleTextIncome]}>
                      {i18n.t('addTransaction.income')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </FormRow>

              <FormRow
                icon={<Folder color="#6B7280" size={20} />}
                label={i18n.t('addTransaction.category')}
                onPress={handleSelectCategory}>
                {selectedCategory ? (
                  <Text style={styles.rowText}>
                    {selectedCategory.icon} {selectedCategory.name}
                  </Text>
                ) : (
                  <Text style={styles.rowPlaceholder}>
                    {i18n.t('addTransaction.selectCategory')}
                  </Text>
                )}
              </FormRow>

              <FormRow
                icon={<Calendar color="#6B7280" size={20} />}
                label={i18n.t('addTransaction.date')}
                onPress={handleSelectDate}
                isLast>
                <Text style={styles.rowText}>
                  {date.toLocaleDateString(i18n.locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </FormRow>
            </View>

            {showDatePicker && (
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.pickerDone}
                    onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDoneText}>{i18n.t('addTransaction.done')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity activeOpacity={0.85} style={styles.aiButton}>
              <View style={styles.aiIcon}>
                <Mic color="#FFFFFF" size={20} />
              </View>
              <View style={styles.aiTexts}>
                <Text style={styles.aiLabel}>{i18n.t('addTransaction.addWithAI')}</Text>
                <Text style={styles.aiHint}>{i18n.t('addTransaction.addWithAIHint')}</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <Modal
            visible={showCategoryPicker}
            animationType="slide"
            onRequestClose={() => setShowCategoryPicker(false)}>
            <SafeAreaProvider>
              <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
                <View style={styles.header}>
                  <TouchableOpacity
                    onPress={() => setShowCategoryPicker(false)}
                    style={styles.headerSide}>
                    <ChevronLeft color="#007AFF" size={28} />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>{i18n.t('addTransaction.categories')}</Text>
                  <View style={styles.headerSide} />
                </View>

                <View style={styles.tabs}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setCategoryTab('expense')}
                    style={[styles.tab, categoryTab === 'expense' && styles.tabActive]}>
                    <Text
                      style={[styles.tabText, categoryTab === 'expense' && styles.tabTextActive]}>
                      {i18n.t('addTransaction.expenses')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setCategoryTab('income')}
                    style={[styles.tab, categoryTab === 'income' && styles.tabActive]}>
                    <Text style={[styles.tabText, categoryTab === 'income' && styles.tabTextActive]}>
                      {i18n.t('addTransaction.incomes')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                  <View style={styles.card}>
                    {visibleCategories.map((category, index) => (
                      <TouchableOpacity
                        key={category.id}
                        activeOpacity={0.6}
                        onPress={() => handlePickCategory(category)}
                        style={[
                          styles.row,
                          index === visibleCategories.length - 1 && styles.rowLast,
                        ]}>
                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                        <Text style={styles.rowLabel}>{category.name}</Text>
                        <View style={styles.rowValue}>
                          {selectedCategory?.id === category.id && (
                            <Check color="#007AFF" size={20} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </SafeAreaView>
            </SafeAreaProvider>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCancel: {
    fontSize: 17,
    color: '#007AFF',
  },
  headerSave: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerSaveDisabled: {
    color: '#B0B3B8',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    padding: 16,
    gap: 24,
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  currency: {
    fontSize: 32,
    fontWeight: '600',
  },
  amountInput: {
    fontSize: 56,
    fontWeight: '700',
    minWidth: 140,
    textAlign: 'center',
    padding: 0,
  },
  expense: {
    color: '#EF4444',
  },
  income: {
    color: '#10B981',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 24,
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    color: '#111827',
  },
  rowValue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    textAlign: 'right',
    padding: 0,
  },
  rowText: {
    fontSize: 15,
    color: '#111827',
  },
  rowPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 2,
  },
  toggleOption: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleTextExpense: {
    color: '#EF4444',
  },
  toggleTextIncome: {
    color: '#10B981',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 16,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
  },
  aiTexts: {
    gap: 2,
  },
  aiLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aiHint: {
    fontSize: 13,
    color: '#C7D2FE',
  },
  saveError: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: 2,
    margin: 16,
    marginBottom: 0,
    padding: 2,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
  },
  categoryIcon: {
    fontSize: 22,
    width: 32,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: -12,
  },
  pickerDone: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});
