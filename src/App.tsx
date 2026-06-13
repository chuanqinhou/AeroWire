import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { CanvasEditor } from "./components/CanvasEditor";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { TopBar } from "./components/TopBar";
import {
  DEFAULT_CANVAS_GRID_SIZE,
  DEFAULT_PIN_LABEL_FONT_FAMILY,
  DEFAULT_PIN_LABEL_FONT_SIZE,
  DEFAULT_PIN_SIZE,
  EXPORT_MAX_IMAGE_SIDE,
  EXPORT_TARGET_PIXEL_RATIO,
  HISTORY_LIMIT,
  STORAGE_KEY,
  WIRE_HIT_TOLERANCE,
  initialProject,
  voltages,
} from "./domain/constants";
import { getWireBridgeMap } from "./domain/bridges";
import {
  clamp,
  getBoardLocalFromAbsolute,
  getBoardPlacement,
  getBoardVisibleSize,
  getPinBatchOffset,
  getPinAbsolute,
  normalizeRotation,
} from "./domain/geometry";
import { getProjectExportBounds } from "./domain/exportBounds";
import { inferPinGroupDirection, inferPinGroupSpacing, remapPinsForBoard } from "./domain/pins";
import { buildIssues, evaluateConnection, normalizeProject, recomputeProject } from "./domain/project";
import {
  createDefaultWireBends,
  getDefaultWireAppearance,
  getDefaultWireWidth,
  getDistanceToSegment,
  getDistanceToWirePath,
  getWireDefaultControl,
  getWireNodes,
  getWirePathFromBends,
} from "./domain/wires";
import type {
  Board,
  IssueTarget,
  NetworkType,
  Pin,
  PinBatchDirection,
  Project,
  ProjectIssue,
  Severity,
  ToolMode,
  Wire,
  WireBend,
} from "./domain/types";
import { createAssetUri, putImageAsset } from "./lib/assets";
import { uid } from "./lib/id";
import { exportProjectBundle as downloadProjectBundle, exportProjectJson, importProjectPayload } from "./lib/projectFiles";
import { clearStagePanPreview, setStagePanPreview } from "./lib/stagePan";

Konva.pixelRatio = 1;
Konva.hitOnDragEnabled = false;
Konva.dragDistance = 1;

function loadProject(): Project {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialProject;

  try {
    return normalizeProject(JSON.parse(raw));
  } catch {
    return initialProject;
  }
}

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject());
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);
  const [mode, setMode] = useState<ToolMode>("select");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedPinGroupId, setSelectedPinGroupId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [wireStartPinId, setWireStartPinId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 720 });
  const [scale, setScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [pinGuide, setPinGuide] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingProjectItem, setIsDraggingProjectItem] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(DEFAULT_CANVAS_GRID_SIZE);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isPinMenuOpen, setIsPinMenuOpen] = useState(false);
  const [isCleanExporting, setIsCleanExporting] = useState(false);
  const [pinBatchCount, setPinBatchCount] = useState(1);
  const [pinBatchSpacing, setPinBatchSpacing] = useState(24);
  const [pinBatchDirection, setPinBatchDirection] = useState<PinBatchDirection>("right");
  const [defaultPinSize, setDefaultPinSize] = useState(DEFAULT_PIN_SIZE);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const canvasPanStartRef = useRef<{ clientX: number; clientY: number; originX: number; originY: number } | null>(null);
  const isPanningCanvasRef = useRef(false);
  const canvasPanFrameRef = useRef<number | null>(null);
  const pendingCanvasPanPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pendingProjectFrameRef = useRef<number | null>(null);
  const pendingProjectUpdateRef = useRef<((current: Project) => Project) | null>(null);
  const pinGroupDragRef = useRef<Record<string, { x: number; y: number }>>({});
  const projectRef = useRef(project);
  const undoStackRef = useRef<Project[]>([]);
  const redoStackRef = useRef<Project[]>([]);
  const historyProjectRef = useRef(project);
  const skipNextHistoryRef = useRef(true);
  const isApplyingHistoryRef = useRef(false);
  const issuesRef = useRef<ProjectIssue[]>([]);
  const pinGroupsRef = useRef<Array<{ id: string; pins: Pin[]; x: number; y: number; width: number; height: number }>>([]);

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
    projectRef.current = project;
    let idleSaveId: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const saveTimer = window.setTimeout(() => {
      const saveProject = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current));
      };

      if (idleWindow.requestIdleCallback) {
        idleSaveId = idleWindow.requestIdleCallback(saveProject, { timeout: 4000 });
      } else {
        idleSaveId = window.setTimeout(saveProject, 0);
      }
    }, 1500);

    return () => {
      window.clearTimeout(saveTimer);
      if (idleSaveId == null) return;
      if (idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleSaveId);
      } else {
        window.clearTimeout(idleSaveId);
      }
    };
  }, [project]);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  useEffect(() => {
    const previousProject = historyProjectRef.current;
    if (skipNextHistoryRef.current) {
      skipNextHistoryRef.current = false;
      historyProjectRef.current = project;
      return;
    }

    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      historyProjectRef.current = project;
      return;
    }

    if (previousProject === project) {
      historyProjectRef.current = project;
      return;
    }

    setUndoStack((current) => {
      const nextUndoStack = [...current.slice(Math.max(0, current.length - HISTORY_LIMIT + 1)), previousProject];
      undoStackRef.current = nextUndoStack;
      return nextUndoStack;
    });
    redoStackRef.current = [];
    setRedoStack([]);
    historyProjectRef.current = project;
  }, [project]);

  useEffect(() => {
    const saveBeforeUnload = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current));
    };
    window.addEventListener("beforeunload", saveBeforeUnload);
    return () => window.removeEventListener("beforeunload", saveBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (canvasPanFrameRef.current != null) {
        window.cancelAnimationFrame(canvasPanFrameRef.current);
      }
      if (pendingProjectFrameRef.current != null) {
        window.cancelAnimationFrame(pendingProjectFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (isModifierPressed && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoProject();
        } else {
          undoProject();
        }
        return;
      }
      if (isModifierPressed && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoProject();
        return;
      }

      if (event.key !== "Escape") return;
      if (canvasPanFrameRef.current != null) {
        window.cancelAnimationFrame(canvasPanFrameRef.current);
        canvasPanFrameRef.current = null;
      }
      pendingCanvasPanPositionRef.current = null;
      clearStagePanPreview(stageRef.current);
      canvasPanStartRef.current = null;
      isPanningCanvasRef.current = false;
      setIsViewMenuOpen(false);
      setIsPinMenuOpen(false);
      resetSelections();
      setMode("select");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const boardsById = useMemo(() => new Map(project.boards.map((board) => [board.id, board])), [project.boards]);
  const pinsById = useMemo(() => new Map(project.pins.map((pin) => [pin.id, pin])), [project.pins]);
  const networkTypesById = useMemo(() => new Map(project.networkTypes.map((networkType) => [networkType.id, networkType])), [project.networkTypes]);
  const selectedPin = selectedPinId ? pinsById.get(selectedPinId) ?? null : null;
  const selectedPinGroup = selectedPinGroupId
    ? project.pins.filter((pin) => pin.groupId === selectedPinGroupId)
    : [];
  const pinGroups = useMemo(() => {
    if (isDraggingProjectItem) return pinGroupsRef.current;
    const groups = new Map<string, Pin[]>();
    for (const pin of project.pins) {
      if (!pin.groupId) continue;
      groups.set(pin.groupId, [...(groups.get(pin.groupId) ?? []), pin]);
    }

    const nextPinGroups = Array.from(groups.entries())
      .filter(([, pins]) => pins.length > 1)
      .flatMap(([groupId, pins]) => {
        const points = pins.flatMap((pin) => {
          const board = boardsById.get(pin.boardId);
          if (!board) return [];
          return [getPinAbsolute(pin, board)];
        });
        if (points.length === 0) return [];
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxX = Math.max(...points.map((point) => point.x));
        const maxY = Math.max(...points.map((point) => point.y));
        const padding = Math.max(18, Math.max(...pins.map((pin) => pin.size ?? DEFAULT_PIN_SIZE)) + 12);

        return [{
          id: groupId,
          pins,
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
        }];
      });
    pinGroupsRef.current = nextPinGroups;
    return nextPinGroups;
  }, [boardsById, isDraggingProjectItem, project.pins]);
  const selectedPinGroupInfo = selectedPinGroupId
    ? pinGroups.find((group) => group.id === selectedPinGroupId) ?? null
    : null;
  const selectedPinGroupDirection = inferPinGroupDirection(selectedPinGroup);
  const selectedPinGroupSpacing = inferPinGroupSpacing(selectedPinGroup);
  const selectedPinGroupSize = selectedPinGroup[0]?.size ?? DEFAULT_PIN_SIZE;
  const selectedPinGroupLabelColor = selectedPinGroup[0]?.labelColor ?? "#111827";
  const selectedPinGroupLabelFontSize = selectedPinGroup[0]?.labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE;
  const selectedPinGroupLabelFontFamily = selectedPinGroup[0]?.labelFontFamily ?? DEFAULT_PIN_LABEL_FONT_FAMILY;
  const selectedWire = selectedWireId ? project.wires.find((wire) => wire.id === selectedWireId) ?? null : null;
  const selectedBoard = selectedBoardId ? boardsById.get(selectedBoardId) ?? null : null;
  const issues = useMemo(() => {
    if (isDraggingProjectItem) return issuesRef.current;
    const nextIssues = buildIssues(project);
    issuesRef.current = nextIssues;
    return nextIssues;
  }, [isDraggingProjectItem, project]);
  const wireGeometry = useMemo(() => {
    return project.wires.flatMap((wire, order) => {
      const from = pinsById.get(wire.fromPinId);
      const to = pinsById.get(wire.toPinId);
      if (!from) return [];
      if (!to) return [];
      const fromBoard = boardsById.get(from.boardId);
      const toBoard = boardsById.get(to.boardId);
      if (!fromBoard || !toBoard) return [];
      const a = getPinAbsolute(from, fromBoard);
      const b = getPinAbsolute(to, toBoard);
      return [{
        id: wire.id,
        width: wire.width,
        order,
        points: getWirePathFromBends(a, wire.bends, b),
      }];
    });
  }, [boardsById, pinsById, project.wires]);
  const wireBridgeMap = useMemo(
    () => (isDraggingProjectItem ? new Map<string, Array<{ x: number; y: number }>>() : getWireBridgeMap(wireGeometry)),
    [isDraggingProjectItem, wireGeometry],
  );
  const renderedWires = useMemo(() => {
    return [...project.wires].sort((left, right) => {
      const leftBridgeCount = wireBridgeMap.get(left.id)?.length ?? 0;
      const rightBridgeCount = wireBridgeMap.get(right.id)?.length ?? 0;
      if (left.id === selectedWireId) return 1;
      if (right.id === selectedWireId) return -1;
      if (leftBridgeCount !== rightBridgeCount) return leftBridgeCount - rightBridgeCount;
      return project.wires.indexOf(left) - project.wires.indexOf(right);
    });
  }, [project.wires, selectedWireId, wireBridgeMap]);
  const logicalNetworkLinks = useMemo(() => {
    if (isDraggingProjectItem) return [];
    const links: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number }; name: string }> = [];
    const physicallyConnectedPairs = new Set(
      project.wires.flatMap((wire) => [
        `${wire.fromPinId}:${wire.toPinId}`,
        `${wire.toPinId}:${wire.fromPinId}`,
      ]),
    );

    for (const networkType of project.networkTypes) {
      const members = project.pins.filter((pin) => pin.networkTypeId === networkType.id);
      for (let index = 0; index < members.length; index += 1) {
        for (let inner = index + 1; inner < members.length; inner += 1) {
          const fromPin = members[index];
          const toPin = members[inner];
          if (physicallyConnectedPairs.has(`${fromPin.id}:${toPin.id}`)) continue;
          const fromBoard = boardsById.get(fromPin.boardId);
          const toBoard = boardsById.get(toPin.boardId);
          if (!fromBoard || !toBoard) continue;
          links.push({
            id: `${networkType.id}:${fromPin.id}:${toPin.id}`,
            from: getPinAbsolute(fromPin, fromBoard),
            to: getPinAbsolute(toPin, toBoard),
            name: networkType.name,
          });
        }
      }
    }

    return links;
  }, [boardsById, isDraggingProjectItem, project.networkTypes, project.pins, project.wires]);
  const projectExportBounds = useMemo(
    () => (isDraggingProjectItem ? null : getProjectExportBounds(project)),
    [isDraggingProjectItem, project],
  );
  const drawingBounds = useMemo(() => {
    const visibleX = -stagePosition.x / scale;
    const visibleY = -stagePosition.y / scale;
    const visibleWidth = stageSize.width / scale;
    const visibleHeight = stageSize.height / scale;
    const minX = Math.floor(Math.min(0, visibleX, projectExportBounds?.x ?? 0) / gridSize) * gridSize;
    const minY = Math.floor(Math.min(0, visibleY, projectExportBounds?.y ?? 0) / gridSize) * gridSize;
    const maxX =
      Math.ceil(
        Math.max(visibleX + visibleWidth, (projectExportBounds?.x ?? 0) + (projectExportBounds?.width ?? 0), gridSize * 42) /
          gridSize,
      ) * gridSize;
    const maxY =
      Math.ceil(
        Math.max(visibleY + visibleHeight, (projectExportBounds?.y ?? 0) + (projectExportBounds?.height ?? 0), gridSize * 28) /
          gridSize,
      ) * gridSize;

    return {
      x: minX,
      y: minY,
      width: Math.max(gridSize, maxX - minX),
      height: Math.max(gridSize, maxY - minY),
    };
  }, [gridSize, projectExportBounds, scale, stagePosition.x, stagePosition.y, stageSize.height, stageSize.width]);

  function scheduleProjectUpdate(updater: (current: Project) => Project) {
    pendingProjectUpdateRef.current = updater;
    if (pendingProjectFrameRef.current != null) return;

    pendingProjectFrameRef.current = window.requestAnimationFrame(() => {
      const pending = pendingProjectUpdateRef.current;
      pendingProjectUpdateRef.current = null;
      pendingProjectFrameRef.current = null;
      if (!pending) return;
      setProject(pending);
    });
  }

  function flushProjectUpdate() {
    if (pendingProjectFrameRef.current != null) {
      window.cancelAnimationFrame(pendingProjectFrameRef.current);
      pendingProjectFrameRef.current = null;
    }
    const pending = pendingProjectUpdateRef.current;
    pendingProjectUpdateRef.current = null;
    if (pending) {
      setProject(pending);
    }
  }

  function undoProject() {
    flushProjectUpdate();
    const currentUndoStack = undoStackRef.current;
    if (currentUndoStack.length === 0) return;
    const previousProject = currentUndoStack[currentUndoStack.length - 1];
    const currentProject = projectRef.current;
    const nextUndoStack = currentUndoStack.slice(0, -1);
    const nextRedoStack = [...redoStackRef.current.slice(Math.max(0, redoStackRef.current.length - HISTORY_LIMIT + 1)), currentProject];
    isApplyingHistoryRef.current = true;
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = nextRedoStack;
    setUndoStack(nextUndoStack);
    setRedoStack(nextRedoStack);
    setProject(previousProject);
    resetSelections();
  }

  function redoProject() {
    flushProjectUpdate();
    const currentRedoStack = redoStackRef.current;
    if (currentRedoStack.length === 0) return;
    const nextProject = currentRedoStack[currentRedoStack.length - 1];
    const currentProject = projectRef.current;
    const nextRedoStack = currentRedoStack.slice(0, -1);
    const nextUndoStack = [...undoStackRef.current.slice(Math.max(0, undoStackRef.current.length - HISTORY_LIMIT + 1)), currentProject];
    isApplyingHistoryRef.current = true;
    redoStackRef.current = nextRedoStack;
    undoStackRef.current = nextUndoStack;
    setRedoStack(nextRedoStack);
    setUndoStack(nextUndoStack);
    setProject(nextProject);
    resetSelections();
  }

  function replaceProject(nextProject: Project) {
    skipNextHistoryRef.current = true;
    historyProjectRef.current = nextProject;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
    setProject(nextProject);
    resetSelections();
  }

  function focusTarget(target: IssueTarget) {
    if (target.kind === "wire") {
      setSelectedWireId(target.id);
      setSelectedPinId(null);
      setSelectedPinGroupId(null);
      setSelectedBoardId(null);
      return;
    }

    if (target.kind === "pin") {
      const pin = pinsById.get(target.id);
      setSelectedPinId(target.id);
      setSelectedPinGroupId(null);
      setSelectedWireId(null);
      setSelectedBoardId(pin?.boardId ?? null);
      return;
    }

    setSelectedBoardId(target.id);
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedWireId(null);
  }

  function resetSelections() {
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedWireId(null);
    setSelectedBoardId(null);
    setWireStartPinId(null);
  }

  function handleImportImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const startSlot = project.boards.length;

    setMode("select");

    for (const [fileIndex, file] of files.entries()) {
      const reader = new FileReader();
      reader.onload = async () => {
        const src = String(reader.result);
        const assetId = uid("image");
        let imageSrc = createAssetUri(assetId);
        try {
          await putImageAsset(assetId, src);
        } catch {
          window.alert("图片资源保存失败，将以内嵌方式加入项目。");
          imageSrc = src;
        }
        const image = new Image();
        image.onload = () => {
          const maxWidth = 460;
          const ratio = Math.min(1, maxWidth / image.width);
          const boardBase = {
            id: uid("board"),
            name: file.name.replace(/\.[^.]+$/, "") || "Board",
            imageSrc,
            originalWidth: image.width,
            originalHeight: image.height,
            scale: ratio,
            rotation: 0,
            crop: { left: 0, right: 0, top: 0, bottom: 0 },
            locked: false,
          };

          setProject((current) => {
            const slot = startSlot + fileIndex;
            const placement = getBoardPlacement(slot);
            const board: Board = {
              ...boardBase,
              x: placement.x,
              y: placement.y,
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
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const result = await importProjectPayload(parsed);
        replaceProject(result.project);
        if (result.failedAssetCount > 0) {
          window.alert(`项目已导入，但有 ${result.failedAssetCount} 个图片资源没有写入本地缓存。`);
        }
      } catch {
        window.alert("项目文件无法解析，请确认它是 AeroWire 导出的 JSON 或 .awire 项目包。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) return;
    pendingCanvasPanPositionRef.current = null;
    clearStagePanPreview(stage);

    if (mode !== "select") {
      resetSelections();
      setMode("select");
      return;
    }

    const stagePositionNow = stage.position();
    canvasPanStartRef.current = {
      clientX: event.evt.clientX,
      clientY: event.evt.clientY,
      originX: stagePositionNow.x,
      originY: stagePositionNow.y,
    };
    isPanningCanvasRef.current = false;
  }

  function handleStagePointerMove(event: Konva.KonvaEventObject<MouseEvent>) {
    if (!canvasPanStartRef.current || mode !== "select") return;
    const stage = event.target.getStage();
    if (!stage) return;

    const deltaX = event.evt.clientX - canvasPanStartRef.current.clientX;
    const deltaY = event.evt.clientY - canvasPanStartRef.current.clientY;
    if (!isPanningCanvasRef.current && Math.hypot(deltaX, deltaY) < 4) return;

    isPanningCanvasRef.current = true;
    pendingCanvasPanPositionRef.current = {
      x: canvasPanStartRef.current.originX + deltaX,
      y: canvasPanStartRef.current.originY + deltaY,
    };

    if (canvasPanFrameRef.current != null) return;
    canvasPanFrameRef.current = window.requestAnimationFrame(() => {
      canvasPanFrameRef.current = null;
      const nextPosition = pendingCanvasPanPositionRef.current;
      const panStart = canvasPanStartRef.current;
      if (!nextPosition) return;
      if (!panStart) return;
      setStagePanPreview(
        stage,
        nextPosition.x - panStart.originX,
        nextPosition.y - panStart.originY,
      );
    });
  }

  function handleStagePointerUp(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    if (stage && isPanningCanvasRef.current) {
      if (canvasPanFrameRef.current != null) {
        window.cancelAnimationFrame(canvasPanFrameRef.current);
        canvasPanFrameRef.current = null;
      }
      const nextPosition = pendingCanvasPanPositionRef.current ?? stage.position();
      pendingCanvasPanPositionRef.current = null;
      clearStagePanPreview(stage);
      stage.position(nextPosition);
      stage.batchDraw();
      setStagePosition({ x: nextPosition.x, y: nextPosition.y });
    } else if (stage && event.target === stage) {
      resetSelections();
      setMode("select");
    }
    canvasPanStartRef.current = null;
    isPanningCanvasRef.current = false;
  }

  function handleStagePointerLeave(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    if (stage && isPanningCanvasRef.current) {
      if (canvasPanFrameRef.current != null) {
        window.cancelAnimationFrame(canvasPanFrameRef.current);
        canvasPanFrameRef.current = null;
      }
      const nextPosition = pendingCanvasPanPositionRef.current ?? stage.position();
      pendingCanvasPanPositionRef.current = null;
      clearStagePanPreview(stage);
      stage.position(nextPosition);
      stage.batchDraw();
      setStagePosition({ x: nextPosition.x, y: nextPosition.y });
    }
    canvasPanStartRef.current = null;
    isPanningCanvasRef.current = false;
  }

  function handleBoardClick(event: Konva.KonvaEventObject<MouseEvent>, board: Board) {
    if (mode === "pin") {
      const canvasPoint = getCanvasPointFromEvent(event);
      if (!canvasPoint) return;
      const pointer = getBoardLocalFromAbsolute(board, canvasPoint);
      const visibleSize = getBoardVisibleSize(board);

      const count = clamp(Math.round(pinBatchCount), 1, 64);
      const spacing = clamp(Math.round(pinBatchSpacing), 1, 200);
      const groupId = count > 1 ? uid("pin_group") : null;
      const pinsToAdd: Pin[] = Array.from({ length: count }).map((_, index) => {
        const offset = getPinBatchOffset(pinBatchDirection, index, spacing);
        return {
          id: uid("pin"),
          boardId: board.id,
          x: Math.round(Math.max(0, Math.min(visibleSize.width, pointer.x + offset.x))),
          y: Math.round(Math.max(0, Math.min(visibleSize.height, pointer.y + offset.y))),
          groupId,
          size: defaultPinSize,
          label: `P${project.pins.length + index + 1}`,
          labelColor: "#111827",
          labelFontSize: DEFAULT_PIN_LABEL_FONT_SIZE,
          labelFontFamily: DEFAULT_PIN_LABEL_FONT_FAMILY,
          typeLabel: "SIGNAL",
          networkTypeId: null,
          labelOffsetX: 10,
          labelOffsetY: -8,
          kind: "SIGNAL",
          voltage: "N/A",
          maxCurrentMa: 500,
        };
      });

      setProject((current) => ({ ...current, pins: [...current.pins, ...pinsToAdd] }));
      setSelectedPinId(groupId ? null : pinsToAdd[0]?.id ?? null);
      setSelectedPinGroupId(groupId);
      setSelectedBoardId(groupId ? null : board.id);
      setSelectedWireId(null);
      setMode("select");
      setIsPinMenuOpen(false);
      return;
    }

    setSelectedBoardId(board.id);
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedWireId(null);
  }

  function handlePinClick(event: Konva.KonvaEventObject<MouseEvent>, pin: Pin) {
    event.cancelBubble = true;
    setSelectedPinId(pin.id);
    setSelectedPinGroupId(null);
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
    const appearance = getDefaultWireAppearance(from, pin);
    const fromBoard = boardsById.get(from.boardId);
    const toBoard = boardsById.get(pin.boardId);
    const bends =
      fromBoard && toBoard
        ? createDefaultWireBends(getPinAbsolute(from, fromBoard), getPinAbsolute(pin, toBoard))
        : [];
    const wire: Wire = {
      id: uid("wire"),
      fromPinId: from.id,
      toPinId: pin.id,
      width: getDefaultWireWidth(from, pin),
      label: "",
      labelFontSize: 12,
      labelOffsetX: 8,
      labelOffsetY: -10,
      bends,
      routeX: null,
      routeY: null,
      ...appearance,
      ...result,
    };

    setProject((current) => ({ ...current, wires: [...current.wires, wire] }));
    setSelectedWireId(wire.id);
    setWireStartPinId(null);
    setMode("select");
  }

  function renamePin(pin: Pin) {
    const nextLabel = window.prompt("编辑锚点名称", pin.label);
    if (nextLabel == null) return;
    updatePinById(pin.id, { label: nextLabel.trim() || pin.label });
  }

  function getCanvasPointFromEvent(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;

    return {
      x: (pointer.x - stagePosition.x) / scale,
      y: (pointer.y - stagePosition.y) / scale,
    };
  }

  function getWireHitCandidates(point: { x: number; y: number }) {
    return project.wires
      .flatMap((wire, order) => {
        const from = pinsById.get(wire.fromPinId);
        const to = pinsById.get(wire.toPinId);
        const fromBoard = from ? boardsById.get(from.boardId) : null;
        const toBoard = to ? boardsById.get(to.boardId) : null;
        if (!from || !to || !fromBoard || !toBoard) return [];
        const points = getWirePathFromBends(getPinAbsolute(from, fromBoard), wire.bends, getPinAbsolute(to, toBoard));
        const distance = getDistanceToWirePath(point, points);
        const tolerance = Math.max(WIRE_HIT_TOLERANCE + 10, wire.width + 16);
        if (distance > tolerance) return [];
        return [{ id: wire.id, distance, order, bridgeCount: wireBridgeMap.get(wire.id)?.length ?? 0 }];
      })
      .sort((left, right) => {
        if (Math.abs(left.distance - right.distance) > 2) return left.distance - right.distance;
        if (left.bridgeCount !== right.bridgeCount) return right.bridgeCount - left.bridgeCount;
        return right.order - left.order;
      });
  }

  function handleWireClick(event: Konva.KonvaEventObject<MouseEvent>, wireId: string) {
    event.cancelBubble = true;
    const canvasPoint = getCanvasPointFromEvent(event);
    if (!canvasPoint) {
      setSelectedWireId(wireId);
      setSelectedPinId(null);
      setSelectedPinGroupId(null);
      setSelectedBoardId(null);
      return;
    }

    const candidates = getWireHitCandidates(canvasPoint);
    const selectedCandidateIndex = selectedWireId
      ? candidates.findIndex((candidate) => candidate.id === selectedWireId)
      : -1;
    const nextWireId =
      selectedCandidateIndex >= 0 && candidates.length > 1
        ? candidates[(selectedCandidateIndex + 1) % candidates.length].id
        : candidates[0]?.id ?? wireId;

    setSelectedWireId(nextWireId);
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedBoardId(null);
  }

  function handleWireDoubleClick(event: Konva.KonvaEventObject<MouseEvent>, wireId: string) {
    event.cancelBubble = true;
    const canvasPoint = getCanvasPointFromEvent(event);
    if (!canvasPoint) return;
    const candidates = getWireHitCandidates(canvasPoint);
    const targetWireId =
      selectedWireId && candidates.some((candidate) => candidate.id === selectedWireId)
        ? selectedWireId
        : candidates[0]?.id ?? wireId;

    setSelectedWireId(targetWireId);
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedBoardId(null);
    addWireBend(targetWireId, canvasPoint.x, canvasPoint.y);
  }

  function selectWireOnly(wireId: string) {
    setSelectedWireId(wireId);
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedBoardId(null);
  }

  function commitBoardDrag(boardId: string, position: { x: number; y: number }) {
    setProject((current) => ({
      ...current,
      boards: current.boards.map((item) => (item.id === boardId ? { ...item, ...position } : item)),
    }));
    setSelectedBoardId(boardId);
    setSelectedPinId(null);
    setSelectedPinGroupId(null);
    setSelectedWireId(null);
  }

  function commitWireLabelDrag(wireId: string, labelOffsetX: number, labelOffsetY: number) {
    setProject((current) => ({
      ...current,
      wires: current.wires.map((item) =>
        item.id === wireId
          ? {
              ...item,
              labelOffsetX,
              labelOffsetY,
            }
          : item,
      ),
    }));
    selectWireOnly(wireId);
  }

  function commitPinLabelDrag(pin: Pin, labelOffsetX: number, labelOffsetY: number) {
    setProject((current) => ({
      ...current,
      pins: current.pins.map((item) =>
        item.id === pin.id
          ? {
              ...item,
              labelOffsetX,
              labelOffsetY,
            }
          : item,
      ),
    }));
    setSelectedPinId(pin.id);
    setSelectedPinGroupId(null);
    setSelectedBoardId(pin.boardId);
    setSelectedWireId(null);
  }

  function handlePinDragCommit(pin: Pin, board: Board, absolutePoint: { x: number; y: number }) {
    commitPinDrag(pin, board, absolutePoint);
    setSelectedPinId(pin.id);
    setSelectedPinGroupId(null);
    setSelectedBoardId(pin.boardId);
    setSelectedWireId(null);
  }

  function startProjectItemDrag() {
    setIsDraggingProjectItem(true);
  }

  function finishProjectItemDrag() {
    setIsDraggingProjectItem(false);
  }

  function updatePin(patch: Partial<Pin>) {
    if (!selectedPin) return;
    updatePinById(selectedPin.id, patch);
  }

  function updatePinById(pinId: string, patch: Partial<Pin>) {
    setProject((current) =>
      recomputeProject({
        ...current,
        pins: current.pins.map((pin) => (pin.id === pinId ? { ...pin, ...patch } : pin)),
      }),
    );
  }

  function selectPinGroup(groupId: string) {
    setSelectedPinGroupId(groupId);
    setSelectedPinId(null);
    setSelectedWireId(null);
    setSelectedBoardId(null);
  }

  function movePinGroup(groupId: string, deltaX: number, deltaY: number) {
    setProject((current) => ({
      ...current,
      pins: current.pins.map((pin) => {
        if (pin.groupId !== groupId) return pin;
        const board = current.boards.find((item) => item.id === pin.boardId);
        if (!board) {
          return {
            ...pin,
            x: Math.round(pin.x + deltaX),
            y: Math.round(pin.y + deltaY),
          };
        }
        const absolute = getPinAbsolute(pin, board);
        const nextLocal = getBoardLocalFromAbsolute(board, {
          x: absolute.x + deltaX,
          y: absolute.y + deltaY,
        });
        return {
          ...pin,
          x: Math.round(nextLocal.x),
          y: Math.round(nextLocal.y),
        };
      }),
    }));
  }

  function updatePinGroup(
    groupId: string,
    patch: Partial<Pick<Pin, "size" | "labelColor" | "labelFontSize" | "labelFontFamily">>,
  ) {
    setProject((current) => ({
      ...current,
      pins: current.pins.map((pin) => (pin.groupId === groupId ? { ...pin, ...patch } : pin)),
    }));
  }

  function updatePinGroupLayout(groupId: string, direction: PinBatchDirection, spacing: number) {
    setProject((current) => {
      const groupPins = current.pins.filter((pin) => pin.groupId === groupId);
      if (groupPins.length < 2) return current;
      const anchor = groupPins[0];
      const nextSpacing = clamp(Math.round(spacing), 1, 240);
      const nextPins = current.pins.map((pin) => {
        const groupIndex = groupPins.findIndex((item) => item.id === pin.id);
        if (groupIndex < 0) return pin;
        const offset = getPinBatchOffset(direction, groupIndex, nextSpacing);
        return {
          ...pin,
          x: Math.round(anchor.x + offset.x),
          y: Math.round(anchor.y + offset.y),
        };
      });

      return { ...current, pins: nextPins };
    });
  }

  function ungroupSelectedPins() {
    if (!selectedPinGroupId) return;
    setProject((current) => ({
      ...current,
      pins: current.pins.map((pin) =>
        pin.groupId === selectedPinGroupId ? { ...pin, groupId: null } : pin,
      ),
    }));
    setSelectedPinGroupId(null);
  }

  function deletePinGroup(groupId: string) {
    setProject((current) => {
      const removePinIds = new Set(current.pins.filter((pin) => pin.groupId === groupId).map((pin) => pin.id));
      return {
        ...current,
        pins: current.pins.filter((pin) => pin.groupId !== groupId),
        wires: current.wires.filter((wire) => !removePinIds.has(wire.fromPinId) && !removePinIds.has(wire.toPinId)),
      };
    });
    if (selectedPinGroupId === groupId) {
      setSelectedPinGroupId(null);
    }
    setWireStartPinId(null);
  }

  function createNetworkTypeFromSelectedPin() {
    if (!selectedPin) return;
    const name = window.prompt("新建网络类型名称", selectedPin.typeLabel || selectedPin.kind);
    if (!name) return;

    const networkType: NetworkType = {
      id: uid("network"),
      name: name.trim(),
      baseKind: selectedPin.kind,
      defaultVoltage: selectedPin.voltage,
    };

    setProject((current) => ({
      ...current,
      networkTypes: [...current.networkTypes, networkType],
      pins: current.pins.map((pin) =>
        pin.id === selectedPin.id
          ? {
              ...pin,
              networkTypeId: networkType.id,
              typeLabel: networkType.name,
              kind: networkType.baseKind,
              voltage: networkType.defaultVoltage || pin.voltage,
            }
          : pin,
      ),
    }));
  }

  function applyNetworkTypeToSelectedPin(networkTypeId: string | null) {
    if (!selectedPin) return;
    if (networkTypeId == null) {
      updatePin({ networkTypeId: null });
      return;
    }
    const networkType = networkTypesById.get(networkTypeId);
    if (!networkType) return;
    updatePin({
      networkTypeId,
      typeLabel: networkType.name,
      kind: networkType.baseKind,
      voltage: networkType.defaultVoltage || selectedPin.voltage,
    });
  }

  function materializeSelectedPinNetwork() {
    if (!selectedPin || !selectedPin.networkTypeId) return;
    const members = project.pins.filter(
      (pin) => pin.networkTypeId === selectedPin.networkTypeId && pin.id !== selectedPin.id,
    );
    const fromBoard = boardsById.get(selectedPin.boardId);
    if (!fromBoard) return;

    setProject((current) => {
      const newWires = [...current.wires];
      for (const targetPin of members) {
        const duplicate = current.wires.some(
          (wire) =>
            (wire.fromPinId === selectedPin.id && wire.toPinId === targetPin.id) ||
            (wire.fromPinId === targetPin.id && wire.toPinId === selectedPin.id),
        );
        const toBoard = boardsById.get(targetPin.boardId);
        if (duplicate || !toBoard) continue;
        const appearance = getDefaultWireAppearance(selectedPin, targetPin);
        newWires.push({
          id: uid("wire"),
          fromPinId: selectedPin.id,
          toPinId: targetPin.id,
          width: getDefaultWireWidth(selectedPin, targetPin),
          label: "",
          labelFontSize: 12,
          labelOffsetX: 8,
          labelOffsetY: -10,
          bends: createDefaultWireBends(getPinAbsolute(selectedPin, fromBoard), getPinAbsolute(targetPin, toBoard)),
          routeX: null,
          routeY: null,
          ...appearance,
          ...evaluateConnection(selectedPin, targetPin, selectedPin.boardId === targetPin.boardId),
        });
      }
      return recomputeProject({ ...current, wires: newWires });
    });
  }

  function createNetworkType() {
    const name = window.prompt("新建网络类型名称", "NET");
    if (!name) return;
    const networkType: NetworkType = {
      id: uid("network"),
      name: name.trim(),
      baseKind: "SIGNAL",
      defaultVoltage: "N/A",
    };
    setProject((current) => ({
      ...current,
      networkTypes: [...current.networkTypes, networkType],
    }));
  }

  function updateNetworkType(networkTypeId: string, patch: Partial<NetworkType>) {
    setProject((current) => ({
      ...current,
      networkTypes: current.networkTypes.map((networkType) =>
        networkType.id === networkTypeId ? { ...networkType, ...patch } : networkType,
      ),
    }));
  }

  function deleteNetworkType(networkTypeId: string) {
    setProject((current) => ({
      ...current,
      networkTypes: current.networkTypes.filter((networkType) => networkType.id !== networkTypeId),
      pins: current.pins.map((pin) =>
        pin.networkTypeId === networkTypeId ? { ...pin, networkTypeId: null } : pin,
      ),
    }));
  }

  function updateWire(patch: Partial<Wire>) {
    if (!selectedWire) return;
    updateWireById(selectedWire.id, patch);
  }

  function updateWireById(wireId: string, patch: Partial<Wire>) {
    setProject((current) => ({
      ...current,
      wires: current.wires.map((wire) => (wire.id === wireId ? { ...wire, ...patch } : wire)),
    }));
  }

  function updateWireBend(wireId: string, bendId: string, x: number, y: number) {
    setProject((current) => ({
      ...current,
      wires: current.wires.map((wire) =>
        wire.id === wireId
          ? {
              ...wire,
              bends: wire.bends.map((bend) =>
                bend.id === bendId
                  ? { ...bend, x: snapToGrid(x), y: snapToGrid(y) }
                  : bend,
              ),
            }
          : wire,
      ),
    }));
  }

  function addWireBend(wireId: string, x: number, y: number) {
    setProject((current) => ({
      ...current,
      wires: current.wires.map((wire) => {
        if (wire.id !== wireId) return wire;
        const from = current.pins.find((pin) => pin.id === wire.fromPinId);
        const to = current.pins.find((pin) => pin.id === wire.toPinId);
        if (!from || !to) return wire;
        const fromBoard = current.boards.find((board) => board.id === from.boardId);
        const toBoard = current.boards.find((board) => board.id === to.boardId);
        if (!fromBoard || !toBoard) return wire;

        const nodes = getWireNodes(getPinAbsolute(from, fromBoard), wire.bends, getPinAbsolute(to, toBoard));
        let closestSegmentIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < nodes.length - 1; index += 1) {
          const distance = getDistanceToSegment({ x, y }, nodes[index], nodes[index + 1]);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestSegmentIndex = index;
          }
        }

        const nextBends = [...wire.bends];
        nextBends.splice(
          closestSegmentIndex,
          0,
          { id: uid("bend"), x: snapToGrid(x), y: snapToGrid(y) },
        );

        return {
          ...wire,
          bends: nextBends,
        };
      }),
    }));
  }

  function removeWireBend(wireId: string, bendId: string) {
    setProject((current) => ({
      ...current,
      wires: current.wires.map((wire) =>
        wire.id === wireId && wire.bends.length > 0
          ? {
              ...wire,
              bends: wire.bends.filter((bend) => bend.id !== bendId),
            }
          : wire,
      ),
    }));
  }

  function commitPinDrag(pin: Pin, board: Board, absolutePoint: { x: number; y: number }) {
    const visibleSize = getBoardVisibleSize(board);
    const pinDragMargin = gridSize * 20;
    const nextLocal = getBoardLocalFromAbsolute(board, absolutePoint);
    const nextX = clamp(Math.round(nextLocal.x), -pinDragMargin, visibleSize.width + pinDragMargin);
    const nextY = clamp(Math.round(nextLocal.y), -pinDragMargin, visibleSize.height + pinDragMargin);
    const deltaX = nextX - pin.x;
    const deltaY = nextY - pin.y;
    const movingGroupId = pin.groupId;

    setProject((current) => ({
      ...current,
      pins: current.pins.map((item) => {
        const shouldMove = item.id === pin.id || (movingGroupId != null && item.groupId === movingGroupId);
        if (!shouldMove) return item;
        return {
          ...item,
          x: clamp(Math.round(item.x + deltaX), -pinDragMargin, visibleSize.width + pinDragMargin),
          y: clamp(Math.round(item.y + deltaY), -pinDragMargin, visibleSize.height + pinDragMargin),
        };
      }),
    }));
  }

  function commitPinGroupDrag(groupId: string, deltaX: number, deltaY: number) {
    setProject((current) => ({
      ...current,
      pins: current.pins.map((pin) => {
        if (pin.groupId !== groupId) return pin;
        const board = current.boards.find((item) => item.id === pin.boardId);
        if (!board) {
          return {
            ...pin,
            x: Math.round(pin.x + deltaX),
            y: Math.round(pin.y + deltaY),
          };
        }
        const absolute = getPinAbsolute(pin, board);
        const nextLocal = getBoardLocalFromAbsolute(board, {
          x: absolute.x + deltaX,
          y: absolute.y + deltaY,
        });
        return {
          ...pin,
          x: Math.round(nextLocal.x),
          y: Math.round(nextLocal.y),
        };
      }),
    }));
  }

  function snapToGrid(value: number) {
    return Math.round(value / gridSize) * gridSize;
  }

  function moveBoard(boardId: string, x: number, y: number) {
    scheduleProjectUpdate((current) => ({
      ...current,
      boards: current.boards.map((item) => (item.id === boardId ? { ...item, x, y } : item)),
    }));
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

  function rotateSelectedBoard(rotation: number) {
    if (!selectedBoard) return;
    updateBoard({ rotation: normalizeRotation(rotation) });
  }

  function deleteBoard(boardId: string) {
    const selectedGroupTouchesBoard = Boolean(
      selectedPinGroupId &&
        project.pins.some((pin) => pin.groupId === selectedPinGroupId && pin.boardId === boardId),
    );
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
    if (selectedGroupTouchesBoard) {
      setSelectedPinGroupId(null);
    }
  }

  function deleteSelected() {
    if (selectedPinGroupId) {
      deletePinGroup(selectedPinGroupId);
      return;
    }

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
    replaceProject(initialProject);
  }

  async function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;

    const bounds = getProjectExportBounds(project);
    if (!bounds) {
      window.alert("当前项目为空，没有可导出的图纸。");
      return;
    }

    const maxPixelRatio = Math.min(EXPORT_MAX_IMAGE_SIDE / bounds.width, EXPORT_MAX_IMAGE_SIDE / bounds.height);
    const pixelRatio = clamp(Math.min(EXPORT_TARGET_PIXEL_RATIO, maxPixelRatio), 0.5, EXPORT_TARGET_PIXEL_RATIO);
    const previousPosition = stage.position();
    const previousScale = stage.scale();

    setIsCleanExporting(true);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    try {
      stage.position({ x: 0, y: 0 });
      stage.scale({ x: 1, y: 1 });
      stage.batchDraw();

      const uri = stage.toDataURL({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        pixelRatio,
      });

      const link = document.createElement("a");
      link.download = "aerowire-wiring.png";
      link.href = uri;
      link.click();
    } finally {
      stage.position(previousPosition);
      stage.scale(previousScale);
      stage.batchDraw();
      setIsCleanExporting(false);
    }
  }

  function exportJson() {
    exportProjectJson(project);
  }

  async function exportProjectBundle() {
    if (project.boards.length === 0) {
      window.alert("当前项目没有板卡，暂时不需要打包。");
      return;
    }

    const { missingAssetNames } = await downloadProjectBundle(project);
    if (missingAssetNames.length > 0) {
      window.alert(`项目包已导出，但这些板卡图片没有找到：${missingAssetNames.join("、")}。`);
    }
  }

  function handleStageWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.08;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextScale = clamp(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.4, 2.8);
    const stagePositionNow = stage.position();

    const mousePointTo = {
      x: (pointer.x - stagePositionNow.x) / oldScale,
      y: (pointer.y - stagePositionNow.y) / oldScale,
    };
    const nextPosition = {
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale,
    };

    setScale(nextScale);
    setStagePosition(nextPosition);
  }

  const canDelete = Boolean(selectedPinGroupId || selectedPinId || selectedWireId || selectedBoardId);
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const showEditorOverlays = !isDraggingProjectItem && !isCleanExporting;
  const transientModeHint =
    mode === "pin"
      ? "添加锚点：点一下板卡即创建，随后自动回到选择。Esc 取消。"
      : mode === "wire"
        ? wireStartPinId
          ? "连线：请选择第二个锚点完成连接，完成后自动回到选择。Esc 取消。"
          : "连线：请选择第一个锚点，完成后自动回到选择。Esc 取消。"
        : null;

  return (
    <main className="shell">
      <TopBar
        mode={mode}
        canUndo={canUndo}
        canRedo={canRedo}
        canDelete={canDelete}
        isPinMenuOpen={isPinMenuOpen}
        isViewMenuOpen={isViewMenuOpen}
        showGrid={showGrid}
        gridSize={gridSize}
        scale={scale}
        pinBatchCount={pinBatchCount}
        pinBatchSpacing={pinBatchSpacing}
        pinBatchDirection={pinBatchDirection}
        defaultPinSize={defaultPinSize}
        onUndo={undoProject}
        onRedo={redoProject}
        onSelectMode={() => {
          setMode("select");
          setIsPinMenuOpen(false);
        }}
        onTogglePinMenu={() => {
          setMode("pin");
          setIsPinMenuOpen(true);
          setIsViewMenuOpen(false);
        }}
        onWireMode={() => {
          setMode("wire");
          setIsPinMenuOpen(false);
        }}
        onImportImages={() => {
          setIsPinMenuOpen(false);
          imageInputRef.current?.click();
        }}
        onImportProject={() => {
          setIsPinMenuOpen(false);
          projectInputRef.current?.click();
        }}
        onExportPng={() => {
          setIsPinMenuOpen(false);
          void exportPng();
        }}
        onExportBundle={() => {
          setIsPinMenuOpen(false);
          void exportProjectBundle();
        }}
        onExportJson={() => {
          setIsPinMenuOpen(false);
          exportJson();
        }}
        onDeleteSelected={() => {
          setIsPinMenuOpen(false);
          deleteSelected();
        }}
        onToggleViewMenu={() => {
          setIsViewMenuOpen((open) => !open);
          setIsPinMenuOpen(false);
        }}
        onShowGridChange={setShowGrid}
        onGridSizeChange={setGridSize}
        onScaleChange={setScale}
        onPinBatchCountChange={setPinBatchCount}
        onPinBatchSpacingChange={setPinBatchSpacing}
        onPinBatchDirectionChange={setPinBatchDirection}
        onDefaultPinSizeChange={setDefaultPinSize}
      />
      <>
        <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImportImages} />
        <input
          ref={projectInputRef}
          type="file"
          accept=".awire,application/json,.json"
          hidden
          onChange={handleImportProject}
        />
        <datalist id="voltage-presets">
          {voltages.map((voltage) => (
            <option key={voltage} value={voltage} />
          ))}
        </datalist>
      </>

      <section className="workspace">
        <LeftPanel
          project={project}
          issues={issues}
          transientModeHint={transientModeHint}
          onImportImages={() => imageInputRef.current?.click()}
          onImportProject={() => projectInputRef.current?.click()}
          onExportProjectBundle={() => void exportProjectBundle()}
          onClearProject={clearProject}
          onFocusTarget={focusTarget}
        />

        <CanvasEditor
          project={project}
          stageWrapRef={stageWrapRef}
          stageRef={stageRef}
          stageSize={stageSize}
          stagePosition={stagePosition}
          scale={scale}
          drawingBounds={drawingBounds}
          gridSize={gridSize}
          showGrid={showGrid}
          showEditorOverlays={showEditorOverlays}
          isDraggingProjectItem={isDraggingProjectItem}
          pinGuide={pinGuide}
          boardsById={boardsById}
          pinsById={pinsById}
          renderedWires={renderedWires}
          selectedBoardId={selectedBoardId}
          selectedWireId={selectedWireId}
          selectedPinId={selectedPinId}
          selectedPinGroupId={selectedPinGroupId}
          wireStartPinId={wireStartPinId}
          selectedWire={selectedWire}
          wireBridgeMap={wireBridgeMap}
          logicalNetworkLinks={logicalNetworkLinks}
          pinGroups={pinGroups}
          pinGroupDragRef={pinGroupDragRef}
          snapToGrid={snapToGrid}
          onStagePointerDown={handleStagePointerDown}
          onStagePointerMove={handleStagePointerMove}
          onStagePointerUp={handleStagePointerUp}
          onStagePointerLeave={handleStagePointerLeave}
          onStageWheel={handleStageWheel}
          onBoardClick={handleBoardClick}
          onBoardDragEnd={commitBoardDrag}
          onWireClick={handleWireClick}
          onWireDoubleClick={handleWireDoubleClick}
          onWireLabelDragEnd={commitWireLabelDrag}
          onSelectWire={selectWireOnly}
          onUpdateWireBend={updateWireBend}
          onRemoveWireBend={removeWireBend}
          onSelectPinGroup={selectPinGroup}
          onCommitPinGroupDrag={commitPinGroupDrag}
          onPinClick={handlePinClick}
          onRenamePin={renamePin}
          onProjectItemDragStart={startProjectItemDrag}
          onProjectItemDragEnd={finishProjectItemDrag}
          onCommitPinDrag={handlePinDragCommit}
          onPinLabelDragEnd={commitPinLabelDrag}
        />

        <RightPanel
          project={project}
          mode={mode}
          wireStartPinId={wireStartPinId}
          selectedBoard={selectedBoard}
          selectedBoardId={selectedBoardId}
          selectedPin={selectedPin}
          selectedPinGroup={selectedPinGroup}
          selectedPinGroupId={selectedPinGroupId}
          selectedPinGroupInfo={selectedPinGroupInfo}
          selectedPinGroupDirection={selectedPinGroupDirection}
          selectedPinGroupSpacing={selectedPinGroupSpacing}
          selectedPinGroupSize={selectedPinGroupSize}
          selectedPinGroupLabelColor={selectedPinGroupLabelColor}
          selectedPinGroupLabelFontSize={selectedPinGroupLabelFontSize}
          selectedPinGroupLabelFontFamily={selectedPinGroupLabelFontFamily}
          selectedWire={selectedWire}
          boardsById={boardsById}
          pinsById={pinsById}
          pinBatchSpacing={pinBatchSpacing}
          onUpdateBoard={updateBoard}
          onTransformSelectedBoard={transformSelectedBoard}
          onRotateSelectedBoard={rotateSelectedBoard}
          onDeleteBoard={deleteBoard}
          onUpdatePin={updatePin}
          onUpdatePinGroup={updatePinGroup}
          onUpdatePinGroupLayout={updatePinGroupLayout}
          onUngroupSelectedPins={ungroupSelectedPins}
          onDeletePinGroup={deletePinGroup}
          onCreateNetworkTypeFromSelectedPin={createNetworkTypeFromSelectedPin}
          onApplyNetworkTypeToSelectedPin={applyNetworkTypeToSelectedPin}
          onMaterializeSelectedPinNetwork={materializeSelectedPinNetwork}
          onUpdateWire={updateWire}
          onCreateNetworkType={createNetworkType}
          onUpdateNetworkType={updateNetworkType}
          onDeleteNetworkType={deleteNetworkType}
          onFocusTarget={focusTarget}
        />
      </section>
    </main>
  );
}
