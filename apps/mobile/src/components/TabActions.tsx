import { createContext, useContext } from 'react';
import type { SettingsAnchor } from './OptionsModal';

export const TabActionsContext = createContext<{ openSettings: (anchor: SettingsAnchor) => void } | null>(null);
export function useTabActions() {
  const actions = useContext(TabActionsContext);
  if (!actions) throw new Error('Tab actions require the tab layout');
  return actions;
}
