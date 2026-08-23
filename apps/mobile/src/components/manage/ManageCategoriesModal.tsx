import {
  CategoryInput,
  CategoryType,
  countCategoryTransactions,
  i18n,
  useCategories,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useTransactionsQuery,
  useUpdateCategoryMutation,
} from '@budgetaiapp/shared';
import { Alert } from 'react-native';

import { categoryTypeOptions } from '../../lib/labels';
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
  const { categories } = useCategories();
  const { transactions } = useTransactionsQuery();
  const createCategoryMutation = useCreateCategoryMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();
  const deleteCategoryMutation = useDeleteCategoryMutation();

  const entries: ManageEntry<CategoryType>[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    type: category.type,
    subtitle: i18n.t('manage.usage', {
      count: transactions.filter((row) => row.category_id === category.id).length,
    }),
  }));

  const toInput = (draft: EntryDraft<CategoryType>): CategoryInput => ({
    name: draft.name,
    type: draft.type,
    icon: draft.icon,
  });

  return (
    <ManageEntriesModal
      visible={visible}
      title={i18n.t('manage.categories')}
      entries={entries}
      typeOptions={categoryTypeOptions()}
      iconChoices={CATEGORY_ICONS}
      filterable
      addLabel={i18n.t('manage.addCategory')}
      createTitle={i18n.t('manage.newCategory')}
      editTitle={i18n.t('manage.editCategory')}
      onCreate={async (draft) => {
        await createCategoryMutation.mutateAsync(toInput(draft));
      }}
      onUpdate={async (id, draft) => {
        await updateCategoryMutation.mutateAsync({ id, input: toInput(draft) });
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

        await deleteCategoryMutation.mutateAsync(entry.id);

        return true;
      }}
      onClose={onClose}
    />
  );
}
