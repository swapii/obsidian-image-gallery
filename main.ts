import { Plugin } from "obsidian";
import { GalleryRenderChild } from "./src/gallery";
import photoswipeCss from "photoswipe/style.css";

export default class ImageGalleryPlugin extends Plugin {
  private styleEl: HTMLStyleElement | null = null;

  async onload() {
    console.log("Image Gallery: loading plugin");

    // PhotoSwipe ships its own CSS; inject it once for the whole plugin.
    this.styleEl = document.head.createEl("style", { text: photoswipeCss });

    this.registerMarkdownCodeBlockProcessor("image-gallery", (source, el, ctx) => {
      ctx.addChild(new GalleryRenderChild(el, source));
    });
  }

  onunload() {
    console.log("Image Gallery: unloading plugin");
    this.styleEl?.remove();
    this.styleEl = null;
  }
}
