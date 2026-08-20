import {
  AssetInput,
  AssetType,
  countAssetTransactions,
  createAsset,
  DEFAULT_CURRENCY,
  deleteAsset,
  i18n,
  updateAsset,
} from '@budgetaiapp/shared';
import { Alert } from 'react-native';

import { useAssets } from '../../context/AssetsContext';
import { useTransactions } from '../../context/TransactionsContext';
import { accountTypeLabel, accountTypeOptions } from '../../lib/labels';
import { EntryDraft } from './EntryEditor';
import ManageEntriesModal, { ManageEntry } from './ManageEntriesModal';

const ACCOUNT_ICONS = ['💳', '💵', '🏦', '💰', '🪙', '🏧', '💶', '💷', '📈', '🐷', '🧾', '📱'];

/** Ticker-style short code the assets table requires alongside the display name. */
function toSymbol(name: string) {
  return name.replace(/\s+/g, '').toUpperCase().slice(0, 8);
}

export default function ManageAccountsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { assets, refresh } = useAssets();
  const { transactions, refetch } = useTransactions();

  const entries: ManageEntry<AssetType>[] = assets.map((asset) => {
    const used = transactions.filter((row) => row.asset_id === asset.id).length;
    const type = asset.type ?? 'cash';

    return {
      id: asset.id,
      name: asset.name,
      icon: asset.icon,
      type,
      subtitle: `${accountTypeLabel(type)} · ${i18n.t('manage.usage', { count: used })}`,
    };
  });

  /** Reloads the accounts and the rows that embed their names. */
  const syncEverywhere = async () => {
    await Promise.all([refresh(), refetch()]);
  };

  const toInput = (draft: EntryDraft<AssetType>, id: string | null): AssetInput => {
    const existing = assets.find((asset) => asset.id === id);

    return {
      name: draft.name,
      // Investments carry a real ticker, so an edit must never overwrite it.
      symbol: existing?.symbol ?? toSymbol(draft.name),
      type: draft.type,
      icon: draft.icon,
      currency: existing?.currency ?? DEFAULT_CURRENCY,
    };
  };

  return (
    <ManageEntriesModal
      visible={visible}
      title={i18n.t('manage.accounts')}
      entries={entries}
      typeOptions={accountTypeOptions()}
      iconChoices={ACCOUNT_ICONS}
      addLabel={i18n.t('manage.addAccount')}
      createTitle={i18n.t('manage.newAccount')}
      editTitle={i18n.t('manage.editAccount')}
      onCreate={async (draft) => {
        await createAsset(toInput(draft, null));
        await syncEverywhere();
      }}
      onUpdate={async (id, draft) => {
        await updateAsset(id, toInput(draft, id));
        await syncEverywhere();
      }}
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

        await deleteAsset(entry.id);
        await syncEverywhere();

        return true;
      }}
      onClose={onClose}
    />
  );
}
