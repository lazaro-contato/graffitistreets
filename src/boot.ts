import { apply as applyLocale } from "./i18n/i18n";

/**
 * Decides whether there is a game to load at all.
 *
 * The test is the pointer, not the screen width or the user agent. This game
 * needs something it can lock and something it can aim: a coarse pointer with
 * no hover is a finger, and a finger can do neither. A narrow window on a
 * laptop still plays fine, and a touchscreen laptop still reports a fine
 * primary pointer, so both are let through.
 *
 * styles.css asks the same question and gets there first, while the HTML is
 * still parsing, so nobody watches a loading bar for a game that is not
 * coming. Setting the attribute as well costs nothing and means a browser that
 * mishandles the media query still closes the door.
 *
 * The game is imported rather than required, so a phone never downloads
 * three-quarters of a megabyte of renderer it has no use for.
 */
const canPlay = !window.matchMedia("(pointer: coarse) and (hover: none)")
  .matches;

if (canPlay) {
  await import("./main");
} else {
  document.documentElement.dataset.unsupported = "";
  // The game normally does this on its way up. Nothing else will now.
  applyLocale();
}
