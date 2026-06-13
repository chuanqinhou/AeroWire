import {
  BOARD_GRID_COLUMNS,
  BOARD_GRID_GAP_X,
  BOARD_GRID_GAP_Y,
  BOARD_GRID_START_X,
  BOARD_GRID_START_Y,
} from "./constants";
import type { Board, Pin, PinBatchDirection } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getBoardVisibleSize(board: Board) {
  const innerWidth = Math.max(24, board.originalWidth - board.crop.left - board.crop.right);
  const innerHeight = Math.max(24, board.originalHeight - board.crop.top - board.crop.bottom);
  return {
    width: Math.round(innerWidth * board.scale),
    height: Math.round(innerHeight * board.scale),
  };
}

export function normalizeRotation(value: number) {
  return ((Math.round(value) % 360) + 360) % 360;
}

export function rotatePoint(
  point: { x: number; y: number },
  center: { x: number; y: number },
  rotation: number,
) {
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getBoardCenter(board: Board) {
  const visibleSize = getBoardVisibleSize(board);
  return {
    x: board.x + visibleSize.width / 2,
    y: board.y + visibleSize.height / 2,
  };
}

export function getBoardLocalFromAbsolute(board: Board, point: { x: number; y: number }) {
  const unrotated = rotatePoint(point, getBoardCenter(board), -normalizeRotation(board.rotation));
  return {
    x: unrotated.x - board.x,
    y: unrotated.y - board.y,
  };
}

export function getPinAbsolute(pin: Pin, board?: Board) {
  if (!board) return { x: pin.x, y: pin.y };
  return rotatePoint(
    {
      x: board.x + pin.x,
      y: board.y + pin.y,
    },
    getBoardCenter(board),
    normalizeRotation(board.rotation),
  );
}

export function getBoardPlacement(slot: number) {
  return {
    x: BOARD_GRID_START_X + (slot % BOARD_GRID_COLUMNS) * BOARD_GRID_GAP_X,
    y: BOARD_GRID_START_Y + Math.floor(slot / BOARD_GRID_COLUMNS) * BOARD_GRID_GAP_Y,
  };
}

export function getPinBatchOffset(direction: PinBatchDirection, index: number, spacing: number) {
  const distance = index * spacing;
  if (direction === "left") return { x: -distance, y: 0 };
  if (direction === "up") return { x: 0, y: -distance };
  if (direction === "down") return { x: 0, y: distance };
  return { x: distance, y: 0 };
}
