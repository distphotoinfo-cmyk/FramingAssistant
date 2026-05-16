import type { RoomViewPoint, RoomViewRect } from "../types/framing";

export interface SmartSnapSize {
  width: number;
  height: number;
}

export interface SmartSnapReference {
  id?: string;
  center: RoomViewPoint;
  sizePixels: SmartSnapSize;
}

export interface SmartSnapStage {
  width: number;
  height: number;
}

export type SmartSnapAxis = "x" | "y";
export type SmartSnapTargetKind = "grid" | "bounds" | "center" | "reference";

export interface SmartSnapGuide {
  axis: SmartSnapAxis;
  normalizedValue: number;
  kind: SmartSnapTargetKind;
  referenceId?: string;
}

export interface SmartSnapOptions {
  point: RoomViewPoint;
  itemSizePixels: SmartSnapSize;
  stageSizePixels: SmartSnapStage;
  placementBounds: RoomViewRect;
  snapDistancePixels: number;
  gridSizePixels?: number | null;
  references?: SmartSnapReference[];
}

export interface SmartSnapResult {
  point: RoomViewPoint;
  snapped: boolean;
  guides: SmartSnapGuide[];
}

interface AxisCandidate {
  value: number;
  guideValue: number;
  kind: SmartSnapTargetKind;
  referenceId?: string;
}

function getCenterBounds({
  itemSizePixels,
  stageSizePixels,
  placementBounds,
}: Pick<SmartSnapOptions, "itemSizePixels" | "stageSizePixels" | "placementBounds">) {
  const halfWidth = itemSizePixels.width / Math.max(stageSizePixels.width, 1) / 2;
  const halfHeight = itemSizePixels.height / Math.max(stageSizePixels.height, 1) / 2;
  const maxBoundsX = placementBounds.x + placementBounds.width;
  const maxBoundsY = placementBounds.y + placementBounds.height;

  return {
    minX:
      halfWidth * 2 >= placementBounds.width
        ? placementBounds.x + placementBounds.width / 2
        : placementBounds.x + halfWidth,
    maxX:
      halfWidth * 2 >= placementBounds.width
        ? placementBounds.x + placementBounds.width / 2
        : maxBoundsX - halfWidth,
    minY:
      halfHeight * 2 >= placementBounds.height
        ? placementBounds.y + placementBounds.height / 2
        : placementBounds.y + halfHeight,
    maxY:
      halfHeight * 2 >= placementBounds.height
        ? placementBounds.y + placementBounds.height / 2
        : maxBoundsY - halfHeight,
  };
}

function clampSmartSnapPoint(options: SmartSnapOptions, point: RoomViewPoint) {
  const bounds = getCenterBounds(options);

  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
  };
}

function addTargetCandidates({
  candidates,
  target,
  itemHalfSize,
  kind,
  referenceId,
}: {
  candidates: AxisCandidate[];
  target: number;
  itemHalfSize: number;
  kind: SmartSnapTargetKind;
  referenceId?: string;
}) {
  candidates.push(
    { value: target, guideValue: target, kind, referenceId },
    { value: target + itemHalfSize, guideValue: target, kind, referenceId },
    { value: target - itemHalfSize, guideValue: target, kind, referenceId }
  );
}

function chooseAxisSnap({
  current,
  stageLength,
  snapDistancePixels,
  candidates,
}: {
  current: number;
  stageLength: number;
  snapDistancePixels: number;
  candidates: AxisCandidate[];
}): AxisCandidate | null {
  let bestCandidate: AxisCandidate | null = null;
  let bestDistance = snapDistancePixels;

  for (const candidate of candidates) {
    const distance = Math.abs(candidate.value - current) * stageLength;

    if (distance <= bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

export function calculateSmartSnap(options: SmartSnapOptions): SmartSnapResult {
  const {
    point,
    itemSizePixels,
    stageSizePixels,
    placementBounds,
    snapDistancePixels,
    gridSizePixels,
    references = [],
  } = options;
  const clampedPoint = clampSmartSnapPoint(options, point);

  if (
    stageSizePixels.width <= 0 ||
    stageSizePixels.height <= 0 ||
    itemSizePixels.width <= 0 ||
    itemSizePixels.height <= 0 ||
    snapDistancePixels <= 0
  ) {
    return { point: clampedPoint, snapped: false, guides: [] };
  }

  const halfWidth = itemSizePixels.width / stageSizePixels.width / 2;
  const halfHeight = itemSizePixels.height / stageSizePixels.height / 2;
  const boundsMaxX = placementBounds.x + placementBounds.width;
  const boundsMaxY = placementBounds.y + placementBounds.height;
  const xCandidates: AxisCandidate[] = [];
  const yCandidates: AxisCandidate[] = [];

  addTargetCandidates({
    candidates: xCandidates,
    target: placementBounds.x + placementBounds.width / 2,
    itemHalfSize: 0,
    kind: "center",
  });
  addTargetCandidates({
    candidates: yCandidates,
    target: placementBounds.y + placementBounds.height / 2,
    itemHalfSize: 0,
    kind: "center",
  });
  [placementBounds.x, boundsMaxX].forEach((target) =>
    addTargetCandidates({
      candidates: xCandidates,
      target,
      itemHalfSize: halfWidth,
      kind: "bounds",
    })
  );
  [placementBounds.y, boundsMaxY].forEach((target) =>
    addTargetCandidates({
      candidates: yCandidates,
      target,
      itemHalfSize: halfHeight,
      kind: "bounds",
    })
  );

  references.forEach((reference) => {
    const referenceHalfWidth = reference.sizePixels.width / stageSizePixels.width / 2;
    const referenceHalfHeight = reference.sizePixels.height / stageSizePixels.height / 2;

    [
      reference.center.x - referenceHalfWidth,
      reference.center.x,
      reference.center.x + referenceHalfWidth,
    ].forEach((target) =>
      addTargetCandidates({
        candidates: xCandidates,
        target,
        itemHalfSize: halfWidth,
        kind: "reference",
        referenceId: reference.id,
      })
    );
    [
      reference.center.y - referenceHalfHeight,
      reference.center.y,
      reference.center.y + referenceHalfHeight,
    ].forEach((target) =>
      addTargetCandidates({
        candidates: yCandidates,
        target,
        itemHalfSize: halfHeight,
        kind: "reference",
        referenceId: reference.id,
      })
    );
  });

  if (gridSizePixels && Number.isFinite(gridSizePixels) && gridSizePixels > 0) {
    xCandidates.push({
      value:
        Math.round((clampedPoint.x * stageSizePixels.width) / gridSizePixels) *
        gridSizePixels /
        stageSizePixels.width,
      guideValue: clampedPoint.x,
      kind: "grid",
    });
    yCandidates.push({
      value:
        Math.round((clampedPoint.y * stageSizePixels.height) / gridSizePixels) *
        gridSizePixels /
        stageSizePixels.height,
      guideValue: clampedPoint.y,
      kind: "grid",
    });
  }

  const xSnap = chooseAxisSnap({
    current: clampedPoint.x,
    stageLength: stageSizePixels.width,
    snapDistancePixels,
    candidates: xCandidates,
  });
  const ySnap = chooseAxisSnap({
    current: clampedPoint.y,
    stageLength: stageSizePixels.height,
    snapDistancePixels,
    candidates: yCandidates,
  });
  const snappedPoint = clampSmartSnapPoint(options, {
    x: xSnap?.value ?? clampedPoint.x,
    y: ySnap?.value ?? clampedPoint.y,
  });
  const guides: SmartSnapGuide[] = [];

  if (xSnap) {
    const guide: SmartSnapGuide = {
      axis: "x",
      normalizedValue: xSnap.guideValue,
      kind: xSnap.kind,
    };

    if (xSnap.referenceId) {
      guide.referenceId = xSnap.referenceId;
    }

    guides.push(guide);
  }

  if (ySnap) {
    const guide: SmartSnapGuide = {
      axis: "y",
      normalizedValue: ySnap.guideValue,
      kind: ySnap.kind,
    };

    if (ySnap.referenceId) {
      guide.referenceId = ySnap.referenceId;
    }

    guides.push(guide);
  }

  return {
    point: snappedPoint,
    snapped:
      Math.abs(snappedPoint.x - clampedPoint.x) > 0.0001 ||
      Math.abs(snappedPoint.y - clampedPoint.y) > 0.0001,
    guides,
  };
}
