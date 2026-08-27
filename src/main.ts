import { Engine } from "./core/Engine";
import { Loop } from "./core/Loop";
import { Input } from "./core/Input";
import { buildStreet } from "./world/Street";
import { WallSystem } from "./world/WallSystem";
import {
  loadWallSurfaces,
  loadRoadSurface,
  loadAdTextures,
} from "./world/Surfaces";
import { buildBillboards } from "./world/Billboard";
import { Player } from "./player/Player";
import { SprayCan } from "./paint/SprayCan";
import { Aim } from "./paint/Aim";
import { PaintSystem } from "./paint/PaintSystem";
import { DripSystem } from "./paint/DripSystem";
import { StrokeStore } from "./state/StrokeStore";
import { LocalTransport } from "./net/LocalTransport";
import { buildHud } from "./ui/Hud";
import { SprayCursor } from "./ui/SprayCursor";
import { Inventory } from "./ui/Inventory";
import { Menu, MENU_ART, type MenuScreen } from "./ui/Menu";
import { LoadingScreen } from "./ui/Loading";
import { buildPhoto } from "./ui/Photo";
import { BackpackHint } from "./ui/Hint";
import { GITHUB_ICON } from "./ui/Icons";
import { Session } from "./telemetry/Session";
import {
  apply as applyLocale,
  getLocale,
  onLocaleChange,
} from "./i18n/i18n";
import { ADS, LINKS } from "./config";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const hud = document.getElementById("hud")!;
// Counted rather than estimated, so the bar tells the truth — including when
// the ad panels are switched off and there are two fewer files to wait for.
const loading = new LoadingScreen(
  6 + // wall textures, three a side
    3 + // road textures
    (ADS.ENABLED ? 2 : 0) + // ad artwork, one per language
    1 + // building the world
    2 + // menu artwork and the shark
    1, // the display face
);

const engine = new Engine(canvas);
const loop = new Loop();
const input = new Input(canvas);

buildStreet(engine.scene, await loadRoadSurface(() => loading.advance()));

// Awaited before the walls exist, because the photograph is tiled into each
// panel canvas as its base coat — there is no adding it afterwards without
// repainting every panel. The loading screen is already up, in the markup.
const surfaces = await loadWallSurfaces(() => loading.advance());
await loading.breathe();

// Building the panels blocks the main thread, so let the bar paint first.
const walls = new WallSystem(surfaces);
engine.scene.add(walls.group);
loading.advance();
await loading.breathe();

const player = new Player(engine.camera, input, canvas);
const can = new SprayCan();
const store = new StrokeStore(walls);
const transport = new LocalTransport();
// Model identity from day one, even with a single player. Retrofitting
// authorId into single player code means an optional field in thirty places.
const authorId = crypto.randomUUID();

// Off by default — see ADS.ENABLED. With it off nothing is built, the two
// artwork files are never fetched, and Aim has nothing clickable to test.
const billboards = ADS.ENABLED
  ? buildBillboards(
      engine.scene,
      await loadAdTextures(() => loading.advance()),
      ADS.HOUSE_LINK,
    )
  : null;

if (billboards) {
  billboards.setLocale(getLocale());
  onLocaleChange(() => billboards.setLocale(getLocale()));
}

const aim = new Aim(engine.camera, walls, billboards?.meshes ?? []);
const drips = new DripSystem(transport, authorId);
const paint = new PaintSystem(aim, can, transport, drips, authorId);
const cursor = new SprayCursor(engine.camera, can, aim, paint);

// The message loop: everything that paints goes through here.
transport.onMessage((message) => {
  switch (message.kind) {
    case "stroke:append":
      store.appendPoint(message);
      break;
    case "stroke:undo":
      store.undo(message.authorId);
      break;
    case "strip:clear":
      store.clearSide(message.side);
      break;
    case "stroke:end":
      // One per finished spray or paint run, so it is the honest count of
      // marks left on the wall.
      session.countMark();
      break;
  }
});

buildHud(can, () => player.controls.isLocked);

// Times the visit and reports it to Umami as the page goes away — how long the
// street held someone, and how much paint they left on it.
const session = new Session();

// P takes a photo. The same PNG is what the gallery will submit later.
buildPhoto(engine, () => player.controls.isLocked);

// Everything below is one state machine with four states: playing, the menu
// (main / pause / controls), and the backpack. Only "playing" holds pointer
// lock, and every other state needs a real mouse cursor, so the two must never
// drift apart — every transition goes through enterStreet or a menu.show.

const menu = new Menu({
  onPlay: () => {
    player.setMode(menu.mode);
    enterStreet();
  },
  onBrushSizing: (sizing) => can.setSizing(sizing),
  onResume: () => enterStreet(),
  onQuit: () => menu.show("main"),
});

const inventory = new Inventory(can, () => closeBackpack());
const hint = new BackpackHint();

(document.getElementById("menu-submit") as HTMLAnchorElement).href =
  LINKS.SUBMIT[getLocale()];
(document.getElementById("menu-bug") as HTMLAnchorElement).href = LINKS.BUG;

// Hidden in the markup until there is somewhere real to send people.
if (LINKS.AUTHOR) {
  const credits = document.getElementById("menu-credits") as HTMLAnchorElement;
  credits.href = LINKS.AUTHOR;
  credits.hidden = false;
}

const github = document.getElementById("menu-github") as HTMLAnchorElement;
github.href = LINKS.GITHUB_PROFILE;
github.innerHTML = GITHUB_ICON;

/**
 * Asks for the pointer back.
 *
 * Browsers refuse a lock request that arrives too soon after an Esc exit, and
 * there is no way to ask whether this one will be honoured. If it was not,
 * fall back to `refuge` rather than stranding the player with no cursor, no
 * HUD and no way back in.
 */
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
 * `onRefusal` covers the one case with nothing left to fall back on: closing
 * the backpack shuts it before asking, so a refusal there needs a destination.
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
  const link = aim.current.link;
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
 * itself is already built by the time this runs, synchronously, above. The
 * race is a safety net: a slow font CDN must delay the game, never block it.
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

// Order matters: move, aim, paint, then flush, then render. Aim runs before
// paint so both the spray and the cursor act on the same frame's raycast, and
// flushing after all paint logic keeps it to one texture upload per panel.
loop.add((dt) => {
  session.update(player.controls.isLocked);
  player.update(dt);
  aim.update();
  // Pointing at a sign is not painting, so the trigger does nothing to the
  // wall behind it.
  paint.update(
    input.isPainting && player.controls.isLocked && !aim.current.link,
    dt,
  );
  // After paint, so a run spawned this frame lays its first point immediately.
  drips.update(dt);
  cursor.update();
  walls.flush();
  engine.render();
});

await transport.connect();
loop.start();
