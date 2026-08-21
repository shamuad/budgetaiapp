import { create } from 'zustand';

type AppState = {
  /** Dashboard account focus filter. `null` means all accounts. */
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  toggleSelectedAsset: (id: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedAssetId: null,
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  toggleSelectedAsset: (id) =>
    set((state) => ({
      selectedAssetId: state.selectedAssetId === id ? null : id,
    })),
}));
