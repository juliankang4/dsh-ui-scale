# dsh-ui-scale

Make the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) interface larger or smaller, from 50% to 200%. Works in the browser (`dsh web`) and in the Desktop app.

## Install

```sh
dsh plugin --profile web add dsh-ui-scale
```

In the Desktop app, open Plugins, choose Add plugin, enter `dsh-ui-scale` and install it.

## Use

Open Settings > General > Interface scale. There are three ways to set the scale:

- Drag the slider. It moves in 5% steps and applies the scale when you release it.
- Type a percent in the field and press Enter or click elsewhere. The value is rounded to a whole percent, and a value below 50 or above 200 is set to the nearest limit.
- Click a preset: 100, 110, 125, 150, 175 or 200%.

The scale is saved in the profile configuration. It survives restarts and is applied before the main window appears. Each profile (`web`, `desktop`) keeps its own value. A page opened from another computer can change the scale for itself, but dsh does not save settings from such pages.

## What scales

Everything in the window: sidebars, conversation, composer, pages, Settings and other dialogs, and the menus, tooltips and pop-ups attached to them. The layout behaves as it would under browser zoom: at a high scale in a small window the left sidebar collapses, panels keep their share of the window, and dragging a divider follows the pointer.

The Desktop app's native menus and window controls keep their normal size.

## Desktop window size

The Desktop app opens its window at the same default size on every start. With this plugin enabled it opens at the size and position you left it in. The window is not resized past the screen, and a position on another display is not restored, so the window opens on the main display at the saved size. Full screen is not saved.

## Limits

The plugin applies CSS zoom and converts what the page measures to the zoomed scale: element positions and sizes, the window and page viewport size, pointer positions, SVG screen matrices, wheel deltas, media queries (widths and resolutions) in style sheets and `matchMedia`, and the viewport units in style sheets and inline styles. Some things fall outside that conversion:

- A viewport size (`vw`, `vh`) in a style rule added from script with `insertRule`, in a constructed style sheet added with `adoptedStyleSheets.push` instead of assignment, inside a shadow root, or on a MathML element is not converted. Such an element can come out larger than the window.
- `IntersectionObserver` rectangles and touch coordinates still use the real window size.
- A size measured in the same script step that sets an inline viewport size or adds a style element still sees the unconverted value; the next step sees the converted one.
- Every script on the page sees the converted values, including other plugins.
- A PDF that is already open keeps its sharpness from before a scale change until it is reloaded, opened again or zoomed in the preview.

In a browser you can also use the browser's own zoom; the two multiply.

## Configuration

| Field | Default | Description |
| --- | --- | --- |
| `scale` | `100` | Interface scale in percent, a whole number from 50 to 200. |

The settings row writes this field. You can also set it in the profile's `cordis.patch.yml`:

```yaml
- id: ui-scale
  name: dsh-ui-scale
  config:
    scale: 125
```

Tested with dsh 0.2.0-rc.2 (web in Chrome, and the macOS Desktop app).
