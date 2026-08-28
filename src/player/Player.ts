import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { Movement } from "./Movement";
import { Input } from "../core/Input";
import { PLAYER, type MovementMode } from "../config";
import type { MapMetrics } from "../maps/types";

/**
 * Where a player is put down in a new street: back from the middle, facing
 * along it, with a wall within reach on either side.
 */
const SPAWN_ALONG = 0.4; // fraction of half the street's length

/**
 * First person player: pointer lock for looking, Movement for walking.
 *
 * The player outlives any one map — the pointer lock, its DOM listeners and
 * the lock state all have to survive a street being torn down and rebuilt, so
 * changing map goes through `setMap` rather than through a new instance.
 *
 * Note: in Three.js 0.185 PointerLockControls extends Controls and exposes the
 * camera as `controls.object`. The old `getObject()` accessor is gone.
 */
export class Player {
  readonly controls: PointerLockControls;
  private movement: Movement;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    domElement: HTMLElement,
    metrics: MapMetrics,
  ) {
    this.controls = new PointerLockControls(camera, domElement);
    this.movement = new Movement(metrics);
    this.spawn(metrics);
  }

  setMode(mode: MovementMode) {
    this.movement.setMode(mode);
  }

  /** Moves into another street: new bounds, new ceiling, back at the start. */
  setMap(metrics: MapMetrics) {
    this.movement.setMap(metrics);
    this.spawn(metrics);
  }

  private spawn(metrics: MapMetrics) {
    this.camera.position.set(
      0,
      PLAYER.EYE_HEIGHT,
      metrics.halfLength * SPAWN_ALONG,
    );
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
