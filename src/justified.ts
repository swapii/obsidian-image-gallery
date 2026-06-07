export interface JustifiedSize {
  width: number;
  height: number;
}

// Lay images out in justified rows (Flickr / Google Photos style): every full row is scaled
// so its left and right edges meet the container, which keeps a roughly uniform row height
// without cropping any image. Images are placed in the given order — so the visual order is
// plain reading order (left→right, top→bottom), which makes drag-reordering predictable.
//
// Pure function: no DOM. `aspectRatios` are width/height per image, in order.
export function computeJustifiedLayout(
  aspectRatios: number[],
  containerWidth: number,
  targetHeight: number,
  gap: number,
): JustifiedSize[] {
  const result: JustifiedSize[] = [];
  let row: number[] = []; // aspect ratios accumulated for the current row
  let sumAspect = 0;

  // Scale the accumulated row down so its images + inner gaps span exactly the container.
  const flushFullRow = () => {
    const usable = containerWidth - gap * (row.length - 1);
    const height = usable / sumAspect;
    for (const ar of row) result.push({ width: ar * height, height });
    row = [];
    sumAspect = 0;
  };

  for (const ar of aspectRatios) {
    row.push(ar);
    sumAspect += ar;
    // At the target height, how wide would this row be? Once that reaches the container,
    // the row is full and gets justified (scaled down) to fit exactly.
    const naturalWidth = sumAspect * targetHeight + gap * (row.length - 1);
    if (containerWidth > 0 && naturalWidth >= containerWidth) {
      flushFullRow();
    }
  }

  // Leftover images form a partial last row: keep them at the target height, left-aligned,
  // rather than blowing them up to fill the width.
  for (const ar of row) result.push({ width: ar * targetHeight, height: targetHeight });

  return result;
}
