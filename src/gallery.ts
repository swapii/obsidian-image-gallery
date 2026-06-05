import { MarkdownRenderChild } from "obsidian";
import Masonry from "masonry-layout";
import imagesLoaded from "imagesloaded";
import PhotoSwipeLightbox from "photoswipe/lightbox";

const GUTTER = 8;

type Slide = { src: string; width: number; height: number };

// Renders an `image-gallery` block: one image URL per line, packed into a
// responsive masonry grid. Clicking a tile opens a full-screen PhotoSwipe viewer
// with prev/next, arrow keys, swipe, and Esc to close.
export class GalleryRenderChild extends MarkdownRenderChild {
  private masonry: Masonry | null = null;
  private lightbox: PhotoSwipeLightbox | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(containerEl: HTMLElement, private source: string) {
    super(containerEl);
  }

  onload() {
    const urls = this.parseUrls(this.source);
    if (urls.length === 0) {
      this.containerEl.createEl("p", { text: "Image Gallery: no image URLs found." });
      return;
    }

    const grid = this.containerEl.createDiv({ cls: "ig-grid" });
    grid.createDiv({ cls: "ig-sizer" });

    // PhotoSwipe slides, opened programmatically so tiles don't need to be <a> links
    // (which Obsidian would otherwise try to open in a browser).
    const slides: Slide[] = urls.map((src) => ({ src, width: 0, height: 0 }));

    this.lightbox = new PhotoSwipeLightbox({ pswpModule: () => import("photoswipe") });
    this.lightbox.init();

    urls.forEach((url, index) => {
      const item = grid.createDiv({ cls: "ig-item" });
      item.dataset.index = String(index);
      const img = item.createEl("img");
      img.src = url;
      img.loading = "lazy";

      item.addEventListener("click", () => {
        if (slides[index].width === 0 && img.naturalWidth > 0) {
          slides[index].width = img.naturalWidth;
          slides[index].height = img.naturalHeight;
        }
        this.lightbox?.loadAndOpen(index, slides);
      });
    });

    // Remote image heights are unknown until they load — record real dimensions
    // (for the viewer) and re-pack the grid as each arrives.
    imagesLoaded(grid).on("progress", (_instance, image) => {
      if (image?.isLoaded) {
        const item = image.img.closest<HTMLElement>(".ig-item");
        const i = item ? Number(item.dataset.index) : -1;
        if (i >= 0) {
          slides[i].width = image.img.naturalWidth;
          slides[i].height = image.img.naturalHeight;
        }
      }
      this.masonry?.layout?.();
    });

    this.masonry = new Masonry(grid, {
      itemSelector: ".ig-item",
      columnWidth: ".ig-sizer",
      gutter: GUTTER,
    });

    // Re-pack when the note pane width changes (container-based, not viewport).
    this.resizeObserver = new ResizeObserver(() => this.masonry?.layout?.());
    this.resizeObserver.observe(grid);
  }

  onunload() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.lightbox?.destroy?.();
    this.lightbox = null;
    this.masonry?.destroy?.();
    this.masonry = null;
  }

  private parseUrls(source: string): string[] {
    return source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }
}
