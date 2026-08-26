import * as THREE from "three";
import { PHOTO } from "../config";

/**
 * Owns the renderer, scene, camera and resize handling.
 * No gameplay logic belongs in here.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    // Capping the pixel ratio at 2 matters: on a 3x screen, rendering at native
    // resolution costs 2.25x more pixels with no visible gain.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Sky and fog belong to the scenery, not the engine — see buildStreet.
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /**
   * Grabs a PNG of the next frame, rendered larger than the screen.
   *
   * The shot has to be taken inside render(), immediately after the draw call,
   * and that is not a stylistic choice: `preserveDrawingBuffer` is off, so the
   * drawing buffer is only readable until the browser composites at the end of
   * the task. Called from anywhere else, toDataURL returns a blank image.
   *
   * Turning that flag on instead would let the shot be taken at leisure, at
   * the cost of an extra buffer copy on every frame of a game nobody
   * screenshots most of the time.
   */
  capture(): Promise<string> {
    return new Promise((resolve) => {
      this.pendingCapture = resolve;
    });
  }

  private pendingCapture: ((png: string) => void) | null = null;

  /**
   * Renders one frame at a higher pixel ratio and reads it back.
   *
   * The screen buffer is capped at 2x for the sake of the frame rate, which is
   * the right call for something running sixty times a second and the wrong
   * one for a still. This pushes it up for exactly one frame, then puts it
   * back — and redraws, because resizing the buffer clears it and the next
   * frame would otherwise start from an empty canvas.
   *
   * The ceiling is on total pixels, not on the multiplier: a 4x buffer on a
   * high-density display is over a hundred megabytes, which weaker hardware
   * simply fails to allocate.
   */
  private takePhoto(): string {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = this.renderer.getPixelRatio();

    const longEst = Math.max(width, height) * ratio;
    const supersample = Math.max(
      1,
      Math.min(PHOTO.SUPERSAMPLE, PHOTO.MAX_LONG_EDGE / longEst),
    );

    this.renderer.setPixelRatio(ratio * supersample);
    this.renderer.setSize(width, height, false); // false: leave the CSS size be
    this.renderer.render(this.scene, this.camera);
    const png = this.renderer.domElement.toDataURL("image/png");

    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);

    return png;
  }

  render() {
    if (this.pendingCapture) {
      const resolve = this.pendingCapture;
      this.pendingCapture = null;
      resolve(this.takePhoto());
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
  }
}
