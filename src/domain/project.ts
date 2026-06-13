import {
  DEFAULT_PIN_LABEL_FONT_FAMILY,
  DEFAULT_PIN_LABEL_FONT_SIZE,
  DEFAULT_PIN_SIZE,
  initialProject,
  pinKinds,
  powerKinds,
  signalKinds,
  voltages,
  wireColorByKind,
} from "./constants";
import { clamp, getPinAbsolute, normalizeRotation } from "./geometry";
import type { Board, BoardCrop, NetworkType, Pin, PinKind, Project, ProjectIssue, Voltage, Wire, WireBend } from "./types";
import { getWireDefaultControl } from "./wires";
import { uid } from "../lib/id";

export function normalizeProject(candidate: unknown): Project {
  if (!candidate || typeof candidate !== "object") return initialProject;

  const raw = candidate as Partial<Project>;
  const boards = Array.isArray(raw.boards)
    ? raw.boards
        .map((board) => {
          if (!board || typeof board !== "object") return null;
          const item = board as Partial<Board> & { width?: number; height?: number; crop?: Partial<BoardCrop> };
          if (!item.id || !item.imageSrc) return null;
          return {
            id: String(item.id),
            name: String(item.name ?? "Board"),
            imageSrc: String(item.imageSrc),
            x: Number(item.x ?? 0),
            y: Number(item.y ?? 0),
            originalWidth: Number(item.originalWidth ?? item.width ?? 320),
            originalHeight: Number(item.originalHeight ?? item.height ?? 240),
            scale: Number(item.scale ?? 1),
            rotation: normalizeRotation(Number(item.rotation ?? 0)),
            crop: {
              left: Number(item.crop?.left ?? 0),
              right: Number(item.crop?.right ?? 0),
              top: Number(item.crop?.top ?? 0),
              bottom: Number(item.crop?.bottom ?? 0),
            },
            locked: Boolean(item.locked),
          } satisfies Board;
        })
        .filter((board): board is Board => Boolean(board))
    : [];

  const boardIds = new Set(boards.map((board) => board.id));
  const pins = Array.isArray(raw.pins)
    ? raw.pins
        .map((pin) => {
          if (!pin || typeof pin !== "object") return null;
          const item = pin as Partial<Pin>;
          if (!item.id || !item.boardId || !boardIds.has(String(item.boardId))) return null;
          const kind = pinKinds.includes(item.kind as PinKind) ? (item.kind as PinKind) : "SIGNAL";
          const voltage = voltages.includes(item.voltage as Voltage) ? (item.voltage as Voltage) : "N/A";
          return {
            id: String(item.id),
            boardId: String(item.boardId),
            x: Number(item.x ?? 0),
            y: Number(item.y ?? 0),
            groupId: item.groupId == null ? null : String(item.groupId),
            size: clamp(Number((item as Partial<Pin> & { size?: number }).size ?? DEFAULT_PIN_SIZE), 4, 18),
            label: String(item.label ?? "PIN"),
            labelColor: String((item as Partial<Pin> & { labelColor?: string }).labelColor ?? "#111827"),
            labelFontSize: clamp(
              Number((item as Partial<Pin> & { labelFontSize?: number }).labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE),
              8,
              28,
            ),
            labelFontFamily: String(
              (item as Partial<Pin> & { labelFontFamily?: string }).labelFontFamily ?? DEFAULT_PIN_LABEL_FONT_FAMILY,
            ),
            typeLabel: String((item as Partial<Pin> & { typeLabel?: string }).typeLabel ?? item.kind ?? "SIGNAL"),
            networkTypeId: item.networkTypeId == null ? null : String(item.networkTypeId),
            labelOffsetX: Number(item.labelOffsetX ?? 10),
            labelOffsetY: Number(item.labelOffsetY ?? -8),
            kind,
            voltage: String(item.voltage ?? voltage),
            maxCurrentMa: Number(item.maxCurrentMa ?? 500),
          } satisfies Pin;
        })
        .filter((pin): pin is Pin => Boolean(pin))
    : [];

  const networkTypes = Array.isArray((raw as Partial<Project> & { networkTypes?: Partial<NetworkType>[] }).networkTypes)
    ? (((raw as Partial<Project> & { networkTypes?: Partial<NetworkType>[] }).networkTypes) ?? [])
        .map((networkType) => {
          if (!networkType || typeof networkType !== "object") return null;
          const baseKind = pinKinds.includes(networkType.baseKind as PinKind) ? (networkType.baseKind as PinKind) : "SIGNAL";
          return {
            id: String(networkType.id ?? uid("network")),
            name: String(networkType.name ?? baseKind),
            baseKind,
            defaultVoltage: String(networkType.defaultVoltage ?? "N/A"),
          } satisfies NetworkType;
        })
        .filter((networkType): networkType is NetworkType => Boolean(networkType))
    : [];

  const pinIds = new Set(pins.map((pin) => pin.id));
  const wires = Array.isArray(raw.wires)
    ? raw.wires
        .map((wire) => {
          if (!wire || typeof wire !== "object") return null;
          const item = wire as Partial<Wire>;
          if (!item.id || !item.fromPinId || !item.toPinId) return null;
          if (!pinIds.has(String(item.fromPinId)) || !pinIds.has(String(item.toPinId))) return null;
          return {
            id: String(item.id),
            fromPinId: String(item.fromPinId),
            toPinId: String(item.toPinId),
            color: String(item.color ?? "#6a7280"),
            width: Number(item.width ?? 3),
            label: String((item as Partial<Wire> & { label?: string }).label ?? ""),
            labelFontSize: Number((item as Partial<Wire> & { labelFontSize?: number }).labelFontSize ?? 12),
            labelOffsetX: Number((item as Partial<Wire> & { labelOffsetX?: number }).labelOffsetX ?? 8),
            labelOffsetY: Number((item as Partial<Wire> & { labelOffsetY?: number }).labelOffsetY ?? -10),
            bends: Array.isArray((item as Partial<Wire> & { bends?: Partial<WireBend>[] }).bends)
              ? ((item as Partial<Wire> & { bends?: Partial<WireBend>[] }).bends ?? [])
                  .map((bend) => {
                    if (!bend || typeof bend !== "object") return null;
                    return {
                      id: String(bend.id ?? uid("bend")),
                      x: Number(bend.x ?? 0),
                      y: Number(bend.y ?? 0),
                    } satisfies WireBend;
                  })
                  .filter((bend): bend is WireBend => Boolean(bend))
              : [],
            routeX: item.routeX == null ? null : Number(item.routeX),
            routeY: item.routeY == null ? null : Number(item.routeY),
            lineStyle:
              item.lineStyle === "dashed" || item.lineStyle === "dotted" || item.lineStyle === "solid"
                ? item.lineStyle
                : "solid",
            endStyle:
              item.endStyle === "dot" || item.endStyle === "arrow" || item.endStyle === "none"
                ? item.endStyle
                : "none",
            arrowDirection:
              item.arrowDirection === "reverse" || item.arrowDirection === "forward"
                ? item.arrowDirection
                : "forward",
            status: item.status === "error" || item.status === "warning" || item.status === "ok" ? item.status : "ok",
            message: String(item.message ?? ""),
          } satisfies Wire;
        })
        .filter((wire): wire is Wire => Boolean(wire))
    : [];

  return recomputeProject(migrateProjectGeometry({ boards, pins, wires, networkTypes }));
}

export function evaluateConnection(from: Pin, to: Pin, sameBoard: boolean): Pick<Wire, "status" | "message" | "color"> {
  if (from.id === to.id) {
    return { status: "error", message: "同一个引脚不能自连", color: "#c62a24" };
  }

  if (sameBoard) {
    return { status: "warning", message: "同一块板上的跨脚跳线需要人工确认", color: "#f08b1a" };
  }

  if (from.kind === "GND" || to.kind === "GND") {
    if (from.kind === "GND" && to.kind === "GND") {
      return { status: "ok", message: "地线连接正常", color: wireColorByKind.GND };
    }
    return { status: "error", message: "GND 只能连接 GND", color: "#c62a24" };
  }

  if (powerKinds.includes(from.kind) || powerKinds.includes(to.kind)) {
    if (!powerKinds.includes(from.kind) || !powerKinds.includes(to.kind)) {
      return { status: "error", message: "电源脚不能直接连接信号脚", color: "#c62a24" };
    }
    if (from.voltage !== to.voltage) {
      return { status: "error", message: `电压冲突：${from.voltage} 不能连接 ${to.voltage}`, color: "#c62a24" };
    }
    return { status: "ok", message: `${from.voltage} 电源连接正常`, color: wireColorByKind[from.kind] };
  }

  if (from.kind === "UART_TX" && to.kind === "UART_TX") {
    return { status: "warning", message: "UART 通常需要 TX 连接 RX", color: "#f08b1a" };
  }

  if (from.kind === "UART_RX" && to.kind === "UART_RX") {
    return { status: "warning", message: "UART 通常需要 RX 连接 TX", color: "#f08b1a" };
  }

  if (
    (from.kind === "UART_TX" && to.kind === "UART_RX") ||
    (from.kind === "UART_RX" && to.kind === "UART_TX")
  ) {
    return { status: "ok", message: "UART 连接正常", color: from.kind === "UART_TX" ? wireColorByKind.UART_TX : wireColorByKind.UART_RX };
  }

  if (from.kind === to.kind) {
    return { status: "ok", message: `${from.kind} 信号连接`, color: wireColorByKind[from.kind] };
  }

  return { status: "warning", message: `${from.kind} 到 ${to.kind} 需要人工确认`, color: "#f08b1a" };
}

export function recomputeProject(project: Project): Project {
  const pinMap = new Map(project.pins.map((pin) => [pin.id, pin]));
  return {
    ...project,
    wires: project.wires.map((wire) => {
      const from = pinMap.get(wire.fromPinId);
      const to = pinMap.get(wire.toPinId);
      if (!from || !to) return wire;
      return {
        ...wire,
        ...evaluateConnection(from, to, from.boardId === to.boardId),
      };
    }),
  };
}

export function migrateProjectGeometry(project: Project): Project {
  const boardMap = new Map(project.boards.map((board) => [board.id, board]));
  const pinMap = new Map(project.pins.map((pin) => [pin.id, pin]));

  return {
    ...project,
    wires: project.wires.map((wire) => {
      if (wire.bends.length > 0) return wire;
      const from = pinMap.get(wire.fromPinId);
      const to = pinMap.get(wire.toPinId);
      if (!from || !to) return { ...wire, bends: [] };
      const fromBoard = boardMap.get(from.boardId);
      const toBoard = boardMap.get(to.boardId);
      if (!fromBoard || !toBoard) return { ...wire, bends: [] };
      const a = getPinAbsolute(from, fromBoard);
      const b = getPinAbsolute(to, toBoard);
      const defaultControl = getWireDefaultControl(a, b);
      const routeX = wire.routeX ?? defaultControl.x;
      const routeY = wire.routeY ?? defaultControl.y;
      return {
        ...wire,
        bends: [
          { id: uid("bend"), x: routeX, y: a.y },
          { id: uid("bend"), x: routeX, y: routeY },
          { id: uid("bend"), x: b.x, y: routeY },
        ],
      };
    }),
  };
}

export function buildIssues(project: Project): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const pinsById = new Map(project.pins.map((pin) => [pin.id, pin]));
  const boardMap = new Map(project.boards.map((board) => [board.id, board]));
  const connectedByPin = new Map<string, Wire[]>();

  for (const wire of project.wires) {
    issues.push(
      ...(wire.status === "ok"
        ? []
        : [
            {
              id: `wire-${wire.id}`,
              severity: wire.status,
              text: wire.message,
              target: { kind: "wire", id: wire.id },
            } satisfies ProjectIssue,
          ]),
    );

    connectedByPin.set(wire.fromPinId, [...(connectedByPin.get(wire.fromPinId) ?? []), wire]);
    connectedByPin.set(wire.toPinId, [...(connectedByPin.get(wire.toPinId) ?? []), wire]);
  }

  for (const pin of project.pins) {
    const links = connectedByPin.get(pin.id) ?? [];
    if (powerKinds.includes(pin.kind) && links.length === 0) {
      issues.push({
        id: `pin-power-${pin.id}`,
        severity: "warning",
        text: `${pin.label} 供电脚未连接`,
        target: { kind: "pin", id: pin.id },
      });
    }

    if ((pin.kind === "GND" || signalKinds.includes(pin.kind)) && links.length === 0) {
      issues.push({
        id: `pin-open-${pin.id}`,
        severity: "warning",
        text: `${pin.label} 未接入网络`,
        target: { kind: "pin", id: pin.id },
      });
    }

    if (signalKinds.includes(pin.kind) && links.length > 1) {
      issues.push({
        id: `pin-fanout-${pin.id}`,
        severity: "warning",
        text: `${pin.label} 连到了 ${links.length} 条线，请确认是否允许分叉`,
        target: { kind: "pin", id: pin.id },
      });
    }
  }

  for (const networkType of project.networkTypes) {
    const members = project.pins.filter((pin) => pin.networkTypeId === networkType.id);
    if (members.length < 2) continue;
    for (let index = 0; index < members.length; index += 1) {
      for (let inner = index + 1; inner < members.length; inner += 1) {
        const a = members[index];
        const b = members[inner];
        const physicallyConnected = project.wires.some(
          (wire) =>
            (wire.fromPinId === a.id && wire.toPinId === b.id) ||
            (wire.fromPinId === b.id && wire.toPinId === a.id),
        );
        if (!physicallyConnected) {
          issues.push({
            id: `network-open-${networkType.id}-${a.id}-${b.id}`,
            severity: "warning",
            text: `${networkType.name}: ${a.label} 与 ${b.label} 同网络但未物理连通`,
            target: { kind: "pin", id: a.id },
          });
        }
      }
    }
  }

  for (const board of project.boards) {
    const boardPins = project.pins.filter((pin) => pin.boardId === board.id);
    if (boardPins.length === 0) {
      issues.push({
        id: `board-empty-${board.id}`,
        severity: "warning",
        text: `${board.name} 还没有定义任何引脚`,
        target: { kind: "board", id: board.id },
      });
      continue;
    }

    const boardLinks = boardPins.flatMap((pin) => connectedByPin.get(pin.id) ?? []);
    const connectedGround = boardPins.some((pin) => pin.kind === "GND" && (connectedByPin.get(pin.id)?.length ?? 0) > 0);
    const connectedPower = boardPins.some((pin) => powerKinds.includes(pin.kind) && (connectedByPin.get(pin.id)?.length ?? 0) > 0);
    const hasSignalLink = boardPins.some((pin) => signalKinds.includes(pin.kind) && (connectedByPin.get(pin.id)?.length ?? 0) > 0);

    if (boardPins.some((pin) => powerKinds.includes(pin.kind)) && !connectedPower) {
      issues.push({
        id: `board-power-${board.id}`,
        severity: "warning",
        text: `${board.name} 没有接入供电`,
        target: { kind: "board", id: board.id },
      });
    }

    if (boardPins.some((pin) => pin.kind === "GND") && !connectedGround) {
      issues.push({
        id: `board-ground-${board.id}`,
        severity: "warning",
        text: `${board.name} 没有接入地线`,
        target: { kind: "board", id: board.id },
      });
    }

    if (hasSignalLink && (!connectedPower || !connectedGround)) {
      issues.push({
        id: `board-incomplete-${board.id}`,
        severity: "error",
        text: `${board.name} 已接信号但供电或地线不完整`,
        target: { kind: "board", id: board.id },
      });
    }

    const foreignBoardIds = new Set<string>();
    for (const wire of boardLinks) {
      const otherPinId = wire.fromPinId === boardPins.find((pin) => pin.id === wire.fromPinId)?.id ? wire.toPinId : wire.fromPinId;
      const otherPin = pinsById.get(otherPinId);
      if (otherPin && otherPin.boardId !== board.id) {
        foreignBoardIds.add(otherPin.boardId);
      }
    }

    if (foreignBoardIds.size === 0 && project.boards.length > 1) {
      issues.push({
        id: `board-isolated-${board.id}`,
        severity: "warning",
        text: `${board.name} 还没有和其他板建立连接`,
        target: { kind: "board", id: board.id },
      });
    }

    if (!boardMap.has(board.id)) continue;
  }

  return issues;
}
