import {
  Asset,
  Category,
  createTransaction,
  CurrencyCode,
  DEFAULT_CURRENCY,
  formatAmountForInput,
  formatAssetLabel,
  formatDate,
  formatMoney,
  fromISODate,
  i18n,
  parseAmountString,
  toBaseAmount,
  toISODate,
  TransactionInput,
  TransactionRow,
  TransactionType,
  updateTransaction,
} from '@budgetaiapp/shared';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Part } from '@google/generative-ai';
import {
  ArrowUpDown,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Folder,
  Mic,
  Sparkles,
  Square,
  Type,
  Wallet,
} from 'lucide-react-native';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { useAssets } from '../context/AssetsContext';
import { useCategories } from '../context/CategoriesContext';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import {
  askGemini,
  buildTransactionPrompt,
  parseTransactionResponse,
  TransactionValues,
} from '../lib/ai';
import { fetchExchangeRate, PICKABLE_CURRENCIES } from '../lib/exchangeRates';
import { transactionTypeOptions } from '../lib/labels';
import { colors, radius, spacing, TOUCH_TARGET } from '../theme';
import PickerModal from './PickerModal';
import SegmentedControl from './SegmentedControl';

/** Display-only labels and symbols — keeps the picker free of Intl.DisplayNames quirks. */
const CURRENCY_META: Record<CurrencyCode, { symbol: string; label: string }> = {
  EUR: { symbol: '€', label: 'Euro' },
  USD: { symbol: '$', label: 'US Dollar' },
  GBP: { symbol: '£', label: 'British Pound' },
  TRY: { symbol: '₺', label: 'Turkish Lira' },
};

type CurrencyOption = {
  id: CurrencyCode;
  name: string;
  icon: string;
};

function currencyOptions(): CurrencyOption[] {
  return PICKABLE_CURRENCIES.map((code) => {
    const meta = CURRENCY_META[code];

    return {
      id: code,
      name: `${code} - ${meta.label}`,
      icon: meta.symbol,
    };
  });
}

// A draft is a validated transaction: both relations are resolved, never null.
type TransactionDraft = Omit<TransactionValues, 'category' | 'asset'> & {
  category: Category;
  asset: Asset;
};

/** The account a new transaction opens on, so the required field is never empty. */
function defaultAsset(assets: Asset[]) {
  return assets.find((item) => item.name.toLocaleLowerCase().includes('credit card')) ?? assets[0] ?? null;
}

type ValidationResult =
  | { ok: true; draft: TransactionDraft }
  | { ok: false; message: string };

type AddTransactionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  /** Supplying a row switches the modal into edit mode. */
  transactionToEdit?: TransactionRow | null;
};

function sanitizeAmountInput(input: string) {
  return input.replace(/[^\d.,]/g, '');
}

/** The account is not part of the AI result, so it is validated alongside it. */
function validateDraft(values: TransactionValues, asset: Asset | null): ValidationResult {
  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return { ok: false, message: i18n.t('addTransaction.invalidAmount') };
  }

  const title = values.title.trim();

  if (title.length === 0) {
    return { ok: false, message: i18n.t('addTransaction.missingTitle') };
  }

  if (!values.category) {
    return { ok: false, message: i18n.t('addTransaction.missingCategory') };
  }

  if (!asset) {
    return { ok: false, message: i18n.t('addTransaction.missingAsset') };
  }

  return { ok: true, draft: { ...values, title, category: values.category, asset } };
}

type FormRowProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  isLast?: boolean;
  onPress?: () => void;
};

function FormRow({ icon, label, children, isLast, onPress }: FormRowProps) {
  const content = (
    <>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
      {onPress ? <ChevronRight color={colors.chevron} size={18} /> : null}
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

type CategoryPickerProps = {
  visible: boolean;
  categories: Category[];
  selectedId?: string;
  tab: TransactionType;
  onChangeTab: (tab: TransactionType) => void;
  onSelect: (category: Category) => void;
  onClose: () => void;
};

function CategoryPicker({
  visible,
  categories,
  selectedId,
  tab,
  onChangeTab,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  return (
    <PickerModal
      visible={visible}
      title={i18n.t('addTransaction.categories')}
      items={categories.filter((category) => category.type === tab)}
      selectedId={selectedId}
      onSelect={onSelect}
      onClose={onClose}>
      <SegmentedControl
        options={transactionTypeOptions()}
        value={tab}
        onChange={onChangeTab}
        style={styles.tabs}
      />
    </PickerModal>
  );
}

export default function AddTransactionModal({
  visible,
  onClose,
  onSuccess,
  transactionToEdit = null,
}: AddTransactionModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [categoryTab, setCategoryTab] = useState<TransactionType>('expense');
  const [aiInput, setAiInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<TransactionDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [amountSelection, setAmountSelection] = useState<
    { start: number; end: number } | undefined
  >();
  const amountSelectionRef = useRef({ start: 0, end: 0 });
  const isProgrammaticAmountRef = useRef(false);
  // Which row the form has already been filled from, so edits are not overwritten.
  const prefilledIdRef = useRef<string | null>(null);

  const { categories } = useCategories();
  const { assets } = useAssets();
  const {
    isRecording,
    isProcessing,
    toggle: toggleRecording,
    cancel: cancelRecording,
  } = useVoiceRecorder({
    onFinish: async ({ base64, mimeType }) => {
      await runAI([
        { inlineData: { mimeType, data: base64 } },
        buildTransactionPrompt(categories, assets),
      ]);
    },
    onError: reportAIError,
  });

  const isAIBusy = isParsing || isProcessing;
  const isEditing = transactionToEdit !== null;
  const amountColor = type === 'expense' ? styles.expense : styles.income;
  const parsedAmount = parseAmountString(amount);
  const showBaseHint =
    currency !== DEFAULT_CURRENCY && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const baseAmount =
    showBaseHint && Number.isFinite(exchangeRate) ? toBaseAmount(parsedAmount, exchangeRate) : null;

  useEffect(() => {
    if (visible) {
      return;
    }

    void cancelRecording();
    isProgrammaticAmountRef.current = true;
    prefilledIdRef.current = null;
    setTitle('');
    setAmount('');
    setType('expense');
    setDate(new Date());
    setSelectedCategory(null);
    setSelectedAsset(null);
    setCurrency(DEFAULT_CURRENCY);
    setExchangeRate(1);
    setIsRateLoading(false);
    setShowDatePicker(false);
    setShowCategoryPicker(false);
    setShowAssetPicker(false);
    setShowCurrencyPicker(false);
    setAiInput('');
    setPendingDraft(null);
    setFormError(null);
  }, [cancelRecording, visible]);

  // Fills the form from the edited row once, waiting for any relation it needs.
  useEffect(() => {
    if (!visible || !transactionToEdit) {
      return;
    }

    if (prefilledIdRef.current === transactionToEdit.id) {
      return;
    }

    const waitingForCategory = transactionToEdit.category_id !== null && categories.length === 0;
    const waitingForAsset = transactionToEdit.asset_id !== null && assets.length === 0;

    if (waitingForCategory || waitingForAsset) {
      return;
    }

    prefilledIdRef.current = transactionToEdit.id;

    isProgrammaticAmountRef.current = true;
    setAmount(formatAmountForInput(transactionToEdit.amount));
    setTitle(transactionToEdit.title);
    setType(transactionToEdit.type);
    setDate(fromISODate(transactionToEdit.date) ?? new Date());
    setCurrency(transactionToEdit.currency);
    setSelectedCategory(
      categories.find((category) => category.id === transactionToEdit.category_id) ?? null,
    );
    setSelectedAsset(assets.find((asset) => asset.id === transactionToEdit.asset_id) ?? null);
  }, [assets, categories, transactionToEdit, visible]);

  // Create mode opens on a default account. Guarded on the current pick so it only
  // ever fills an empty field, never overrides the user or the AI.
  useEffect(() => {
    if (!visible || transactionToEdit || selectedAsset || assets.length === 0) {
      return;
    }

    setSelectedAsset(defaultAsset(assets));
  }, [assets, selectedAsset, transactionToEdit, visible]);

  // Lock in a live rate whenever the user picks a foreign currency.
  useEffect(() => {
    if (!visible) {
      return;
    }

    // An edited row keeps the rate it was written with, so historical figures
    // never move. Switching currency invalidates that rate and refetches below.
    if (transactionToEdit && currency === transactionToEdit.currency) {
      setExchangeRate(transactionToEdit.exchange_rate);
      setIsRateLoading(false);
      return;
    }

    if (currency === DEFAULT_CURRENCY) {
      setExchangeRate(1);
      setIsRateLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsRateLoading(true);

    fetchExchangeRate(currency, DEFAULT_CURRENCY, controller.signal)
      .then((rate) => {
        setExchangeRate(rate);
        setFormError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setExchangeRate(NaN);
        setFormError(
          error instanceof Error ? error.message : i18n.t('addTransaction.rateError'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsRateLoading(false);
        }
      });

    return () => controller.abort();
  }, [currency, transactionToEdit, visible]);

  useEffect(() => {
    if (amountSelection === undefined) {
      return;
    }

    const frame = requestAnimationFrame(() => setAmountSelection(undefined));

    return () => cancelAnimationFrame(frame);
  }, [amountSelection]);

  function reportAIError(error: unknown) {
    console.warn('[AI]', error);
    setFormError(error instanceof Error ? error.message : i18n.t('addTransaction.aiError'));
  }

  function applyValues(values: TransactionValues) {
    // A focused TextInput can push its stale native value back into state on blur,
    // so the keyboard is dismissed before the parsed values are written.
    Keyboard.dismiss();
    isProgrammaticAmountRef.current = true;
    const nextAmount = formatAmountForInput(values.amount);
    setAmount(nextAmount);

    if (Platform.OS === 'android') {
      setAmountSelection({ start: nextAmount.length, end: nextAmount.length });
    }

    setTitle(values.title);
    setType(values.type);
    setDate(values.date);
    setSelectedCategory(values.category);

    // Only overrides the account when the user actually named one, so a request
    // that says nothing about it keeps the default or the existing pick.
    if (values.asset) {
      setSelectedAsset(values.asset);
    }
  }

  function handleAmountChange(text: string) {
    const sanitized = sanitizeAmountInput(text);

    if (Platform.OS !== 'android' || isProgrammaticAmountRef.current) {
      isProgrammaticAmountRef.current = false;
      setAmount(sanitized);
      return;
    }

    const previousLength = amount.length;
    const cursor = amountSelectionRef.current.start;
    const lengthDelta = sanitized.length - previousLength;

    setAmount(sanitized);

    let nextCursor = cursor + lengthDelta;

    if (lengthDelta < 0 && nextCursor > sanitized.length) {
      nextCursor = sanitized.length;
    }

    nextCursor = Math.max(0, Math.min(nextCursor, sanitized.length));
    setAmountSelection({ start: nextCursor, end: nextCursor });
  }

  /** Single entry point for both the typed and the spoken request. */
  async function runAI(parts: (string | Part)[]) {
    setFormError(null);
    setIsParsing(true);

    try {
      const { action, values } = parseTransactionResponse(
        await askGemini(parts),
        categories,
        assets,
        date,
      );

      if (action === 'cancel') {
        onClose();
        return true;
      }

      if (!values) {
        return true;
      }

      const resolved = { ...values, title: values.title || title };

      applyValues(resolved);

      if (action === 'save') {
        // `applyValues` has only queued its state update, so the account the AI
        // just named is read from the result rather than from stale state.
        const result = validateDraft(resolved, resolved.asset ?? selectedAsset);

        if (result.ok) {
          setPendingDraft(result.draft);
        } else {
          setFormError(result.message);
        }
      }

      return true;
    } catch (error) {
      reportAIError(error);
      return false;
    } finally {
      setIsParsing(false);
    }
  }

  async function handleParseText() {
    const text = aiInput.trim();

    if (text.length === 0) {
      setFormError(i18n.t('addTransaction.aiEmptyInput'));
      return;
    }

    Keyboard.dismiss();

    if (await runAI([buildTransactionPrompt(categories, assets, text)])) {
      setAiInput('');
    }
  }

  async function saveTransaction(draft: TransactionDraft) {
    if (isRateLoading || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setFormError(i18n.t('addTransaction.rateRequired'));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const input: TransactionInput = {
        title: draft.title,
        amount: draft.amount,
        currency,
        // Locked-in rate at save time — never rewritten when live rates move.
        exchange_rate: exchangeRate,
        type: draft.type,
        date: toISODate(draft.date),
        category_id: draft.category.id,
        asset_id: draft.asset.id,
      };

      if (transactionToEdit) {
        await updateTransaction(transactionToEdit.id, input);
      } else {
        await createTransaction(input);
      }

      await onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : i18n.t('addTransaction.saveError');

      setFormError(message);
      // The inline banner can sit off-screen on a scrolled form, so a write that
      // failed is always raised natively too.
      Alert.alert(i18n.t('common.errorTitle'), message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    await cancelRecording();

    const result = validateDraft({
      title,
      amount: parseAmountString(amount),
      // A row's type has to match its category, which the toggle alone cannot guarantee.
      type: selectedCategory?.type ?? type,
      date,
      category: selectedCategory,
      asset: selectedAsset,
    }, selectedAsset);

    if (!result.ok) {
      setFormError(result.message);
      Alert.alert(i18n.t('common.errorTitle'), result.message);
      return;
    }

    await saveTransaction(result.draft);
  }

  async function handleClose() {
    await cancelRecording();
    onClose();
  }

  function handleOpenCategoryPicker() {
    Keyboard.dismiss();
    setCategoryTab(type);
    setShowCategoryPicker(true);
  }

  function handleSelectCategory(category: Category) {
    setSelectedCategory(category);
    setType(category.type);
    setShowCategoryPicker(false);
  }

  /**
   * A category belongs to exactly one type, and the save derives the saved type
   * from the category. Dropping a mismatched pick keeps the toggle authoritative
   * instead of letting the stale category silently overrule it.
   */
  function handleChangeType(nextType: TransactionType) {
    setType(nextType);

    if (selectedCategory && selectedCategory.type !== nextType) {
      setSelectedCategory(null);
    }
  }

  function handleOpenAssetPicker() {
    Keyboard.dismiss();
    setShowAssetPicker(true);
  }

  function handleSelectAsset(asset: Asset) {
    setSelectedAsset(asset);
    setShowAssetPicker(false);
  }

  function handleOpenCurrencyPicker() {
    Keyboard.dismiss();
    setShowCurrencyPicker(true);
  }

  function handleSelectCurrency(option: CurrencyOption) {
    setCurrency(option.id);
    setShowCurrencyPicker(false);
    setFormError(null);
  }

  function handleOpenDatePicker() {
    Keyboard.dismiss();
    setShowDatePicker(true);
  }

  function handleDateValueChange(_event: DateTimePickerChangeEvent, selectedDate: Date) {
    setDate(selectedDate);

    // Android shows a dialog that closes itself after a choice.
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      {/* Modal renders outside the app's view tree, so it needs its own provider for insets. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerSide}>
              <Text style={styles.headerCancel}>{i18n.t('addTransaction.cancel')}</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {isEditing ? i18n.t('addTransaction.editTitle') : i18n.t('addTransaction.title')}
            </Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving || isRateLoading}
              style={[styles.headerSide, styles.headerSideRight]}>
              {isSaving || isRateLoading ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <Text style={styles.headerSave}>{i18n.t('addTransaction.save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets>
            <View style={styles.amountSection}>
              <View style={styles.amountRow}>
                <Text style={[styles.currency, amountColor]}>{CURRENCY_META[currency].symbol}</Text>
                <TextInput
                  style={[styles.amountInput, amountColor]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  onSelectionChange={(event) => {
                    amountSelectionRef.current = event.nativeEvent.selection;
                  }}
                  selection={Platform.OS === 'android' ? amountSelection : undefined}
                  placeholder="0,00"
                  placeholderTextColor={colors.placeholderFaint}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              {currency !== DEFAULT_CURRENCY ? (
                <View style={styles.baseHint}>
                  {isRateLoading ? (
                    <Text style={styles.baseHintText}>{i18n.t('addTransaction.rateLoading')}</Text>
                  ) : baseAmount !== null ? (
                    <Text style={styles.baseHintText}>
                      {i18n.t('addTransaction.baseAmountHint', {
                        amount: formatMoney(baseAmount, DEFAULT_CURRENCY),
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <FormRow
                icon={<Type color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.titleLabel')}>
                <TextInput
                  style={styles.rowInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={i18n.t('addTransaction.titlePlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="done"
                />
              </FormRow>

              <FormRow
                icon={<ArrowUpDown color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.type')}>
                <View style={styles.toggle}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleChangeType('expense')}
                    style={[styles.toggleOption, type === 'expense' && styles.toggleOptionActive]}>
                    <Text
                      style={[styles.toggleText, type === 'expense' && styles.toggleTextExpense]}>
                      {i18n.t('addTransaction.expense')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleChangeType('income')}
                    style={[styles.toggleOption, type === 'income' && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, type === 'income' && styles.toggleTextIncome]}>
                      {i18n.t('addTransaction.income')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </FormRow>

              <FormRow
                icon={<CircleDollarSign color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.currency')}
                onPress={handleOpenCurrencyPicker}>
                <Text style={styles.rowText}>
                  {CURRENCY_META[currency].symbol} {currency}
                </Text>
              </FormRow>

              <FormRow
                icon={<Wallet color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.asset')}
                onPress={handleOpenAssetPicker}>
                {selectedAsset ? (
                  <Text style={styles.rowText}>{formatAssetLabel(selectedAsset)}</Text>
                ) : (
                  <Text style={styles.rowPlaceholder}>{i18n.t('addTransaction.selectAsset')}</Text>
                )}
              </FormRow>

              <FormRow
                icon={<Folder color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.category')}
                onPress={handleOpenCategoryPicker}>
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
                icon={<Calendar color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.date')}
                onPress={handleOpenDatePicker}
                isLast>
                <Text style={styles.rowText}>{formatDate(date)}</Text>
              </FormRow>
            </View>

            {showDatePicker && (
              <View style={styles.card}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onValueChange={handleDateValueChange}
                  onDismiss={() => setShowDatePicker(false)}
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

            {/* Editing an existing row is a manual correction, so the AI panel is hidden. */}
            {isEditing ? null : (
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIcon}>
                  <Sparkles color={colors.onBrand} size={20} />
                </View>
                <View style={styles.aiTexts}>
                  <Text style={styles.aiLabel}>{i18n.t('addTransaction.addWithAI')}</Text>
                  <Text style={styles.aiHint}>
                    {isRecording
                      ? i18n.t('addTransaction.aiRecording')
                      : i18n.t('addTransaction.addWithAIHint')}
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.aiInput}
                value={aiInput}
                onChangeText={setAiInput}
                placeholder={i18n.t('addTransaction.aiPlaceholder')}
                placeholderTextColor={colors.placeholder}
                multiline
                editable={!isAIBusy && !isRecording}
              />

              <View style={styles.aiActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={toggleRecording}
                  disabled={isAIBusy}
                  style={[
                    styles.aiMic,
                    isRecording && styles.aiMicActive,
                    isAIBusy && styles.aiActionDisabled,
                  ]}>
                  {isRecording ? (
                    <Square color={colors.onBrand} size={16} fill={colors.onBrand} />
                  ) : (
                    <Mic color={colors.onBrand} size={20} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleParseText}
                  disabled={isAIBusy || isRecording}
                  style={[styles.aiAction, (isAIBusy || isRecording) && styles.aiActionDisabled]}>
                  {isAIBusy ? (
                    <ActivityIndicator size="small" color={colors.onBrand} />
                  ) : (
                    <Text style={styles.aiActionText}>{i18n.t('addTransaction.aiParse')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            )}
          </ScrollView>

          {pendingDraft ? (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>{i18n.t('addTransaction.confirmTitle')}</Text>
                <Text style={styles.confirmLine}>{pendingDraft.title}</Text>
                <Text style={styles.confirmLine}>
                  {formatMoney(pendingDraft.amount, currency)} · {pendingDraft.category.name}
                </Text>
                {currency !== DEFAULT_CURRENCY && Number.isFinite(exchangeRate) ? (
                  <Text style={styles.confirmDate}>
                    {i18n.t('addTransaction.baseAmountHint', {
                      amount: formatMoney(
                        toBaseAmount(pendingDraft.amount, exchangeRate),
                        DEFAULT_CURRENCY,
                      ),
                    })}
                  </Text>
                ) : null}
                {/* Guaranteed by validation, so it always names the account being charged. */}
                <Text style={styles.confirmLine}>{formatAssetLabel(pendingDraft.asset)}</Text>
                <Text style={styles.confirmDate}>{formatDate(pendingDraft.date)}</Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    onPress={() => setPendingDraft(null)}
                    style={styles.confirmButton}>
                    <Text style={styles.confirmCancel}>{i18n.t('addTransaction.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => saveTransaction(pendingDraft)}
                    disabled={isSaving || isRateLoading}
                    style={styles.confirmButton}>
                    {isSaving || isRateLoading ? (
                      <ActivityIndicator size="small" color={colors.tint} />
                    ) : (
                      <Text style={styles.confirmSave}>{i18n.t('addTransaction.save')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          <CategoryPicker
            visible={showCategoryPicker}
            categories={categories}
            selectedId={selectedCategory?.id}
            tab={categoryTab}
            onChangeTab={setCategoryTab}
            onSelect={handleSelectCategory}
            onClose={() => setShowCategoryPicker(false)}
          />

          <PickerModal
            visible={showAssetPicker}
            title={i18n.t('addTransaction.assets')}
            items={assets}
            selectedId={selectedAsset?.id}
            onSelect={handleSelectAsset}
            onClose={() => setShowAssetPicker(false)}
          />

          <PickerModal
            visible={showCurrencyPicker}
            title={i18n.t('addTransaction.currencies')}
            items={currencyOptions()}
            selectedId={currency}
            onSelect={handleSelectCurrency}
            onClose={() => setShowCurrencyPicker(false)}
          />
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
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCancel: {
    fontSize: 17,
    color: colors.tint,
  },
  headerSave: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.tint,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  formError: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.dangerText,
    backgroundColor: colors.dangerSurface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  amountSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
  baseHint: {
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseHintText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
  },
  expense: {
    color: colors.expense,
  },
  income: {
    color: colors.income,
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
  rowIcon: {
    width: 24,
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    color: colors.text,
  },
  rowValue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    padding: 0,
  },
  rowText: {
    fontSize: 15,
    color: colors.text,
  },
  rowPlaceholder: {
    fontSize: 15,
    color: colors.placeholder,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 2,
  },
  toggleOption: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  toggleOptionActive: {
    backgroundColor: colors.surface,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  toggleTextExpense: {
    color: colors.expense,
  },
  toggleTextIncome: {
    color: colors.income,
  },
  pickerDone: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.tint,
  },
  aiCard: {
    gap: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandLight,
  },
  aiTexts: {
    flex: 1,
    gap: 2,
  },
  aiLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onBrand,
  },
  aiHint: {
    fontSize: 13,
    color: colors.brandSoft,
  },
  aiInput: {
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    textAlignVertical: 'top',
  },
  aiActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  aiMic: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    backgroundColor: colors.brandDark,
  },
  aiMicActive: {
    backgroundColor: colors.danger,
  },
  aiAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    backgroundColor: colors.brandDark,
  },
  aiActionDisabled: {
    opacity: 0.6,
  },
  aiActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onBrand,
  },
  tabs: {
    margin: spacing.lg,
    marginBottom: 0,
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  confirmCard: {
    width: '100%',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 20,
  },
  confirmTitle: {
    marginBottom: spacing.sm,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  confirmLine: {
    fontSize: 16,
    color: colors.text,
  },
  confirmDate: {
    fontSize: 15,
    color: colors.textMuted,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  confirmButton: {
    minWidth: 64,
    minHeight: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  confirmCancel: {
    fontSize: 17,
    color: colors.tint,
  },
  confirmSave: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.tint,
  },
});
