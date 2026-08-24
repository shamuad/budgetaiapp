import { AssetType, CategoryType, i18n, TransactionType } from '@budgetaiapp/shared';

/** The account kinds a user can create from settings. */
export const ACCOUNT_TYPES: AssetType[] = ['cash', 'card', 'bank', 'investment'];

// Built on call rather than at module scope so the active locale is always applied.

/** Every kind a transaction can be booked as, including a transfer between accounts. */
export function transactionTypeOptions(): { id: TransactionType; label: string }[] {
  return [
    { id: 'expense', label: i18n.t('addTransaction.expense') },
    { id: 'income', label: i18n.t('addTransaction.income') },
    { id: 'transfer', label: i18n.t('addTransaction.transfer') },
  ];
}

/** Transfers carry no category, so category pickers only ever offer the two sides. */
export function categoryTypeOptions(): { id: CategoryType; label: string }[] {
  return [
    { id: 'expense', label: i18n.t('addTransaction.expenses') },
    { id: 'income', label: i18n.t('addTransaction.incomes') },
  ];
}

export function accountTypeOptions(): { id: AssetType; label: string }[] {
  return ACCOUNT_TYPES.map((type) => ({ id: type, label: accountTypeLabel(type) }));
}

export function accountTypeLabel(type: AssetType): string {
  return ACCOUNT_TYPES.includes(type) ? i18n.t(`accountTypes.${type}`) : type;
}

/** The four zoom levels the Analytics screen can page through. */
export type AnalyticsTimeframe = 'day' | 'week' | 'month' | 'year';

export function analyticsTimeframeOptions(): { id: AnalyticsTimeframe; label: string }[] {
  return [
    { id: 'day', label: i18n.t('analytics.timeframeDay') },
    { id: 'week', label: i18n.t('analytics.timeframeWeek') },
    { id: 'month', label: i18n.t('analytics.timeframeMonth') },
    { id: 'year', label: i18n.t('analytics.timeframeYear') },
  ];
}
