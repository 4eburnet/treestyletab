/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from '/common/common.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('sidebar/color', ...args);
}

export function mixCSSColors(base, over, alpha = 1) {
  base = parseCSSColor(base);
  over = parseCSSColor(over);
  const mixed = mixColors(base, over);
  return `rgba(${mixed.red}, ${mixed.green}, ${mixed.blue}, ${alpha})`;
}

export function parseCSSColor(color, baseColor) {
  if (typeof color!= 'string')
    return color;

  let red, green, blue, alpha;

  // RRGGBB, RRGGBBAA
  let parts = color.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (parts) {
    red   = parseInt(parts[1], 16);
    green = parseInt(parts[2], 16);
    blue  = parseInt(parts[3], 16);
    alpha = parts[4] ? parseInt(parts[4], 16) / 255 : 1 ;
  }
  if (!parts) {
    // RGB, RGBA
    parts = color.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i);
    if (parts) {
      red   = Math.min(255, Math.round(255 * (parseInt(parts[1], 16) / 16)));
      green = Math.min(255, Math.round(255 * (parseInt(parts[2], 16) / 16)));
      blue  = Math.min(255, Math.round(255 * (parseInt(parts[3], 16) / 16)));
      alpha = parts[4] ? parseInt(parts[4], 16) / 16 : 1 ;
    }
  }
  if (!parts) {
    // rgb(), rgba()
    parts = color.match(/^rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*((?:0\.)?[0-9]+)\s*)?\)$/i);
    if (!parts)
      return color;
    red   = parseInt(parts[1]);
    green = parseInt(parts[2]);
    blue  = parseInt(parts[3]);
    alpha = parts[4] ? parseFloat(parts[4]) : 1 ;
  }

  const parsed = { red, green, blue, alpha };

  if (alpha < 1 && baseColor)
    return mixColors(parseCSSColor(baseColor), parsed);

  return parsed;
}

function mixColors(base, over) {
  const alpha = over.alpha;
  const red   = Math.min(255, Math.round((base.red   * (1 - alpha)) + (over.red   * alpha)));
  const green = Math.min(255, Math.round((base.green * (1 - alpha)) + (over.green * alpha)));
  const blue  = Math.min(255, Math.round((base.blue  * (1 - alpha)) + (over.blue  * alpha)));
  return { red, green, blue, alpha: 1 };
}

export function isBrightColor(color) {
  color = parseCSSColor(color);
  // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/browser/base/content/browser.js#8200
  const luminance = (color.red * 0.2125) + (color.green * 0.7154) + (color.blue * 0.0721);
  return luminance > 110;
}
