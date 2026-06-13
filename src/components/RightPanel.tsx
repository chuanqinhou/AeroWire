import { Cable, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_PIN_LABEL_FONT_FAMILY,
  DEFAULT_PIN_LABEL_FONT_SIZE,
  DEFAULT_PIN_SIZE,
  PIN_BATCH_DIRECTIONS,
  PIN_LABEL_FONTS,
  pinKinds,
  wireArrowDirections,
  wireEndStyles,
  wireLineStyles,
} from "../domain/constants";
import { clamp, getBoardVisibleSize, getPinAbsolute, normalizeRotation } from "../domain/geometry";
import type {
  Board,
  BoardCrop,
  IssueTarget,
  NetworkType,
  Pin,
  PinBatchDirection,
  PinKind,
  Project,
  ToolMode,
  Wire,
  WireArrowDirection,
  WireEndStyle,
  WireLineStyle,
} from "../domain/types";
import { getWirePathFromBends, getWirePathLength } from "../domain/wires";

type PinGroupInfo = { id: string; pins: Pin[]; x: number; y: number; width: number; height: number };

type RightPanelProps = {
  project: Project;
  mode: ToolMode;
  wireStartPinId: string | null;
  selectedBoard: Board | null;
  selectedBoardId: string | null;
  selectedPin: Pin | null;
  selectedPinGroup: Pin[];
  selectedPinGroupId: string | null;
  selectedPinGroupInfo: PinGroupInfo | null;
  selectedPinGroupDirection: PinBatchDirection;
  selectedPinGroupSpacing: number;
  selectedPinGroupSize: number;
  selectedPinGroupLabelColor: string;
  selectedPinGroupLabelFontSize: number;
  selectedPinGroupLabelFontFamily: string;
  selectedWire: Wire | null;
  boardsById: Map<string, Board>;
  pinsById: Map<string, Pin>;
  pinBatchSpacing: number;
  onUpdateBoard: (patch: Partial<Board>) => void;
  onTransformSelectedBoard: (transform: Partial<Pick<Board, "scale" | "crop">>) => void;
  onRotateSelectedBoard: (rotation: number) => void;
  onDeleteBoard: (boardId: string) => void;
  onUpdatePin: (patch: Partial<Pin>) => void;
  onUpdatePinGroup: (
    groupId: string,
    patch: Partial<Pick<Pin, "size" | "labelColor" | "labelFontSize" | "labelFontFamily">>,
  ) => void;
  onUpdatePinGroupLayout: (groupId: string, direction: PinBatchDirection, spacing: number) => void;
  onUngroupSelectedPins: () => void;
  onDeletePinGroup: (groupId: string) => void;
  onCreateNetworkTypeFromSelectedPin: () => void;
  onApplyNetworkTypeToSelectedPin: (networkTypeId: string | null) => void;
  onMaterializeSelectedPinNetwork: () => void;
  onUpdateWire: (patch: Partial<Wire>) => void;
  onCreateNetworkType: () => void;
  onUpdateNetworkType: (networkTypeId: string, patch: Partial<NetworkType>) => void;
  onDeleteNetworkType: (networkTypeId: string) => void;
  onFocusTarget: (target: IssueTarget) => void;
};

export function RightPanel({
  project,
  mode,
  wireStartPinId,
  selectedBoard,
  selectedBoardId,
  selectedPin,
  selectedPinGroup,
  selectedPinGroupId,
  selectedPinGroupInfo,
  selectedPinGroupDirection,
  selectedPinGroupSpacing,
  selectedPinGroupSize,
  selectedPinGroupLabelColor,
  selectedPinGroupLabelFontSize,
  selectedPinGroupLabelFontFamily,
  selectedWire,
  boardsById,
  pinsById,
  pinBatchSpacing,
  onUpdateBoard,
  onTransformSelectedBoard,
  onRotateSelectedBoard,
  onDeleteBoard,
  onUpdatePin,
  onUpdatePinGroup,
  onUpdatePinGroupLayout,
  onUngroupSelectedPins,
  onDeletePinGroup,
  onCreateNetworkTypeFromSelectedPin,
  onApplyNetworkTypeToSelectedPin,
  onMaterializeSelectedPinNetwork,
  onUpdateWire,
  onCreateNetworkType,
  onUpdateNetworkType,
  onDeleteNetworkType,
  onFocusTarget,
}: RightPanelProps) {
  return (
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
                    <input value={selectedBoard.name} onChange={(event) => onUpdateBoard({ name: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>缩放 {selectedBoard.scale.toFixed(2)}x</span>
                    <input
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.05"
                      value={selectedBoard.scale}
                      onChange={(event) => onTransformSelectedBoard({ scale: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>旋转 {normalizeRotation(selectedBoard.rotation)}°</span>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      step="1"
                      value={normalizeRotation(selectedBoard.rotation)}
                      onChange={(event) => onRotateSelectedBoard(Number(event.target.value))}
                    />
                  </label>
                  <div className="action-grid">
                    <button className="wide ghost" onClick={() => onRotateSelectedBoard(selectedBoard.rotation - 90)}>
                      左转 90°
                    </button>
                    <button className="wide ghost" onClick={() => onRotateSelectedBoard(selectedBoard.rotation + 90)}>
                      右转 90°
                    </button>
                    <button className="wide ghost" onClick={() => onRotateSelectedBoard(0)}>
                      归零
                    </button>
                  </div>
                  <div className="crop-grid">
                    <label className="field compact">
                      <span>裁左</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, selectedBoard.originalWidth - selectedBoard.crop.right - 24)}
                        value={selectedBoard.crop.left}
                        onChange={(event) => onTransformSelectedBoard({ crop: { left: Number(event.target.value) } as BoardCrop })}
                      />
                    </label>
                    <label className="field compact">
                      <span>裁右</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, selectedBoard.originalWidth - selectedBoard.crop.left - 24)}
                        value={selectedBoard.crop.right}
                        onChange={(event) => onTransformSelectedBoard({ crop: { right: Number(event.target.value) } as BoardCrop })}
                      />
                    </label>
                    <label className="field compact">
                      <span>裁上</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, selectedBoard.originalHeight - selectedBoard.crop.bottom - 24)}
                        value={selectedBoard.crop.top}
                        onChange={(event) => onTransformSelectedBoard({ crop: { top: Number(event.target.value) } as BoardCrop })}
                      />
                    </label>
                    <label className="field compact">
                      <span>裁下</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, selectedBoard.originalHeight - selectedBoard.crop.top - 24)}
                        value={selectedBoard.crop.bottom}
                        onChange={(event) => onTransformSelectedBoard({ crop: { bottom: Number(event.target.value) } as BoardCrop })}
                      />
                    </label>
                  </div>
                  <label className="field checkbox-field">
                    <input
                      type="checkbox"
                      checked={selectedBoard.locked}
                      onChange={(event) => onUpdateBoard({ locked: event.target.checked })}
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
                  <button className="wide danger" onClick={() => onDeleteBoard(selectedBoard.id)}>
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
        <h2>锚点组属性</h2>
        {selectedPinGroupInfo && selectedPinGroupId ? (
          <div className="form">
            <div className="inline-note">
              <span>{selectedPinGroup.length} 个锚点</span>
              <small>整体组框</small>
            </div>
            <label className="field">
              <span>排列方向</span>
              <select
                value={selectedPinGroupDirection}
                onChange={(event) =>
                  onUpdatePinGroupLayout(
                    selectedPinGroupId,
                    event.target.value as PinBatchDirection,
                    selectedPinGroupSpacing || pinBatchSpacing,
                  )
                }
              >
                {PIN_BATCH_DIRECTIONS.map((direction) => (
                  <option key={direction.value} value={direction.value}>
                    {direction.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>锚点间距 {selectedPinGroupSpacing}px</span>
              <input
                type="range"
                min="4"
                max="160"
                step="1"
                value={clamp(selectedPinGroupSpacing || pinBatchSpacing, 4, 160)}
                onChange={(event) =>
                  onUpdatePinGroupLayout(selectedPinGroupId, selectedPinGroupDirection, Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>整体大小 {selectedPinGroupSize}px</span>
              <input
                type="range"
                min="4"
                max="18"
                step="1"
                value={selectedPinGroupSize}
                onChange={(event) => onUpdatePinGroup(selectedPinGroupId, { size: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>标签颜色</span>
              <input
                type="color"
                value={selectedPinGroupLabelColor}
                onChange={(event) => onUpdatePinGroup(selectedPinGroupId, { labelColor: event.target.value })}
              />
            </label>
            <label className="field">
              <span>标签字号 {selectedPinGroupLabelFontSize}px</span>
              <input
                type="range"
                min="8"
                max="28"
                step="1"
                value={selectedPinGroupLabelFontSize}
                onChange={(event) => onUpdatePinGroup(selectedPinGroupId, { labelFontSize: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>标签字体</span>
              <select
                value={selectedPinGroupLabelFontFamily}
                onChange={(event) => onUpdatePinGroup(selectedPinGroupId, { labelFontFamily: event.target.value })}
              >
                {PIN_LABEL_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-note">
              <span>
                {Math.round(selectedPinGroupInfo.x)}, {Math.round(selectedPinGroupInfo.y)}
              </span>
              <small>组框位置</small>
            </div>
            <div className="action-grid">
              <button className="wide ghost" onClick={onUngroupSelectedPins}>
                取消成组
              </button>
              <button className="wide danger" onClick={() => onDeletePinGroup(selectedPinGroupId)}>
                <Trash2 size={17} />
                删除锚点组
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">点击批量锚点外侧的大虚线矩形框，可以整体移动并编辑间距、方向和样式。</p>
        )}
      </div>

      <div className="panel-section">
        <h2>引脚属性</h2>
        {selectedPin ? (
          <div className="form">
            <label className="field">
              <span>名称</span>
              <input value={selectedPin.label} onChange={(event) => onUpdatePin({ label: event.target.value })} />
            </label>
            <label className="field">
              <span>显示类型</span>
              <input value={selectedPin.typeLabel} onChange={(event) => onUpdatePin({ typeLabel: event.target.value })} />
            </label>
            <label className="field">
              <span>锚点大小 {selectedPin.size ?? DEFAULT_PIN_SIZE}px</span>
              <input
                type="range"
                min="4"
                max="18"
                step="1"
                value={selectedPin.size ?? DEFAULT_PIN_SIZE}
                onChange={(event) => onUpdatePin({ size: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>标签颜色</span>
              <input
                type="color"
                value={selectedPin.labelColor ?? "#111827"}
                onChange={(event) => onUpdatePin({ labelColor: event.target.value })}
              />
            </label>
            <label className="field">
              <span>标签字号 {selectedPin.labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE}px</span>
              <input
                type="range"
                min="8"
                max="28"
                step="1"
                value={selectedPin.labelFontSize ?? DEFAULT_PIN_LABEL_FONT_SIZE}
                onChange={(event) => onUpdatePin({ labelFontSize: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>标签字体</span>
              <select
                value={selectedPin.labelFontFamily ?? DEFAULT_PIN_LABEL_FONT_FAMILY}
                onChange={(event) => onUpdatePin({ labelFontFamily: event.target.value })}
              >
                {PIN_LABEL_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedPin.groupId && (
              <>
                <div className="inline-note">
                  <span>{project.pins.filter((pin) => pin.groupId === selectedPin.groupId).length} 个锚点</span>
                  <small>所属锚点组</small>
                </div>
                <p className="muted group-note">点击外侧大虚线框可编辑整组间距、方向和样式。</p>
                <button className="wide ghost" onClick={() => onUpdatePin({ groupId: null })}>
                  脱离锚点组
                </button>
              </>
            )}
            <label className="field">
              <span>规则类型</span>
              <select value={selectedPin.kind} onChange={(event) => onUpdatePin({ kind: event.target.value as PinKind })}>
                {pinKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>逻辑网络</span>
              <select
                value={selectedPin.networkTypeId ?? ""}
                onChange={(event) => onApplyNetworkTypeToSelectedPin(event.target.value === "" ? null : event.target.value)}
              >
                <option value="">未指定</option>
                {project.networkTypes.map((networkType) => (
                  <option key={networkType.id} value={networkType.id}>
                    {networkType.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="wide" onClick={onCreateNetworkTypeFromSelectedPin}>
              <Plus size={17} />
              从当前引脚创建网络类型
            </button>
            {selectedPin.networkTypeId && (
              <button className="wide ghost" onClick={onMaterializeSelectedPinNetwork}>
                <Cable size={17} />
                同网络转真实导线
              </button>
            )}
            <label className="field">
              <span>电压</span>
              <input
                list="voltage-presets"
                value={selectedPin.voltage}
                onChange={(event) => onUpdatePin({ voltage: event.target.value })}
                placeholder="例如 4.2V / 5V / VBAT / 1S"
              />
            </label>
            <label className="field">
              <span>最大电流 mA</span>
              <input
                type="number"
                min={0}
                value={selectedPin.maxCurrentMa}
                onChange={(event) => onUpdatePin({ maxCurrentMa: Number(event.target.value) })}
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
          (() => {
            const from = pinsById.get(selectedWire.fromPinId);
            const to = pinsById.get(selectedWire.toPinId);
            const fromBoard = from ? boardsById.get(from.boardId) : null;
            const toBoard = to ? boardsById.get(to.boardId) : null;
            const pathLengthPx =
              from && to && fromBoard && toBoard
                ? Math.round(getWirePathLength(getWirePathFromBends(getPinAbsolute(from, fromBoard), selectedWire.bends, getPinAbsolute(to, toBoard))))
                : 0;

            return (
              <div className="form">
                <div className={`wire-card ${selectedWire.status}`}>
                  <strong>{selectedWire.status.toUpperCase()}</strong>
                  <span>{selectedWire.message}</span>
                </div>
                <div className="inline-note">
                  <span>{`${from?.label ?? "?"} -> ${to?.label ?? "?"}`}</span>
                  <small>锚点</small>
                </div>
                <div className="inline-note">
                  <span>{`${fromBoard?.name ?? "?"} -> ${toBoard?.name ?? "?"}`}</span>
                  <small>模块</small>
                </div>
                <div className="inline-note">
                  <span>{pathLengthPx}px</span>
                  <small>路径长度</small>
                </div>
                <label className="field">
                  <span>线色</span>
                  <input type="color" value={selectedWire.color} onChange={(event) => onUpdateWire({ color: event.target.value })} />
                </label>
                <label className="field">
                  <span>线型</span>
                  <select value={selectedWire.lineStyle} onChange={(event) => onUpdateWire({ lineStyle: event.target.value as WireLineStyle })}>
                    {wireLineStyles.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>端点样式</span>
                  <select value={selectedWire.endStyle} onChange={(event) => onUpdateWire({ endStyle: event.target.value as WireEndStyle })}>
                    {wireEndStyles.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedWire.endStyle === "arrow" && (
                  <label className="field">
                    <span>箭头方向</span>
                    <select
                      value={selectedWire.arrowDirection}
                      onChange={(event) => onUpdateWire({ arrowDirection: event.target.value as WireArrowDirection })}
                    >
                      {wireArrowDirections.map((direction) => (
                        <option key={direction} value={direction}>
                          {direction}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>线宽 {selectedWire.width}px</span>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={selectedWire.width}
                    onChange={(event) => onUpdateWire({ width: Number(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>标注文本</span>
                  <input value={selectedWire.label} onChange={(event) => onUpdateWire({ label: event.target.value })} />
                </label>
                <label className="field">
                  <span>标注字号 {selectedWire.labelFontSize}px</span>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    step="1"
                    value={selectedWire.labelFontSize}
                    onChange={(event) => onUpdateWire({ labelFontSize: Number(event.target.value) })}
                  />
                </label>
              </div>
            );
          })()
        ) : (
          <p className="muted">{mode === "wire" && wireStartPinId ? "请选择第二个引脚完成连线。" : "选择一条线查看 ERC 结果。"}</p>
        )}
      </div>

      <div className="panel-section">
        <h2>网络类型</h2>
        <button className="wide" onClick={onCreateNetworkType}>
          <Plus size={17} />
          新建网络类型
        </button>
        <div className="board-list" style={{ marginTop: 12 }}>
          {project.networkTypes.length === 0 ? (
            <p className="muted">还没有自定义网络类型。</p>
          ) : (
            project.networkTypes.map((networkType) => (
              <div key={networkType.id} className="network-card">
                <input
                  value={networkType.name}
                  onChange={(event) => onUpdateNetworkType(networkType.id, { name: event.target.value })}
                />
                <select
                  value={networkType.baseKind}
                  onChange={(event) => onUpdateNetworkType(networkType.id, { baseKind: event.target.value as PinKind })}
                >
                  {pinKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <input
                  value={networkType.defaultVoltage}
                  onChange={(event) => onUpdateNetworkType(networkType.id, { defaultVoltage: event.target.value })}
                  placeholder="默认电压"
                />
                <button className="wide danger" onClick={() => onDeleteNetworkType(networkType.id)}>
                  <Trash2 size={17} />
                  删除
                </button>
              </div>
            ))
          )}
        </div>
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
                onClick={() => onFocusTarget({ kind: "board", id: board.id })}
              >
                <span>{board.name}</span>
                <small>{board.locked ? "locked" : `${project.pins.filter((pin) => pin.boardId === board.id).length} pins`}</small>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
