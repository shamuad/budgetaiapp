import { AssetType, i18n, TransactionType } from '@budgetaiapp/shared';

/** The account kinds a user can create from settings. Investments live elsewhere. */
export const ACCOUNT_TYPES: AssetType[] = ['cash', 'card', 'bank'];

// Built on call rather than at module scope so the active locale is always applied.
export function transactionTypeOptions(): { id: TransactionType; label: string }[] {
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
