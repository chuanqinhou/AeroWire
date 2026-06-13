import { useEffect, useState } from "react";
import { getAssetIdFromUri, getImageAsset, isAssetUri } from "../lib/assets";

export function useImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!src) {
      setImage(null);
      return;
    }

    const loadImage = async () => {
      const resolvedSrc = isAssetUri(src) ? await getImageAsset(getAssetIdFromUri(src)) : src;
      if (isCancelled) return;
      if (!resolvedSrc) {
        setImage(null);
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (!isCancelled) setImage(img);
      };
      img.src = resolvedSrc;
    };

    loadImage().catch(() => {
      if (!isCancelled) setImage(null);
    });

    return () => {
      isCancelled = true;
    };
  }, [src]);

  return image;
}
