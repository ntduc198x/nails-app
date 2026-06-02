import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { type ScrollView } from "react-native";

type UseRouteScrollFocusArgs<TItem> = {
  clearFocusParams: () => void;
  focusSection?: string;
  getItemId: (item: TItem) => string;
  highlightId?: string;
  itemYRef: MutableRefObject<Record<string, number>>;
  items: TItem[];
  matchesHighlight: (item: TItem, highlightId: string) => boolean;
  offset?: number;
  onMatch?: (item: TItem) => void;
  scrollDelayMs?: number;
  scrollViewRef: RefObject<ScrollView | null>;
  sectionKey: string;
  sectionYRef: MutableRefObject<number>;
};

export function useRouteScrollFocus<TItem>({
  clearFocusParams,
  focusSection,
  getItemId,
  highlightId,
  itemYRef,
  items,
  matchesHighlight,
  offset = 140,
  onMatch,
  scrollDelayMs = 260,
  scrollViewRef,
  sectionKey,
  sectionYRef,
}: UseRouteScrollFocusArgs<TItem>) {
  const handledFocusRef = useRef("");
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (focusSection !== sectionKey && !highlightId) {
      handledFocusRef.current = "";
      return;
    }

    const matchedItem = highlightId
      ? items.find((item) => matchesHighlight(item, highlightId)) ?? null
      : null;
    const focusKey = `${focusSection ?? ""}:${matchedItem ? getItemId(matchedItem) : highlightId ?? ""}:${items.length}`;

    if (handledFocusRef.current === focusKey) {
      return;
    }

    if (matchedItem) {
      onMatch?.(matchedItem);
    }

    handledFocusRef.current = focusKey;

    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = setTimeout(() => {
      const targetItemId = matchedItem ? getItemId(matchedItem) : null;
      const targetY = (targetItemId ? itemYRef.current[targetItemId] : undefined) ?? sectionYRef.current;

      scrollViewRef.current?.scrollTo({
        y: Math.max(0, targetY - offset),
        animated: true,
      });
      clearFocusParams();
    }, scrollDelayMs);
  }, [
    clearFocusParams,
    focusSection,
    getItemId,
    highlightId,
    itemYRef,
    items,
    matchesHighlight,
    offset,
    onMatch,
    scrollDelayMs,
    scrollViewRef,
    sectionKey,
    sectionYRef,
  ]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);
}
