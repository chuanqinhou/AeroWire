import type { Pin, Wire, WireArrowDirection, WireBend, WireEndStyle, WireLineStyle } from "./types";
import { powerKinds } from "./constants";
import { uid } from "../lib/id";

export function createDefaultWireBends(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = Math.round((a.x + b.x) / 2);
  return [
    { id: uid("bend"), x: midX, y: a.y },
    { id: uid("bend"), x: midX, y: b.y },
  ];
}

export function getDefaultWireWidth(from: Pin, to: Pin) {
  if (powerKinds.includes(from.kind) || powerKinds.includes(to.kind)) return 5;
  if (from.kind === "GND" || to.kind === "GND") return 4;
  return 3;
}

export function getDefaultWireAppearance(
  from: Pin,
  to: Pin,
): Pick<Wire, "lineStyle" | "endStyle" | "arrowDirection"> {
  if (powerKinds.includes(from.kind) || powerKinds.includes(to.kind)) {
    return {
      lineStyle: "solid" as WireLineStyle,
      endStyle: "dot" as WireEndStyle,
      arrowDirection: "forward" as WireArrowDirection,
    };
  }

  if (from.kind === "GND" || to.kind === "GND") {
    return {
      lineStyle: "dashed" as WireLineStyle,
      endStyle: "dot" as WireEndStyle,
      arrowDirection: "forward" as WireArrowDirection,
    };
  }

  if (
    (from.kind === "UART_TX" && to.kind === "UART_RX") ||
    (from.kind === "UART_RX" && to.kind === "UART_TX")
  ) {
    return {
      lineStyle: "dotted" as WireLineStyle,
      endStyle: "arrow" as WireEndStyle,
      arrowDirection: from.kind === "UART_TX" ? "forward" : "reverse",
    };
  }

  return {
    lineStyle: "solid" as WireLineStyle,
    endStyle: "none" as WireEndStyle,
    arrowDirection: "forward" as WireArrowDirection,
  };
}

export function getWirePathFromBends(
  start: { x: number; y: number },
  bends: WireBend[],
  end: { x: number; y: number },
) {
  const points = [start.x, start.y];
  for (const bend of bends) {
    points.push(Math.round(bend.x), Math.round(bend.y));
  }
  points.push(end.x, end.y);
  return points;
}

export function getWireNodes(
  start: { x: number; y: number },
  bends: WireBend[],
  end: { x: number; y: number },
) {
  return [start, ...bends.map((bend) => ({ x: bend.x, y: bend.y })), end];
}

export function getDistanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const projectionX = start.x + t * dx;
  const projectionY = start.y + t * dy;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

export function getDistanceToWirePath(point: { x: number; y: number }, points: number[]) {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 2; index += 2) {
    closest = Math.min(
      closest,
      getDistanceToSegment(
        point,
        { x: points[index], y: points[index + 1] },
        { x: points[index + 2], y: points[index + 3] },
      ),
    );
  }
  return closest;
}

export function getWirePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = Math.round((a.x + b.x) / 2);
  return [a.x, a.y, midX, a.y, midX, b.y, b.x, b.y];
}

export function getWirePathWithControl(a: { x: number; y: number }, b: { x: number; y: number }, routeX: number, routeY: number) {
  const x = Math.round(routeX);
  const y = Math.round(routeY);
  return [a.x, a.y, x, a.y, x, y, b.x, y, b.x, b.y];
}

export function getWireDefaultControl(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.round((a.x + b.x) / 2),
    y: Math.round((a.y + b.y) / 2),
  };
}

export function getWirePathLength(points: number[]) {
  let length = 0;
  for (let index = 0; index < points.length - 2; index += 2) {
    length += Math.hypot(points[index + 2] - points[index], points[index + 3] - points[index + 1]);
  }
  return length;
}

export function getWireDash(style: WireLineStyle) {
  if (style === "dashed") return [12, 8];
  if (style === "dotted") return [3, 7];
  return [];
}
