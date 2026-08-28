import { Engine } from "./core/Engine";
import { Loop } from "./core/Loop";
import { Input } from "./core/Input";
import { loadArena, fileCount, type Arena, type ArenaDeps } from "./Arena";
import { loadAdTextures } from "./world/Surfaces";
import { mapById } from "./maps";
import type { MapId } from "./maps/types";
import { Player } from "./player/Player";
import { SprayCan } from "./paint/SprayCan";
import { LocalTransport } from "./net/LocalTransport";
import { buildHud } from "./ui/Hud";
import { Inventory } from "./ui/Inventory";
import { Menu, MENU_ART, storedMapId, type MenuScreen } from "./ui/Menu";
import { LoadingScreen } from "./ui/Loading";
import { buildPhoto } from "./ui/Photo";
import { BackpackHint } from "./ui/Hint";
import { GITHUB_ICON } from "./ui/Icons";
import { wireLink } from "./ui/Links";
import { Session } from "./telemetry/Session";
import {
  apply as applyLocale,
  getLocale,
  onLocaleChange,
} from "./i18n/i18n";
import { ADS, LINKS } from "./config";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const hud = document.getElementById("hud")!;

const engine = new Engine(canvas);
const loop = new Loop();
const input = new Input(canvas);
const can = new SprayCan();
const transport = new LocalTransport();
// Model identity from day one, even with a single player. Retrofitting
// authorId into single player code means an optional field in thirty places.
const authorId = crypto.randomUUID();

// Times the visit and reports it to Umami as the page goes away — how long the
// street held someone, and how much paint they left on it.
const session = new Session();

/**
 * The street the player was last in, restored from their last visit.
 *
 * Read before the menu is built, because the loading bar has to be sized
 * before anything is fetched and different maps fetch different numbers of
 * files.
 */
const startMapId = storedMapId();

/** Everything a load waits on besides the map's own files. */
const CHROME_STEPS =
  1 + // building the world: panel canvases, and their base coats
  2 + // the menu artwork and the shark
  1; // the display face

// Counted rather than estimated, so the bar tells the truth — including when
// the ad panels are switched off and there are two fewer files to wait for.
const loading = new LoadingScreen(
  fileCount(mapById(startMapId)) + CHROME_STEPS + (ADS.ENABLED ? 2 : 0),
);

// One image per language, loaded once and hung in every map, so it sits out
// here rather than inside an arena. Off by default — see ADS.ENABLED.
const ads = ADS.ENABLED ? await loadAdTextures(() => loading.advance()) : null;

const arenaDeps: ArenaDeps = {
  engine,
  can,
  transport,
  authorId,
  ads,
  onFile: () => loading.advance(),
  breathe: () => loading.breathe(),
};

/**
 * The loaded street, and the only thing in this file that is replaced rather
 * than kept. Everything above outlives a map; everything an arena owns does
 * not — see Arena.ts for where that line is drawn and why.
 */
let arena: Arena = await loadArena(mapById(startMapId), arenaDeps);
loading.advance();
await loading.breathe();

const player = new Player(engine.camera, input, canvas, arena.metrics);

/**
 * Journals of streets left behind, kept for as long as the tab is open.
 *
 * Nothing is written to disk yet — that is phase 3 — but a switch would
 * otherwise throw away a piece somebody was half way through, and coming back
 * to find a bare wall is the wrong answer to "let me look at the other map".
 */
const journals = new Map<MapId, string>();

/**
 * True while a street is being torn down and the next one built.
 *
 * The frame loop must not touch the arena across that gap: between `dispose()`
 * and the new one being assigned there is an await, and a frame landing in it
 * would flush disposed canvases and render freed geometry.
 */
let swapping = false;

async function switchMap(id: MapId) {
  if (id === arena.metrics.def.id) return;

  if (!arena.store.isEmpty) {
    journals.set(arena.metrics.def.id, arena.store.serialize());
  }

  loading.reopen(fileCount(mapById(id)) + 1);
  // Two frames: one to un-hide the loading screen, one for it to fade in over
  // the street before the main thread goes away to build panel canvases.
  await loading.breathe();
  await loading.breathe();

  swapping = true;
  arena.dispose();
  arena = await loadArena(mapById(id), arenaDeps);
  loading.advance();
  swapping = false;

  arena.setLocale(getLocale());
  player.setMap(arena.metrics);

  const saved = journals.get(id);
  if (saved) arena.store.load(saved);

  await loading.finish();
}

arena.setLocale(getLocale());
onLocaleChange(() => arena.setLocale(getLocale()));

// The message loop: everything that paints goes through here. It is registered
// once and reads whichever arena is loaded, because the transport outlives any
// one street — and LocalTransport has no way to take a handler back off.
transport.onMessage((message) => {
  switch (message.kind) {
    case "stroke:append":
      arena.store.appendPoint(message);
      break;
    case "stroke:undo":
      arena.store.undo(message.authorId);
      break;
    case "surface:clear":
      arena.store.clearSurface(message.surface);
      break;
    case "stroke:end":
      // One per finished spray or paint run, so it is the honest count of
      // marks left on the wall.
      session.countMark();
      break;
  }
});

buildHud(can, () => player.controls.isLocked);

// P takes a photo. The same PNG is what the gallery will submit later.
buildPhoto(engine, () => player.controls.isLocked);

// Everything below is one state machine with four states: playing, the menu
// (main / maps / modes / settings / controls / pause), and the backpack. Only
// "playing" holds pointer lock, and every other state needs a real mouse
// cursor, so the two must never drift apart — every transition goes through
// enterStreet or a menu.show.

const menu = new Menu({
  onPlay: async () => {
    player.setMode(menu.mode);
    // Picking a different street rebuilds the world before the pointer is
    // asked for. That takes long enough to be worth a refuge: a lock request
    // arriving late can still be refused, and the menu is where to land.
    const moving = menu.mapId !== arena.metrics.def.id;
    if (moving) await switchMap(menu.mapId);
    enterStreet(moving ? "modes" : null);
  },
  onBrushSizing: (sizing) => can.setSizing(sizing),
  onResume: () => enterStreet(),
  onQuit: () => menu.show("main"),
});

const inventory = new Inventory(can, () => closeBackpack());
const hint = new BackpackHint();

wireLink("menu-submit", LINKS.SUBMIT[getLocale()]);
wireLink("menu-bug", LINKS.BUG);
wireLink("menu-source", LINKS.SOURCE, GITHUB_ICON);

/** Between asking for the pointer and finding out whether we got it. */
let requesting = false;
/** Where to land if the request is turned down. Usually nowhere. */
let refuge: MenuScreen | null = null;

/**
 * Asks for the pointer back.
 *
 * Nothing is hidden here, and that is the entire point. Browsers refuse a new
 * lock for about a second after Escape released the last one, and there is no
 * way to ask in advance — so hiding first meant the menu vanished, the request
 * was turned down in silence, and the fallback put it back half a second
 * later. Pressing Escape to resume therefore looked like the menu flickering
 * rather than like a refusal.
 *
 * The screen now comes down in the `lock` listener, once the pointer really is
 * ours. A refused request leaves whatever is on screen exactly where it was.
 *
 * `onRefusal` covers the cases with nothing left to fall back on: closing the
 * backpack shuts it before asking, and moving to another street has already
 * left the old one.
 */
function enterStreet(onRefusal: MenuScreen | null = null) {
  if (requesting || player.controls.isLocked) return;

  requesting = true;
  refuge = onRefusal;
  player.controls.lock();

  // Neither event is guaranteed to arrive — an unfocused document can swallow
  // both — so the flag is cleared on a timer regardless.
  window.setTimeout(() => {
    requesting = false;
  }, 2000);
}

// three listens for this too, but only to log; the recovery has to be ours.
document.addEventListener("pointerlockerror", () => {
  requesting = false;
  if (refuge && !menu.isOpen && !inventory.isOpen) menu.show(refuge);
  refuge = null;
});

function openBackpack() {
  if (inventory.isOpen) return;
  hint.dismiss();
  inventory.open();
  hud.hidden = true;
  player.controls.unlock();
}

function closeBackpack() {
  if (!inventory.isOpen) return;
  // Shut on the spot: pressing I again has to close it whether or not the
  // pointer comes back. The refuge covers the case where it does not.
  inventory.close();
  enterStreet("pause");
}

player.controls.addEventListener("lock", () => {
  requesting = false;
  refuge = null;
  menu.hide();
  inventory.close();
  hud.hidden = false;
});

player.controls.addEventListener("unlock", () => {
  hud.hidden = true;
  // Losing the lock on its own — Esc, or the tab going to the background —
  // means the player stepped away, so pause. Unless we let go of it ourselves
  // to open the backpack, or a menu screen is already up.
  if (!inventory.isOpen && !menu.isOpen) menu.show("pause");
});

// Opening a tab drops pointer lock, which is what anyone clicking a link
// expects. noopener keeps the new tab from reaching back into this one.
canvas.addEventListener("click", () => {
  const link = arena.currentLink();
  if (link && player.controls.isLocked) {
    window.open(link, "_blank", "noopener,noreferrer");
  }
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
    e.preventDefault();
    transport.send({ kind: "stroke:undo", authorId });
    return;
  }

  if (e.code === "KeyI") {
    if (inventory.isOpen) closeBackpack();
    else if (player.controls.isLocked) openBackpack();
    return;
  }

  if (e.code !== "Escape") return;

  // Escape while locked is the browser's to handle: it drops the lock and the
  // unlock listener above brings up the pause screen.
  if (inventory.isOpen) closeBackpack();
  else if (menu.current && menu.current !== "main" && menu.current !== "pause")
    menu.back();
  else if (menu.current === "pause") enterStreet();
});

/**
 * Holds the loader up until the front door can be painted properly.
 *
 * Only the menu artwork and the display face are worth waiting on — the world
 * itself is already built by the time this runs. The race is a safety net: a
 * slow font CDN must delay the game, never block it.
 */
async function waitForFrontDoor() {
  const art = new Image();
  art.src = MENU_ART;

  // Already in the markup, so this waits on the fetch the browser started for
  // itself rather than asking for the file twice.
  const shark = document.getElementById("menu-shark") as HTMLImageElement;

  const counted = (pending: Promise<unknown>) =>
    pending.finally(() => loading.advance());

  await Promise.race([
    Promise.allSettled([
      counted(art.decode()),
      counted(shark.decode()),
      counted(document.fonts.load('1rem "Aldrich"')),
    ]),
    new Promise((resolve) => window.setTimeout(resolve, 6000)),
  ]);
}

await waitForFrontDoor();
// Fills every data-i18n element, sets <html lang> and the document title.
applyLocale();
menu.show("main");
await loading.finish();

// Order matters: move, then the arena (aim, paint, drips, cursor, flush), then
// the render. Aim runs before paint so both the spray and the cursor act on
// the same frame's raycast, and the flush comes after all paint logic so it
// stays at one texture upload per panel per frame.
loop.add((dt) => {
  session.update(player.controls.isLocked);
  // Mid-swap there is no street to draw and nothing to draw it with.
  if (swapping) return;
  player.update(dt);
  arena.update(dt, input.isPainting && player.controls.isLocked);
  engine.render();
});

await transport.connect();
loop.start();
