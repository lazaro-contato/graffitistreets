import { Engine } from "./core/Engine";
import { Loop } from "./core/Loop";
import { Input } from "./core/Input";
import { buildStreet } from "./world/Street";
import { WallSystem } from "./world/WallSystem";
import {
  loadWallSurface,
  loadWallSurfaces,
  loadRoadSurface,
  loadAdTextures,
} from "./world/Surfaces";
import { loadCatalogue, entryFor, specOf } from "./world/SurfaceCatalogue";
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
import { Workshop } from "./ui/workshop/Workshop";
import { Loadout } from "./state/Loadout";
import { Menu, MENU_ART, type MenuScreen } from "./ui/Menu";
import { LoadingScreen } from "./ui/Loading";
import { buildPhoto } from "./ui/Photo";
import { workshopHint, canHint } from "./ui/Hint";
import { GITHUB_ICON } from "./ui/Icons";
import { wireLink } from "./ui/Links";
import { Session } from "./telemetry/Session";
import {
  apply as applyLocale,
  getLocale,
  onLocaleChange,
} from "./i18n/i18n";
import { ADS, DEFAULT_SURFACE_SLUG, LINKS, SIDES } from "./config";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const hud = document.getElementById("hud")!;
// Counted rather than estimated, so the bar tells the truth — including when
// the ad panels are switched off and there are two fewer files to wait for.
const loading = new LoadingScreen(
  1 + // the surface manifest
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

// What this deployment has to dress a wall with. Read before the walls exist,
// because the choice of surface decides which files are fetched next.
const catalogue = await loadCatalogue();
loading.advance();

// Awaited before the walls exist, because the photograph is tiled into each
// panel canvas as its base coat — there is no adding it afterwards without
// repainting every panel. The loading screen is already up, in the markup.
// The street the player is standing in. The menu edits this in place as choices
// are made, so reopening the settings shows what is actually on the walls.
const dressing = { slug: DEFAULT_SURFACE_SLUG };

const surfaces = await loadWallSurfaces(
  {
    left: specOf(entryFor(catalogue, dressing.slug)),
    right: specOf(entryFor(catalogue, dressing.slug)),
  },
  () => loading.advance(),
);
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

/**
 * The eight cans, and which of them is in hand.
 *
 * It is the source of truth for what the player is painting with; the spray
 * can is downstream of it. Keeping the equipping in one place is what makes
 * the rack on screen, the workshop and the actual paint agree with each other
 * without any of them talking to the others.
 */
const loadout = new Loadout();

function equip() {
  const selected = loadout.current;
  can.setCap(selected.cap);
  can.setColor(selected.color);
  can.sizeMultiplier = selected.size;
  can.flowMultiplier = selected.flow;
}

loadout.onChange(equip);
equip();

// Retired the first time somebody reaches for another can, which is proof they
// have learned the thing it exists to teach.
const canTip = canHint();

buildHud(loadout, () => player.controls.isLocked, {
  onCanPicked: () => canTip.dismiss(),
});

// Times the visit and reports it to Umami as the page goes away — how long the
// street held someone, and how much paint they left on it.
const session = new Session();

// P takes a photo. The same PNG is what the gallery will submit later.
buildPhoto(engine, () => player.controls.isLocked);

// Everything below is one state machine with four states: playing, the menu
// (main / pause / controls), and the backpack. Only "playing" holds pointer
// lock, and every other state needs a real mouse cursor, so the two must never
// drift apart — every transition goes through enterStreet or a menu.show.

/**
 * Puts a different photograph on one wall, keeping everything painted on it.
 *
 * Two steps, and the order is the whole trick: the panels take the new maps,
 * then the store lays the base coat down again and replays that side's journal
 * over it. Strokes are the source of truth, so nothing painted is lost by
 * changing what the wall is made of.
 *
 * Failures are silent on purpose, in the same way a missing texture file is:
 * loadWallSurface resolves to nulls rather than rejecting, which dresses the
 * wall in procedural concrete instead of leaving the player looking at an
 * error they cannot act on.
 */
async function redress(slug: string) {
  const surface = await loadWallSurface(specOf(entryFor(catalogue, slug)));
  for (const side of SIDES) {
    walls.dress(side, surface);
    store.repaintSide(side);
  }
}

const menu = new Menu(
  {
    onPlay: () => {
      player.setMode(menu.mode);
      enterStreet();
    },
    onWallSurface: (slug) => {
      dressing.slug = slug;
      void redress(slug);
    },
    onBrushSizing: (sizing) => can.setSizing(sizing),
    onResume: () => enterStreet(),
    onWorkshop: () => {
      // Reachable while the workshop is already open, since the pause screen
      // can be raised over it. There it means "put me back", not "open it
      // again".
      if (workshop.isOpen) menu.hide();
      else openWorkshop();
    },
    onQuit: () => {
      // The pause screen can be raised over the workshop, and the main menu
      // must not be left floating on top of it.
      workshop.close();
      menu.show("main");
    },
  },
  { catalogue, current: dressing.slug },
);

const workshop = new Workshop(loadout, {
  onClose: () => closeWorkshop(),
  // Escape over the workshop pauses without shutting it, and pressing it again
  // puts the workshop back. Anything else would make Escape a dead key here,
  // since it cannot close and cannot resume.
  onPause: () => (menu.isOpen ? menu.hide() : menu.show("pause")),
});
const hint = workshopHint();

// The workshop generates copy and cap samples, so it has to be told: one pass
// over data-i18n reaches the static markup but not a canvas.
onLocaleChange(() => workshop.relocalise());

wireLink("menu-submit", LINKS.SUBMIT[getLocale()]);
wireLink("menu-bug", LINKS.BUG);
wireLink("menu-source", LINKS.SOURCE, GITHUB_ICON);

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
  if (refuge && !menu.isOpen && !workshop.isOpen) menu.show(refuge);
  refuge = null;
});

/**
 * True between us handing the pointer back on purpose and the browser
 * confirming it is gone.
 *
 * The unlock listener needs it to tell "the player walked away" from "we asked
 * for this". It used to infer that from whether the workshop was open, which
 * is only true while the exit arrives promptly — and `pointerlockchange` is
 * asynchronous, so a fast Escape could close the workshop first and leave the
 * exit looking like the player leaving.
 */
let releasing = false;

/** Hands the pointer back without that being read as stepping away. */
function releasePointer() {
  if (!player.controls.isLocked) return;
  releasing = true;
  player.controls.unlock();
  // The event is not guaranteed to arrive — an unfocused document can swallow
  // it — so the flag is cleared on a timer regardless, like `requesting`.
  window.setTimeout(() => {
    releasing = false;
  }, 1000);
}

function openWorkshop() {
  if (workshop.isOpen) return;
  hint.dismiss();
  menu.hide();
  workshop.open();
  hud.hidden = true;
  releasePointer();
}

/**
 * Shuts the workshop and puts the player back in the street.
 *
 * Always the street, whichever door they came in by: the workshop is only
 * reachable from inside a game, so there is nowhere else closing it could
 * sensibly mean.
 *
 * It is only ever reached from the X or from I, and that is the point. Both
 * are gestures a browser will grant a pointer lock for, so the street comes
 * back playable with nothing left to click. Escape pauses instead — see the
 * workshop's onPause.
 */
function closeWorkshop() {
  if (!workshop.isOpen) return;
  workshop.close();
  hud.hidden = false;
  enterStreet();
}

/**
 * A lock this short was never really granted.
 *
 * Chrome will hand the pointer over and take it straight back when the request
 * came from the same keypress that also means "let go" — Escape. Nobody locks
 * the pointer and walks away inside a quarter of a second, so an exit that
 * fast is a refusal rather than a departure, and pausing on it is what put a
 * menu over the street.
 */
const REVOKE_MS = 250;

/** When the pointer was last actually ours. */
let lockedAt = -Infinity;

player.controls.addEventListener("lock", () => {
  requesting = false;
  refuge = null;
  lockedAt = performance.now();
  menu.hide();
  workshop.close();
  hud.hidden = false;
});

player.controls.addEventListener("unlock", () => {
  // An exit we asked for is not the player stepping away, and it must not
  // pause the game — whenever it turns up. This is a flag rather than a look
  // at what is on screen, because the screen that asked for it may already
  // have closed by the time the browser gets round to telling us.
  if (releasing) {
    releasing = false;
    return;
  }

  // See REVOKE_MS: a lock revoked the instant it was granted leaves the street
  // exactly as it was, for the click handler below to pick up.
  if (performance.now() - lockedAt < REVOKE_MS) {
    hud.hidden = false;
    return;
  }

  hud.hidden = true;
  // Losing the lock on its own — Esc, or the tab going to the background —
  // means the player stepped away, so pause. Unless a menu is already up.
  if (!workshop.isOpen && !menu.isOpen) menu.show("pause");
});

/**
 * A click in the street takes the pointer back.
 *
 * This is the recovery for every lock request that gets refused, and refusals
 * are ordinary rather than exceptional: a request made from Escape is always
 * turned down, and one made too soon after an Escape exit usually is. Rather
 * than guessing which, the street stays on screen and the first click puts the
 * player back in it — the same gesture that started the game.
 */
canvas.addEventListener("pointerdown", () => {
  if (menu.isOpen || workshop.isOpen || player.controls.isLocked) return;
  enterStreet();
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
    // While a menu is up over the workshop it owns the keyboard: closing
    // underneath it would leave the menu floating over the street.
    if (menu.isOpen) return;
    if (workshop.isOpen) closeWorkshop();
    else if (player.controls.isLocked) openWorkshop();
    return;
  }

  if (e.code !== "Escape") return;

  // Escape while locked is the browser's to handle: it drops the lock and the
  // unlock listener above brings up the pause screen. The workshop handles its
  // own Escape and calls back into closeWorkshop, so it is not repeated here.
  if (workshop.isOpen) return;
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
