# Dev-fleet palette

This fork is development-environment tooling for the THAOS dev fleet. Its colours are a dev-tooling choice: the
sidebar matches the operator's terminal theme. The lifecycle marks carry their meaning in their shape, so they read
in monochrome; the three idle recency tiers draw one mark and differ by colour only.

## Why hex

Herdr's sidebar tokens accept hex only. Measured on herdr 0.9.1 with `herdr config check`: role names (`red`),
palette indices (`1`, `"ansi:1"`, `"color1"`), theme references and `"terminal"` are all rejected, and a rejected
value makes herdr drop the whole config. An omitted `fg` is accepted but renders as muted grey.

## Dark set

Copied from the ANSI palette of Ghostty's bundled theme "Dracula", which the operator's Ghostty config names
(`theme = "Dracula"`). Source file:
`/Applications/Ghostty.app/Contents/Resources/ghostty/themes/Dracula` (`palette = N=#rrggbb` lines).

| Use                            | ANSI role | Value     |
| ------------------------------ | --------- | --------- |
| up, done (`done`)              | 2         | `#50fa7b` |
| down, blocked (`blocked`)      | 1         | `#ff5555` |
| unknown                        | 4         | `#bd93f9` |
| idle, fresh                    | 15        | `#ffffff` |
| idle, normal; text             | 7         | `#f8f8f2` |
| idle, stale; dim; none; subtle | 8         | `#6272a4` |
| selected row (theme selection) | -         | `#44475a` |

Three recency tiers need three greys and the theme gives two plus white, so fresh and normal are close.
`test/palette-dark.test.js` re-reads the theme file and fails if the six state colours drift from it (it skips
where Ghostty is not installed).

## Light set

No light theme is configured, so none was derived: the light set keeps upstream's values. When the operator names a
light Ghostty theme, copy its ANSI roles the same way.

## Pinning the side

Ghostty here uses one theme day and night, so the desktop's light/dark is the wrong authority. Set
`appearance = "dark"` in the plugin config to pin the dark set (`auto` follows the desktop, as upstream does). The
pin is written into the config blocks by the configure action, so run it again after changing the setting.

## Unchanged

Vendor logo marks keep upstream's brand colours (a few are adjusted for legibility, as upstream's comments say). No
motion was added or changed: the working spinner and the pulse on a blocked mark are upstream's.
