/// <reference types="vite/client" />

/** The version from package.json, substituted at build time by Vite. */
declare const __APP_VERSION__: string;

/**
 * Everything this deployment knows that the source does not.
 *
 * All optional, deliberately. A checkout with no configuration has to build
 * and run — someone reading the code should be able to paint on a wall within
 * a minute of cloning, without first being asked for an analytics account.
 * What is missing simply does not appear.
 */
interface ImportMetaEnv {
  /** Umami website id. Without it no tracker loads and nothing is reported. */
  readonly VITE_UMAMI_ID?: string;
  /** Only for a self-hosted Umami; defaults to their cloud script. */
  readonly VITE_UMAMI_SRC?: string;

  /**
   * Where this deployment's source lives — the icon in the corner of the
   * front screen.
   *
   * Under the AGPL, a modified version served over a network has to offer its
   * source to the people using it. This is that offer, so anyone who forks and
   * deploys already has the mechanism and only has to point it at their own
   * repository.
   */
  readonly VITE_LINK_SOURCE?: string;

  /** Where "report a bug" goes. */
  readonly VITE_LINK_BUG?: string;

  /** Where "send your image" goes, one per language. */
  readonly VITE_FORM_SUBMIT_PT?: string;
  readonly VITE_FORM_SUBMIT_EN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
