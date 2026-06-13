import type { MutableRefObject, RefObject } from "react";
import { Circle, Group, Layer, Line, Rect, RegularPolygon, Shape, Stage, Text } from "react-konva";
import Konva from "konva";
import { ImagePlus } from "lucide-react";
import { DEFAULT_PIN_LABEL_FONT_FAMILY, DEFAULT_PIN_LABEL_FONT_SIZE, DEFAULT_PIN_SIZE, pinColorByKind } from "../domain/constants";
import { drawWirePath } from "../domain/bridges";
import { getBoardVisibleSize, getPinAbsolute, normalizeRotation } from "../domain/geometry";
import type { Board, Pin, Project, Wire } from "../domain/types";
import { getWireDash, getWirePathFromBends } from "../domain/wires";
import { BoardImage } from "./BoardImage";

type Bounds = { x: number; y: number; width: number; height: number };
type StageSize = { width: number; height: number };
type Point = { x: number; y: number };
type PinGroupInfo = { id: string; pins: Pin[]; x: number; y: number; width: number; height: number };
type LogicalNetworkLink = { id: string; from: Point; to: Point; name: string };

type CanvasEditorProps = {
  project: Project;
  stageWrapRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<Konva.Stage | null>;
  stageSize: StageSize;
  stagePosition: Point;
  scale: number;
  drawingBounds: Bounds;
  gridSize: number;
  showGrid: boolean;
  showEditorOverlays: boolean;
  isDraggingProjectItem: boolean;
  pinGuide: Point | null;
  boardsById: Map<string, Board>;
  pinsById: Map<string, Pin>;
  renderedWires: Wire[];
  selectedBoardId: string | null;
  selectedWireId: string | null;
  selectedPinId: string | null;
  selectedPinGroupId: string | null;
  wireStartPinId: string | null;
  selectedWire: Wire | null;
  wireBridgeMap: Map<string, Point[]>;
  logicalNetworkLinks: LogicalNetworkLink[];
  pinGroups: PinGroupInfo[];
  pinGroupDragRef: MutableRefObject<Record<string, Point>>;
  snapToGrid: (value: number) => number;
  onStagePointerDown: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onStagePointerMove: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onStagePointerUp: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onStagePointerLeave: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageWheel: (event: Konva.KonvaEventObject<WheelEvent>) => void;
  onBoardClick: (event: Konva.KonvaEventObject<MouseEvent>, board: Board) => void;
  onBoardDragEnd: (boardId: string, position: Point) => void;
  onWireClick: (event: Konva.KonvaEventObject<MouseEvent>, wireId: string) => void;
  onWireDoubleClick: (event: Konva.KonvaEventObject<MouseEvent>, wireId: string) => void;
  onWireLabelDragEnd: (wireId: string, offsetX: number, offsetY: number) => void;
  onSelectWire: (wireId: string) => void;
  onUpdateWireBend: (wireId: string, bendId: string, x: number, y: number) => void;
  onRemoveWireBend: (wireId: string, bendId: string) => void;
  onSelectPinGroup: (groupId: string) => void;
  onCommitPinGroupDrag: (groupId: string, deltaX: number, deltaY: number) => void;
  onPinClick: (event: Konva.KonvaEventObject<MouseEvent>, pin: Pin) => void;
  onRenamePin: (pin: Pin) => void;
  onProjectItemDragStart: () => void;
  onProjectItemDragEnd: () => void;
  onCommitPinDrag: (pin: Pin, board: Board, absolutePoint: Point) => void;
  onPinLabelDragEnd: (pin: Pin, offsetX: number, offsetY: number) => void;
};

export function CanvasEditor({
  project,
  stageWrapRef,
  stageRef,
  stageSize,
  stagePosition,
  scale,
  drawingBounds,
  gridSize,
  showGrid,
  showEditorOverlays,
  isDraggingProjectItem,
  pinGuide,
  boardsById,
  pinsById,
  renderedWires,
  selectedBoardId,
  selectedWireId,
  selectedPinId,
  selectedPinGroupId,
  wireStartPinId,
  selectedWire,
  wireBridgeMap,
  logicalNetworkLinks,
  pinGroups,
  pinGroupDragRef,
  snapToGrid,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onStagePointerLeave,
  onStageWheel,
  onBoardClick,
  onBoardDragEnd,
  onWireClick,
  onWireDoubleClick,
  onWireLabelDragEnd,
  onSelectWire,
  onUpdateWireBend,
  onRemoveWireBend,
  onSelectPinGroup,
  onCommitPinGroupDrag,
  onPinClick,
  onRenamePin,
  onProjectItemDragStart,
  onProjectItemDragEnd,
  onCommitPinDrag,
  onPinLabelDragEnd,
}: CanvasEditorProps) {
  return (
    <div ref={stageWrapRef} className="canvas-wrap">
      {project.boards.length === 0 && (
        <div className="empty-state">
          <ImagePlus size={36} />
          <strong>导入多张板卡俯视图</strong>
          <span>导入后先拖开位置，再逐块加引脚和连线会更顺手。</span>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stagePosition.x}
        y={stagePosition.y}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={onStagePointerDown}
        onMouseMove={onStagePointerMove}
        onMouseUp={onStagePointerUp}
        onMouseLeave={onStagePointerLeave}
        onWheel={onStageWheel}
      >
        <Layer>
          <Rect
            x={drawingBounds.x}
            y={drawingBounds.y}
            width={drawingBounds.width}
            height={drawingBounds.height}
            fill="#edf1f4"
            listening={false}
          />
          {showGrid &&
            showEditorOverlays &&
            Array.from({ length: Math.floor(drawingBounds.width / gridSize) + 1 }).map((_, index) => {
              const x = drawingBounds.x + index * gridSize;
              return (
                <Line
                  key={`v-${x}`}
                  points={[x, drawingBounds.y, x, drawingBounds.y + drawingBounds.height]}
                  stroke="#d9e1e7"
                  strokeWidth={1}
                  listening={false}
                />
              );
            })}
          {showGrid &&
            showEditorOverlays &&
            Array.from({ length: Math.floor(drawingBounds.height / gridSize) + 1 }).map((_, index) => {
              const y = drawingBounds.y + index * gridSize;
              return (
                <Line
                  key={`h-${y}`}
                  points={[drawingBounds.x, y, drawingBounds.x + drawingBounds.width, y]}
                  stroke="#d9e1e7"
                  strokeWidth={1}
                  listening={false}
                />
              );
            })}
          {pinGuide && showEditorOverlays && (
            <>
              <Line
                points={[pinGuide.x, drawingBounds.y, pinGuide.x, drawingBounds.y + drawingBounds.height]}
                stroke="#0f8b8d"
                strokeWidth={1}
                dash={[6, 6]}
                opacity={0.85}
                listening={false}
              />
              <Line
                points={[drawingBounds.x, pinGuide.y, drawingBounds.x + drawingBounds.width, pinGuide.y]}
                stroke="#0f8b8d"
                strokeWidth={1}
                dash={[6, 6]}
                opacity={0.85}
                listening={false}
              />
            </>
          )}
        </Layer>

        <Layer>
          {project.boards.map((board) => {
            const isSelected = showEditorOverlays && selectedBoardId === board.id;
            const visibleSize = getBoardVisibleSize(board);
            return (
              <Group
                key={board.id}
                x={board.x}
                y={board.y}
                draggable={!board.locked}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  onProjectItemDragStart();
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const { x, y } = event.target.position();
                  const snapped = { x: snapToGrid(x), y: snapToGrid(y) };
                  event.target.position(snapped);
                  onBoardDragEnd(board.id, snapped);
                  onProjectItemDragEnd();
                }}
                onClick={(event) => onBoardClick(event, board)}
              >
                <Rect
                  x={visibleSize.width / 2}
                  y={visibleSize.height / 2}
                  offsetX={visibleSize.width / 2 + 10}
                  offsetY={visibleSize.height / 2 + 10}
                  width={visibleSize.width + 20}
                  height={visibleSize.height + 40}
                  fill="#ffffff"
                  stroke={isSelected ? "#0f8b8d" : "#ffffff"}
                  strokeWidth={isSelected ? 2 : 1}
                  cornerRadius={8}
                  shadowColor="#1d2733"
                  shadowEnabled={!isDraggingProjectItem}
                  shadowOpacity={0.13}
                  shadowBlur={14}
                  rotation={normalizeRotation(board.rotation)}
                />
                <BoardImage board={board} />
                <Text x={0} y={visibleSize.height + 14} text={board.name} fill="#26313d" fontSize={13} fontStyle="bold" />
                {board.locked && (
                  <Text x={visibleSize.width - 18} y={visibleSize.height + 14} text="L" fill="#7c5600" fontSize={12} fontStyle="bold" />
                )}
              </Group>
            );
          })}
        </Layer>

        <Layer listening={false} visible={showEditorOverlays}>
          {logicalNetworkLinks.map((link) => (
            <Group key={link.id}>
              <Line
                points={[link.from.x, link.from.y, link.to.x, link.to.y]}
                stroke="#76a9ad"
                strokeWidth={2}
                dash={[10, 7]}
                opacity={0.7}
              />
              <Text
                x={(link.from.x + link.to.x) / 2 + 6}
                y={(link.from.y + link.to.y) / 2 - 10}
                text={link.name}
                fill="#5d7c80"
                fontSize={11}
                fontStyle="bold"
              />
            </Group>
          ))}
        </Layer>

        <Layer listening={!isDraggingProjectItem}>
          {renderedWires.map((wire) => {
            const from = pinsById.get(wire.fromPinId);
            const to = pinsById.get(wire.toPinId);
            if (!from || !to) return null;
            const fromBoard = boardsById.get(from.boardId);
            const toBoard = boardsById.get(to.boardId);
            if (!fromBoard || !toBoard) return null;
            const a = getPinAbsolute(from, fromBoard);
            const b = getPinAbsolute(to, toBoard);
            const points = getWirePathFromBends(a, wire.bends, b);
            const isSelected = showEditorOverlays && selectedWireId === wire.id;
            const midIndex = Math.max(0, Math.floor(points.length / 4) * 2 - 2);
            const midX = points[midIndex] ?? a.x;
            const midY = points[midIndex + 1] ?? a.y;
            const bridges = wireBridgeMap.get(wire.id) ?? [];

            return (
              <Group
                key={wire.id}
                onMouseDown={(event) => onWireClick(event, wire.id)}
                onDblClick={(event) => onWireDoubleClick(event, wire.id)}
              >
                <Line
                  points={points}
                  stroke="#000000"
                  strokeWidth={Math.max(34, wire.width + 26)}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.01}
                  visible={showEditorOverlays}
                />
                <Shape
                  sceneFunc={(context, shape) => {
                    const radius = Math.max(11, wire.width * 2 + 5);
                    drawWirePath(context, points, bridges, radius);
                    context.setLineDash(getWireDash(wire.lineStyle));
                    context.strokeStyle = wire.color;
                    context.lineWidth = isSelected ? wire.width + 2 : wire.width;
                    context.lineCap = "round";
                    context.lineJoin = "round";
                    context.stroke();
                    context.setLineDash([]);
                    context.fillStrokeShape(shape);
                  }}
                />
                {wire.endStyle === "dot" && <Circle x={b.x} y={b.y} radius={Math.max(4, wire.width)} fill={wire.color} />}
                {wire.endStyle === "arrow" && (
                  <Line
                    points={
                      wire.arrowDirection === "reverse"
                        ? [a.x + 14, a.y - 8, a.x, a.y, a.x + 14, a.y + 8]
                        : [b.x - 14, b.y - 8, b.x, b.y, b.x - 14, b.y + 8]
                    }
                    stroke={wire.color}
                    strokeWidth={Math.max(2, wire.width - 1)}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                {wire.status !== "ok" && showEditorOverlays && (
                  <Text
                    x={midX - 92}
                    y={midY - 23}
                    text={wire.status === "error" ? "ERR" : "CHECK"}
                    fill={wire.status === "error" ? "#c62a24" : "#9a5a00"}
                    fontSize={12}
                    fontStyle="bold"
                  />
                )}
                {wire.label.trim() !== "" && (
                  <Text
                    x={midX + wire.labelOffsetX}
                    y={midY + wire.labelOffsetY}
                    text={wire.label}
                    fill="#3e4c59"
                    fontSize={wire.labelFontSize}
                    fontStyle="bold"
                    draggable
                    onDragStart={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragMove={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragEnd={(event) => {
                      event.cancelBubble = true;
                      onWireLabelDragEnd(wire.id, Math.round(event.target.x() - midX), Math.round(event.target.y() - midY));
                    }}
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        <Layer visible={showEditorOverlays}>
          {selectedWire
            ? (() => {
                const from = pinsById.get(selectedWire.fromPinId);
                const to = pinsById.get(selectedWire.toPinId);
                const fromBoard = from ? boardsById.get(from.boardId) : null;
                const toBoard = to ? boardsById.get(to.boardId) : null;
                if (!from || !to || !fromBoard || !toBoard) return null;
                const points = getWirePathFromBends(getPinAbsolute(from, fromBoard), selectedWire.bends, getPinAbsolute(to, toBoard));

                return (
                  <>
                    <Line
                      points={points}
                      stroke={selectedWire.color}
                      strokeWidth={1.5}
                      dash={[5, 6]}
                      opacity={0.42}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                    {selectedWire.bends.map((bend) => (
                      <Group
                        key={bend.id}
                        x={bend.x}
                        y={bend.y}
                        draggable
                        onMouseDown={(event) => {
                          event.cancelBubble = true;
                          onSelectWire(selectedWire.id);
                        }}
                        onDragStart={(event) => {
                          event.cancelBubble = true;
                        }}
                        onDblClick={(event) => {
                          event.cancelBubble = true;
                          onRemoveWireBend(selectedWire.id, bend.id);
                        }}
                        onDragMove={(event) => {
                          event.cancelBubble = true;
                          const snapped = {
                            x: snapToGrid(event.target.x()),
                            y: snapToGrid(event.target.y()),
                          };
                          event.target.position(snapped);
                        }}
                        onDragEnd={(event) => {
                          event.cancelBubble = true;
                          onUpdateWireBend(selectedWire.id, bend.id, event.target.x(), event.target.y());
                          onSelectWire(selectedWire.id);
                        }}
                      >
                        <Circle radius={Math.max(18, selectedWire.width + 13)} fill="#ffffff" opacity={0.01} />
                        <RegularPolygon
                          sides={4}
                          radius={Math.max(10, selectedWire.width + 6)}
                          rotation={45}
                          fill={selectedWire.color}
                          stroke="#ffffff"
                          strokeWidth={3}
                          shadowColor="#1d2733"
                          shadowBlur={7}
                          shadowOpacity={0.18}
                          listening={false}
                        />
                        <Line points={[-5, 0, 5, 0]} stroke="#ffffff" strokeWidth={2} lineCap="round" opacity={0.95} listening={false} />
                        <Line points={[0, -5, 0, 5]} stroke="#ffffff" strokeWidth={2} lineCap="round" opacity={0.95} listening={false} />
                      </Group>
                    ))}
                  </>
                );
              })()
            : null}
        </Layer>

        <Layer visible={showEditorOverlays}>
          {pinGroups.map((group) => {
            const isSelected = selectedPinGroupId === group.id;
            return (
              <Group
                key={group.id}
                x={group.x}
                y={group.y}
                draggable
                onClick={(event) => {
                  event.cancelBubble = true;
                  onSelectPinGroup(group.id);
                }}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  onProjectItemDragStart();
                  pinGroupDragRef.current[group.id] = { x: event.target.x(), y: event.target.y() };
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const start = pinGroupDragRef.current[group.id] ?? { x: group.x, y: group.y };
                  const next = { x: event.target.x(), y: event.target.y() };
                  onCommitPinGroupDrag(group.id, next.x - start.x, next.y - start.y);
                  delete pinGroupDragRef.current[group.id];
                  onSelectPinGroup(group.id);
                  onProjectItemDragEnd();
                }}
              >
                <Rect
                  x={0}
                  y={0}
                  width={group.width}
                  height={group.height}
                  fill="transparent"
                  stroke={isSelected ? "#101820" : "#0f8b8d"}
                  strokeWidth={isSelected ? 2 : 1.5}
                  dash={[9, 6]}
                  cornerRadius={6}
                  listening={false}
                />
                {[
                  [0, 0, group.width, 0],
                  [group.width, 0, group.width, group.height],
                  [group.width, group.height, 0, group.height],
                  [0, group.height, 0, 0],
                ].map((points, index) => (
                  <Line key={index} points={points} stroke="#000000" strokeWidth={18} opacity={0.01} lineCap="round" />
                ))}
              </Group>
            );
          })}
        </Layer>

        <Layer>
          {project.pins.map((pin) => {
            const board = boardsById.get(pin.boardId);
            if (!board) return null;
            const position = getPinAbsolute(pin, board);
            const isSelected = showEditorOverlays && selectedPinId === pin.id;
            const isWireStart = showEditorOverlays && wireStartPinId === pin.id;

            return (
              <Group
                key={pin.id}
                x={position.x}
                y={position.y}
                draggable
                onClick={(event) => onPinClick(event, pin)}
                onDblClick={(event) => {
                  event.cancelBubble = true;
                  onRenamePin(pin);
                }}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  onProjectItemDragStart();
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  onCommitPinDrag(pin, board, {
                    x: event.target.x(),
                    y: event.target.y(),
                  });
                  onProjectItemDragEnd();
                }}
              >
                <Circle radius={Math.max(18, (pin.size ?? DEFAULT_PIN_SIZE) + 11)} fill="#ffffff" opacity={0.01} />
                <Circle
                  radius={(pin.size ?? DEFAULT_PIN_SIZE) + (isSelected || isWireStart ? 4 : 2)}
                  fill="#ffffff"
                  stroke={isWireStart ? "#ffffff" : isSelected ? "#101820" : pinColorByKind[pin.kind]}
                  strokeWidth={isSelected || isWireStart ? 3 : 2}
                  shadowColor="#111827"
                  shadowEnabled={!isDraggingProjectItem}
                  shadowBlur={7}
                  shadowOpacity={0.2}
                  listening={false}
                />
                <Circle radius={pin.size ?? DEFAULT_PIN_SIZE} fill={pinColorByKind[pin.kind]} stroke="#ffffff" strokeWidth={2} listening={false} />
                <Circle radius={Math.max(2, (pin.size ?? DEFAULT_PIN_SIZE) * 0.45)} fill="#ffffff" opacity={0.92} listening={false} />
                {!isDraggingProjectItem && (
                  <Text
                    x={pin.labelOffsetX}
                    y={pin.labelOffsetY}
                    text={pin.label}
                    fill={pin.labelColor ?? "#111827"}
                    fontSize={pin.labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE}
                    fontFamily={pin.labelFontFamily ?? DEFAULT_PIN_LABEL_FONT_FAMILY}
                    fontStyle="bold"
                    draggable
                    onDblClick={(event) => {
                      event.cancelBubble = true;
                      onRenamePin(pin);
                    }}
                    onDragStart={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragMove={(event) => {
                      event.cancelBubble = true;
                    }}
                    onDragEnd={(event) => {
                      event.cancelBubble = true;
                      onPinLabelDragEnd(pin, Math.round(event.target.x()), Math.round(event.target.y()));
                    }}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
