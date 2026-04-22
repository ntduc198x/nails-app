import { useCallback, useMemo, type ReactElement } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

const COLUMN_GAP = 12;
const CARD_PADDING = 16;
const NUM_COLUMNS = 2;

export type MasonryItem = {
  id: string;
  title: string;
  blurb: string;
  tone: string;
  price: string;
  image: string;
  aspectRatio?: number;
};

type MasonryGridProps = {
  data: ReadonlyArray<MasonryItem>;
  onItemPress?: (item: MasonryItem) => void;
  onItemLongPress?: (item: MasonryItem) => void;
  renderItem?: (item: MasonryItem) => ReactElement;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
};

export function MasonryGrid({
  data,
  onItemPress,
  onItemLongPress,
  renderItem,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
}: MasonryGridProps) {
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => (width - CARD_PADDING * 2 - COLUMN_GAP) / NUM_COLUMNS, [width]);

  const columns = useMemo(() => {
    const cols: MasonryItem[][] = Array.from({ length: NUM_COLUMNS }, () => []);
    const colHeights = Array(NUM_COLUMNS).fill(0);

    data.forEach((item) => {
      const aspectRatio = item.aspectRatio ?? 1.2;
      const itemHeight = cardWidth * aspectRatio + 70;
      let shortestCol = 0;
      let shortestHeight = colHeights[0];

      for (let i = 1; i < NUM_COLUMNS; i++) {
        if (colHeights[i] < shortestHeight) {
          shortestCol = i;
          shortestHeight = colHeights[i];
        }
      }

      cols[shortestCol].push(item);
      colHeights[shortestCol] += itemHeight;
    });

    return cols;
  }, [cardWidth, data]);

  const renderCard = useCallback(
    (item: MasonryItem) => {
      if (renderItem) {
        return (
          <View key={item.id} style={styles.customCardWrapper}>
            {renderItem(item)}
          </View>
        );
      }

      const aspectRatio = item.aspectRatio ?? 1.2;
      const imageHeight = cardWidth * aspectRatio;

      return (
        <Pressable
          key={item.id}
          style={styles.card}
          onPress={() => onItemPress?.(item)}
          onLongPress={() => onItemLongPress?.(item)}
        >
          <Image
            source={{ uri: item.image }}
            alt={item.title}
            style={[styles.cardImage, { height: imageHeight }]}
            resizeMode="cover"
          />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardPrice}>{item.price}</Text>
            <Text style={styles.cardTone}>{item.tone}</Text>
          </View>
        </Pressable>
      );
    },
    [cardWidth, onItemLongPress, onItemPress, renderItem]
  );

  if (!data.length && ListEmptyComponent) {
    return ListEmptyComponent;
  }

  return (
    <View style={styles.container}>
      {ListHeaderComponent}
      <View style={styles.columnsContainer}>
        {columns.map((columnItems, columnIndex) => (
          <View key={columnIndex} style={styles.column}>
            {columnItems.map(renderCard)}
          </View>
        ))}
      </View>
      {ListFooterComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  columnsContainer: {
    flexDirection: "row",
    paddingHorizontal: CARD_PADDING,
    gap: COLUMN_GAP,
  },
  column: {
    flex: 1,
    gap: COLUMN_GAP,
  },
  customCardWrapper: {
    width: "100%",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImage: {
    width: "100%",
  },
  cardBody: {
    padding: 12,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2f241d",
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8b5b36",
  },
  cardTone: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8b7b6c",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
