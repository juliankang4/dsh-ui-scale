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

- Scaled: the main window (sidebars, conversation, composer, pages), Settings and other modal dialogs. A dialog that would grow past the window is limited to the window size and scrolls inside.
- Normal size: menus (including the `/` command menu), dropdowns, tooltips, hover cards, toasts and other pop-ups attached to a control. Scaling them would move them away from the control they belong to, so they stay at normal size. The image preview and the Desktop app's native right-click menu are also unchanged.

Which areas scale depends on how the dsh Web UI page is built, so a dsh update can leave some areas at normal size until the plugin is updated.

## Limits

The plugin uses CSS zoom, not browser zoom, so dsh still lays out the page for the real window size. This shows in two places:

- At high scales the left sidebar does not collapse as early as it would in a small window, and the right sidebar can extend past the window edge.
- Dragging a panel divider moves it faster than the pointer (twice as fast at 200%).

In a browser you can use the browser's own zoom instead, which has none of these limits.

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

Tested with dsh 0.2.0-rc.2 (web and Desktop).
