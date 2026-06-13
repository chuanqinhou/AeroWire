import { FileUp, HardDriveDownload, ImagePlus, Package, Zap } from "lucide-react";
import type { IssueTarget, Project, ProjectIssue } from "../domain/types";

type LeftPanelProps = {
  project: Project;
  issues: ProjectIssue[];
  transientModeHint: string | null;
  onImportImages: () => void;
  onImportProject: () => void;
  onExportProjectBundle: () => void;
  onClearProject: () => void;
  onFocusTarget: (target: IssueTarget) => void;
};

export function LeftPanel({
  project,
  issues,
  transientModeHint,
  onImportImages,
  onImportProject,
  onExportProjectBundle,
  onClearProject,
  onFocusTarget,
}: LeftPanelProps) {
  return (
    <aside className="panel left">
      {transientModeHint && (
        <div className="panel-section panel-hint">
          <p>{transientModeHint}</p>
        </div>
      )}
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
          <button className="wide primary" onClick={onImportImages}>
            <ImagePlus size={17} />
            导入板卡图片
          </button>
          <button className="wide" onClick={onImportProject}>
            <FileUp size={17} />
            导入项目包/JSON
          </button>
          <button className="wide" onClick={onExportProjectBundle}>
            <Package size={17} />
            打包项目含图片
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
              <button key={issue.id} className={`issue ${issue.severity}`} onClick={() => onFocusTarget(issue.target)}>
                {issue.text}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="panel-section">
        <h2>视图</h2>
        <button className="wide ghost" onClick={onClearProject}>
          <HardDriveDownload size={17} />
          新建空白项目
        </button>
      </div>
    </aside>
  );
}
