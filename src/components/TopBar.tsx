import {
  Cable,
  Download,
  FileUp,
  Grid3X3,
  ImagePlus,
  Package,
  Plus,
  MousePointer2,
  Redo2,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { PIN_BATCH_DIRECTIONS } from "../domain/constants";
import type { PinBatchDirection, ToolMode } from "../domain/types";

type TopBarProps = {
  mode: ToolMode;
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  isPinMenuOpen: boolean;
  isViewMenuOpen: boolean;
  showGrid: boolean;
  gridSize: number;
  scale: number;
  pinBatchCount: number;
  pinBatchSpacing: number;
  pinBatchDirection: PinBatchDirection;
  defaultPinSize: number;
  onUndo: () => void;
  onRedo: () => void;
  onSelectMode: () => void;
  onTogglePinMenu: () => void;
  onWireMode: () => void;
  onImportImages: () => void;
  onImportProject: () => void;
  onExportPng: () => void;
  onExportBundle: () => void;
  onExportJson: () => void;
  onDeleteSelected: () => void;
  onToggleViewMenu: () => void;
  onShowGridChange: (show: boolean) => void;
  onGridSizeChange: (size: number) => void;
  onScaleChange: (scale: number) => void;
  onPinBatchCountChange: (count: number) => void;
  onPinBatchSpacingChange: (spacing: number) => void;
  onPinBatchDirectionChange: (direction: PinBatchDirection) => void;
  onDefaultPinSizeChange: (size: number) => void;
};

export function TopBar({
  mode,
  canUndo,
  canRedo,
  canDelete,
  isPinMenuOpen,
  isViewMenuOpen,
  showGrid,
  gridSize,
  scale,
  pinBatchCount,
  pinBatchSpacing,
  pinBatchDirection,
  defaultPinSize,
  onUndo,
  onRedo,
  onSelectMode,
  onTogglePinMenu,
  onWireMode,
  onImportImages,
  onImportProject,
  onExportPng,
  onExportBundle,
  onExportJson,
  onDeleteSelected,
  onToggleViewMenu,
  onShowGridChange,
  onGridSizeChange,
  onScaleChange,
  onPinBatchCountChange,
  onPinBatchSpacingChange,
  onPinBatchDirectionChange,
  onDefaultPinSizeChange,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">AW</div>
        <div>
          <h1>AeroWire</h1>
          <p>多板卡布线与电气规则检查</p>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="toolbar" aria-label="工具栏">
          <button onClick={onUndo} disabled={!canUndo} title="撤销 Ctrl+Z">
            <Undo2 size={18} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} title="重做 Ctrl+Y / Ctrl+Shift+Z">
            <Redo2 size={18} />
          </button>
          <button className={mode === "select" ? "active" : ""} onClick={onSelectMode} title="选择与编辑">
            <MousePointer2 size={18} />
          </button>
          <div className="toolbar-menu">
            <button
              className={mode === "pin" || isPinMenuOpen ? "active" : ""}
              onClick={onTogglePinMenu}
              title="下一次点击添加锚点，并设置批量参数"
            >
              <Plus size={18} />
            </button>
            {isPinMenuOpen && (
              <div className="tool-popover pin-popover">
                <div className="view-popover-title">
                  <Plus size={16} />
                  <span>添加锚点</span>
                </div>
                <label className="field">
                  <span>数量 {pinBatchCount}</span>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    step="1"
                    value={pinBatchCount}
                    onChange={(event) => onPinBatchCountChange(Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  <span>间距 {pinBatchSpacing}px</span>
                  <input
                    type="range"
                    min="8"
                    max="80"
                    step="1"
                    value={pinBatchSpacing}
                    onChange={(event) => onPinBatchSpacingChange(Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  <span>方向</span>
                  <select
                    value={pinBatchDirection}
                    onChange={(event) => onPinBatchDirectionChange(event.target.value as PinBatchDirection)}
                  >
                    {PIN_BATCH_DIRECTIONS.map((direction) => (
                      <option key={direction.value} value={direction.value}>
                        {direction.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>默认大小 {defaultPinSize}px</span>
                  <input
                    type="range"
                    min="4"
                    max="18"
                    step="1"
                    value={defaultPinSize}
                    onChange={(event) => onDefaultPinSizeChange(Number(event.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
          <button className={mode === "wire" ? "active" : ""} onClick={onWireMode} title="下一次连线">
            <Cable size={18} />
          </button>
          <button onClick={onImportImages} title="导入板卡图片">
            <ImagePlus size={18} />
          </button>
          <button onClick={onImportProject} title="导入项目包或 JSON">
            <FileUp size={18} />
          </button>
          <button onClick={onExportPng} title="干净导出 PNG">
            <Download size={18} />
          </button>
          <button onClick={onExportBundle} title="打包项目（含图片，发给别人用）">
            <Package size={18} />
          </button>
          <button onClick={onExportJson} title="轻量导出 JSON">
            <Save size={18} />
          </button>
          <button onClick={onDeleteSelected} disabled={!canDelete} title="删除所选">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="view-menu">
          <button
            className={`view-menu-button ${isViewMenuOpen ? "active" : ""}`}
            onClick={onToggleViewMenu}
            title="视图设置"
          >
            <SlidersHorizontal size={18} />
          </button>
          {isViewMenuOpen && (
            <div className="view-popover">
              <div className="view-popover-title">
                <Grid3X3 size={16} />
                <span>视图栅格</span>
              </div>
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(event) => onShowGridChange(event.target.checked)}
                />
                <span>显示背景栅格</span>
              </label>
              <label className="field">
                <span>栅格间距 {gridSize}px</span>
                <input
                  type="range"
                  min="12"
                  max="96"
                  step="4"
                  value={gridSize}
                  onChange={(event) => onGridSizeChange(Number(event.target.value))}
                />
              </label>
              <label className="field">
                <span>视图缩放 {scale.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  value={scale}
                  onChange={(event) => onScaleChange(Number(event.target.value))}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
