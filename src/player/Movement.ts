import * as THREE from "three";
import { PLAYER, type MovementMode } from "../config";
import { clampToCorridor } from "../world/Colliders";

// Scratch vectors, reused every frame to avoid per-frame allocation.
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const target = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * What the player is asking for this frame.
 *
 * Shift and space are named after the keys because what they mean depends on
 * the mode: shift sprints on foot and sinks in flight, space jumps on foot and
 * climbs in flight.
 */
export type MoveIntent = {
  move: { x: number; z: number };
  shift: boolean;
  space: boolean;
  crouching: boolean;
};

export class Movement {
  mode: MovementMode = "walk";

  /** Horizontal velocity. Vertical motion is tracked separately below. */
  velocity = new THREE.Vector3();

  /** Height of the player's feet above the street. */
  private feetY = 0;
  private verticalVelocity = 0;
  private grounded = true;

  /** Top speed captured at take-off, held for the duration of a jump. */
  private airTargetSpeed = 0;

  private eyeHeight: number = PLAYER.EYE_HEIGHT;

  setMode(mode: MovementMode) {
    this.mode = mode;
    this.verticalVelocity = 0;
  }

  update(camera: THREE.Camera, intent: MoveIntent, dt: number) {
    const flying = this.mode === "free";
    const sprinting = !flying && intent.shift;

    // Camera direction projected onto the ground plane
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, UP).normalize();

    wish
      .set(0, 0, 0)
      .addScaledVector(forward, intent.move.z)
      .addScaledVector(right, intent.move.x);
    const steering = wish.lengthSq() > 0;

    const stanceSpeed = intent.crouching
      ? PLAYER.CROUCH_SPEED
      : sprinting
        ? PLAYER.RUN_SPEED
        : PLAYER.WALK_SPEED;

    // Take off before integrating, so a jump starts on this very frame.
    if (!flying && intent.space && this.grounded) {
      this.verticalVelocity = PLAYER.JUMP_SPEED;
      this.grounded = false;
      // Freeze the top speed at take-off. Without this, crouching or letting
      // go of shift in mid air would brake the player in the middle of a jump.
      this.airTargetSpeed = Math.max(stanceSpeed, this.velocity.length());
    }

    // Flight keeps full authority over the horizontal: you are not falling,
    // you are steering. Only a real jump gives up control.
    const fullControl = flying || this.grounded;
    const speed = fullControl ? stanceSpeed : this.airTargetSpeed;
    target.copy(wish).multiplyScalar(speed);

    const rate = fullControl
      ? steering
        ? PLAYER.GROUND_ACCEL
        : PLAYER.GROUND_STOP
      : steering
        ? PLAYER.AIR_ACCEL
        : PLAYER.AIR_STOP;

    // Chase a target velocity rather than integrating a raw acceleration and
    // damping it. exp(-rate * dt) is exact for any step, so this behaves the
    // same at 30 and 240 fps, and it reaches the speed constants exactly.
    this.velocity.lerp(target, 1 - Math.exp(-rate * dt));
    camera.position.addScaledVector(this.velocity, dt);

    const { hitX, hitZ } = clampToCorridor(camera.position);
    if (hitX) this.velocity.x = 0;
    if (hitZ) this.velocity.z = 0;

    // Stance settles before the vertical step, so the flight ceiling is
    // measured against the eye height actually in use this frame.
    const targetEyeHeight = intent.crouching
      ? PLAYER.CROUCH_EYE_HEIGHT
      : PLAYER.EYE_HEIGHT;
    this.eyeHeight +=
      (targetEyeHeight - this.eyeHeight) *
      (1 - Math.exp(-PLAYER.CROUCH_LERP * dt));

    if (flying) this.fly(intent, dt);
    else this.fall(dt);

    camera.position.y = this.feetY + this.eyeHeight;
  }

  /** Free flight: no gravity, the climb rate simply chases the input. */
  private fly(intent: MoveIntent, dt: number) {
    const climb = (intent.space ? 1 : 0) - (intent.shift ? 1 : 0);
    const wanted = climb * PLAYER.FLY_SPEED;
    this.verticalVelocity +=
      (wanted - this.verticalVelocity) * (1 - Math.exp(-PLAYER.FLY_ACCEL * dt));

    this.feetY += this.verticalVelocity * dt;

    // The ceiling is on the eye, not the feet, so crouching in mid air does
    // not buy extra altitude.
    const highest = Math.max(0, PLAYER.FLY_CEILING - this.eyeHeight);
    if (this.feetY <= 0) {
      this.feetY = 0;
      this.verticalVelocity = Math.max(0, this.verticalVelocity);
    } else if (this.feetY >= highest) {
      this.feetY = highest;
      this.verticalVelocity = Math.min(0, this.verticalVelocity);
    }

    this.grounded = this.feetY <= 0;
  }

  /** On foot: the street is flat, so the ground is always y = 0. */
  private fall(dt: number) {
    // Stepping position with the *average* velocity over the frame, rather
    // than the velocity at its start, is exact for constant acceleration —
    // otherwise the jump peaks lower on a slow machine than on a fast one.
    this.feetY += (this.verticalVelocity - (PLAYER.GRAVITY * dt) / 2) * dt;
    this.verticalVelocity -= PLAYER.GRAVITY * dt;

    if (this.feetY <= 0) {
      this.feetY = 0;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
  }
}
