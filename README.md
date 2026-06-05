# Obsidian Image Gallery

An Obsidian plugin that turns a folder of images into a gallery inside your notes. Previews are laid out as a
masonry grid, and clicking any image opens it full-screen with prev/next switching — without leaving the note.

## How it works

The plugin combines two small JavaScript libraries. [Masonry](https://masonry.desandro.com/) arranges the
previews into a responsive, gap-free grid, and [PhotoSwipe](https://photoswipe.com/) provides the full-screen
viewer with zoom and keyboard/swipe navigation between images.

## Usage

Add an `image-gallery` code block to a note, pointing it at a folder of images:

````
```image-gallery
path: Attachments/Trip
columns: 3
```
````

The plugin renders the matching images as a masonry grid; clicking a preview opens the full-screen viewer.

## Status

Early work in progress — local-only, no release yet.
