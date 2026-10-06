# Changelog

## 0.1.3

- The Desktop app reopens its window at the size and position it was left in.

## 0.1.2

- Dialogs and panels sized with inline viewport units, such as the cost-meter details dialog, fit the window.
- Pop-ups that measure the page width, such as the archive-manager sort menu, open inside the window.
- Plugins that check the window size with `matchMedia` see the scaled size and are told when the scale changes.
- SVG pointer math, wheel scrolling and resolution queries follow the scale.

## 0.1.1

- Menus, tooltips and pop-ups scale with the rest of the interface.
- The right panel keeps its share of the window and can be resized at high scales; divider drags follow the pointer.
- The left sidebar collapses at high scales in a small window, as under browser zoom.

## 0.1.0

- Interface scale setting (50% to 200%) in Settings > General.
