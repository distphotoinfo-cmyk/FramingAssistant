import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/AppThemeProvider";
import GuideBubble, { type GuidePlacement } from "./GuideBubble";
import { useGuidance, type GuidanceAnchorRect } from "./GuidanceProvider";
import {
  GUIDANCE_ANCHOR_STABILITY_TOLERANCE,
  GUIDANCE_BACKDROP_ENTER_DURATION,
  GUIDANCE_BACKDROP_EXIT_DURATION,
  GUIDANCE_BUBBLE_BACKDROP_COLOR,
  GUIDANCE_BUBBLE_ENTER_DURATION,
  GUIDANCE_BUBBLE_EXIT_DURATION,
  GUIDANCE_MAX_ANCHOR_MEASURE_ATTEMPTS,
} from "./guidanceTransitionConfig";

export type GuidanceItem = {
  id: string;
  targetId: string;
  text: string;
  preferredPlacement: GuidePlacement;
  allowedPlacements?: GuidePlacement[];
  bubbleOffsetY?: number;
};

interface GuidanceOverlayProps {
  visible: boolean;
  items: GuidanceItem[];
  currentIndex: number;
  onNext: () => void;
  onClose: () => void;
  accentColor: string;
  actionLabel?: string;
  showCloseButton?: boolean;
  dismissOnBackdropPress?: boolean;
}

const EDGE_PADDING = 12;
const TARGET_GAP = 14;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function anchorRectsMatch(a: GuidanceAnchorRect, b: GuidanceAnchorRect) {
  return (
    Math.abs(a.x - b.x) <= GUIDANCE_ANCHOR_STABILITY_TOLERANCE &&
    Math.abs(a.y - b.y) <= GUIDANCE_ANCHOR_STABILITY_TOLERANCE &&
    Math.abs(a.width - b.width) <= GUIDANCE_ANCHOR_STABILITY_TOLERANCE &&
    Math.abs(a.height - b.height) <= GUIDANCE_ANCHOR_STABILITY_TOLERANCE
  );
}

function oppositePlacement(placement: GuidePlacement): GuidePlacement {
  switch (placement) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function perpendicularPlacements(placement: GuidePlacement): GuidePlacement[] {
  if (placement === "top" || placement === "bottom") {
    return ["right", "left"];
  }

  return ["bottom", "top"];
}

function computeCandidateOrigin(
  placement: GuidePlacement,
  anchor: GuidanceAnchorRect,
  contentWidth: number,
  contentHeight: number
) {
  switch (placement) {
    case "top":
      return {
        left: anchor.x + anchor.width / 2 - contentWidth / 2,
        top: anchor.y - contentHeight - TARGET_GAP,
      };
    case "bottom":
      return {
        left: anchor.x + anchor.width / 2 - contentWidth / 2,
        top: anchor.y + anchor.height + TARGET_GAP,
      };
    case "left":
      return {
        left: anchor.x - contentWidth - TARGET_GAP,
        top: anchor.y + anchor.height / 2 - contentHeight / 2,
      };
    case "right":
      return {
        left: anchor.x + anchor.width + TARGET_GAP,
        top: anchor.y + anchor.height / 2 - contentHeight / 2,
      };
  }
}

function computePointerOffset(
  placement: GuidePlacement,
  anchor: GuidanceAnchorRect,
  left: number,
  top: number,
  contentWidth: number,
  contentHeight: number
) {
  if (placement === "top" || placement === "bottom") {
    return clamp(anchor.x + anchor.width / 2 - left - 7, 18, contentWidth - 32);
  }

  return clamp(anchor.y + anchor.height / 2 - top - 7, 18, contentHeight - 32);
}

export default function GuidanceOverlay({
  visible,
  items,
  currentIndex,
  onNext,
  onClose,
  accentColor,
  actionLabel = "Got it",
  showCloseButton = false,
  dismissOnBackdropPress = false,
}: GuidanceOverlayProps) {
  const { colors } = useAppTheme();
  const { measureAnchor } = useGuidance();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const itemCount = items.length;
  const normalizedIndex = Math.max(0, Math.min(currentIndex, Math.max(itemCount - 1, 0)));
  const [isRendered, setIsRendered] = useState(false);
  const [displayedIndex, setDisplayedIndex] = useState(normalizedIndex);
  const [anchorRect, setAnchorRect] = useState<GuidanceAnchorRect | null>(null);
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const surfaceOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const item = items[displayedIndex] ?? null;
  const itemId = item?.id ?? null;
  const prevPropIndexRef = useRef(normalizedIndex);
  const dismissNotifiedRef = useRef(false);
  const transitionLockRef = useRef(false);
  const lastEnteredItemIdRef = useRef<string | null>(null);
  const isLast = displayedIndex === itemCount - 1;
  const surfaceReady = Boolean(
    isRendered && visible && item && itemId && contentSize.width > 0 && contentSize.height > 0 && anchorRect
  );

  const stopAnimations = useCallback(() => {
    cancelAnimation(surfaceOpacity);
    cancelAnimation(backdropOpacity);
  }, [backdropOpacity, surfaceOpacity]);

  const resetMeasuredState = useCallback(() => {
    setAnchorRect(null);
    setContentSize({ width: 0, height: 0 });
    lastEnteredItemIdRef.current = null;
  }, []);

  const resetHiddenState = useCallback(() => {
    stopAnimations();
    surfaceOpacity.value = 0;
    backdropOpacity.value = 0;
  }, [backdropOpacity, stopAnimations, surfaceOpacity]);

  const finishEnter = useCallback(() => {
    transitionLockRef.current = false;
  }, []);

  const finishHide = useCallback(() => {
    transitionLockRef.current = false;
    setIsRendered(false);
    resetMeasuredState();

    if (dismissNotifiedRef.current) {
      onClose();
    }
  }, [onClose, resetMeasuredState]);

  const finishAdvance = useCallback(() => {
    onNext();
  }, [onNext]);

  const fadeIn = useCallback(() => {
    stopAnimations();
    surfaceOpacity.value = 0;
    backdropOpacity.value = 0;
    backdropOpacity.value = withTiming(1, {
      duration: GUIDANCE_BACKDROP_ENTER_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    surfaceOpacity.value = withTiming(
      1,
      {
        duration: GUIDANCE_BUBBLE_ENTER_DURATION,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishEnter)();
        }
      }
    );
  }, [backdropOpacity, finishEnter, stopAnimations, surfaceOpacity]);

  const fadeOut = useCallback(
    (onComplete: () => void) => {
      stopAnimations();
      backdropOpacity.value = withTiming(0, {
        duration: GUIDANCE_BACKDROP_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      surfaceOpacity.value = withTiming(
        0,
        {
          duration: GUIDANCE_BUBBLE_EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        }
      );
    },
    [backdropOpacity, stopAnimations, surfaceOpacity]
  );

  useEffect(() => {
    if (!itemCount) {
      transitionLockRef.current = false;
      dismissNotifiedRef.current = false;
      setIsRendered(false);
      resetMeasuredState();
      return;
    }

    if (visible) {
      if (dismissNotifiedRef.current) {
        return;
      }

      if (!isRendered) {
        transitionLockRef.current = true;
        dismissNotifiedRef.current = false;
        prevPropIndexRef.current = normalizedIndex;
        setDisplayedIndex(normalizedIndex);
        resetHiddenState();
        resetMeasuredState();
        setIsRendered(true);
      }

      return;
    }

    if (!isRendered || !item) {
      dismissNotifiedRef.current = false;
      return;
    }

    transitionLockRef.current = true;
    lastEnteredItemIdRef.current = null;
    fadeOut(finishHide);
  }, [
    fadeOut,
    finishHide,
    isRendered,
    item,
    itemCount,
    normalizedIndex,
    resetHiddenState,
    resetMeasuredState,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !isRendered) {
      return;
    }

    if (normalizedIndex === prevPropIndexRef.current) {
      return;
    }

    prevPropIndexRef.current = normalizedIndex;
    transitionLockRef.current = true;
    setDisplayedIndex(normalizedIndex);
    resetHiddenState();
    resetMeasuredState();
  }, [isRendered, normalizedIndex, resetHiddenState, resetMeasuredState, visible]);

  useEffect(() => {
    if (!item || !isRendered || !visible) {
      return;
    }

    let active = true;
    let attempts = 0;
    let previousRect: GuidanceAnchorRect | null = null;

    const finishAnchorResolution = (rect: GuidanceAnchorRect | null) => {
      if (rect) {
        setAnchorRect(rect);
      }
    };

    const tryMeasure = () => {
      void measureAnchor(item.targetId).then((rect) => {
        if (!active) {
          return;
        }

        attempts += 1;

        if (rect) {
          if (previousRect && anchorRectsMatch(previousRect, rect)) {
            finishAnchorResolution(rect);
            return;
          }

          previousRect = rect;

          if (attempts < GUIDANCE_MAX_ANCHOR_MEASURE_ATTEMPTS) {
            requestAnimationFrame(tryMeasure);
            return;
          }

          finishAnchorResolution(rect);
          return;
        }

        if (attempts < GUIDANCE_MAX_ANCHOR_MEASURE_ATTEMPTS) {
          requestAnimationFrame(tryMeasure);
          return;
        }

        finishAnchorResolution(previousRect);
      });
    };

    requestAnimationFrame(tryMeasure);

    return () => {
      active = false;
    };
  }, [displayedIndex, isRendered, item, measureAnchor, visible]);

  const layout = useMemo(() => {
    if (!item || !anchorRect || !contentSize.width || !contentSize.height) {
      return null;
    }

    const safeLeft = EDGE_PADDING;
    const safeTop = insets.top + EDGE_PADDING;
    const safeRight = screenWidth - EDGE_PADDING;
    const safeBottom = screenHeight - insets.bottom - EDGE_PADDING;
    const candidates: GuidePlacement[] = item.allowedPlacements?.length
      ? item.allowedPlacements
      : [
          item.preferredPlacement,
          oppositePlacement(item.preferredPlacement),
          ...perpendicularPlacements(item.preferredPlacement),
        ];

    for (const placement of candidates) {
      const candidate = computeCandidateOrigin(
        placement,
        anchorRect,
        contentSize.width,
        contentSize.height
      );
      const fitsHorizontally =
        candidate.left >= safeLeft && candidate.left + contentSize.width <= safeRight;
      const fitsVertically =
        candidate.top >= safeTop && candidate.top + contentSize.height <= safeBottom;

      if (fitsHorizontally && fitsVertically) {
        return {
          placement,
          left: candidate.left,
          top: candidate.top + (item.bubbleOffsetY ?? 0),
          pointerOffset: computePointerOffset(
            placement,
            anchorRect,
            candidate.left,
            candidate.top,
            contentSize.width,
            contentSize.height
          ),
        };
      }
    }

    const fallback = computeCandidateOrigin(
      item.preferredPlacement,
      anchorRect,
      contentSize.width,
      contentSize.height
    );
    const left = clamp(fallback.left, safeLeft, safeRight - contentSize.width);
    const top = clamp(
      fallback.top + (item.bubbleOffsetY ?? 0),
      safeTop,
      safeBottom - contentSize.height
    );

    return {
      placement: item.preferredPlacement,
      left,
      top,
      pointerOffset: computePointerOffset(
        item.preferredPlacement,
        anchorRect,
        left,
        top,
        contentSize.width,
        contentSize.height
      ),
    };
  }, [anchorRect, contentSize.height, contentSize.width, insets.bottom, insets.top, item, screenHeight, screenWidth]);

  useEffect(() => {
    if (!surfaceReady || !item || !layout) {
      return;
    }

    if (lastEnteredItemIdRef.current === itemId) {
      return;
    }

    lastEnteredItemIdRef.current = itemId;
    fadeIn();
  }, [fadeIn, item, itemId, layout, surfaceReady]);

  const handleAdvance = useCallback(() => {
    if (!item || transitionLockRef.current || !visible) {
      return;
    }

    transitionLockRef.current = true;
    lastEnteredItemIdRef.current = null;
    fadeOut(finishAdvance);
  }, [fadeOut, finishAdvance, item, visible]);

  const handleClose = useCallback(() => {
    if (!item || transitionLockRef.current) {
      return;
    }

    transitionLockRef.current = true;
    dismissNotifiedRef.current = true;
    lastEnteredItemIdRef.current = null;
    fadeOut(finishHide);
  }, [fadeOut, finishHide, item]);

  const handleBackdropPress = useCallback(() => {
    if (!dismissOnBackdropPress) {
      return;
    }

    handleClose();
  }, [dismissOnBackdropPress, handleClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: surfaceOpacity.value,
  }));

  if (!isRendered || !item) {
    return null;
  }

  const anchorHitRect = anchorRect
    ? {
        left: clamp(anchorRect.x, 0, screenWidth),
        top: clamp(anchorRect.y, 0, screenHeight),
        right: clamp(anchorRect.x + anchorRect.width, 0, screenWidth),
        bottom: clamp(anchorRect.y + anchorRect.height, 0, screenHeight),
      }
    : null;
  const bubbleHighlightRect = anchorHitRect
    ? {
        left: Math.max(0, anchorHitRect.left - 12),
        top: Math.max(0, anchorHitRect.top - 12),
        width: Math.max(0, anchorHitRect.right - anchorHitRect.left + 24),
        height: Math.max(0, anchorHitRect.bottom - anchorHitRect.top + 24),
      }
    : null;
  const bubbleWidth = clamp(
    anchorRect?.width ?? screenWidth - EDGE_PADDING * 2,
    300,
    screenWidth - EDGE_PADDING * 2
  );
  const visibleLayout = surfaceReady ? layout : null;
  const surfaceContent = (
    <GuideBubble
      text={item.text}
      actionLabel={actionLabel}
      onAction={isLast ? handleClose : handleAdvance}
      onClose={showCloseButton ? handleClose : undefined}
      pointerPlacement={layout?.placement ?? item.preferredPlacement}
      pointerOffset={layout?.pointerOffset ?? 28}
      width={bubbleWidth}
      accentColor={accentColor}
      accentText={colors.white}
    />
  );

  const renderBackdropSegment = (
    key: string,
    style: {
      position: "absolute";
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
      width?: number;
      height?: number;
    }
  ) => (
    <Pressable key={key} style={style} onPress={handleBackdropPress}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: GUIDANCE_BUBBLE_BACKDROP_COLOR,
          },
          backdropStyle,
        ]}
      />
    </Pressable>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
      }}
    >
      {anchorHitRect ? (
        <>
          {renderBackdropSegment("top", {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: anchorHitRect.top,
          })}
          {renderBackdropSegment("left", {
            position: "absolute",
            top: anchorHitRect.top,
            left: 0,
            width: anchorHitRect.left,
            height: Math.max(0, anchorHitRect.bottom - anchorHitRect.top),
          })}
          {renderBackdropSegment("right", {
            position: "absolute",
            top: anchorHitRect.top,
            left: anchorHitRect.right,
            right: 0,
            height: Math.max(0, anchorHitRect.bottom - anchorHitRect.top),
          })}
          {renderBackdropSegment("bottom", {
            position: "absolute",
            top: anchorHitRect.bottom,
            left: 0,
            right: 0,
            bottom: 0,
          })}
        </>
      ) : (
        renderBackdropSegment("fallback", {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        })
      )}

      {bubbleHighlightRect ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: bubbleHighlightRect.left,
              top: bubbleHighlightRect.top,
              width: bubbleHighlightRect.width,
              height: bubbleHighlightRect.height,
              borderRadius: 18,
              borderWidth: 2.5,
              borderColor: accentColor,
              backgroundColor: "rgba(255,255,255,0.03)",
            },
            surfaceStyle,
          ]}
        />
      ) : null}

      {visibleLayout ? (
        <Animated.View
          key={`surface-${itemId ?? displayedIndex}`}
          style={[
            {
              position: "absolute",
              left: visibleLayout.left,
              top: visibleLayout.top,
            },
            surfaceStyle,
          ]}
        >
          {surfaceContent}
        </Animated.View>
      ) : (
        <View
          key={`measure-${itemId ?? displayedIndex}`}
          pointerEvents="none"
          onLayout={(event: LayoutChangeEvent) => {
            const { width, height } = event.nativeEvent.layout;

            if (width !== contentSize.width || height !== contentSize.height) {
              setContentSize({ width, height });
            }
          }}
          style={{
            position: "absolute",
            left: -9999,
            top: -9999,
            opacity: 0,
          }}
        >
          {surfaceContent}
        </View>
      )}
    </View>
  );
}
