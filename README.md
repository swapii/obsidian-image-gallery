# Obsidian Image Gallery

An Obsidian plugin that renders a list of images as a masonry grid inside your notes. Previews are packed
into a responsive, gap-free grid; clicking an image opens it full-screen with prev/next switching, and you
can drag tiles to reorder the gallery — all without leaving the note.

## How it works

The plugin builds on two libraries: [Muuri](https://github.com/haltu/muuri) packs the previews into a
responsive masonry grid and makes the tiles draggable, and [PhotoSwipe](https://photoswipe.com/) provides
the full-screen viewer with zoom and keyboard/swipe navigation between images.

## Usage

Add an `image-gallery` code block listing one image URL per line:

````
```image-gallery
https://picsum.photos/id/237/600/900
https://picsum.photos/id/238/600/400
https://picsum.photos/id/239/600/700
```
````

The plugin renders the images as a masonry grid. Click any preview to open the full-screen viewer
(navigate with the on-screen arrows, your keyboard, or swipe; press Esc to close). Drag a tile to rearrange
the grid, then click **Apply new order** to write the new order back to the code block — or **Cancel
reordering** to revert.

## Install (beta)

Until this is in the community plugin store, install it with
[BRAT](https://github.com/TfTHacker/obsidian42-brat): add the beta plugin `swapii/obsidian-image-gallery`,
then enable **Image Gallery** under Settings → Community plugins.

## Status

Early work in progress. Image sourcing is currently a URL list; pointing a gallery at a vault folder is
planned.
