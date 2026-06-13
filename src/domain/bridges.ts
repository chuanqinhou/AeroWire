type WireSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
};

function getWireSegments(points: number[]) {
  const segments: WireSegment[] = [];
  for (let index = 0; index < points.length - 2; index += 2) {
    const x1 = points[index];
    const y1 = points[index + 1];
    const x2 = points[index + 2];
    const y2 = points[index + 3];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 0.001) continue;
    segments.push({
      x1,
      y1,
      x2,
      y2,
      length,
    });
  }
  return segments;
}

function getPointOnSegmentInfo(segment: WireSegment, point: { x: number; y: number }) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const along = ((point.x - segment.x1) * dx + (point.y - segment.y1) * dy) / segment.length;
  const t = along / segment.length;
  const projectionX = segment.x1 + dx * t;
  const projectionY = segment.y1 + dy * t;
  const distance = Math.hypot(point.x - projectionX, point.y - projectionY);

  return { along, t, distance };
}

function isInteriorIntersection(segment: WireSegment, point: { x: number; y: number }, margin: number) {
  const info = getPointOnSegmentInfo(segment, point);
  return info.distance < 0.75 && info.along > margin && info.along < segment.length - margin;
}

export function getWireBridgeMap(wires: Array<{ id: string; points: number[]; width: number; order: number }>) {
  const bridges = new Map<string, Array<{ x: number; y: number }>>();

  for (let i = 0; i < wires.length; i += 1) {
    for (let j = i + 1; j < wires.length; j += 1) {
      const wireA = wires[i];
      const wireB = wires[j];
      const segmentsA = getWireSegments(wireA.points);
      const segmentsB = getWireSegments(wireB.points);

      for (const segmentA of segmentsA) {
        for (const segmentB of segmentsB) {
          const denominator =
            (segmentA.x1 - segmentA.x2) * (segmentB.y1 - segmentB.y2) -
            (segmentA.y1 - segmentA.y2) * (segmentB.x1 - segmentB.x2);
          if (Math.abs(denominator) < 0.001) continue;

          const determinantA = segmentA.x1 * segmentA.y2 - segmentA.y1 * segmentA.x2;
          const determinantB = segmentB.x1 * segmentB.y2 - segmentB.y1 * segmentB.x2;
          const crossX =
            (determinantA * (segmentB.x1 - segmentB.x2) - (segmentA.x1 - segmentA.x2) * determinantB) /
            denominator;
          const crossY =
            (determinantA * (segmentB.y1 - segmentB.y2) - (segmentA.y1 - segmentA.y2) * determinantB) /
            denominator;

          const cross = { x: crossX, y: crossY };
          const insideA = isInteriorIntersection(segmentA, cross, 10);
          const insideB = isInteriorIntersection(segmentB, cross, 10);

          if (!insideA || !insideB) continue;

          const bridgeOwnerId =
            wireA.width !== wireB.width
              ? wireA.width > wireB.width
                ? wireA.id
                : wireB.id
              : wireA.order > wireB.order
                ? wireA.id
                : wireB.id;

          bridges.set(bridgeOwnerId, [...(bridges.get(bridgeOwnerId) ?? []), { x: crossX, y: crossY }]);
        }
      }
    }
  }

  return bridges;
}

export function drawWirePath(
  context: {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
  },
  points: number[],
  bridges: Array<{ x: number; y: number }>,
  bridgeRadius: number,
) {
  if (points.length < 4) return;

  context.beginPath();
  context.moveTo(points[0], points[1]);

  for (let index = 2; index < points.length; index += 2) {
    const x = points[index];
    const y = points[index + 1];
    const prevX = points[index - 2];
    const prevY = points[index - 1];
    const segmentLength = Math.hypot(x - prevX, y - prevY);
    if (segmentLength < bridgeRadius * 3) {
      context.lineTo(x, y);
      continue;
    }

    const unitX = (x - prevX) / segmentLength;
    const unitY = (y - prevY) / segmentLength;
    let normalX = -unitY;
    let normalY = unitX;
    if (Math.abs(normalY) >= Math.abs(normalX)) {
      if (normalY > 0) {
        normalX *= -1;
        normalY *= -1;
      }
    } else if (normalX < 0) {
      normalX *= -1;
      normalY *= -1;
    }

    const bridgesOnSegment = bridges
      .map((bridge) => {
        const dx = bridge.x - prevX;
        const dy = bridge.y - prevY;
        const distanceAlong = dx * unitX + dy * unitY;
        const perpendicularDistance = Math.abs(dx * normalX + dy * normalY);
        return { bridge, distanceAlong, perpendicularDistance };
      })
      .filter(
        ({ distanceAlong, perpendicularDistance }) =>
          perpendicularDistance < 2 &&
          distanceAlong > bridgeRadius * 1.2 &&
          distanceAlong < segmentLength - bridgeRadius * 1.2,
      )
      .sort((left, right) => left.distanceAlong - right.distanceAlong);

    if (bridgesOnSegment.length === 0) {
      context.lineTo(x, y);
      continue;
    }

    for (const { bridge } of bridgesOnSegment) {
      const entryX = bridge.x - unitX * bridgeRadius;
      const entryY = bridge.y - unitY * bridgeRadius;
      const exitX = bridge.x + unitX * bridgeRadius;
      const exitY = bridge.y + unitY * bridgeRadius;
      const apexX = bridge.x + normalX * bridgeRadius * 2;
      const apexY = bridge.y + normalY * bridgeRadius * 2;

      context.lineTo(entryX, entryY);
      context.quadraticCurveTo(apexX, apexY, exitX, exitY);
    }

    context.lineTo(x, y);
  }
}
