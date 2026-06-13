import { DEFAULT_PIN_LABEL_FONT_SIZE, DEFAULT_PIN_SIZE, EXPORT_PADDING } from "./constants";
import { getBoardCenter, getBoardVisibleSize, getPinAbsolute, normalizeRotation, rotatePoint } from "./geometry";
import type { Project } from "./types";
import { getWirePathFromBends } from "./wires";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function addBoundsPoint(bounds: Bounds, point: { x: number; y: number }) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function addBoundsRect(bounds: Bounds, rect: { x: number; y: number; width: number; height: number }) {
  addBoundsPoint(bounds, { x: rect.x, y: rect.y });
  addBoundsPoint(bounds, { x: rect.x + rect.width, y: rect.y + rect.height });
}

export function getProjectExportBounds(project: Project) {
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const boardMap = new Map(project.boards.map((board) => [board.id, board]));
  const pinMap = new Map(project.pins.map((pin) => [pin.id, pin]));

  for (const board of project.boards) {
    const visibleSize = getBoardVisibleSize(board);
    const corners = [
      { x: board.x, y: board.y },
      { x: board.x + visibleSize.width, y: board.y },
      { x: board.x + visibleSize.width, y: board.y + visibleSize.height },
      { x: board.x, y: board.y + visibleSize.height },
    ].map((corner) => rotatePoint(corner, getBoardCenter(board), normalizeRotation(board.rotation)));
    for (const corner of corners) addBoundsPoint(bounds, corner);
    addBoundsPoint(bounds, { x: board.x, y: board.y + visibleSize.height + 36 });
  }

  for (const pin of project.pins) {
    const board = boardMap.get(pin.boardId);
    if (!board) continue;
    const point = getPinAbsolute(pin, board);
    const radius = (pin.size ?? DEFAULT_PIN_SIZE) + 20;
    addBoundsRect(bounds, {
      x: point.x - radius,
      y: point.y - radius,
      width: radius * 2,
      height: radius * 2,
    });
    addBoundsPoint(bounds, {
      x: point.x + pin.labelOffsetX,
      y: point.y + pin.labelOffsetY,
    });
    addBoundsPoint(bounds, {
      x: point.x + pin.labelOffsetX + Math.max(42, pin.label.length * (pin.labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE) * 0.75),
      y: point.y + pin.labelOffsetY + (pin.labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE) + 8,
    });
  }

  for (const wire of project.wires) {
    const from = pinMap.get(wire.fromPinId);
    const to = pinMap.get(wire.toPinId);
    const fromBoard = from ? boardMap.get(from.boardId) : null;
    const toBoard = to ? boardMap.get(to.boardId) : null;
    if (!from || !to || !fromBoard || !toBoard) continue;

    const points = getWirePathFromBends(getPinAbsolute(from, fromBoard), wire.bends, getPinAbsolute(to, toBoard));
    for (let index = 0; index < points.length; index += 2) {
      addBoundsPoint(bounds, { x: points[index], y: points[index + 1] });
    }

    const midIndex = Math.max(0, Math.floor(points.length / 4) * 2 - 2);
    if (wire.label.trim() !== "") {
      addBoundsPoint(bounds, {
        x: (points[midIndex] ?? 0) + wire.labelOffsetX,
        y: (points[midIndex + 1] ?? 0) + wire.labelOffsetY,
      });
    }
  }

  if (!Number.isFinite(bounds.minX)) return null;
  return {
    x: Math.floor(bounds.minX - EXPORT_PADDING),
    y: Math.floor(bounds.minY - EXPORT_PADDING),
    width: Math.ceil(bounds.maxX - bounds.minX + EXPORT_PADDING * 2),
    height: Math.ceil(bounds.maxY - bounds.minY + EXPORT_PADDING * 2),
  };
}
