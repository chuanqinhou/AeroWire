import type { Board, Pin, PinBatchDirection } from "./types";
import { clamp, getBoardVisibleSize } from "./geometry";

export function inferPinGroupDirection(pins: Pin[]): PinBatchDirection {
  if (pins.length < 2) return "right";
  const first = pins[0];
  const last = pins[pins.length - 1];
  const deltaX = last.x - first.x;
  const deltaY = last.y - first.y;
  if (Math.abs(deltaY) > Math.abs(deltaX)) return deltaY >= 0 ? "down" : "up";
  return deltaX >= 0 ? "right" : "left";
}

export function inferPinGroupSpacing(pins: Pin[]) {
  if (pins.length < 2) return 0;
  let distance = 0;
  for (let index = 1; index < pins.length; index += 1) {
    distance += Math.hypot(pins[index].x - pins[index - 1].x, pins[index].y - pins[index - 1].y);
  }
  return Math.round(distance / (pins.length - 1));
}

export function remapPinsForBoard(
  pins: Pin[],
  boardBefore: Board,
  boardAfter: Board,
) {
  const beforeSize = getBoardVisibleSize(boardBefore);
  const afterSize = getBoardVisibleSize(boardAfter);
  const scaleX = beforeSize.width > 0 ? afterSize.width / beforeSize.width : 1;
  const scaleY = beforeSize.height > 0 ? afterSize.height / beforeSize.height : 1;

  return pins.map((pin) => {
    if (pin.boardId !== boardBefore.id) return pin;
    return {
      ...pin,
      x: clamp(Math.round(pin.x * scaleX), 0, afterSize.width),
      y: clamp(Math.round(pin.y * scaleY), 0, afterSize.height),
    };
  });
}
