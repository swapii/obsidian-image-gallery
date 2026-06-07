import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import Muuri from "muuri";
import imagesLoaded from "imagesloaded";
import PhotoSwipeLightbox from "photoswipe/lightbox";

type Slide = { src: string; width: number; height: number };

// Renders an `image-gallery` block: one image URL per line, packed into a draggable
// masonry grid (Muuri). Clicking a tile opens a full-screen PhotoSwipe viewer; dragging
// reorders tiles locally. "Apply new order" writes the order back to the note (the one
// moment the gallery re-renders); "Cancel reordering" animates back to the saved order.
export class GalleryRenderChild extends MarkdownRenderChild {
  private muuri: Muuri | null = null;
  private lightbox: PhotoSwipeLightbox | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private applyBtn: HTMLButtonElement | null = null;
  private cancelBtn: HTMLButtonElement | null = null;
  private slides: Slide[] = [];
  private destroyed = false;
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

    // Reorder controls — hidden until tiles are reordered. Reordering stays local
    // (smooth); Apply is the one moment we rewrite the note, Cancel reverts it.
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
    this.slides = urls.map((src) => ({ src, width: 0, height: 0 }));

    this.lightbox = new PhotoSwipeLightbox({ pswpModule: () => import("photoswipe") });
    this.lightbox.init();

    urls.forEach((url, index) => {
      const item = grid.createDiv({ cls: "ig-item" });
      item.dataset.index = String(index);
      const content = item.createDiv({ cls: "ig-item-content" });
      const img = content.createEl("img");
      img.src = url;
      img.loading = "lazy";

      item.addEventListener("click", (e) => {
        // Stop Obsidian's built-in image viewer from also opening.
        e.stopPropagation();
        // Ignore the click the browser synthesizes at the end of a drag.
        if (Date.now() - this.lastDragEnd < 400) return;
        this.openViewer(item);
      });
    });

    // Muuri requires the grid to be attached to the document AND to have a real width,
    // but Obsidian renders code blocks into a detached, not-yet-sized element — so defer
    // setup until both hold. Image-load wiring goes there too, once Muuri exists.
    this.initGridWhenAttached(grid);
  }

  private initGridWhenAttached(grid: HTMLElement, attempts = 0) {
    if (this.destroyed) return;

    // Muuri packs absolutely-positioned tiles from the grid's measured width. Obsidian
    // attaches a rendered code block before its pane has a settled width, so waiting only
    // for attachment can run the one guaranteed layout against width 0 — every tile lands
    // at (0,0), they overlap, and you see a single photo until something forces another
    // layout (e.g. dragging the pane edge). So wait for a real width too. Don't spin
    // forever: after ~1s give up waiting, build anyway, and let the ResizeObserver recover
    // the layout whenever the pane is finally shown or resized.
    const ready = document.body.contains(grid) && grid.clientWidth > 0;
    if (!ready && attempts < 60) {
      requestAnimationFrame(() => this.initGridWhenAttached(grid, attempts + 1));
      return;
    }

    this.muuri = new Muuri(grid, {
      items: ".ig-item",
      dragEnabled: true,
      // Require a little movement before a drag begins. Otherwise Muuri treats a plain
      // tap as a zero-distance drag, which fires dragEnd and makes the click guard
      // swallow the tap — so the viewer never opens.
      dragStartPredicate: { distance: 10 },
      layout: { fillGaps: true },
    });
    // Remember when a drag ended, so the trailing synthesized click is ignored.
    this.muuri.on("dragEnd", () => {
      this.lastDragEnd = Date.now();
    });
    // Reordering is local — just toggle the controls. The note is rewritten on Apply.
    this.muuri.on("dragReleaseEnd", () => this.updateButtons());

    // Re-pack on any later size change. refreshItems() re-measures tiles before layout(),
    // so a width change arriving together with freshly-loaded images still packs correctly,
    // and the first real width (after a render at width 0) repairs the overlapping pile.
    this.resizeObserver = new ResizeObserver(() => this.muuri?.refreshItems().layout());
    this.resizeObserver.observe(this.containerEl);

    // Record image dimensions for the viewer and re-pack as each image loads. Wired up only
    // now that Muuri exists: cached images can finish loading during the wait above, and if
    // imagesLoaded were attached earlier (as it used to be) those relayouts would fire into a
    // null Muuri and be silently lost — leaving the grid frozen in its first layout. Attaching
    // late loses nothing: imagesLoaded still emits progress for already-complete images. The
    // final "always" pass guarantees one more layout after every image has settled.
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
      this.muuri?.refreshItems().layout();
    });
    loaded.on("always", () => this.muuri?.refreshItems().layout());

    // Images may already have loaded while we waited — re-pack to be safe.
    this.muuri.refreshItems().layout();
  }

  // Show the reorder controls only when the on-screen order differs from the saved one.
  private updateButtons() {
    if (!this.muuri) return;
    const reordered = this.muuri
      .getItems()
      .some((it, pos) => Number((it.getElement() as HTMLElement).dataset.index) !== pos);
    if (reordered) {
      this.applyBtn?.show();
      this.cancelBtn?.show();
    } else {
      this.applyBtn?.hide();
      this.cancelBtn?.hide();
    }
  }

  // Animate tiles back to the saved order without touching the note.
  private cancelReorder() {
    this.muuri?.sort(
      (a, b) =>
        Number((a.getElement() as HTMLElement).dataset.index) -
        Number((b.getElement() as HTMLElement).dataset.index),
    );
    this.updateButtons();
  }

  onunload() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.muuri?.destroy();
    this.muuri = null;
    this.lightbox?.destroy?.();
    this.lightbox = null;
  }

  // Open PhotoSwipe at the clicked tile, with slides in the current on-screen order.
  private openViewer(clickedItem: HTMLElement) {
    if (!this.muuri || !this.lightbox) return;
    const order = this.muuri.getItems().map((it) => it.getElement() as HTMLElement);
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
    if (!this.muuri) return;
    const order = this.muuri
      .getItems()
      .map((it) => Number((it.getElement() as HTMLElement).dataset.index));
    const urls = this.parseUrls();
    const newUrls = order.map((i) => urls[i]);
    if (newUrls.join("\n") === urls.join("\n")) return; // order unchanged
    await this.rewriteBlock(newUrls);
  }

  // Rewrite only the URL lines of this code block in the new order, leaving the fence
  // and any comment/blank lines untouched.
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
