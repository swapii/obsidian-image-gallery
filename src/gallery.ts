import { MarkdownRenderChild } from "obsidian";
import Masonry from "masonry-layout";
import imagesLoaded from "imagesloaded";

const GUTTER = 8;

// First-cut gallery: one image URL per line, laid out as a masonry grid.
// Column count is not fixed — the grid fits as many fixed-width columns as the
// note pane allows, so it stays responsive on desktop, tablet, and phone.
export class GalleryRenderChild extends MarkdownRenderChild {
  private masonry: Masonry | null = null;
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

    for (const url of urls) {
      const item = grid.createDiv({ cls: "ig-item" });
      const img = item.createEl("img");
      img.src = url;
      img.loading = "lazy";
    }

    this.masonry = new Masonry(grid, {
      itemSelector: ".ig-item",
      columnWidth: ".ig-sizer",
      gutter: GUTTER,
    });

    // Remote image heights are unknown until they load, so re-pack as each arrives.
    imagesLoaded(grid).on("progress", () => this.masonry?.layout?.());

    // Re-pack when the note pane width changes (container-based, not viewport).
    this.resizeObserver = new ResizeObserver(() => this.masonry?.layout?.());
    this.resizeObserver.observe(grid);
  }

  onunload() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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
