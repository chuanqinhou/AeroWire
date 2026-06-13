import { Image as KonvaImage, Rect } from "react-konva";
import type { Board } from "../domain/types";
import { getBoardVisibleSize, normalizeRotation } from "../domain/geometry";
import { useImage } from "../hooks/useImage";

export function BoardImage({ board }: { board: Board }) {
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
      x={visibleSize.width / 2}
      y={visibleSize.height / 2}
      offsetX={visibleSize.width / 2}
      offsetY={visibleSize.height / 2}
      width={visibleSize.width}
      height={visibleSize.height}
      rotation={normalizeRotation(board.rotation)}
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
