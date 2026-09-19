import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { spacing } from '@/src/theme';

/** The parts of `usePagedList` the footer needs. */
interface PagedListState {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  loadMore: () => void;
  items: unknown[];
  total: number;
}

/** Sits under a paged list: a spinner while the next page loads, a fallback button otherwise. */
export function ListFooterLoader({ list }: { list: PagedListState }) {
  const colors = usePalette();
  const shown = list.items.length;

  if (list.isFetchingNextPage) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!list.hasNextPage) return null;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={list.loadMore} hitSlop={8} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
        <Text variant="label" color={colors.primary}>
          {list.total > shown ? `Load more · ${shown} of ${list.total}` : 'Load more'}
        </Text>
      </Pressable>
    </View>
  );
}

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/** True when the user is within about one screen of the bottom. */
export function isNearEnd(event: ScrollEvent) {
  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - Math.max(400, layoutMeasurement.height);
}

/** Spread onto a ScrollView to load the next page as the user nears the end. */
export function loadMoreOnScroll(loadMore: () => void) {
  return {
    scrollEventThrottle: 250,
    onScroll: (event: ScrollEvent) => {
      if (isNearEnd(event)) loadMore();
    },
  };
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
