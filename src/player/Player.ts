import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { Movement } from "./Movement";
import { Input } from "../core/Input";
import { PLAYER, HALF_LENGTH, type MovementMode } from "../config";

/**
 * First person player: pointer lock for looking, Movement for walking.
 *
 * Note: in Three.js 0.185 PointerLockControls extends Controls and exposes the
 * camera as `controls.object`. The old `getObject()` accessor is gone.
 */
export class Player {
  readonly controls: PointerLockControls;
  private movement = new Movement();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    domElement: HTMLElement,
  ) {
    this.controls = new PointerLockControls(camera, domElement);
    camera.position.set(0, PLAYER.EYE_HEIGHT, HALF_LENGTH * 0.4);
  }

  setMode(mode: MovementMode) {
    this.movement.setMode(mode);
  }

  update(dt: number) {
    if (!this.controls.isLocked) return;
    this.movement.update(
      this.camera,
      {
        move: this.input.getMoveVector(),
        shift: this.input.isShiftDown,
        space: this.input.isSpaceDown,
        crouching: this.input.isCrouching,
      },
      dt,
    );
  }
}
