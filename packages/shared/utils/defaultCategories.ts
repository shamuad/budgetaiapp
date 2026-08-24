/**
 * The exact icon each built-in category was seeded with — see
 * `supabase/migrations/20260823_category_i18n.sql`. The `categories` table
 * only ever stores whichever icon is *currently* active, so this map is the
 * only place "Reset to default icon" can look up what a category originally
 * looked like, keyed by the same `translation_key` the row carries.
 */
export const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  category_salary: '💼',
  category_rent: '🏠',
  category_child_benefit: '👶',
  category_interest: '📈',
  category_other_income: '💰',
  category_mortgage: '🏦',
  category_energy: '💡',
  category_water: '🚰',
  category_transportation: '🚗',
  category_market: '🛒',
  category_eat_drink: '🍔',
  category_clothing: '👕',
  category_home_needs: '🏠',
  category_house_cleaning: '🧹',
  category_education: '🎓',
  category_entertainment: '🎬',
  category_personal_needs: '🧴',
  category_gift: '🎁',
  category_bank_commission: '🏧',
  category_telecom: '📱',
  category_car_insurance: '🚙',
  category_municipality: '🏛️',
  category_subscriptions: '📺',
};
