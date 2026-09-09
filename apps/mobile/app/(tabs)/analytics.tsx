import { router, useLocalSearchParams } from 'expo-router';
import AnalyticsScreen from '../../src/components/AnalyticsScreen';

export default function AnalyticsRoute() {
  const { filterAccountId, dashboardMonth } = useLocalSearchParams<{ filterAccountId?: string; dashboardMonth?: string }>();
  return <AnalyticsScreen accountId={filterAccountId} dashboardMonth={dashboardMonth} onClearScope={() => router.setParams({ filterAccountId: '' })} />;
}
