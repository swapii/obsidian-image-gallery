import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import Sortable from "sortablejs";
import imagesLoaded from "imagesloaded";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import { computeJustifiedLayout } from "./justified";

type Slide = { src: string; width: number; height: number };

// Target row height and gap for the justified layout. GAP must match the `gap` in styles.css.
const ROW_HEIGHT = 200;
const GAP = 4;

// Renders an `image-gallery` block: one image URL per line, laid out in justified rows (every
// row the same height, photos scaled to fill the width with no cropping — like Google Photos).
// Clicking a tile opens a full-screen PhotoSwipe viewer; dragging reorders tiles locally in plain
// reading order, so the resulting order is predictable. "Apply new order" writes the order back to
// the note (the one moment the gallery re-renders); "Cancel reordering" restores the saved order.
export class GalleryRenderChild extends MarkdownRenderChild {
  private sortable: Sortable | null = null;
  private lightbox: PhotoSwipeLightbox | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private grid: HTMLElement | null = null;
  private applyBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private slides: Slide[] = [];
  private destroyed = false;
  private dragging = false;
  private lastDragEnd = 0;

  constructor(
    containerEl: HTMLElement,
    private source: string,
    private app: App,
    private ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);
  }

  onload() {
    try {
      this.renderGallery();
    } catch (err) {
      console.error("Image Gallery: failed to render", err);
      this.containerEl.empty();
      this.containerEl.createEl("pre", {
        text: "Image Gallery error: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  }

  private renderGallery() {
    const urls = this.parseUrls();
    if (urls.length === 0) {
      this.containerEl.createEl("p", { text: "Image Gallery: no image URLs found." });
      return;
    }

    // Reorder controls — hidden until tiles are reordered. Reordering stays local (smooth);
    // Apply is the one moment we rewrite the note, Cancel reverts it.
    const toolbar = this.containerEl.createDiv({ cls: "ig-toolbar" });

    const applyBtn = toolbar.createEl("button", { cls: "mod-cta ig-apply", text: "Apply new order" });
    applyBtn.hide();
    applyBtn.addEventListener("click", () => void this.persistOrder());
    this.applyBtn = applyBtn;

    const cancelBtn = toolbar.createEl("button", { cls: "ig-cancel", text: "Cancel reordering" });
    cancelBtn.hide();
    cancelBtn.addEventListener("click", () => this.cancelReorder());
    this.cancelBtn = cancelBtn;

    const grid = this.containerEl.createDiv({ cls: "ig-grid" });
    this.grid = grid;
    this.slides = urls.map((src) => ({ src, width: 0, height: 0 }));

    this.lightbox = new PhotoSwipeLightbox({ pswpModule: () => import("photoswipe") });
    this.lightbox.init();

    urls.forEach((url, index) => {
      const item = grid.createDiv({ cls: "ig-item" });
      item.dataset.index = String(index);
      const img = item.createEl("img");
      img.src = url;
      // Load eagerly: the justified layout needs each image's real aspect ratio, and galleries
      // here are modest. Lazy loading would leave off-screen tiles at a placeholder ratio until
      // scrolled, making the grid reshuffle as you scroll.
      img.loading = "eager";

      item.addEventListener("click", (e) => {
        // Stop Obsidian's built-in image viewer from also opening.
        e.stopPropagation();
        // Ignore a click mid-drag, and the one the browser synthesizes at the end of a drag.
        if (this.dragging || Date.now() - this.lastDragEnd < 300) return;
        this.openViewer(item);
      });
    });

    this.initGridWhenReady(grid);
  }

  private initGridWhenReady(grid: HTMLElement, attempts = 0) {
    if (this.destroyed) return;

    // Wait for attachment AND a real width before the first layout. Obsidian attaches a rendered
    // code block before its pane has a settled width; a justified layout computed against width 0
    // collapses every tile to (0,0). Don't spin forever — after ~1s build anyway and let the
    // ResizeObserver recover when the pane is finally shown or resized.
    const ready = document.body.contains(grid) && grid.clientWidth > 0;
    if (!ready && attempts < 60) {
      requestAnimationFrame(() => this.initGridWhenReady(grid, attempts + 1));
      return;
    }

    // Predictable drag-reorder: every tile lives in one flat container, so a drag is a simple
    // linear reorder in reading order. SortableJS handles both mouse and touch (mobile).
    this.sortable = Sortable.create(grid, {
      animation: 150,
      draggable: ".ig-item",
      onStart: () => {
        this.dragging = true;
      },
      onEnd: () => {
        this.dragging = false;
        this.lastDragEnd = Date.now();
        this.updateButtons();
        // The moved tile changes the shape of its row(s) — re-justify.
        this.layout();
      },
    });

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.containerEl);

    // Record natural dimensions (for the viewer and for aspect ratios) and re-justify as each
    // image loads. Wired up only now that the grid is ready, so cached images that finish during
    // the wait above can't fire their relayout before we're listening. The final "always" pass
    // guarantees one more layout after every image has settled.
    const loaded = imagesLoaded(grid);
    loaded.on("progress", (_instance, image) => {
      if (image?.isLoaded) {
        const item = image.img.closest<HTMLElement>(".ig-item");
        const i = item ? Number(item.dataset.index) : -1;
        if (i >= 0) {
          this.slides[i].width = image.img.naturalWidth;
          this.slides[i].height = image.img.naturalHeight;
        }
      }
      this.layout();
    });
    loaded.on("always", () => this.layout());

    this.layout();
  }

  // Size every tile from the justified layout, for the current on-screen order and grid width.
  private layout() {
    const grid = this.grid;
    if (!grid) return;
    const width = grid.clientWidth;
    const items = Array.from(grid.querySelectorAll<HTMLElement>(".ig-item"));
    if (width <= 0 || items.length === 0) return;

    const aspectRatios = items.map((it) => {
      const slide = this.slides[Number(it.dataset.index)];
      return slide && slide.width > 0 && slide.height > 0 ? slide.width / slide.height : 1;
    });
    const sizes = computeJustifiedLayout(aspectRatios, width, ROW_HEIGHT, GAP);
    items.forEach((it, i) => {
      // Floor so a row never rounds past the container width and wraps a tile onto the next line.
      it.style.width = Math.floor(sizes[i].width) + "px";
      it.style.height = Math.floor(sizes[i].height) + "px";
    });
  }

  // Show the reorder controls only when the on-screen order differs from the saved one.
  private updateButtons() {
    const grid = this.grid;
    if (!grid) return;
    const items = Array.from(grid.querySelectorAll<HTMLElement>(".ig-item"));
    const reordered = items.some((it, pos) => Number(it.dataset.index) !== pos);
    if (reordered) {
      this.applyBtn?.show();
      this.cancelBtn?.show();
    } else {
      this.applyBtn?.hide();
      this.cancelBtn?.hide();
    }
  }

  // Restore the saved order without touching the note: re-append tiles by their original index.
  private cancelReorder() {
    const grid = this.grid;
    if (!grid) return;
    const items = Array.from(grid.querySelectorAll<HTMLElement>(".ig-item")).sort(
      (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
    );
    for (const it of items) grid.appendChild(it);
    this.updateButtons();
    this.layout();
  }

  onunload() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.sortable?.destroy();
    this.sortable = null;
    this.lightbox?.destroy?.();
    this.lightbox = null;
  }

  // Open PhotoSwipe at the clicked tile, with slides in the current on-screen order.
  private openViewer(clickedItem: HTMLElement) {
    const grid = this.grid;
    if (!grid || !this.lightbox) return;
    const order = Array.from(grid.querySelectorAll<HTMLElement>(".ig-item"));
    const pos = order.indexOf(clickedItem);
    const orderedSlides = order.map((el) => {
      const i = Number(el.dataset.index);
      const slide = this.slides[i];
      const img = el.querySelector("img");
      if (slide.width === 0 && img && img.naturalWidth > 0) {
        slide.width = img.naturalWidth;
        slide.height = img.naturalHeight;
      }
      return slide;
    });
    this.lightbox.loadAndOpen(Math.max(0, pos), orderedSlides);
  }

  // Read the current tile order and rewrite the note if it changed.
  private async persistOrder() {
    const grid = this.grid;
    if (!grid) return;
    const order = Array.from(grid.querySelectorAll<HTMLElement>(".ig-item")).map((it) =>
      Number(it.dataset.index),
    );
    const urls = this.parseUrls();
    const newUrls = order.map((i) => urls[i]);
    if (newUrls.join("\n") === urls.join("\n")) return; // order unchanged
    await this.rewriteBlock(newUrls);
  }

  // Rewrite only the URL lines of this code block in the new order, leaving the fence and any
  // comment/blank lines untouched.
  private async rewriteBlock(newUrls: string[]) {
    const info = this.ctx.getSectionInfo(this.containerEl);
    if (!info) return;
    const file = this.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const body = lines.slice(info.lineStart + 1, info.lineEnd);

    let u = 0;
    const newBody = body.map((line) => {
      const trimmed = line.trim();
      const isUrl = trimmed.length > 0 && !trimmed.startsWith("#");
      return isUrl && u < newUrls.length ? newUrls[u++] : line;
    });

    const newContent = [
      ...lines.slice(0, info.lineStart + 1),
      ...newBody,
      ...lines.slice(info.lineEnd),
    ].join("\n");

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }

  private parseUrls(): string[] {
    return this.source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }
}
