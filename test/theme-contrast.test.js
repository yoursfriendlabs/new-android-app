import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAppPalette } from '../src/theme/app-palette.ts';
import { COLOR_THEMES, buildPaletteFromHex } from '../src/theme/color-themes.ts';

// Dark palettes are derived from each theme's hue rather than hand-written, so
// these checks are what stops a new or custom colour shipping unreadable.

function luminance(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const part = channel / 255;
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const THEMES = [...COLOR_THEMES, buildPaletteFromHex('#e91e63')];

for (const mode of ['light', 'dark']) {
  for (const theme of THEMES) {
    test(`${mode} palette for "${theme.id}" stays readable`, () => {
      const colors = buildAppPalette(theme, mode);

      assert.ok(contrast(colors.text, colors.surface) >= 7, 'body text on cards');
      assert.ok(contrast(colors.textMuted, colors.surface) >= 4.5, 'muted text on cards');
      assert.ok(contrast(colors.text, colors.background) >= 7, 'body text on the page');
      assert.ok(contrast(colors.text, colors.backgroundAlt) >= 4.5, 'text on chips');
      assert.ok(contrast(colors.onPrimary, colors.primary) >= 4.5, 'label on a primary button');
      assert.ok(contrast(colors.onSuccess, colors.success) >= 4, 'label on a success fill');
      assert.ok(contrast(colors.onDanger, colors.danger) >= 4, 'label on a danger fill');
      assert.ok(contrast(colors.primaryText, colors.surface) >= 3, 'accent-coloured text on cards');
    });
  }
}

test('dark mode actually darkens the surfaces', () => {
  for (const theme of THEMES) {
    const light = buildAppPalette(theme, 'light');
    const dark = buildAppPalette(theme, 'dark');
    assert.equal(dark.mode, 'dark');
    assert.ok(luminance(dark.surface) < 0.05, `${theme.id} dark surface is dark`);
    assert.ok(luminance(light.surface) > 0.5, `${theme.id} light surface is light`);
  }
});
