import {
  DEFAULT_CURRENCY,
  formatAssetLabel,
  formatDate,
  formatCurrency,
  fromISODate,
  i18n,
  TransactionRow,
  useAppStore,
  useAssets,
  useTransactions,
} from '@budgetaiapp/shared';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, ChevronRight, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AddTransactionModal from '../../src/components/AddTransactionModal';
import AccountCard, { ACCOUNT_CARD_HEIGHT, ACCOUNT_CARD_WIDTH } from '../../src/components/AccountCard';
import ManageAccountsModal from '../../src/components/manage/ManageAccountsModal';
import TransactionItem, { transactionAccount } from '../../src/components/TransactionItem';
import { getPeriodRange } from '../../src/lib/analyticsPeriod';
import { spacing } from '../../src/theme';
import { useAppTheme, type ColorTokens } from '../../src/theming';

/** The dashboard is a summary, so the full history stays on the transactions tab. */
const RECENT_LIMIT = 6;

/** Narrower than a real account card, so it reads as a trailing action, not another account. */
const ADD_ACCOUNT_CARD_WIDTH = ACCOUNT_CARD_WIDTH - 60;

/** Which inline section header a transaction falls under, in display order. */
type ActivityBucket = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

// Strictly enforces the display order (Today, then Yesterday, then This
// Week/Earlier) regardless of the order buckets were encountered in.
const ACTIVITY_BUCKET_RANK: Record<ActivityBucket, number> = {
  today: 0,
  yesterday: 1,
  thisWeek: 2,
  earlier: 3,
};

function yesterday(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}

function activityBucketLabel(bucket: ActivityBucket): string {
  switch (bucket) {
    case 'today':
      return i18n.t('dashboard.sectionToday');
    case 'yesterday':
      return i18n.t('dashboard.sectionYesterday');
    case 'thisWeek':
      return i18n.t('dashboard.sectionThisWeek');
    case 'earlier':
      return i18n.t('dashboard.sectionEarlier');
  }
}

/** The category emoji, falling back to a direction arrow for uncategorised rows. */
function TransactionIcon({
  transaction,
  colors,
}: {
  transaction: TransactionRow;
  colors: ColorTokens;
}) {
  if (transaction.category?.icon) {
    return <Text style={{ fontSize: 20 }}>{transaction.category.icon}</Text>;
  }

  if (transaction.type === 'transfer') {
    return <ArrowRightLeft color={colors.textMuted} size={20} />;
  }

  return transaction.type === 'income' ? (
    <ArrowDownLeft color={colors.income} size={20} />
  ) : (
    <ArrowUpRight color={colors.expense} size={20} />
  );
}

export default function DashboardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { transactions, balanceByAsset, isLoading, error, remove, removeGroup } = useTransactions({
    onDeleteError: (err) => {
      Alert.alert(i18n.t('common.errorTitle'), err.message || i18n.t('transactionActions.deleteError'));
    },
  });
  const { assets } = useAssets();
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const toggleSelectedAsset = useAppStore((state) => state.toggleSelectedAsset);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null);
  const [isAddAccountVisible, setIsAddAccountVisible] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  // x-offset of each carousel card (accounts, then the trailing "Add
  // Account" tile), measured via onLayout since the tile is a different
  // width than a real account card and fixed-step math would drift.
  const [cardLayouts, setCardLayouts] = useState<number[]>([]);
  const heroFade = useRef(new Animated.Value(1)).current;
  // +1 for the trailing "Add Account" tile.
  const totalCards = assets.length + 1;

  // Keeps the pagination dots in range if an account is removed while focused
  // on a later card.
  useEffect(() => {
    setActiveCardIndex((current) => Math.min(current, Math.max(totalCards - 1, 0)));
  }, [totalCards]);

  // Fades the headline back in whenever focus moves, so the figure swaps softly
  // instead of snapping to a new number.
  useEffect(() => {
    heroFade.setValue(0);
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [heroFade, selectedAssetId]);

  // Already sorted newest first by the API, so the head of the list is the latest.
  // A transfer belongs to both accounts it touches, so it shows on either one.
  // Grouped into a continuous vertical timeline: each transaction is tagged
  // with the inline section header it falls under, and `showHeader` is only
  // set on the first transaction of each bucket — so an empty bucket simply
  // never appears, with no separate "is it empty" check needed.
  const recentGroups = useMemo(() => {
    const scoped = selectedAssetId
      ? transactions.filter(
          (transaction) =>
            transaction.asset_id === selectedAssetId ||
            transaction.to_asset_id === selectedAssetId,
        )
      : transactions;

    const now = new Date();
    const today = getPeriodRange('day', now);
    const yesterdayRange = getPeriodRange('day', yesterday());
    const week = getPeriodRange('week', now);

    // Buckets by the transaction's actual calendar day — the same date
    // already shown in the row's subtitle — rather than its billing-month
    // period date, which can put a credit purchase in a different bucket
    // than its visible date implies and break the chronological order.
    function bucketFor(transaction: TransactionRow): ActivityBucket {
      const date = fromISODate(transaction.date);
      if (!date) {
        return 'earlier';
      }
      if (date >= today.start && date < today.end) {
        return 'today';
      }
      if (date >= yesterdayRange.start && date < yesterdayRange.end) {
        return 'yesterday';
      }
      if (date >= week.start && date < week.end) {
        return 'thisWeek';
      }
      return 'earlier';
    }

    const withBuckets = scoped
      .slice(0, RECENT_LIMIT)
      .map((transaction) => ({ transaction, bucket: bucketFor(transaction) }));

    // Belt-and-braces: a stable sort guarantees strict Today → Yesterday →
    // This Week → Earlier order even if two rows on the same day arrive in
    // a different sequence than the list they came from.
    withBuckets.sort((a, b) => ACTIVITY_BUCKET_RANK[a.bucket] - ACTIVITY_BUCKET_RANK[b.bucket]);

    let previousBucket: ActivityBucket | null = null;

    return withBuckets.map(({ transaction, bucket }) => {
      const showHeader = bucket !== previousBucket;
      previousBucket = bucket;
      return { transaction, bucket, showHeader };
    });
  }, [selectedAssetId, transactions]);

  const focusedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
  // Headline always matches the cards: one account when focused, otherwise
  // the sum of every account currently on the dashboard. Using net cash
  // flow here drifted from the cards whenever a transfer (or an income
  // booked to an account that is not listed) was in the ledger.
  const headlineBalance = focusedAsset
    ? (balanceByAsset.get(focusedAsset.id) ?? 0)
    : assets.reduce((sum, asset) => sum + (balanceByAsset.get(asset.id) ?? 0), 0);

  function toggleAsset(assetId: string) {
    toggleSelectedAsset(assetId);
  }

  // Carries the dashboard's current account focus into the Transactions tab,
  // so "See All" continues browsing the same scope instead of resetting it.
  function handleSeeAll() {
    router.push({
      pathname: '/(tabs)/transactions',
      params: selectedAssetId ? { filterAccountId: selectedAssetId } : {},
    });
  }

  // Records where each card actually starts, since the trailing "Add
  // Account" tile is narrower than a real account card.
  function handleCardLayout(index: number, event: LayoutChangeEvent) {
    const x = event.nativeEvent.layout.x;
    setCardLayouts((current) => {
      if (current[index] === x) {
        return current;
      }
      const next = [...current];
      next[index] = x;
      return next;
    });
  }

  function handleCarouselScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    let nearestIndex = 0;
    let smallestDiff = Infinity;

    for (let index = 0; index < totalCards; index += 1) {
      const cardStart = cardLayouts[index];
      if (cardStart === undefined) {
        continue;
      }
      const diff = Math.abs(cardStart - offsetX);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        nearestIndex = index;
      }
    }

    setActiveCardIndex(nearestIndex);
  }

  function openEditor(transaction: TransactionRow) {
    setEditingTransaction(transaction);
    setIsModalVisible(true);
  }

  function closeModal() {
    setIsModalVisible(false);
    setEditingTransaction(null);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, { opacity: heroFade }]}>
          <Text style={styles.heroLabel} numberOfLines={1}>
            {focusedAsset ? formatAssetLabel(focusedAsset) : i18n.t('dashboard.totalBalance')}
          </Text>
          <Text
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {formatCurrency(headlineBalance, DEFAULT_CURRENCY)}
          </Text>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('dashboard.myAssets')}</Text>
          {assets.length === 0 ? (
            <Text style={styles.placeholder}>{i18n.t('dashboard.emptyAssets')}</Text>
          ) : (
            // Negative margin lets the cards run to both screen edges while the
            // first one stays aligned with the page gutter.
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleCarouselScroll}
                scrollEventThrottle={16}
                style={styles.accountScroll}
                contentContainerStyle={styles.accountScrollContent}>
                {assets.map((asset, index) => (
                  <View key={asset.id} onLayout={(event) => handleCardLayout(index, event)}>
                    <AccountCard
                      asset={asset}
                      balance={balanceByAsset.get(asset.id) ?? 0}
                      isFocused={selectedAssetId === asset.id}
                      isDimmed={selectedAssetId !== null && selectedAssetId !== asset.id}
                      onPress={() => toggleAsset(asset.id)}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  activeOpacity={0.7}
                  onLayout={(event) => handleCardLayout(assets.length, event)}
                  onPress={() => setIsAddAccountVisible(true)}
                  style={styles.addAccountCard}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('manage.addAccount')}>
                  <Plus color={colors.brand} size={30} strokeWidth={2.5} />
                </TouchableOpacity>
              </ScrollView>

              {totalCards > 1 && (
                <View style={styles.paginationContainer}>
                  {Array.from({ length: totalCards }).map((_, index) => (
                    <View
                      // eslint-disable-next-line react/no-array-index-key -- dots are purely positional
                      key={index}
                      style={index === activeCardIndex ? styles.dotActive : styles.dotInactive}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{i18n.t('dashboard.recentActivity')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSeeAll}
              style={styles.seeAllRow}
              accessibilityRole="button">
              <Text style={styles.showAllLink}>{i18n.t('dashboard.seeAll')}</Text>
              <ChevronRight color={colors.brand} size={16} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : recentGroups.length === 0 ? (
            <Text style={styles.placeholder}>{i18n.t('dashboard.emptyTransactions')}</Text>
          ) : (
            <View>
              {recentGroups.map(({ transaction, bucket, showHeader }, index) => {
                const isIncome = transaction.type === 'income';
                // A transfer neither earns nor spends, so it carries no sign.
                const isTransfer = transaction.type === 'transfer';
                const groupId = transaction.installment_group_id;
                // The divider between rows is redundant right where a new
                // section header is about to start, so it's dropped there too.
                const isLastInSection =
                  index === recentGroups.length - 1 || recentGroups[index + 1].bucket !== bucket;

                return (
                  <View key={transaction.id}>
                    {showHeader && (
                      <Text style={styles.timelineSectionHeader}>{activityBucketLabel(bucket)}</Text>
                    )}
                    <View style={[styles.listRow, !isLastInSection && styles.listRowBorder]}>
                      <TransactionItem
                        flat
                        icon={<TransactionIcon transaction={transaction} colors={colors} />}
                        title={transaction.title}
                        subtitle={formatDate(transaction.date, 'short')}
                        account={transactionAccount(transaction)}
                        amount={`${isTransfer ? '' : isIncome ? '+' : '-'}${formatCurrency(transaction.amount, transaction.currency)}`}
                        positive={isIncome}
                        negative={!isIncome && !isTransfer}
                        onEdit={() => openEditor(transaction)}
                        onDelete={() => (groupId ? removeGroup(groupId) : remove(transaction.id))}
                        deleteConfirmation={
                          groupId
                            ? {
                                title: i18n.t('transactionActions.installmentDeleteTitle'),
                                message: i18n.t('transactionActions.installmentDeleteMessage'),
                                confirmLabel: i18n.t('transactionActions.deleteAll'),
                              }
                            : undefined
                        }
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <AddTransactionModal
        visible={isModalVisible}
        onClose={closeModal}
        transactionToEdit={editingTransaction}
      />

      <ManageAccountsModal
        visible={isAddAccountVisible}
        startInCreateMode
        onClose={() => setIsAddAccountVisible(false)}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
    },
    hero: {
      gap: spacing.xs,
    },
    // Deliberately not uppercased: native casing turns the Turkish "Bakiye" into
    // "BAKIYE" rather than "BAKİYE".
    heroLabel: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textMuted,
    },
    heroAmount: {
      fontSize: 44,
      fontWeight: '800',
      // Tight tracking keeps a long figure from looking loose at this size.
      letterSpacing: -1.6,
      color: colors.text,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    },
    // Explicitly transparent so the cards float directly on the screen's own
    // background instead of any inherited surface color.
    accountScroll: {
      marginHorizontal: -spacing.lg,
      backgroundColor: 'transparent',
    },
    accountScrollContent: {
      paddingHorizontal: spacing.lg,
      // Room for the focused card to scale up without being clipped.
      paddingVertical: spacing.xs,
      gap: spacing.md,
      backgroundColor: 'transparent',
    },
    // Narrower than a real account card and outlined rather than filled, so
    // it reads as a trailing action at the end of the carousel, not another
    // account. `chevron` is already the app's muted, low-emphasis gray.
    addAccountCard: {
      width: ADD_ACCOUNT_CARD_WIDTH,
      height: ACCOUNT_CARD_HEIGHT,
      borderRadius: 18,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.chevron,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dotActive: {
      width: 16,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.brand,
    },
    dotInactive: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      opacity: 0.6,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    seeAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    showAllLink: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.brand,
    },
    // Inline divider above each bucket of the vertical timeline (Today,
    // Yesterday, This Week, Earlier) — subtle and clean, never rendered for
    // a bucket with no transactions.
    timelineSectionHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 16,
      marginBottom: 8,
    },
    listRow: {
      paddingVertical: spacing.md,
    },
    listRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    placeholder: {
      fontSize: 14,
      color: colors.textMuted,
    },
    error: {
      fontSize: 14,
      color: colors.danger,
    },
  });
}
