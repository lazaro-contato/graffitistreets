import * as THREE from "three";
import type { WallSystem } from "../world/WallSystem";
import type { Side } from "../config";
import { isUsablePhoto } from "../state/WallPhotos";

/**
 * Dropping an image on a wall.
 *
 * The side comes from where the file landed, not from a menu: the walls are
 * two metres apart on screen and the obvious way to say "that one" is to drop
 * it on that one. A drop that misses both walls is ignored rather than guessed
 * at — putting a photo on the wrong wall is worse than nothing happening.
 *
 * The browser's own drag events are used rather than a file input, because the
 * gesture is the affordance here. There is no button to find.
 */
export type WallDropHandlers = {
  /** A usable image landed on a wall. */
  onDrop: (side: Side, file: File) => void;
};

/** How long the wall flashes when a drop is refused. */
const REFUSAL_MS = 900;

export class WallDrop {
  private raycaster = new THREE.Raycaster();
  private point = new THREE.Vector2();

  /**
   * Nested dragenter and dragleave fire as the pointer crosses child elements,
   * so the highlight is counted in rather than toggled — otherwise it flickers
   * off every time the cursor passes over anything.
   */
  private depth = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.Camera,
    private walls: WallSystem,
    private handlers: WallDropHandlers,
  ) {
    // Without preventDefault on dragover the browser navigates to the file,
    // which loses the game and everything painted in it.
    this.canvas.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });

    this.canvas.addEventListener("dragenter", (event) => {
      event.preventDefault();
      this.depth += 1;
      this.canvas.dataset.dropping = "on";
    });

    this.canvas.addEventListener("dragleave", () => {
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) delete this.canvas.dataset.dropping;
    });

    this.canvas.addEventListener("drop", (event) => {
      event.preventDefault();
      this.depth = 0;
      delete this.canvas.dataset.dropping;

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      const side = this.sideAt(event);
      if (!side) return;

      // Checked after the wall, not before it: a drop into the middle of the
      // street was not aimed at anything, and complaining about the file it
      // happened to carry would be answering a question nobody asked.
      if (!isUsablePhoto(file)) {
        this.refuse();
        return;
      }

      this.handlers.onDrop(side, file);
    });
  }

  /**
   * Says no, on the canvas, for about a second.
   *
   * Deliberately not a message. The two ways to be refused are "that is not an
   * image" and "that image is enormous", and both are obvious to the person
   * who just dragged the file — a modal explaining it would cost a click to
   * dismiss and tell them nothing they did not know.
   */
  private refuse() {
    this.canvas.dataset.dropping = "refused";
    window.setTimeout(() => {
      if (this.canvas.dataset.dropping === "refused") {
        delete this.canvas.dataset.dropping;
      }
    }, REFUSAL_MS);
  }

  /** Which wall is under the drop, or null if the alley is. */
  private sideAt(event: DragEvent): Side | null {
    const rect = this.canvas.getBoundingClientRect();
    this.point.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    // Its own raycaster rather than Aim's: Aim is the crosshair, capped at
    // spray range and pointed at the middle of the screen, and neither is true
    // of a file dropped anywhere on a wall from anywhere in the street.
    this.raycaster.setFromCamera(this.point, this.camera);
    const hits = this.raycaster.intersectObjects(this.walls.meshes, false);
    if (hits.length === 0) return null;

    const panelId = hits[0].object.userData.panelId as number | undefined;
    if (panelId === undefined) return null;
    return this.walls.get(panelId).side;
  }
}
