import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import Konva from "konva";
import {
  Cable,
  Download,
  FileUp,
  FolderOpen,
  HardDriveDownload,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";

type PinKind =
  | "VCC"
  | "GND"
  | "UART_TX"
  | "UART_RX"
  | "PWM"
  | "I2C_SCL"
  | "I2C_SDA"
  | "VBAT"
  | "SIGNAL";

type Voltage = "3.3V" | "5V" | "9V" | "12V" | "VBAT" | "N/A";
type ToolMode = "select" | "pin" | "wire";
type Severity = "error" | "warning" | "ok";
type IssueTarget = { kind: "wire" | "pin" | "board"; id: string };
type BoardCrop = { left: number; right: number; top: number; bottom: number };

type Pin = {
  id: string;
  boardId: string;
  x: number;
  y: number;
  label: string;
  kind: PinKind;
  voltage: Voltage;
  maxCurrentMa: number;
};

type Board = {
  id: string;
  name: string;
  imageSrc: string;
  x: number;
  y: number;
  originalWidth: number;
  originalHeight: number;
  scale: number;
  crop: BoardCrop;
  locked: boolean;
};

type Wire = {
  id: string;
  fromPinId: string;
  toPinId: string;
  color: string;
  status: Severity;
  message: string;
};

type Project = {
  boards: Board[];
  pins: Pin[];
  wires: Wire[];
};

type ProjectIssue = {
  id: string;
  severity: Exclude<Severity, "ok">;
  text: string;
  target: IssueTarget;
};

const STORAGE_KEY = "aerowire.project.v1";
const powerKinds: PinKind[] = ["VCC", "VBAT"];
const signalKinds: PinKind[] = ["UART_TX", "UART_RX", "PWM", "I2C_SCL", "I2C_SDA", "SIGNAL"];

const initialProject: Project = {
  boards: [],
  pins: [],
  wires: [],
};

const pinKinds: PinKind[] = ["VCC", "GND", "UART_TX", "UART_RX", "PWM", "I2C_SCL", "I2C_SDA", "VBAT", "SIGNAL"];
const voltages: Voltage[] = ["N/A", "3.3V", "5V", "9V", "12V", "VBAT"];

const wireColorByKind: Record<PinKind, string> = {
  VCC: "#e33d2e",
  VBAT: "#d1221f",
  GND: "#1f2933",
  UART_TX: "#f4b000",
  UART_RX: "#2e9f62",
  PWM: "#2477d4",
  I2C_SCL: "#7857d8",
  I2C_SDA: "#14a6a0",
  SIGNAL: "#6a7280",
};

const pinColorByKind: Record<PinKind, string> = {
  VCC: "#e33d2e",
  VBAT: "#d1221f",
  GND: "#1f2933",
  UART_TX: "#f4b000",
  UART_RX: "#2e9f62",
  PWM: "#2477d4",
  I2C_SCL: "#7857d8",
  I2C_SDA: "#14a6a0",
  SIGNAL: "#6a7280",
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function useImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  return image;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBoardVisibleSize(board: Board) {
  const innerWidth = Math.max(24, board.originalWidth - board.crop.left - board.crop.right);
  const innerHeight = Math.max(24, board.originalHeight - board.crop.top - board.crop.bottom);
  return {
    width: Math.round(innerWidth * board.scale),
    height: Math.round(innerHeight * board.scale),
  };
}

function remapPinsForBoard(
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

function normalizeProject(candidate: unknown): Project {
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
            originalWidth: Number(
              item.originalWidth ?? item.width ?? 320,
            ),
            originalHeight: Number(
              item.originalHeight ?? item.height ?? 240,
            ),
            scale: Number(item.scale ?? 1),
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
            label: String(item.label ?? "PIN"),
            kind,
            voltage,
            maxCurrentMa: Number(item.maxCurrentMa ?? 500),
          } satisfies Pin;
        })
        .filter((pin): pin is Pin => Boolean(pin))
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
            status: item.status === "error" || item.status === "warning" || item.status === "ok" ? item.status : "ok",
            message: String(item.message ?? ""),
          } satisfies Wire;
        })
        .filter((wire): wire is Wire => Boolean(wire))
    : [];

  return recomputeProject({ boards, pins, wires });
}

function evaluateConnection(from: Pin, to: Pin, sameBoard: boolean): Pick<Wire, "status" | "message" | "color"> {
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

function recomputeProject(project: Project): Project {
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

function getPinAbsolute(pin: Pin, board?: Board) {
  return {
    x: (board?.x ?? 0) + pin.x,
    y: (board?.y ?? 0) + pin.y,
  };
}

function BoardImage({ board }: { board: Board }) {
  const image = useImage(board.imageSrc);
  const visibleSize = getBoardVisibleSize(board);

  if (!image) {
    return (
      <Rect
        x={0}
        y={0}
        width={visibleSize.width}
        height={visibleSize.height}
        fill="#d9e0e7"
        stroke="#718096"
        strokeWidth={1}
      />
    );
  }

  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={visibleSize.width}
      height={visibleSize.height}
      crop={{
        x: board.crop.left,
        y: board.crop.top,
        width: Math.max(24, board.originalWidth - board.crop.left - board.crop.right),
        height: Math.max(24, board.originalHeight - board.crop.top - board.crop.bottom),
      }}
      cornerRadius={6}
    />
  );
}

function loadProject(): Project {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialProject;

  try {
    return normalizeProject(JSON.parse(raw));
  } catch {
    return initialProject;
  }
}

function buildIssues(project: Project): ProjectIssue[] {
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

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject());
  const [mode, setMode] = useState<ToolMode>("pin");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [wireStartPinId, setWireStartPinId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 720 });
  const [scale, setScale] = useState(1);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const update = () => {
      if (!stageWrapRef.current) return;
      const rect = stageWrapRef.current.getBoundingClientRect();
      setStageSize({ width: Math.max(720, rect.width), height: Math.max(480, rect.height) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  const boardsById = useMemo(() => new Map(project.boards.map((board) => [board.id, board])), [project.boards]);
  const pinsById = useMemo(() => new Map(project.pins.map((pin) => [pin.id, pin])), [project.pins]);
  const selectedPin = selectedPinId ? pinsById.get(selectedPinId) ?? null : null;
  const selectedWire = selectedWireId ? project.wires.find((wire) => wire.id === selectedWireId) ?? null : null;
  const selectedBoard = selectedBoardId ? boardsById.get(selectedBoardId) ?? null : null;
  const issues = useMemo(() => buildIssues(project), [project]);

  function focusTarget(target: IssueTarget) {
    if (target.kind === "wire") {
      setSelectedWireId(target.id);
      setSelectedPinId(null);
      setSelectedBoardId(null);
      return;
    }

    if (target.kind === "pin") {
      const pin = pinsById.get(target.id);
      setSelectedPinId(target.id);
      setSelectedWireId(null);
      setSelectedBoardId(pin?.boardId ?? null);
      return;
    }

    setSelectedBoardId(target.id);
    setSelectedPinId(null);
    setSelectedWireId(null);
  }

  function resetSelections() {
    setSelectedPinId(null);
    setSelectedWireId(null);
    setSelectedBoardId(null);
    setWireStartPinId(null);
  }

  function handleImportImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        const image = new Image();
        image.onload = () => {
          const maxWidth = 460;
          const ratio = Math.min(1, maxWidth / image.width);
          const boardBase = {
            id: uid("board"),
            name: file.name.replace(/\.[^.]+$/, "") || "Board",
            imageSrc: src,
            originalWidth: image.width,
            originalHeight: image.height,
            scale: ratio,
            crop: { left: 0, right: 0, top: 0, bottom: 0 },
            locked: false,
          };

          setProject((current) => {
            const board: Board = {
              ...boardBase,
              x: 80 + current.boards.length * 36,
              y: 72 + current.boards.length * 36,
            };
            return { ...current, boards: [...current.boards, board] };
          });
        };
        image.src = src;
      };
      reader.readAsDataURL(file);
    }

    event.target.value = "";
  }

  function handleImportProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setProject(normalizeProject(parsed));
        resetSelections();
      } catch {
        window.alert("项目文件无法解析，请确认它是 AeroWire 导出的 JSON。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) return;
    resetSelections();
  }

  function handleBoardClick(event: Konva.KonvaEventObject<MouseEvent>, board: Board) {
    if (mode === "pin") {
      const group = event.currentTarget;
      const pointer = group.getRelativePointerPosition();
      if (!pointer) return;
      const visibleSize = getBoardVisibleSize(board);

      const pin: Pin = {
        id: uid("pin"),
        boardId: board.id,
        x: Math.round(Math.max(0, Math.min(visibleSize.width, pointer.x))),
        y: Math.round(Math.max(0, Math.min(visibleSize.height, pointer.y))),
        label: `P${project.pins.length + 1}`,
        kind: "SIGNAL",
        voltage: "N/A",
        maxCurrentMa: 500,
      };

      setProject((current) => ({ ...current, pins: [...current.pins, pin] }));
      setSelectedPinId(pin.id);
      setSelectedBoardId(board.id);
      setSelectedWireId(null);
      return;
    }

    setSelectedBoardId(board.id);
    setSelectedPinId(null);
    setSelectedWireId(null);
  }

  function handlePinClick(event: Konva.KonvaEventObject<MouseEvent>, pin: Pin) {
    event.cancelBubble = true;
    setSelectedPinId(pin.id);
    setSelectedBoardId(pin.boardId);
    setSelectedWireId(null);

    if (mode !== "wire") return;

    if (!wireStartPinId) {
      setWireStartPinId(pin.id);
      return;
    }

    const from = pinsById.get(wireStartPinId);
    if (!from || from.id === pin.id) {
      setWireStartPinId(null);
      return;
    }

    const duplicate = project.wires.some(
      (wire) =>
        (wire.fromPinId === from.id && wire.toPinId === pin.id) ||
        (wire.fromPinId === pin.id && wire.toPinId === from.id),
    );
    if (duplicate) {
      setWireStartPinId(null);
      return;
    }

    const result = evaluateConnection(from, pin, from.boardId === pin.boardId);
    const wire: Wire = {
      id: uid("wire"),
      fromPinId: from.id,
      toPinId: pin.id,
      ...result,
    };

    setProject((current) => ({ ...current, wires: [...current.wires, wire] }));
    setSelectedWireId(wire.id);
    setWireStartPinId(null);
  }

  function handleWireClick(event: Konva.KonvaEventObject<MouseEvent>, wireId: string) {
    event.cancelBubble = true;
    setSelectedWireId(wireId);
    setSelectedPinId(null);
    setSelectedBoardId(null);
  }

  function updatePin(patch: Partial<Pin>) {
    if (!selectedPin) return;
    setProject((current) =>
      recomputeProject({
        ...current,
        pins: current.pins.map((pin) => (pin.id === selectedPin.id ? { ...pin, ...patch } : pin)),
      }),
    );
  }

  function updateBoard(patch: Partial<Board>) {
    if (!selectedBoard) return;
    setProject((current) => ({
      ...current,
      boards: current.boards.map((board) => (board.id === selectedBoard.id ? { ...board, ...patch } : board)),
    }));
  }

  function transformSelectedBoard(transform: Partial<Pick<Board, "scale" | "crop">>) {
    if (!selectedBoard) return;

    const nextBoard: Board = {
      ...selectedBoard,
      ...transform,
      crop: {
        ...selectedBoard.crop,
        ...(transform.crop ?? {}),
      },
    };

    const cropLimitX = Math.max(0, nextBoard.originalWidth - 24);
    const cropLimitY = Math.max(0, nextBoard.originalHeight - 24);
    nextBoard.crop.left = clamp(nextBoard.crop.left, 0, cropLimitX);
    nextBoard.crop.right = clamp(nextBoard.crop.right, 0, cropLimitX - nextBoard.crop.left);
    nextBoard.crop.top = clamp(nextBoard.crop.top, 0, cropLimitY);
    nextBoard.crop.bottom = clamp(nextBoard.crop.bottom, 0, cropLimitY - nextBoard.crop.top);
    nextBoard.scale = clamp(nextBoard.scale, 0.2, 2.5);

    setProject((current) => ({
      ...current,
      boards: current.boards.map((board) => (board.id === selectedBoard.id ? nextBoard : board)),
      pins: remapPinsForBoard(current.pins, selectedBoard, nextBoard),
    }));
  }

  function deleteBoard(boardId: string) {
    setProject((current) => {
      const removePinIds = new Set(current.pins.filter((pin) => pin.boardId === boardId).map((pin) => pin.id));
      return {
        ...current,
        boards: current.boards.filter((board) => board.id !== boardId),
        pins: current.pins.filter((pin) => pin.boardId !== boardId),
        wires: current.wires.filter((wire) => !removePinIds.has(wire.fromPinId) && !removePinIds.has(wire.toPinId)),
      };
    });
    if (selectedBoardId === boardId) {
      setSelectedBoardId(null);
    }
    if (selectedPin && selectedPin.boardId === boardId) {
      setSelectedPinId(null);
    }
  }

  function deleteSelected() {
    if (selectedPinId) {
      setProject((current) => ({
        ...current,
        pins: current.pins.filter((pin) => pin.id !== selectedPinId),
        wires: current.wires.filter((wire) => wire.fromPinId !== selectedPinId && wire.toPinId !== selectedPinId),
      }));
      setSelectedPinId(null);
      setWireStartPinId(null);
      return;
    }

    if (selectedWireId) {
      setProject((current) => ({ ...current, wires: current.wires.filter((wire) => wire.id !== selectedWireId) }));
      setSelectedWireId(null);
      return;
    }

    if (selectedBoardId) {
      deleteBoard(selectedBoardId);
    }
  }

  function clearProject() {
    setProject(initialProject);
    resetSelections();
  }

  function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;

    const uri = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = "aerowire-wiring.png";
    link.href = uri;
    link.click();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aerowire-project.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const canDelete = Boolean(selectedPinId || selectedWireId || selectedBoardId);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AW</div>
          <div>
            <h1>AeroWire</h1>
            <p>多板卡布线与电气规则检查</p>
          </div>
        </div>

        <div className="toolbar" aria-label="工具栏">
          <button className={mode === "select" ? "active" : ""} onClick={() => setMode("select")} title="选择模块">
            <FolderOpen size={18} />
          </button>
          <button className={mode === "pin" ? "active" : ""} onClick={() => setMode("pin")} title="添加引脚">
            <Plus size={18} />
          </button>
          <button className={mode === "wire" ? "active" : ""} onClick={() => setMode("wire")} title="跨板连线">
            <Cable size={18} />
          </button>
          <button onClick={() => imageInputRef.current?.click()} title="导入板卡图片">
            <ImagePlus size={18} />
          </button>
          <button onClick={() => projectInputRef.current?.click()} title="导入项目 JSON">
            <FileUp size={18} />
          </button>
          <button onClick={exportPng} title="导出 PNG">
            <Download size={18} />
          </button>
          <button onClick={exportJson} title="导出 JSON">
            <Save size={18} />
          </button>
          <button onClick={deleteSelected} disabled={!canDelete} title="删除所选">
            <Trash2 size={18} />
          </button>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImportImages} />
        <input ref={projectInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportProject} />
      </header>

      <section className="workspace">
        <aside className="panel left">
          <div className="panel-section">
            <h2>项目</h2>
            <div className="stat-grid">
              <div>
                <span>{project.boards.length}</span>
                <small>模块</small>
              </div>
              <div>
                <span>{project.pins.length}</span>
                <small>引脚</small>
              </div>
              <div>
                <span>{project.wires.length}</span>
                <small>连线</small>
              </div>
            </div>
            <div className="action-grid">
              <button className="wide primary" onClick={() => imageInputRef.current?.click()}>
                <ImagePlus size={17} />
                导入板卡图片
              </button>
              <button className="wide" onClick={() => projectInputRef.current?.click()}>
                <FileUp size={17} />
                导入项目
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>ERC</h2>
            <div className="erc-summary">
              <Zap size={17} />
              <span>{issues.length === 0 ? "当前没有阻断项" : `${issues.length} 个待确认问题`}</span>
            </div>
            <div className="issue-list">
              {issues.length === 0 ? (
                <p className="muted">多块板连在一起后，这里会显示电压、UART、悬空供电和板级完整性检查结果。</p>
              ) : (
                issues.map((issue) => (
                  <button key={issue.id} className={`issue ${issue.severity}`} onClick={() => focusTarget(issue.target)}>
                    {issue.text}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="panel-section">
            <h2>视图</h2>
            <label className="field">
              <span>缩放</span>
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={scale}
                onChange={(event) => setScale(Number(event.target.value))}
              />
            </label>
            <button className="wide ghost" onClick={clearProject}>
              <HardDriveDownload size={17} />
              新建空白项目
            </button>
          </div>
        </aside>

        <div ref={stageWrapRef} className="canvas-wrap">
          {project.boards.length === 0 && (
            <div className="empty-state">
              <ImagePlus size={36} />
              <strong>导入多张板卡俯视图</strong>
              <span>每块板都能单独加引脚，再用连线工具把不同模块联成一张完整电气图。</span>
            </div>
          )}

          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={handleStagePointerDown}
          >
            <Layer>
              <Rect x={0} y={0} width={stageSize.width / scale} height={stageSize.height / scale} fill="#edf1f4" />
              {Array.from({ length: 42 }).map((_, index) => (
                <Line
                  key={`v-${index}`}
                  points={[index * 48, 0, index * 48, stageSize.height / scale]}
                  stroke="#d9e1e7"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: 28 }).map((_, index) => (
                <Line
                  key={`h-${index}`}
                  points={[0, index * 48, stageSize.width / scale, index * 48]}
                  stroke="#d9e1e7"
                  strokeWidth={1}
                />
              ))}
            </Layer>

            <Layer>
              {project.wires.map((wire) => {
                const from = pinsById.get(wire.fromPinId);
                const to = pinsById.get(wire.toPinId);
                if (!from || !to) return null;
                const fromBoard = boardsById.get(from.boardId);
                const toBoard = boardsById.get(to.boardId);
                if (!fromBoard || !toBoard) return null;
                const a = getPinAbsolute(from, fromBoard);
                const b = getPinAbsolute(to, toBoard);
                const isSelected = selectedWireId === wire.id;
                const midX = (a.x + b.x) / 2;
                const offset = Math.max(40, Math.min(130, Math.abs(a.x - b.x) / 3));

                return (
                  <Group key={wire.id} onClick={(event) => handleWireClick(event, wire.id)}>
                    <Line
                      points={[a.x, a.y, midX - offset, a.y, midX + offset, b.y, b.x, b.y]}
                      tension={0.35}
                      stroke={wire.color}
                      strokeWidth={isSelected ? 5 : 3}
                      lineCap="round"
                      lineJoin="round"
                      shadowColor={wire.status === "error" ? "#c62a24" : "transparent"}
                      shadowBlur={wire.status === "error" ? 12 : 0}
                    />
                    {wire.status !== "ok" && (
                      <Text
                        x={midX - 92}
                        y={(a.y + b.y) / 2 - 23}
                        text={wire.status === "error" ? "ERR" : "CHECK"}
                        fill={wire.status === "error" ? "#c62a24" : "#9a5a00"}
                        fontSize={12}
                        fontStyle="bold"
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>

            <Layer>
              {project.boards.map((board) => {
                const isSelected = selectedBoardId === board.id;
                const visibleSize = getBoardVisibleSize(board);
                return (
                  <Group
                    key={board.id}
                    x={board.x}
                    y={board.y}
                    draggable={mode === "select" && !board.locked}
                    onDragEnd={(event) => {
                      const { x, y } = event.target.position();
                      setProject((current) => ({
                        ...current,
                        boards: current.boards.map((item) => (item.id === board.id ? { ...item, x, y } : item)),
                      }));
                    }}
                    onClick={(event) => handleBoardClick(event, board)}
                  >
                    <Rect
                      x={-10}
                      y={-10}
                      width={visibleSize.width + 20}
                      height={visibleSize.height + 40}
                      fill="#ffffff"
                      stroke={isSelected ? "#0f8b8d" : "#ffffff"}
                      strokeWidth={isSelected ? 2 : 1}
                      cornerRadius={8}
                      shadowColor="#1d2733"
                      shadowOpacity={0.13}
                      shadowBlur={14}
                    />
                    <BoardImage board={board} />
                    <Text x={0} y={visibleSize.height + 14} text={board.name} fill="#26313d" fontSize={13} fontStyle="bold" />
                    {board.locked && <Text x={visibleSize.width - 18} y={visibleSize.height + 14} text="L" fill="#7c5600" fontSize={12} fontStyle="bold" />}
                  </Group>
                );
              })}

              {project.pins.map((pin) => {
                const board = boardsById.get(pin.boardId);
                if (!board) return null;
                const position = getPinAbsolute(pin, board);
                const isSelected = selectedPinId === pin.id;
                const isWireStart = wireStartPinId === pin.id;

                return (
                  <Group key={pin.id} x={position.x} y={position.y} onClick={(event) => handlePinClick(event, pin)}>
                    <Circle
                      radius={isSelected || isWireStart ? 9 : 7}
                      fill={pinColorByKind[pin.kind]}
                      stroke={isWireStart ? "#ffffff" : isSelected ? "#101820" : "#ffffff"}
                      strokeWidth={isSelected || isWireStart ? 3 : 2}
                      shadowColor="#111827"
                      shadowBlur={7}
                      shadowOpacity={0.2}
                    />
                    <Text x={10} y={-8} text={pin.label} fill="#111827" fontSize={12} fontStyle="bold" />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>

        <aside className="panel right">
          <div className="panel-section">
            <h2>模块属性</h2>
            {selectedBoard ? (
              <div className="form">
                {(() => {
                  const visibleSize = getBoardVisibleSize(selectedBoard);
                  return (
                    <>
                      <label className="field">
                        <span>名称</span>
                        <input value={selectedBoard.name} onChange={(event) => updateBoard({ name: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>缩放 {selectedBoard.scale.toFixed(2)}x</span>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.05"
                          value={selectedBoard.scale}
                          onChange={(event) => transformSelectedBoard({ scale: Number(event.target.value) })}
                        />
                      </label>
                      <div className="crop-grid">
                        <label className="field compact">
                          <span>裁左</span>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(0, selectedBoard.originalWidth - selectedBoard.crop.right - 24)}
                            value={selectedBoard.crop.left}
                            onChange={(event) =>
                              transformSelectedBoard({ crop: { left: Number(event.target.value) } as BoardCrop })
                            }
                          />
                        </label>
                        <label className="field compact">
                          <span>裁右</span>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(0, selectedBoard.originalWidth - selectedBoard.crop.left - 24)}
                            value={selectedBoard.crop.right}
                            onChange={(event) =>
                              transformSelectedBoard({ crop: { right: Number(event.target.value) } as BoardCrop })
                            }
                          />
                        </label>
                        <label className="field compact">
                          <span>裁上</span>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(0, selectedBoard.originalHeight - selectedBoard.crop.bottom - 24)}
                            value={selectedBoard.crop.top}
                            onChange={(event) =>
                              transformSelectedBoard({ crop: { top: Number(event.target.value) } as BoardCrop })
                            }
                          />
                        </label>
                        <label className="field compact">
                          <span>裁下</span>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(0, selectedBoard.originalHeight - selectedBoard.crop.top - 24)}
                            value={selectedBoard.crop.bottom}
                            onChange={(event) =>
                              transformSelectedBoard({ crop: { bottom: Number(event.target.value) } as BoardCrop })
                            }
                          />
                        </label>
                      </div>
                      <label className="field checkbox-field">
                        <input
                          type="checkbox"
                          checked={selectedBoard.locked}
                          onChange={(event) => updateBoard({ locked: event.target.checked })}
                        />
                        <span>锁定位置</span>
                      </label>
                      <div className="inline-note">
                        <span>{Math.round(selectedBoard.x)}, {Math.round(selectedBoard.y)}</span>
                        <small>位置</small>
                      </div>
                      <div className="inline-note">
                        <span>{visibleSize.width} x {visibleSize.height}</span>
                        <small>可见尺寸</small>
                      </div>
                      <div className="inline-note">
                        <span>{project.pins.filter((pin) => pin.boardId === selectedBoard.id).length}</span>
                        <small>引脚数</small>
                      </div>
                      <button className="wide danger" onClick={() => deleteBoard(selectedBoard.id)}>
                        <Trash2 size={17} />
                        删除模块
                      </button>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="muted">选择一个模块后可以改名、锁定位置或整块删除。</p>
            )}
          </div>

          <div className="panel-section">
            <h2>引脚属性</h2>
            {selectedPin ? (
              <div className="form">
                <label className="field">
                  <span>名称</span>
                  <input value={selectedPin.label} onChange={(event) => updatePin({ label: event.target.value })} />
                </label>
                <label className="field">
                  <span>类型</span>
                  <select value={selectedPin.kind} onChange={(event) => updatePin({ kind: event.target.value as PinKind })}>
                    {pinKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>电压</span>
                  <select value={selectedPin.voltage} onChange={(event) => updatePin({ voltage: event.target.value as Voltage })}>
                    {voltages.map((voltage) => (
                      <option key={voltage} value={voltage}>
                        {voltage}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>最大电流 mA</span>
                  <input
                    type="number"
                    min={0}
                    value={selectedPin.maxCurrentMa}
                    onChange={(event) => updatePin({ maxCurrentMa: Number(event.target.value) })}
                  />
                </label>
              </div>
            ) : (
              <p className="muted">选择一个锚点后可以定义它的电气属性。</p>
            )}
          </div>

          <div className="panel-section">
            <h2>连线状态</h2>
            {selectedWire ? (
              <div className={`wire-card ${selectedWire.status}`}>
                <strong>{selectedWire.status.toUpperCase()}</strong>
                <span>{selectedWire.message}</span>
              </div>
            ) : (
              <p className="muted">{mode === "wire" && wireStartPinId ? "请选择第二个引脚完成连线。" : "选择一条线查看 ERC 结果。"}</p>
            )}
          </div>

          <div className="panel-section">
            <h2>模块列表</h2>
            <div className="board-list">
              {project.boards.length === 0 ? (
                <p className="muted">暂无模块。</p>
              ) : (
                project.boards.map((board) => (
                  <button
                    key={board.id}
                    className={`board-row ${selectedBoardId === board.id ? "active" : ""}`}
                    onClick={() => focusTarget({ kind: "board", id: board.id })}
                  >
                    <span>{board.name}</span>
                    <small>{board.locked ? "locked" : `${project.pins.filter((pin) => pin.boardId === board.id).length} pins`}</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
