import React, { useEffect, useRef, useState } from "react";
import { InteractionManager, Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

export const WHEEL_ITEM_HEIGHT = 44;

interface WheelPickerColumnProps {
  labels: string[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  accentColor: string;
  textColor: string;
  secondaryColor: string;
  columnLabel?: string;
  width?: number;
}

export default function WheelPickerColumn({
  labels,
  selectedIndex,
  onIndexChange,
  accentColor,
  textColor,
  secondaryColor,
  columnLabel,
  width = 70,
}: WheelPickerColumnProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [localIndex, setLocalIndex] = useState(selectedIndex);
  const isUserInteractingRef = useRef(false);
  const lastCommittedIndexRef = useRef(selectedIndex);
  const isHandlingScrollEndRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const prevIndexRef = useRef(selectedIndex);

  const syncToIndex = (index: number) => {
    setLocalIndex(index);
    lastCommittedIndexRef.current = index;
    prevIndexRef.current = index;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: false });
    });
  };

  useEffect(() => {
    syncToIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      syncToIndex(selectedIndex);
    });

    return () => handle.cancel();
  }, [selectedIndex]);

  const handleScrollEnd = (event: any) => {
    if (isHandlingScrollEndRef.current || isProgrammaticScrollRef.current) {
      return;
    }

    isHandlingScrollEndRef.current = true;

    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, labels.length - 1));
    const targetY = clampedIndex * WHEEL_ITEM_HEIGHT;

    if (Math.abs(Math.round(offsetY) - targetY) > 2) {
      isProgrammaticScrollRef.current = true;
      scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 250);
    }

    setLocalIndex(clampedIndex);

    if (clampedIndex !== lastCommittedIndexRef.current) {
      lastCommittedIndexRef.current = clampedIndex;
      onIndexChange(clampedIndex);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setTimeout(() => {
      isUserInteractingRef.current = false;
      isHandlingScrollEndRef.current = false;
    }, 50);
  };

  return (
    <View style={{ alignItems: "center", width }}>
      {columnLabel ? (
        <Text style={{ fontSize: 12, color: secondaryColor, marginBottom: 8 }}>
          {columnLabel}
        </Text>
      ) : null}

      <View style={{ height: WHEEL_ITEM_HEIGHT * 3, overflow: "hidden", width }}>
        <View
          style={{
            position: "absolute",
            top: WHEEL_ITEM_HEIGHT,
            left: 0,
            right: 0,
            height: WHEEL_ITEM_HEIGHT,
            backgroundColor: `${accentColor}20`,
            borderRadius: 8,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ITEM_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: WHEEL_ITEM_HEIGHT }}
          onScrollBeginDrag={() => {
            isUserInteractingRef.current = true;
            isHandlingScrollEndRef.current = false;
          }}
          onScroll={(event) => {
            if (isProgrammaticScrollRef.current) {
              return;
            }
            const y = event.nativeEvent.contentOffset.y;
            const index = Math.max(0, Math.min(Math.round(y / WHEEL_ITEM_HEIGHT), labels.length - 1));
            if (index !== prevIndexRef.current) {
              prevIndexRef.current = index;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={(event) => {
            const velocity = event.nativeEvent.velocity?.y ?? 0;
            if (Math.abs(velocity) < 0.5) {
              handleScrollEnd(event);
            }
          }}
          scrollEventThrottle={16}
          nestedScrollEnabled
        >
          {labels.map((label, index) => {
            const isSelected = index === localIndex;
            return (
              <Pressable
                key={`${columnLabel ?? "value"}-${label}-${index}`}
                onPress={() => {
                  if (isProgrammaticScrollRef.current) {
                    return;
                  }
                  isUserInteractingRef.current = true;
                  isProgrammaticScrollRef.current = true;
                  scrollViewRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true });
                  setLocalIndex(index);
                  setTimeout(() => {
                    isProgrammaticScrollRef.current = false;
                    handleScrollEnd({
                      nativeEvent: {
                        contentOffset: { y: index * WHEEL_ITEM_HEIGHT },
                        velocity: { y: 0 },
                      },
                    });
                  }, 250);
                }}
                style={{
                  height: WHEEL_ITEM_HEIGHT,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: isSelected ? 24 : 18,
                    fontWeight: isSelected ? "700" : "500",
                    color: isSelected ? textColor : secondaryColor,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
