import {
  buildInstallmentPlan,
  Asset,
  AssetSearchResult,
  billingMonthISO,
  Category,
  CategoryType,
  CurrencyCode,
  DEFAULT_CURRENCY,
  amountCursorAfterMask,
  amountInputPlaceholder,
  formatAmountForInput,
  formatAssetLabel,
  formatCurrency,
  formatDate,
  maskAmountInput,
  fromISODate,
  i18n,
  parseAmountString,
  resolveCategoryName,
  toBaseAmount,
  toISODate,
  TransactionInput,
  TransactionRow,
  TransactionType,
  useAssets,
  useAssetQuote,
  useAssetSearch,
  useCategories,
  useCreateTransactionMutation,
  useCreateTransactionsBatchMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from '@budgetaiapp/shared';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Folder,
  Landmark,
  Repeat,
  Sparkles,
  TrendingUp,
  Type,
  Wallet,
} from 'lucide-react-native';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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

import { useCategorySuggestion } from '../hooks/useCategorySuggestion';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import {
  MAX_INSTALLMENTS,
  normalizeAssetSymbol,
  parseReceiptResponse,
  parseTransactionResponse,
  requestReceiptScan,
  requestTransactionParse,
  type AiFilledField,
  type AIResult,
  TransactionValues,
} from '../lib/ai';
import { fetchExchangeRate, PICKABLE_CURRENCIES } from '../lib/exchangeRates';
import { transactionTypeOptions } from '../lib/labels';
import { pickReceiptImage } from '../lib/receiptPicker';
import { radius, spacing, TOUCH_TARGET } from '../theme';
import { useAppTheme, type ColorTokens } from '../theming';
import CategoryGroupPicker from './CategoryGroupPicker';
import PickerModal from './PickerModal';
import ReceiptAnalyzingOverlay from './ReceiptAnalyzingOverlay';
import SegmentedControl from './SegmentedControl';
import SmartDock from './SmartDock';

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

type ModalStyles = ReturnType<typeof createStyles>;

/** Enough previously-held symbols to be useful without wrapping onto many lines. */
const SYMBOL_SUGGESTIONS = 4;

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

// A draft is a validated transaction: the source account is always resolved, and
// a transfer has been checked to name a destination that differs from it.
type TransactionDraft = Omit<TransactionValues, 'category' | 'asset'> & {
  /** Null on a transfer, which moves money instead of categorising a spend. */
  category: Category | null;
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
  /** Supplying a row switches the modal into edit mode. */
  transactionToEdit?: TransactionRow | null;
};

function sanitizeAmountInput(input: string) {
  return input.replace(/[^\d.,]/g, '');
}

/** Whether a live quote's currency is one this app can actually price a transaction in. */
function isPickableCurrency(code: string | undefined): code is CurrencyCode {
  return !!code && (PICKABLE_CURRENCIES as string[]).includes(code);
}

/** An optional figure: blank stays null rather than being written as NaN. */
function parseOptionalAmount(input: string): number | null {
  if (input.trim().length === 0) {
    return null;
  }

  const parsed = parseAmountString(input);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Digits only — an installment count is a whole number of payments. */
function sanitizeInstallmentsInput(input: string) {
  return input.replace(/[^\d]/g, '');
}

/** Blank or zero reads as a single, un-split payment. */
function parseInstallmentsInput(input: string): number {
  const parsed = Number.parseInt(input, 10);

  if (!Number.isFinite(parsed) || parsed <= 1) {
    return 1;
  }

  return Math.min(MAX_INSTALLMENTS, parsed);
}

/** A fresh id for an installment plan, without pulling in a uuid dependency. */
function generateInstallmentGroupId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // The column is a real `uuid`, so the fallback has to look like one too —
  // an RFC 4122 v4 id built from Math.random for engines without Web Crypto.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

/** The source account is not part of the AI result, so it is validated alongside it. */
function validateDraft(values: TransactionValues, asset: Asset | null): ValidationResult {
  if (!Number.isFinite(values.amount) || values.amount <= 0) {
    return { ok: false, message: i18n.t('addTransaction.invalidAmount') };
  }

  const title = values.title.trim();

  if (title.length === 0) {
    return { ok: false, message: i18n.t('addTransaction.missingTitle') };
  }

  if (!asset) {
    return { ok: false, message: i18n.t('addTransaction.missingAsset') };
  }

  // Double entry: a transfer names both sides and is never categorised.
  if (values.type === 'transfer') {
    if (!values.toAsset) {
      return { ok: false, message: i18n.t('addTransaction.missingToAsset') };
    }

    if (values.toAsset.id === asset.id) {
      return { ok: false, message: i18n.t('addTransaction.sameAsset') };
    }

    // A transfer moves money rather than spending it, so it is never split.
    return { ok: true, draft: { ...values, title, category: null, asset, installments: 1 } };
  }

  if (!values.category) {
    return { ok: false, message: i18n.t('addTransaction.missingCategory') };
  }

  // Only a transfer can carry a destination or a holding.
  return {
    ok: true,
    draft: {
      ...values,
      title,
      category: values.category,
      asset,
      toAsset: null,
      assetSymbol: null,
      shares: null,
      unitPrice: null,
    },
  };
}

type FormRowProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  styles: ModalStyles;
  colors: ColorTokens;
  isLast?: boolean;
  onPress?: () => void;
};

function FormRow({ icon, label, children, styles, colors, isLast, onPress }: FormRowProps) {
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

/**
 * Marks a value the AI filled in, and disappears as soon as the user edits that
 * field. Decorative next to the value it annotates, so only the label carries
 * meaning for a screen reader.
 */
function AiSparkle({
  colors,
  label,
  size = 14,
}: {
  colors: ColorTokens;
  label: string;
  size?: number;
}) {
  return <Sparkles color={colors.tint} size={size} accessibilityLabel={label} />;
}

export default function AddTransactionModal({
  visible,
  onClose,
  transactionToEdit = null,
}: AddTransactionModalProps) {
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  // Which fields still hold exactly what `ask-gemini` filled in, so each one can
  // show a sparkle. A field drops out the moment the user edits it themselves,
  // which is also what stops a later category suggestion from overriding a pick
  // they made by hand.
  const [aiFilled, setAiFilled] = useState<ReadonlySet<AiFilledField>>(new Set());
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedToAsset, setSelectedToAsset] = useState<Asset | null>(null);
  const [assetSymbol, setAssetSymbol] = useState('');
  const [isSymbolFocused, setIsSymbolFocused] = useState(false);
  const [shares, setShares] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  // How many equal monthly payments a new expense or income splits into. Kept
  // as text so the field can sit empty while the user is still typing.
  const [installments, setInstallments] = useState('1');
  // Set only by an explicit dropdown pick, so a live quote is fetched once per
  // selection rather than on every keystroke while typing a symbol by hand.
  const [priceSymbol, setPriceSymbol] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showToAssetPicker, setShowToAssetPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [categoryTab, setCategoryTab] = useState<CategoryType>('expense');
  const [aiInput, setAiInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
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
  // Hidden (soft-deleted) defaults stay out of new picks — but `categories`
  // itself stays unfiltered so editing an old transaction can still resolve
  // whichever category it was originally saved under.
  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active !== false),
    [categories],
  );
  const { assets } = useAssets();
  const { transactions, balanceByAsset } = useTransactionsQuery();
  const createTransactionMutation = useCreateTransactionMutation();
  const createTransactionsBatchMutation = useCreateTransactionsBatchMutation();
  const updateTransactionMutation = useUpdateTransactionMutation();
  const {
    isRecording,
    isProcessing,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
  } = useVoiceRecorder({
    onFinish: async ({ base64, mimeType }) => {
      await runAI(async () =>
        parseTransactionResponse(
          await requestTransactionParse({
            categories: activeCategories,
            assets,
            audio: { base64, mimeType },
          }),
          activeCategories,
          assets,
          date,
        ),
      );
    },
    onError: reportAIError,
  });

  // A field the user touches is theirs again, so its sparkle goes with the edit.
  const clearAiFilled = useCallback((...fields: AiFilledField[]) => {
    setAiFilled((current) => {
      if (!fields.some((field) => current.has(field))) {
        return current;
      }

      const next = new Set(current);

      fields.forEach((field) => next.delete(field));

      return next;
    });
  }, []);

  const markAiFilled = useCallback((...fields: AiFilledField[]) => {
    setAiFilled((current) => new Set([...current, ...fields]));
  }, []);

  const isAIBusy = isParsing || isProcessing;
  const isEditing = transactionToEdit !== null;
  const isTransfer = type === 'transfer';
  // Only a transfer into an investment account buys a holding. A transfer into a
  // plain bank account is just cash moving, and names no asset.
  const isInvestmentPurchase = isTransfer && selectedToAsset?.type === 'investment';
  // A transfer is never split, and editing a single row of an existing plan
  // must not spawn a second one — so the field only ever applies to a new
  // expense or income.
  const canSplitIntoInstallments = !isTransfer && !isEditing;
  const installmentCount = canSplitIntoInstallments ? parseInstallmentsInput(installments) : 1;
  const parsedTotalAmount = parseAmountString(amount);
  const installmentAmount =
    canSplitIntoInstallments && installmentCount > 1 && Number.isFinite(parsedTotalAmount) && parsedTotalAmount > 0
      ? parsedTotalAmount / installmentCount
      : null;

  // A transfer moves money rather than spending it, so it is never categorised.
  const { suggestedCategory } = useCategorySuggestion({
    title,
    type: isTransfer ? null : type,
    categories: activeCategories,
    enabled: visible && !isTransfer,
  });

  // Applies a fresh suggestion as long as the current pick is still an AI
  // guess (or there is none yet) — a category the user picked themselves is
  // never silently swapped out from under them.
  useEffect(() => {
    if (!suggestedCategory || (selectedCategory && !aiFilled.has('category'))) {
      return;
    }

    if (selectedCategory?.id === suggestedCategory.id) {
      return;
    }

    setSelectedCategory(suggestedCategory);
    markAiFilled('category');
  }, [suggestedCategory]);

  /**
   * Symbols already held in the destination account, matched against what has
   * been typed. Repeat purchases are the common case, and they must reuse the
   * exact same symbol to group into one holding — so this is the search.
   */
  const symbolSuggestions = useMemo(() => {
    if (!isInvestmentPurchase) {
      return [];
    }

    const query = assetSymbol.trim().toUpperCase();
    const found = new Set<string>();

    for (const row of transactions) {
      const symbol = row.asset_symbol;

      if (!symbol || symbol === query) {
        continue;
      }

      if (selectedToAsset && row.to_asset_id !== selectedToAsset.id) {
        continue;
      }

      if (query.length > 0 && !symbol.startsWith(query)) {
        continue;
      }

      found.add(symbol);
    }

    return [...found].slice(0, SYMBOL_SUGGESTIONS);
  }, [assetSymbol, isInvestmentPurchase, selectedToAsset, transactions]);

  // Live ticker/company search against the shared Yahoo Finance endpoint. Only
  // meaningful once the holding fields are showing, so it stays idle otherwise.
  const {
    results: symbolResults,
    isSearching: isSymbolSearching,
    error: symbolSearchError,
  } = useAssetSearch(isInvestmentPurchase ? assetSymbol : '');
  const showSymbolDropdown =
    isInvestmentPurchase && isSymbolFocused && assetSymbol.trim().length > 0;

  // Fetched once per explicit dropdown pick (see `priceSymbol`), to prefill
  // "Unit Price" without waiting on a debounce.
  const { quote: assetQuote } = useAssetQuote(priceSymbol ?? '');

  // Shares × Unit Price is the actual cash amount a holding purchase moves —
  // this is what gets saved as the transaction amount, not whatever is left
  // over in the hero Amount field.
  const sharesNum = parseOptionalAmount(shares);
  const unitPriceNum = parseOptionalAmount(unitPrice);
  const holdingTotal =
    isInvestmentPurchase && sharesNum !== null && unitPriceNum !== null
      ? sharesNum * unitPriceNum
      : null;

  const typeAccent =
    type === 'expense' ? colors.expense : type === 'income' ? colors.income : colors.text;
  // A holding purchase is priced by its own fields; the hero input just mirrors it.
  const parsedAmount =
    isInvestmentPurchase && holdingTotal !== null ? holdingTotal : parseAmountString(amount);
  const showBaseHint =
    currency !== DEFAULT_CURRENCY && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const baseAmount =
    showBaseHint && Number.isFinite(exchangeRate) ? toBaseAmount(parsedAmount, exchangeRate) : null;

  /**
   * Soft, non-blocking heads-up when a spend or transfer would take the source
   * account negative. Income never debits, and a card is expected to run
   * negative, so neither is worth warning about.
   */
  const insufficientBalanceWarning = useMemo(() => {
    if (type === 'income' || !selectedAsset || selectedAsset.type === 'card') {
      return null;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isFinite(exchangeRate)) {
      return null;
    }

    const debit = toBaseAmount(parsedAmount, exchangeRate);
    const currentBalance = balanceByAsset.get(selectedAsset.id) ?? 0;

    if (currentBalance - debit >= 0) {
      return null;
    }

    return i18n.t('addTransaction.insufficientBalance', {
      account: formatAssetLabel(selectedAsset),
      amount: formatCurrency(currentBalance, DEFAULT_CURRENCY),
    });
  }, [type, selectedAsset, parsedAmount, exchangeRate, balanceByAsset]);

  // The hero Amount field always mirrors the holding total, so what the user
  // sees at a glance and what gets saved can never drift apart.
  useEffect(() => {
    if (isInvestmentPurchase && holdingTotal !== null) {
      setAmount(formatAmountForInput(holdingTotal));
    }
  }, [isInvestmentPurchase, holdingTotal]);

  // A quote is fetched once per explicit dropdown pick (see `priceSymbol`),
  // then left alone — the field stays fully editable for limit orders.
  useEffect(() => {
    if (!assetQuote) {
      return;
    }

    setUnitPrice(formatAmountForInput(assetQuote.regularMarketPrice));

    const quoteCurrency = assetQuote.currency?.toUpperCase();
    if (isPickableCurrency(quoteCurrency)) {
      setCurrency(quoteCurrency);
    }
    // Only re-run for a new pick, not every time the quote object is refetched
    // with identical data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetQuote, priceSymbol]);

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
    setAiFilled(new Set());
    setSelectedAsset(null);
    setSelectedToAsset(null);
    setAssetSymbol('');
    setShares('');
    setUnitPrice('');
    setInstallments('1');
    setPriceSymbol(null);
    setCurrency(DEFAULT_CURRENCY);
    setExchangeRate(1);
    setIsRateLoading(false);
    setShowDatePicker(false);
    setShowCategoryPicker(false);
    setShowAssetPicker(false);
    setShowToAssetPicker(false);
    setShowCurrencyPicker(false);
    setAiInput('');
    setIsScanningReceipt(false);
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
    setSelectedToAsset(assets.find((asset) => asset.id === transactionToEdit.to_asset_id) ?? null);
    setAssetSymbol(transactionToEdit.asset_symbol ?? '');
    setShares(
      transactionToEdit.shares !== null ? formatAmountForInput(transactionToEdit.shares) : '',
    );
    setUnitPrice(
      transactionToEdit.unit_price !== null
        ? formatAmountForInput(transactionToEdit.unit_price)
        : '',
    );
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
    setFormError(error instanceof Error ? error.message : i18n.t('addTransaction.aiError'));
  }

  function applyValues(values: TransactionValues, filled: AiFilledField[]) {
    // A focused TextInput can push its stale native value back into state on blur,
    // so the keyboard is dismissed before the parsed values are written.
    Keyboard.dismiss();
    isProgrammaticAmountRef.current = true;
    const nextAmount = formatAmountForInput(values.amount);
    setAmount(nextAmount);

    setAmountSelection({ start: nextAmount.length, end: nextAmount.length });

    setTitle(values.title);
    setType(values.type);
    setDate(values.date);
    setSelectedCategory(values.category);
    // Every field the model answered with gets a sparkle, and keeps it until
    // the user edits that field. The account only counts when one was actually
    // matched, since an unmatched one leaves the existing pick untouched below.
    setAiFilled(new Set(values.asset ? filled : filled.filter((field) => field !== 'asset')));

    // Only overrides the account when the user actually named one, so a request
    // that says nothing about it keeps the default or the existing pick.
    if (values.asset) {
      setSelectedAsset(values.asset);
    }

    if (values.type === 'transfer') {
      if (values.toAsset) {
        setSelectedToAsset(values.toAsset);
      }

      setAssetSymbol(values.assetSymbol ?? '');
      setShares(values.shares !== null ? formatAmountForInput(values.shares) : '');
      setUnitPrice(values.unitPrice !== null ? formatAmountForInput(values.unitPrice) : '');
    } else {
      // The request turned out not to be a transfer, so the fields only a
      // transfer can carry are cleared rather than left over from a previous one.
      setSelectedToAsset(null);
      setAssetSymbol('');
      setShares('');
      setUnitPrice('');
    }

    if (values.currency) {
      setCurrency(values.currency);
    }

    // Only a new expense or income can be split, so anything the model heard
    // otherwise is dropped rather than silently carried over.
    setInstallments(values.type !== 'transfer' && !isEditing ? String(values.installments) : '1');
  }

  function handleAmountChange(text: string) {
    const masked = maskAmountInput(text);

    if (isProgrammaticAmountRef.current) {
      isProgrammaticAmountRef.current = false;
      setAmount(masked);
      return;
    }

    clearAiFilled('amount');

    const nextCursor = amountCursorAfterMask(
      amount,
      text,
      masked,
      amountSelectionRef.current.start,
    );

    setAmount(masked);
    setAmountSelection({ start: nextCursor, end: nextCursor });
  }

  /**
   * Single entry point for the typed, the spoken and the scanned request. Each
   * caller supplies its own fetch-and-parse step, because a receipt answers
   * with ids while voice and text answer with names.
   */
  async function runAI(request: () => Promise<AIResult>) {
    setFormError(null);
    setIsParsing(true);

    try {
      const { action, values, aiFilled: filled } = await request();

      if (action === 'cancel') {
        onClose();
        return true;
      }

      if (!values) {
        return true;
      }

      const resolved = { ...values, title: values.title || title };

      applyValues(resolved, filled);

      if (action === 'save') {
        // `applyValues` has only queued its state update, so the accounts the AI
        // just named are read from the result rather than from stale state.
        const result = validateDraft(
          { ...resolved, toAsset: resolved.toAsset ?? selectedToAsset },
          resolved.asset ?? selectedAsset,
        );

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

    const parsed = await runAI(async () =>
      parseTransactionResponse(
        await requestTransactionParse({ categories: activeCategories, assets, text }),
        activeCategories,
        assets,
        date,
      ),
    );

    if (parsed) {
      setAiInput('');
    }
  }

  /** Scan Receipt: Gemini Vision reads the photo, then the same `runAI` path fills the form. */
  async function handleScanReceipt() {
    if (isAIBusy || isRecording) {
      return;
    }

    try {
      const image = await pickReceiptImage();

      if (!image) {
        return;
      }

      setIsScanningReceipt(true);
      await runAI(async () =>
        parseReceiptResponse(
          await requestReceiptScan({ image, categories: activeCategories, assets }),
          activeCategories,
          assets,
          date,
        ),
      );
    } catch (error) {
      reportAIError(error);
    } finally {
      setIsScanningReceipt(false);
    }
  }

  /**
   * Splits one draft into `draft.installments` equal monthly rows, all tagged
   * with the same fresh group id so they can later be edited or deleted as one
   * plan. The last row absorbs the rounding remainder, so the rows always sum
   * back to exactly the original total.
   */
  async function saveInstallmentPlan(draft: TransactionDraft) {
    if (draft.type === 'transfer') {
      throw new Error('Transfers cannot be split into installments.');
    }
    const inputs = buildInstallmentPlan({
      title: draft.title,
      amount: draft.amount,
      installments: draft.installments,
      type: draft.type,
      date: draft.date,
      asset: draft.asset,
      categoryId: draft.category?.id ?? null,
      currency,
      exchangeRate,
      groupId: generateInstallmentGroupId(),
    });
    await createTransactionsBatchMutation.mutateAsync(inputs);
  }

  async function saveTransaction(draft: TransactionDraft) {
    if (isRateLoading || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setFormError(i18n.t('addTransaction.rateRequired'));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (!transactionToEdit && draft.type !== 'transfer' && draft.installments > 1) {
        await saveInstallmentPlan(draft);
      } else {
        const input: TransactionInput = {
          title: draft.title,
          amount: draft.amount,
          currency,
          // Locked-in rate at save time — never rewritten when live rates move.
          exchange_rate: exchangeRate,
          type: draft.type,
          date: toISODate(draft.date),
          billing_month: billingMonthISO(draft.type, draft.date, draft.asset),
          category_id: draft.category?.id ?? null,
          asset_id: draft.asset.id,
          to_asset_id: draft.toAsset?.id ?? null,
          asset_symbol: draft.assetSymbol,
          shares: draft.shares,
          unit_price: draft.unitPrice,
          // Editing a row keeps whatever plan it already belonged to.
          installment_group_id: transactionToEdit?.installment_group_id ?? null,
        };

        if (transactionToEdit) {
          await updateTransactionMutation.mutateAsync({ id: transactionToEdit.id, input });
        } else {
          await createTransactionMutation.mutateAsync(input);
        }
      }

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

    const result = validateDraft(
      {
        title,
        // Double entry has to be exact: once shares and unit price are both
        // known, they — not whatever is left sitting in the Amount field —
        // are the source of truth for what leaves the source account.
        amount: isInvestmentPurchase && holdingTotal !== null ? holdingTotal : parseAmountString(amount),
        // A row's type has to match its category, which the toggle alone cannot
        // guarantee. A transfer has no category to defer to.
        type: isTransfer ? 'transfer' : selectedCategory?.type ?? type,
        date,
        category: isTransfer ? null : selectedCategory,
        asset: selectedAsset,
        toAsset: isTransfer ? selectedToAsset : null,
        // A holding only exists inside an investment account.
        assetSymbol: isInvestmentPurchase ? normalizeAssetSymbol(assetSymbol) : null,
        shares: isInvestmentPurchase ? parseOptionalAmount(shares) : null,
        unitPrice: isInvestmentPurchase ? parseOptionalAmount(unitPrice) : null,
        currency: null,
        installments: installmentCount,
      },
      selectedAsset,
    );

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
    setCategoryTab(type === 'income' ? 'income' : 'expense');
    setShowCategoryPicker(true);
  }

  function handleSelectCategory(category: Category) {
    setSelectedCategory(category);
    clearAiFilled('category');
    setType(category.type);
    setShowCategoryPicker(false);
  }

  /**
   * A category belongs to exactly one type, and the save derives the saved type
   * from the category. Dropping a mismatched pick keeps the toggle authoritative
   * instead of letting the stale category silently overrule it. Switching away
   * from a transfer likewise drops the fields only a transfer can carry.
   */
  function handleChangeType(nextType: TransactionType) {
    setType(nextType);
    setFormError(null);

    if (nextType === 'transfer') {
      setSelectedCategory(null);
      clearAiFilled('category');
      setInstallments('1');
      return;
    }

    setSelectedToAsset(null);
    setAssetSymbol('');
    setIsSymbolFocused(false);
    setShares('');
    setUnitPrice('');
    setPriceSymbol(null);

    if (selectedCategory && selectedCategory.type !== nextType) {
      setSelectedCategory(null);
      clearAiFilled('category');
    }
  }

  function handleOpenAssetPicker() {
    Keyboard.dismiss();
    setShowAssetPicker(true);
  }

  function handleSelectAsset(asset: Asset) {
    setSelectedAsset(asset);
    clearAiFilled('asset');
    setShowAssetPicker(false);

    // The two sides of a transfer must differ, so a clash drops the destination
    // rather than leaving the form in a state that cannot be saved.
    if (selectedToAsset?.id === asset.id) {
      setSelectedToAsset(null);
    }
  }

  function handleOpenToAssetPicker() {
    Keyboard.dismiss();
    setShowToAssetPicker(true);
  }

  function handleSelectToAsset(asset: Asset) {
    setSelectedToAsset(asset);
    setShowToAssetPicker(false);

    // A holding only exists inside a brokerage, so a plain account drops it.
    if (asset.type !== 'investment') {
      setAssetSymbol('');
      setShares('');
      setUnitPrice('');
      setPriceSymbol(null);
    }
  }

  function handleSelectSymbolResult(result: AssetSearchResult) {
    const symbol = result.symbol.toUpperCase();
    setAssetSymbol(symbol);
    // A blank title is otherwise left for the user to fill in by hand, so a
    // recognisable name from the search result is a welcome shortcut.
    if (!title.trim()) {
      setTitle(result.name);
    }
    setIsSymbolFocused(false);
    Keyboard.dismiss();
    // Triggers the live quote fetch that prefills Unit Price below.
    setPriceSymbol(symbol);
  }

  function handleOpenCurrencyPicker() {
    Keyboard.dismiss();
    setShowCurrencyPicker(true);
  }

  function handleSelectCurrency(option: CurrencyOption) {
    setCurrency(option.id);
    clearAiFilled('currency');
    setShowCurrencyPicker(false);
    setFormError(null);
  }

  function handleOpenDatePicker() {
    Keyboard.dismiss();
    setShowDatePicker(true);
  }

  function handleDateValueChange(_event: DateTimePickerChangeEvent, selectedDate: Date) {
    setDate(selectedDate);
    clearAiFilled('date');

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

          <KeyboardAvoidingView
            style={styles.formBody}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.formBody}>
              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.amountSection}>
              <View style={styles.amountRow}>
                <Text style={[styles.currency, { color: typeAccent }]}>
                  {CURRENCY_META[currency].symbol}
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    { color: typeAccent },
                    isInvestmentPurchase && styles.amountInputDisabled,
                  ]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  onSelectionChange={(event) => {
                    amountSelectionRef.current = event.nativeEvent.selection;
                  }}
                  selection={amountSelection}
                  placeholder={amountInputPlaceholder()}
                  placeholderTextColor={colors.placeholderFaint}
                  keyboardType="decimal-pad"
                  editable={!isInvestmentPurchase}
                  autoFocus={!isInvestmentPurchase}
                />
                {aiFilled.has('amount') ? (
                  <AiSparkle
                    colors={colors}
                    size={18}
                    label={i18n.t('addTransaction.aiFilledField')}
                  />
                ) : null}
              </View>
              {isInvestmentPurchase ? (
                <View style={styles.baseHint}>
                  <Text style={styles.baseHintText}>
                    {i18n.t('addTransaction.calculatedFromHolding')}
                  </Text>
                </View>
              ) : currency !== DEFAULT_CURRENCY ? (
                <View style={styles.baseHint}>
                  {isRateLoading ? (
                    <Text style={styles.baseHintText}>{i18n.t('addTransaction.rateLoading')}</Text>
                  ) : baseAmount !== null ? (
                    <Text style={styles.baseHintText}>
                      {i18n.t('addTransaction.baseAmountHint', {
                        amount: formatCurrency(baseAmount, DEFAULT_CURRENCY),
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Editing an existing row is a manual correction, so the AI hub is hidden. */}
            {isEditing ? null : (
              <SmartDock
                visible={visible}
                aiInput={aiInput}
                onChangeAiInput={setAiInput}
                onSubmitText={handleParseText}
                isRecording={isRecording}
                isVoiceProcessing={isProcessing}
                isBusy={isAIBusy}
                onVoicePressIn={startRecording}
                onVoicePressOut={stopRecording}
                onScan={() => void handleScanReceipt()}
              />
            )}

            {/* The direction of the money decides which fields below apply, so it
                leads the form rather than sitting inside the details card. */}
            <SegmentedControl
              options={transactionTypeOptions()}
              value={type}
              onChange={handleChangeType}
              activeColor={typeAccent}
            />

            <View style={styles.card}>
              <FormRow
                styles={styles}
                colors={colors}
                icon={<Type color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.titleLabel')}>
                <View style={styles.aiInputRow}>
                  {aiFilled.has('title') ? (
                    <AiSparkle colors={colors} label={i18n.t('addTransaction.aiFilledField')} />
                  ) : null}
                  <TextInput
                    style={styles.rowInput}
                    value={title}
                    onChangeText={(text) => {
                      clearAiFilled('title');
                      setTitle(text);
                    }}
                    placeholder={i18n.t('addTransaction.titlePlaceholder')}
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="done"
                  />
                </View>
              </FormRow>

              <FormRow
                styles={styles}
                colors={colors}
                icon={<CircleDollarSign color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.currency')}
                onPress={handleOpenCurrencyPicker}>
                <View style={styles.aiValueRow}>
                  {aiFilled.has('currency') ? (
                    <AiSparkle colors={colors} label={i18n.t('addTransaction.aiFilledField')} />
                  ) : null}
                  <Text style={styles.rowText}>
                    {CURRENCY_META[currency].symbol} {currency}
                  </Text>
                </View>
              </FormRow>

              <FormRow
                styles={styles}
                colors={colors}
                icon={<Wallet color={colors.textMuted} size={20} />}
                label={
                  isTransfer
                    ? i18n.t('addTransaction.fromAsset')
                    : i18n.t('addTransaction.asset')
                }
                onPress={handleOpenAssetPicker}>
                {selectedAsset ? (
                  <View style={styles.aiValueRow}>
                    {aiFilled.has('asset') ? (
                      <AiSparkle colors={colors} label={i18n.t('addTransaction.aiFilledAccount')} />
                    ) : null}
                    <Text style={styles.rowText}>{formatAssetLabel(selectedAsset)}</Text>
                  </View>
                ) : (
                  <Text style={styles.rowPlaceholder}>{i18n.t('addTransaction.selectAsset')}</Text>
                )}
              </FormRow>

              {/* A transfer books both sides of the entry; a spend has a category instead. */}
              {isTransfer ? (
                <FormRow
                  styles={styles}
                  colors={colors}
                  icon={<Landmark color={colors.textMuted} size={20} />}
                  label={i18n.t('addTransaction.toAsset')}
                  onPress={handleOpenToAssetPicker}>
                  {selectedToAsset ? (
                    <Text style={styles.rowText}>{formatAssetLabel(selectedToAsset)}</Text>
                  ) : (
                    <Text style={styles.rowPlaceholder}>
                      {i18n.t('addTransaction.selectToAsset')}
                    </Text>
                  )}
                </FormRow>
              ) : (
                <FormRow
                  styles={styles}
                  colors={colors}
                  icon={<Folder color={colors.textMuted} size={20} />}
                  label={i18n.t('addTransaction.category')}
                  onPress={handleOpenCategoryPicker}>
                  {selectedCategory ? (
                    <View style={styles.aiValueRow}>
                      {aiFilled.has('category') ? (
                        <AiSparkle
                          colors={colors}
                          label={i18n.t('addTransaction.aiSuggestedCategory')}
                        />
                      ) : null}
                      <Text style={styles.rowText}>
                        {selectedCategory.icon} {resolveCategoryName(selectedCategory)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.rowPlaceholder}>
                      {i18n.t('addTransaction.selectCategory')}
                    </Text>
                  )}
                </FormRow>
              )}

              <FormRow
                styles={styles}
                colors={colors}
                icon={<Calendar color={colors.textMuted} size={20} />}
                label={i18n.t('addTransaction.date')}
                onPress={handleOpenDatePicker}
                isLast={!canSplitIntoInstallments}>
                <View style={styles.aiValueRow}>
                  {aiFilled.has('date') ? (
                    <AiSparkle colors={colors} label={i18n.t('addTransaction.aiFilledField')} />
                  ) : null}
                  <Text style={styles.rowText}>{formatDate(date)}</Text>
                </View>
              </FormRow>

              {/* Splits a new expense or income into equal monthly payments. Not
                  offered for a transfer, or while editing a single existing row. */}
              {canSplitIntoInstallments ? (
                <FormRow
                  styles={styles}
                  colors={colors}
                  icon={<Repeat color={colors.textMuted} size={20} />}
                  label={i18n.t('addTransaction.installments')}
                  isLast>
                  <TextInput
                    style={styles.rowInput}
                    value={installments}
                    onChangeText={(text) => setInstallments(sanitizeInstallmentsInput(text))}
                    placeholder="1"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </FormRow>
              ) : null}
            </View>

            {canSplitIntoInstallments && installmentCount > 1 && installmentAmount !== null ? (
              <View style={styles.baseHint}>
                <Text style={styles.baseHintText}>
                  {i18n.t('addTransaction.installmentsHint', {
                    count: installmentCount,
                    amount: formatCurrency(installmentAmount, currency),
                  })}
                </Text>
              </View>
            ) : null}

            {insufficientBalanceWarning ? (
              <View style={styles.warningBanner}>
                <AlertTriangle color={colors.warning} size={16} />
                <Text style={styles.warningBannerText}>{insufficientBalanceWarning}</Text>
              </View>
            ) : null}

            {/* Tier two: which holding inside the brokerage this buys. Hidden for a
                transfer into a plain account, where there is no asset to name. */}
            {isInvestmentPurchase ? (
              <View style={styles.holdingCard}>
                <View style={styles.holdingHeader}>
                  <TrendingUp color={colors.brandLight} size={18} />
                  <Text style={styles.holdingTitle}>{i18n.t('addTransaction.holding')}</Text>
                </View>

                <View style={styles.holdingField}>
                  <Text style={styles.holdingLabel}>{i18n.t('addTransaction.assetSymbol')}</Text>
                  <TextInput
                    style={styles.holdingInput}
                    value={assetSymbol}
                    onChangeText={setAssetSymbol}
                    onFocus={() => setIsSymbolFocused(true)}
                    onBlur={() => setIsSymbolFocused(false)}
                    placeholder={i18n.t('addTransaction.assetSymbolPlaceholder')}
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                  />

                  {showSymbolDropdown ? (
                    <View style={styles.symbolDropdown}>
                      {isSymbolSearching ? (
                        <View style={styles.symbolDropdownRow}>
                          <ActivityIndicator size="small" color={colors.textMuted} />
                          <Text style={styles.symbolDropdownMuted}>
                            {i18n.t('addTransaction.searchingSymbols')}
                          </Text>
                        </View>
                      ) : symbolResults.length > 0 ? (
                        <ScrollView
                          style={styles.symbolDropdownScroll}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled>
                          {symbolResults.map((result) => (
                            <TouchableOpacity
                              key={`${result.symbol}-${result.exchange ?? ''}`}
                              activeOpacity={0.7}
                              onPress={() => handleSelectSymbolResult(result)}
                              style={styles.symbolDropdownRow}>
                              <View style={styles.symbolDropdownText}>
                                <Text style={styles.symbolDropdownSymbol}>{result.symbol}</Text>
                                <Text style={styles.symbolDropdownName} numberOfLines={1}>
                                  {result.name}
                                  {result.exchange ? ` · ${result.exchange}` : ''}
                                </Text>
                              </View>
                              {result.type ? (
                                <Text style={styles.symbolDropdownType}>{result.type}</Text>
                              ) : null}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : symbolSearchError ? (
                        <Text style={styles.symbolDropdownMuted}>
                          {i18n.t('addTransaction.symbolSearchError')}
                        </Text>
                      ) : (
                        <Text style={styles.symbolDropdownMuted}>
                          {i18n.t('addTransaction.noSymbolResults')}
                        </Text>
                      )}
                    </View>
                  ) : null}
                </View>

                {!showSymbolDropdown && symbolSuggestions.length > 0 ? (
                  <View style={styles.holdingField}>
                    <Text style={styles.holdingLabel}>{i18n.t('addTransaction.heldInAccount')}</Text>
                    <View style={styles.suggestions}>
                      {symbolSuggestions.map((symbol) => (
                        <TouchableOpacity
                          key={symbol}
                          activeOpacity={0.7}
                          onPress={() => setAssetSymbol(symbol)}
                          style={styles.suggestion}>
                          <Text style={styles.suggestionText}>{symbol}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.holdingSplit}>
                  <View style={[styles.holdingField, styles.holdingFieldHalf]}>
                    <Text style={styles.holdingLabel}>{i18n.t('addTransaction.shares')}</Text>
                    <TextInput
                      style={styles.holdingInput}
                      value={shares}
                      onChangeText={(text) => setShares(sanitizeAmountInput(text))}
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                  </View>

                  <View style={[styles.holdingField, styles.holdingFieldHalf]}>
                    <Text style={styles.holdingLabel}>{i18n.t('addTransaction.unitPrice')}</Text>
                    <TextInput
                      style={styles.holdingInput}
                      value={unitPrice}
                      onChangeText={(text) => setUnitPrice(sanitizeAmountInput(text))}
                      placeholder="0,00"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                {holdingTotal !== null ? (
                  <View style={styles.holdingTotal}>
                    <Text style={styles.holdingTotalLabel}>
                      {i18n.t('addTransaction.totalDeduction')}
                    </Text>
                    <Text style={styles.holdingTotalValue}>
                      {formatCurrency(holdingTotal, currency)}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.holdingHint}>{i18n.t('addTransaction.investmentHint')}</Text>
              </View>
            ) : null}

            {showDatePicker && (
              <View style={styles.card}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  // iOS's spinner otherwise follows the device's system
                  // appearance, which can mismatch our own Light/Dark/Auto
                  // preference and render white-on-white text.
                  themeVariant={scheme}
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
              </ScrollView>

              {isScanningReceipt ? (
                <ReceiptAnalyzingOverlay />
              ) : isProcessing ? (
                <ReceiptAnalyzingOverlay title={i18n.t('addTransaction.aiVoiceProcessing')} />
              ) : null}
            </View>
          </KeyboardAvoidingView>

          {pendingDraft ? (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>{i18n.t('addTransaction.confirmTitle')}</Text>
                <Text style={styles.confirmLine}>{pendingDraft.title}</Text>
                <Text style={styles.confirmLine}>
                  {formatCurrency(pendingDraft.amount, currency)}
                  {pendingDraft.category ? ` · ${resolveCategoryName(pendingDraft.category)}` : ''}
                </Text>
                {currency !== DEFAULT_CURRENCY && Number.isFinite(exchangeRate) ? (
                  <Text style={styles.confirmDate}>
                    {i18n.t('addTransaction.baseAmountHint', {
                      amount: formatCurrency(
                        toBaseAmount(pendingDraft.amount, exchangeRate),
                        DEFAULT_CURRENCY,
                      ),
                    })}
                  </Text>
                ) : null}
                {/* Guaranteed by validation, so it always names the account being charged. */}
                <Text style={styles.confirmLine}>{formatAssetLabel(pendingDraft.asset)}</Text>
                {pendingDraft.toAsset ? (
                  <Text style={styles.confirmLine}>
                    → {formatAssetLabel(pendingDraft.toAsset)}
                    {pendingDraft.assetSymbol ? ` · ${pendingDraft.assetSymbol}` : ''}
                  </Text>
                ) : null}
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

          <CategoryGroupPicker
            visible={showCategoryPicker}
            categories={activeCategories}
            selectedId={selectedCategory?.id}
            suggestedId={suggestedCategory?.id ?? null}
            tab={categoryTab}
            onChangeTab={setCategoryTab}
            onSelect={handleSelectCategory}
            onClose={() => setShowCategoryPicker(false)}
          />

          <PickerModal
            visible={showAssetPicker}
            title={
              isTransfer ? i18n.t('addTransaction.fromAsset') : i18n.t('addTransaction.assets')
            }
            items={assets}
            selectedId={selectedAsset?.id}
            onSelect={handleSelectAsset}
            onClose={() => setShowAssetPicker(false)}
          />

          <PickerModal
            visible={showToAssetPicker}
            title={i18n.t('addTransaction.toAsset')}
            // The money has to land somewhere else, so the source is not offered.
            items={assets.filter((asset) => asset.id !== selectedAsset?.id)}
            selectedId={selectedToAsset?.id}
            onSelect={handleSelectToAsset}
            onClose={() => setShowToAssetPicker(false)}
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
    formBody: {
      flex: 1,
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
    // A holding purchase derives its amount from Shares × Unit Price, so the
    // hero field only ever mirrors it here — dimmed to read as informational.
    amountInputDisabled: {
      opacity: 0.5,
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
    // A hairline glass edge reads as depth in dark mode, where a shadow alone
    // disappears against the canvas.
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      paddingHorizontal: spacing.lg,
    },
    // A soft, non-blocking notice — never uses `danger`, which is reserved for
    // validation failures that stop the save outright.
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.warningSurface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    warningBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.warningText,
    },
    // The holding group is glass rather than solid, so it reads as a panel layered
    // over the form instead of another row of it. No elevation: Android composites
    // an elevated layer separately and would flatten the translucency to a block.
    holdingCard: {
      gap: spacing.md,
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      padding: spacing.lg,
    },
    holdingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    holdingTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    holdingField: {
      gap: spacing.xs,
    },
    holdingSplit: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    holdingFieldHalf: {
      flex: 1,
    },
    holdingLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    holdingInput: {
      minHeight: TOUCH_TARGET,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    holdingHint: {
      fontSize: 13,
      color: colors.textMuted,
    },
    holdingTotal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.brandSurface,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    holdingTotalLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.brandLight,
    },
    holdingTotalValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.brandLight,
    },
    suggestions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: -spacing.xs,
    },
    suggestion: {
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      backgroundColor: colors.brandSurface,
    },
    suggestionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.brandLight,
    },
    // Sits directly under the ticker input, filling the layout rather than
    // floating above it — simpler and just as clear inside a scrolling form,
    // and avoids clipping against the ScrollView's content bounds.
    symbolDropdown: {
      marginTop: spacing.xs,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderGlass,
      overflow: 'hidden',
    },
    symbolDropdownScroll: {
      maxHeight: 220,
    },
    symbolDropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: TOUCH_TARGET,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderGlass,
    },
    symbolDropdownText: {
      flex: 1,
      gap: 2,
    },
    symbolDropdownSymbol: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    symbolDropdownName: {
      fontSize: 12,
      color: colors.textMuted,
    },
    symbolDropdownType: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.brandLight,
      textTransform: 'uppercase',
    },
    symbolDropdownMuted: {
      flex: 1,
      fontSize: 13,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: TOUCH_TARGET,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderGlass,
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
    // A value preceded by its AI sparkle. Sits inside `rowValue`, which already
    // pushes it to the right edge of the row.
    aiValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    // Same, for a row whose value is a text field: stretched so the input keeps
    // the full width to type in rather than shrinking to its content.
    aiInputRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.xs,
    },
    rowPlaceholder: {
      fontSize: 15,
      color: colors.placeholder,
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
      backgroundColor: colors.surfaceElevated,
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
}
