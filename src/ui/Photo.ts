import type { Engine } from "../core/Engine";

/** Shutter flash, in milliseconds. Matches the CSS animation. */
const FLASH_MS = 320;

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Takes a photo of the wall.
 *
 * The HUD is DOM rather than canvas, so none of it lands in the shot — the
 * crosshair, the palette and the backpack are simply not there. What comes
 * out is the street as the camera sees it.
 *
 * The same PNG is what the gallery will submit later, which is why this hands
 * back the data URL rather than only saving it.
 */
export function buildPhoto(
  engine: Engine,
  isPlaying: () => boolean,
  onTaken?: (png: string) => void,
) {
  const flash = document.getElementById("flash")!;
  let busy = false;

  const take = async () => {
    if (busy) return;
    busy = true;

    const png = await engine.capture();

    flash.classList.remove("firing");
    // Reading offsetWidth forces the style change to land before the class
    // goes back on; without it the browser coalesces the two and the second
    // photo of a session never flashes.
    void flash.offsetWidth;
    flash.classList.add("firing");
    window.setTimeout(() => flash.classList.remove("firing"), FLASH_MS);

    const link = document.createElement("a");
    link.href = png;
    link.download = `graffiti-streets-${stamp()}.png`;
    link.click();

    onTaken?.(png);
    busy = false;
  };

  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyP" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!isPlaying()) return;
    take();
  });

  return { take };
}
