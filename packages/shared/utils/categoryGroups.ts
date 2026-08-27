import i18n from '../i18n';
import type { CategoryGroup } from '../types/database';

/** Every selectable expense category belongs to one of these two tiers. */
export const CATEGORY_GROUPS: CategoryGroup[] = ['needs', 'wants'];

/**
 * The 50/30/20 tier, including 'savings' — which is never a `group_code` a
 * category can carry (see the type comment on `Category`), but still needs a
 * label and a tone color wherever the budget breakdown is displayed.
 */
export type BudgetGroup = CategoryGroup | 'savings';

export const BUDGET_GROUPS: BudgetGroup[] = ['needs', 'wants', 'savings'];

/** The 50/30/20 rule's target share of income for each tier. */
export const BUDGET_GROUP_TARGET_SHARE: Record<BudgetGroup, number> = {
  needs: 0.5,
  wants: 0.3,
  savings: 0.2,
};

/** Blue/indigo for Needs, orange/amber for Wants, green/emerald for Savings. */
export const BUDGET_GROUP_TONE: Record<BudgetGroup, string> = {
  needs: '#4F46E5',
  wants: '#F97316',
  savings: '#10B981',
};

export function budgetGroupLabel(group: BudgetGroup): string {
  return i18n.t(`budgetGroups.${group}`);
}

/**
 * Buckets already-sorted expense categories into Needs / Wants sections for a
 * `SectionList`, in that fixed order. A category somehow missing a
 * `group_code` (a custom one created before this migration, or an edge case)
 * lands in a trailing "Other" section instead of being dropped — the assigned
 * order is preserved within each bucket, so sort first, then group.
 */
export function groupCategoriesByBudgetGroup<T extends { group_code: CategoryGroup | null }>(
  categories: T[],
): { group: CategoryGroup | 'other'; items: T[] }[] {
  const buckets: Record<CategoryGroup | 'other', T[]> = { needs: [], wants: [], other: [] };

  for (const category of categories) {
    buckets[category.group_code ?? 'other'].push(category);
  }

  return [...CATEGORY_GROUPS, 'other' as const]
    .map((group) => ({ group, items: buckets[group] }))
    .filter((section) => section.items.length > 0);
}
