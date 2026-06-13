import { PROJECT_BUNDLE_TYPE } from "../domain/constants";
import { normalizeProject } from "../domain/project";
import type { Board, Project, ProjectBundle, ProjectFile } from "../domain/types";
import { createAssetUri, getAssetIdFromUri, getImageAsset, isAssetUri, isDataUrl, putImageAsset } from "./assets";
import { downloadJsonFile } from "./download";

export function isProjectBundle(candidate: unknown): candidate is ProjectBundle {
  if (!candidate || typeof candidate !== "object") return false;
  const bundle = candidate as Partial<ProjectBundle>;
  return (
    bundle.bundleType === PROJECT_BUNDLE_TYPE &&
    Boolean(bundle.project) &&
    typeof bundle.assets === "object" &&
    bundle.assets !== null
  );
}

export async function importProjectPayload(parsed: unknown) {
  if (isProjectBundle(parsed)) {
    let failedAssetCount = 0;

    for (const [assetId, dataUrl] of Object.entries(parsed.assets)) {
      if (!assetId || typeof dataUrl !== "string" || !isDataUrl(dataUrl)) {
        failedAssetCount += 1;
        continue;
      }

      try {
        await putImageAsset(assetId, dataUrl);
      } catch {
        failedAssetCount += 1;
      }
    }

    return {
      project: normalizeProject(parsed.project),
      failedAssetCount,
    };
  }

  return {
    project: normalizeProject(parsed),
    failedAssetCount: 0,
  };
}

export function exportProjectJson(project: Project) {
  const projectFile: ProjectFile = {
    ...project,
    schemaVersion: 2,
    assetMode: "local",
  };
  downloadJsonFile(projectFile, "aerowire-project.json");
}

export async function exportProjectBundle(project: Project) {
  const assets: Record<string, string> = {};
  const missingAssetNames: string[] = [];
  const bundledBoards = await Promise.all(
    project.boards.map(async (board) => {
      if (isAssetUri(board.imageSrc)) {
        const assetId = getAssetIdFromUri(board.imageSrc);
        try {
          const dataUrl = await getImageAsset(assetId);
          if (dataUrl) {
            assets[assetId] = dataUrl;
          } else {
            missingAssetNames.push(board.name);
          }
        } catch {
          missingAssetNames.push(board.name);
        }
        return board;
      }

      if (isDataUrl(board.imageSrc)) {
        const assetId = `bundle_${board.id}`;
        assets[assetId] = board.imageSrc;
        return {
          ...board,
          imageSrc: createAssetUri(assetId),
        } satisfies Board;
      }

      return board;
    }),
  );

  const bundle: ProjectBundle = {
    schemaVersion: 2,
    bundleType: PROJECT_BUNDLE_TYPE,
    project: {
      ...project,
      boards: bundledBoards,
      schemaVersion: 2,
      assetMode: "local",
    },
    assets,
  };

  downloadJsonFile(bundle, "aerowire-project.awire");
  return { missingAssetNames };
}
