import { Plugin } from "obsidian";
import { GalleryRenderChild } from "./src/gallery";

export default class ImageGalleryPlugin extends Plugin {
  async onload() {
    console.log("Image Gallery: loading plugin");

    this.registerMarkdownCodeBlockProcessor("image-gallery", (source, el, ctx) => {
      ctx.addChild(new GalleryRenderChild(el, source));
    });
  }

  onunload() {
    console.log("Image Gallery: unloading plugin");
  }
}
