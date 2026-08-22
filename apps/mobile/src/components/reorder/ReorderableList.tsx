import { useCallback, type ReactElement } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import RNReorderableList, {
  reorderItems,
  type ReorderableListCellAnimations,
  type ReorderableListRenderItemInfo,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';

import { colors, radius } from '../../theme';

export { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
export type { ReorderableListRenderItemInfo };

/**
 * Applied by the library to the dragged cell only, so the row reads as a card
 * lifted off the list while it travels.
 */
const LIFTED_CELL: ReorderableListCellAnimations = {
  // Depth is carried by scale and shadow, so the row can stay fully legible.
  opacity: 1,
  transform: [{ scale: 1.03 }],
  // An opaque surface is what the shadow, and Android's elevation, is cast from.
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  shadowColor: colors.text,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 16,
  shadowOpacity: 0.18,
  elevation: 12,
};

type ReorderableListProps<T extends { id: string }> = {
  data: T[];
  /** Receives the whole reordered array once the user drops an item. */
  onReorder: (next: T[]) => void;
  renderItem: (info: ReorderableListRenderItemInfo<T>) => ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

function keyExtractor(item: { id: string }) {
  return item.id;
}

/**
 * Drag-to-reorder list shared by every reorderable screen.
 *
 * Deliberately stateless: the caller owns `data`, so an optimistic update
 * upstream stays the single source of truth and no render is spent mirroring it.
 */
export default function ReorderableList<T extends { id: string }>({
  data,
  onReorder,
  renderItem,
  contentContainerStyle,
  style,
}: ReorderableListProps<T>) {
  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => onReorder(reorderItems(data, from, to)),
    [data, onReorder],
  );

  return (
    <RNReorderableList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onReorder={handleReorder}
      cellAnimations={LIFTED_CELL}
      // Lets rows read their own drag state through `useIsActive`.
      shouldUpdateActiveItem
      autoscrollThreshold={0.15}
      style={[styles.list, style]}
      contentContainerStyle={contentContainerStyle}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
});
