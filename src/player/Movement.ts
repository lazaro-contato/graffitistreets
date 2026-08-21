import * as THREE from "three";
import { PLAYER } from "../config";
import { clampToCorridor } from "../world/Colliders";

// Scratch vectors, reused every frame to avoid per-frame allocation.
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const target = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** What the player is trying to do this frame, read off the raw input. */
export type MoveIntent = {
  move: { x: number; z: number };
  running: boolean;
  crouching: boolean;
  jumping: boolean;
};

export class Movement {
  /** Horizontal velocity. Vertical motion is tracked separately below. */
  velocity = new THREE.Vector3();

  /** Height of the player's feet above the street. */
  private feetY = 0;
  private verticalVelocity = 0;
  private grounded = true;

  /** Top speed captured at take-off, held for the duration of the jump. */
  private airTargetSpeed = 0;

  private eyeHeight: number = PLAYER.EYE_HEIGHT;

  update(camera: THREE.Camera, intent: MoveIntent, dt: number) {
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
      : intent.running
        ? PLAYER.RUN_SPEED
        : PLAYER.WALK_SPEED;

    // Take off before integrating, so the jump starts on this very frame.
    if (intent.jumping && this.grounded) {
      this.verticalVelocity = PLAYER.JUMP_SPEED;
      this.grounded = false;
      // Freeze the top speed at take-off. Without this, crouching or letting
      // go of shift in mid air would brake the player in the middle of a jump.
      this.airTargetSpeed = Math.max(stanceSpeed, this.velocity.length());
    }

    // Chase a target velocity rather than integrating a raw acceleration and
    // damping it. The old form had a terminal speed of ACCELERATION / DAMPING,
    // which sat below WALK_SPEED — so the speed constants were unreachable and
    // running did nothing at all. This reaches them exactly, and because
    // exp(-rate * dt) is exact for any step, it behaves the same at 30 and
    // 240 fps.
    const speed = this.grounded ? stanceSpeed : this.airTargetSpeed;
    target.copy(wish).multiplyScalar(speed);

    const rate = this.grounded
      ? steering
        ? PLAYER.GROUND_ACCEL
        : PLAYER.GROUND_STOP
      : steering
        ? PLAYER.AIR_ACCEL
        : PLAYER.AIR_STOP;

    this.velocity.lerp(target, 1 - Math.exp(-rate * dt));
    camera.position.addScaledVector(this.velocity, dt);

    const { hitX, hitZ } = clampToCorridor(camera.position);
    if (hitX) this.velocity.x = 0;
    if (hitZ) this.velocity.z = 0;

    // Vertical integration. The street is flat, so the ground is always y = 0.
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

    // Crouching eases the camera down rather than snapping it. Same exponential
    // form, for the same framerate-independence reason.
    const targetEyeHeight = intent.crouching
      ? PLAYER.CROUCH_EYE_HEIGHT
      : PLAYER.EYE_HEIGHT;
    this.eyeHeight +=
      (targetEyeHeight - this.eyeHeight) *
      (1 - Math.exp(-PLAYER.CROUCH_LERP * dt));

    camera.position.y = this.feetY + this.eyeHeight;
  }
}
