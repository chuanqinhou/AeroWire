import type Konva from "konva";

export function setStagePanPreview(stage: Konva.Stage, deltaX: number, deltaY: number) {
  const content = stage.getContent();
  content.style.transform = `translate3d(${Math.round(deltaX)}px, ${Math.round(deltaY)}px, 0)`;
  content.style.willChange = "transform";
}

export function clearStagePanPreview(stage: Konva.Stage | null) {
  if (!stage) return;
  const content = stage.getContent();
  content.style.transform = "";
  content.style.willChange = "";
}
