import { Engine } from "./core/Engine";
import { Loop } from "./core/Loop";
import { Input } from "./core/Input";
import { buildStreet } from "./world/Street";
import { WallSystem } from "./world/WallSystem";
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

const canvas = document.getElementById("app") as HTMLCanvasElement;
const overlay = document.getElementById("overlay")!;
const hud = document.getElementById("hud")!;

const engine = new Engine(canvas);
const loop = new Loop();
const input = new Input(canvas);

buildStreet(engine.scene);

const walls = new WallSystem();
engine.scene.add(walls.group);

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
const cursor = new SprayCursor(engine.camera, can, aim);

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

buildHud(can);

// The inventory needs a real mouse cursor to be clickable, so opening it
// releases the pointer lock and closing it asks for the lock back.
const inventory = new Inventory(can, () => closeInventory());

function openInventory() {
  if (inventory.isOpen) return;
  inventory.open();
  hud.hidden = true;
  player.controls.unlock();
}

function closeInventory() {
  if (!inventory.isOpen) return;
  inventory.close();
  player.controls.lock();

  // Browsers can refuse a lock request that comes too soon after an exit.
  // If it did not take, fall back to the entry overlay rather than stranding
  // the player with no cursor, no HUD and no way back in.
  window.setTimeout(() => {
    if (!player.controls.isLocked && !inventory.isOpen) overlay.hidden = false;
  }, 500);
}

document.getElementById("start")!.addEventListener("click", () => {
  player.controls.lock();
});

player.controls.addEventListener("lock", () => {
  overlay.hidden = true;
  hud.hidden = false;
});

player.controls.addEventListener("unlock", () => {
  hud.hidden = true;
  // Releasing the lock for the inventory is not the player leaving the city.
  if (!inventory.isOpen) overlay.hidden = false;
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
    e.preventDefault();
    transport.send({ kind: "stroke:undo", authorId });
    return;
  }

  if (e.code === "KeyI") {
    if (inventory.isOpen) closeInventory();
    else if (player.controls.isLocked) openInventory();
    return;
  }

  if (e.code === "Escape" && inventory.isOpen) closeInventory();
});

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
