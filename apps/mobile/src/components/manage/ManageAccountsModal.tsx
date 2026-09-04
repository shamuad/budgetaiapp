import {
  AssetInput,
  AssetType,
  countAssetTransactions,
  DEFAULT_CURRENCY,
  i18n,
  useAssets,
  useCreateAssetMutation,
  useDeleteAssetMutation,
  useReorderAssetsMutation,
  useTransactionsQuery,
  useUpdateAssetMutation,
} from '@budgetaiapp/shared';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { accountTypeLabel, accountTypeOptions } from '../../lib/labels';
import { EntryDraft } from './EntryEditor';
import ManageEntriesModal, { ManageEntry } from './ManageEntriesModal';

const ACCOUNT_ICONS = ['💳', '💵', '🏦', '💰', '🪙', '🏧', '💶', '💷', '📈', '🐷', '🧾', '📱'];

/**
 * Short code the assets table requires alongside the display name. It identifies
 * the account itself — the holdings inside an investment account carry their own
 * symbols, on the transactions that bought them.
 */
function toSymbol(name: string) {
  return name.replace(/\s+/g, '').toUpperCase().slice(0, 8);
}

export default function ManageAccountsModal({
  visible,
  onClose,
  startInCreateMode,
}: {
  visible: boolean;
  onClose: () => void;
  /** Opens straight into the "new account" editor, e.g. from the dashboard's "Add Account" tile. */
  startInCreateMode?: boolean;
}) {
  const { assets } = useAssets();
  const { transactions } = useTransactionsQuery();
  const createAssetMutation = useCreateAssetMutation();
  const updateAssetMutation = useUpdateAssetMutation();
  const deleteAssetMutation = useDeleteAssetMutation();
  const reorderAssetsMutation = useReorderAssetsMutation();

  const entries: ManageEntry<AssetType>[] = useMemo(() => {
    // Counted in one pass; scanning the ledger per account made every drag frame O(n*m).
    const usage = new Map<string, number>();

    for (const row of transactions) {
      usage.set(row.asset_id, (usage.get(row.asset_id) ?? 0) + 1);
    }

    return assets.map((asset) => {
      const type = asset.type ?? 'cash';

      return {
        id: asset.id,
        name: asset.name,
        icon: asset.icon,
        type,
        customColor: asset.custom_color,
        paymentClue: asset.payment_clue,
        isCredit: asset.is_credit,
        statementDay: asset.statement_day,
        subtitle: `${accountTypeLabel(type)} · ${i18n.t('manage.usage', {
          count: usage.get(asset.id) ?? 0,
        })}`,
      };
    });
  }, [assets, transactions]);

  // `mutateAsync` keeps a stable identity, so the reorderable list never re-renders
  // its rows just because an unrelated query settled.
  const { mutateAsync: reorderAssets } = reorderAssetsMutation;
  const handleReorder = useCallback(
    (orderedIds: string[]) => reorderAssets(orderedIds),
    [reorderAssets],
  );

  const toInput = (draft: EntryDraft<AssetType>, id: string | null): AssetInput => {
    const existing = assets.find((asset) => asset.id === id);

    return {
      name: draft.name,
      // An existing code is left alone, so renaming an account never churns the
      // identifier its history was written against.
      symbol: existing?.symbol ?? toSymbol(draft.name),
      type: draft.type,
      icon: draft.icon,
      currency: existing?.currency ?? DEFAULT_CURRENCY,
      custom_color: draft.customColor ?? null,
      payment_clue: draft.paymentClue ?? null,
      is_credit: draft.type === 'card' && Boolean(draft.isCredit),
      statement_day:
        draft.type === 'card' && draft.isCredit ? (draft.statementDay ?? null) : null,
    };
  };

  return (
    <ManageEntriesModal
      visible={visible}
      title={i18n.t('manage.accounts')}
      entries={entries}
      typeOptions={accountTypeOptions()}
      iconChoices={ACCOUNT_ICONS}
      enableBrandDetect
      showPaymentClue
      showCreditFacility
      reorderable
      startInCreateMode={startInCreateMode}
      addLabel={i18n.t('manage.addAccount')}
      createTitle={i18n.t('manage.newAccount')}
      editTitle={i18n.t('manage.editAccount')}
      onCreate={async (draft) => {
        await createAssetMutation.mutateAsync(toInput(draft, null));
      }}
      onUpdate={async (id, draft) => {
        await updateAssetMutation.mutateAsync({ id, input: toInput(draft, id) });
      }}
      onReorder={handleReorder}
      onDelete={async (entry) => {
        // `transactions.asset_id` is NOT NULL, so the database would reject this
        // with an opaque constraint error. Say it plainly instead.
        const used = await countAssetTransactions(entry.id);

        if (used > 0) {
          Alert.alert(
            i18n.t('manage.inUseTitle'),
            i18n.t('manage.inUseMessage', { name: entry.name, count: used }),
          );

          return false;
        }

        await deleteAssetMutation.mutateAsync(entry.id);

        return true;
      }}
      onClose={onClose}
    />
  );
}
