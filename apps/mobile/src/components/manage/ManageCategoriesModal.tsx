import {
  CategoryInput,
  countCategoryTransactions,
  createCategory,
  deleteCategory,
  i18n,
  TransactionType,
  updateCategory,
} from '@budgetaiapp/shared';
import { Alert } from 'react-native';

import { useCategories } from '../../context/CategoriesContext';
import { useTransactions } from '../../context/TransactionsContext';
import { transactionTypeOptions } from '../../lib/labels';
import { EntryDraft } from './EntryEditor';
import ManageEntriesModal, { ManageEntry } from './ManageEntriesModal';

// Covers both directions: everyday spending plus the usual income sources.
const CATEGORY_ICONS = [
  '🍔', '🛒', '🚗', '🏠', '💡', '📱', '🎬', '✈️',
  '🏥', '👕', '🎓', '☕', '⛽', '🎁', '🐾', '🏋️',
  '💼', '💰', '📈', '🧾',
];

export default function ManageCategoriesModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { categories, refresh } = useCategories();
  const { transactions, refetch } = useTransactions();

  const entries: ManageEntry<TransactionType>[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    type: category.type,
    subtitle: i18n.t('manage.usage', {
      count: transactions.filter((row) => row.category_id === category.id).length,
    }),
  }));

  /** Reloads the categories and the rows that embed their names. */
  const syncEverywhere = async () => {
    await Promise.all([refresh(), refetch()]);
  };

  const toInput = (draft: EntryDraft<TransactionType>): CategoryInput => ({
    name: draft.name,
    type: draft.type,
    icon: draft.icon,
  });

  return (
    <ManageEntriesModal
      visible={visible}
      title={i18n.t('manage.categories')}
      entries={entries}
      typeOptions={transactionTypeOptions()}
      iconChoices={CATEGORY_ICONS}
      filterable
      addLabel={i18n.t('manage.addCategory')}
      createTitle={i18n.t('manage.newCategory')}
      editTitle={i18n.t('manage.editCategory')}
      onCreate={async (draft) => {
        await createCategory(toInput(draft));
        await syncEverywhere();
      }}
      onUpdate={async (id, draft) => {
        await updateCategory(id, toInput(draft));
        await syncEverywhere();
      }}
      onDelete={async (entry) => {
        // `transactions.category_id` is nullable, so a delete would quietly strip
        // the category off existing rows rather than fail.
        const used = await countCategoryTransactions(entry.id);

        if (used > 0) {
          Alert.alert(
            i18n.t('manage.inUseTitle'),
            i18n.t('manage.inUseMessage', { name: entry.name, count: used }),
          );

          return false;
        }

        await deleteCategory(entry.id);
        await syncEverywhere();

        return true;
      }}
      onClose={onClose}
    />
  );
}
