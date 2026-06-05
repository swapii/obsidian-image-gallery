# Obsidian Image Gallery

An Obsidian plugin that renders a list of images as a masonry grid inside your notes. Previews are packed
into a responsive, gap-free grid, and clicking any image opens it full-screen with prev/next switching —
without leaving the note.

## How it works

The plugin builds on two well-known libraries: [Masonry](https://masonry.desandro.com/) (with imagesLoaded)
packs the previews into a responsive grid that fits as many columns as the note pane allows, and
[PhotoSwipe](https://photoswipe.com/) provides the full-screen viewer with zoom and keyboard/swipe
navigation between images.

## Usage

Add an `image-gallery` code block listing one image URL per line:

````
```image-gallery
https://picsum.photos/id/237/600/900
https://picsum.photos/id/238/600/400
https://picsum.photos/id/239/600/700
```
````

The plugin renders the images as a masonry grid; click any preview to open the full-screen viewer
(navigate with the on-screen arrows, your keyboard, or swipe; press Esc to close).

## Status

Early work in progress — local-only, no release yet. Sourcing is currently a URL list; pointing a gallery
at a vault folder is planned.
