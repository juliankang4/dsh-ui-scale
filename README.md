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

## Limits

The plugin applies CSS zoom and converts what the page measures to the zoomed scale: element positions and sizes, the window size, pointer positions and the viewport units in style sheets. Some things fall outside that conversion:

- A viewport size (`vw`, `vh`) set inline on an element, or added from script with `insertRule`, is not converted. Such an element can come out larger than the window.
- Media queries in style sheets follow the scale, but `matchMedia` in scripts and `IntersectionObserver` rectangles still use the real window size.
- Every script on the page sees the converted values, including other plugins.

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
