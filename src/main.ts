import { Engine } from "./core/Engine";
import { Loop } from "./core/Loop";
import { Input } from "./core/Input";
import { buildStreet } from "./world/Street";
import { WallSystem } from "./world/WallSystem";
import { loadWallSurface } from "./world/WallSurface";
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

const canvas = document.getElementById("app") as HTMLCanvasElement;
const hud = document.getElementById("hud")!;
// Seven counted steps: three wall files, the world itself, the menu artwork,
// the shark and the display face. Counted rather than estimated, so the bar
// tells the truth.
const loading = new LoadingScreen(7);

const engine = new Engine(canvas);
const loop = new Loop();
const input = new Input(canvas);

buildStreet(engine.scene);

// Awaited before the walls exist, because the photograph is tiled into each
// panel canvas as its base coat — there is no adding it afterwards without
// repainting every panel. The loading screen is already up, in the markup.
const surface = await loadWallSurface(() => loading.advance());
await loading.breathe();

// Building the panels blocks the main thread, so let the bar paint first.
const walls = new WallSystem(surface);
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

const aim = new Aim(engine.camera, walls);
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
      break;
  }
});

buildHud(can, () => player.controls.isLocked);

// Everything below is one state machine with four states: playing, the menu
// (main / pause / controls), and the backpack. Only "playing" holds pointer
// lock, and every other state needs a real mouse cursor, so the two must never
// drift apart — every transition goes through enterStreet or a menu.show.

const menu = new Menu({
  onPlay: () => {
    player.setMode(menu.mode);
    enterStreet("modes");
  },
  onResume: () => enterStreet("pause"),
  onQuit: () => menu.show("main"),
});

const inventory = new Inventory(can, () => closeBackpack());

/**
 * Asks for the pointer back.
 *
 * Browsers refuse a lock request that arrives too soon after an Esc exit, and
 * there is no way to ask whether this one will be honoured. If it was not,
 * fall back to `refuge` rather than stranding the player with no cursor, no
 * HUD and no way back in.
 */
function enterStreet(refuge: MenuScreen) {
  menu.hide();
  inventory.close();
  player.controls.lock();

  window.setTimeout(() => {
    if (!player.controls.isLocked && !menu.isOpen && !inventory.isOpen) {
      menu.show(refuge);
    }
  }, 500);
}

function openBackpack() {
  if (inventory.isOpen) return;
  inventory.open();
  hud.hidden = true;
  player.controls.unlock();
}

function closeBackpack() {
  if (!inventory.isOpen) return;
  enterStreet("pause");
}

player.controls.addEventListener("lock", () => {
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
  else if (menu.current === "controls" || menu.current === "modes") menu.back();
  else if (menu.current === "pause") enterStreet("pause");
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
menu.show("main");
await loading.finish();

// Order matters: move, aim, paint, then flush, then render. Aim runs before
// paint so both the spray and the cursor act on the same frame's raycast, and
// flushing after all paint logic keeps it to one texture upload per panel.
loop.add((dt) => {
  player.update(dt);
  aim.update();
  paint.update(input.isPainting && player.controls.isLocked, dt);
  // After paint, so a run spawned this frame lays its first point immediately.
  drips.update(dt);
  cursor.update();
  walls.flush();
  engine.render();
});

await transport.connect();
loop.start();
