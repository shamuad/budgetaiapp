import { create } from 'zustand';

type AppState = {
  /** Dashboard account focus filter. `null` means all accounts. */
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  toggleSelectedAsset: (id: string) => void;
  /** Custom card color while the account editor is open. Persisted on save. */
  draftAccountCustomColor: string | null;
  setDraftAccountCustomColor: (color: string | null) => void;
  resetDraftAccountCustomColor: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedAssetId: null,
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  toggleSelectedAsset: (id) =>
    set((state) => ({
      selectedAssetId: state.selectedAssetId === id ? null : id,
    })),
  draftAccountCustomColor: null,
  setDraftAccountCustomColor: (color) => set({ draftAccountCustomColor: color }),
  resetDraftAccountCustomColor: () => set({ draftAccountCustomColor: null }),
}));
