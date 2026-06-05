import { Notice, Plugin } from "obsidian";

export default class ImageGalleryPlugin extends Plugin {
  async onload() {
    console.log("Image Gallery: loading plugin");
    new Notice("Image Gallery loaded");
  }

  onunload() {
    console.log("Image Gallery: unloading plugin");
  }
}
