import {
  BUILT_IN_SURFACE,
  SURFACE_MANIFEST_URL,
  type SurfaceEntry,
  type SurfaceSpec,
} from "../config";

/**
 * The list of wall surfaces this deployment ships, read from
 * `public/wall/surfaces.json`.
 *
 * The manifest exists so that adding a wall — a photograph of somebody's
 * street — is a JSON entry and three files, with no TypeScript to change and
 * nothing to rebuild but the static site. That is the whole point of it: a
 * texture can then arrive as a pull request from someone who has never opened
 * the source.
 */

/** The three files a surface is made of, derived from its slug. */
export function specOf(entry: SurfaceEntry): SurfaceSpec {
  return {
    albedo: `/wall/${entry.slug}/albedo.jpg`,
    normal: `/wall/${entry.slug}/normal.jpg`,
    roughness: `/wall/${entry.slug}/roughness.jpg`,
    tileMeters: entry.tileMeters,
  };
}

/**
 * True for an entry that is safe to put in front of somebody.
 *
 * The manifest is a file on disk that anyone forking this will edit by hand, so
 * a typo in it must not take the game down. An entry that fails this is dropped
 * and the rest of the list still loads.
 */
function isUsable(value: unknown): value is SurfaceEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;

  return (
    typeof entry.slug === "string" &&
    // A slug becomes a URL path segment. Keeping it to this alphabet is what
    // stops an entry from reaching outside /wall with a ../ or a leading slash.
    /^[a-z0-9][a-z0-9-]*$/.test(entry.slug) &&
    typeof entry.title === "string" &&
    typeof entry.author === "string" &&
    typeof entry.licence === "string" &&
    typeof entry.tileMeters === "number" &&
    entry.tileMeters > 0
  );
}

function normalise(value: SurfaceEntry): SurfaceEntry {
  return {
    slug: value.slug,
    title: value.title,
    city: typeof value.city === "string" ? value.city : null,
    country: typeof value.country === "string" ? value.country : null,
    author: value.author,
    licence: value.licence,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
    tileMeters: value.tileMeters,
  };
}

/**
 * Reads the manifest, and never rejects.
 *
 * A missing or broken manifest falls back to the one built-in surface, the same
 * way a missing texture file falls back to procedural concrete: a fork that has
 * deleted the artwork still gets a wall, and the failure is visible as a short
 * list rather than as a blank screen.
 */
export async function loadCatalogue(): Promise<SurfaceEntry[]> {
  try {
    const response = await fetch(SURFACE_MANIFEST_URL);
    if (!response.ok) return [BUILT_IN_SURFACE];

    const parsed: unknown = await response.json();
    const listed = (parsed as { surfaces?: unknown })?.surfaces;
    if (!Array.isArray(listed)) return [BUILT_IN_SURFACE];

    const entries = listed.filter(isUsable).map(normalise);
    return entries.length > 0 ? entries : [BUILT_IN_SURFACE];
  } catch {
    return [BUILT_IN_SURFACE];
  }
}

/** The entry for a slug, or the built-in one if the manifest has lost it. */
export function entryFor(
  catalogue: readonly SurfaceEntry[],
  slug: string,
): SurfaceEntry {
  return catalogue.find((entry) => entry.slug === slug) ?? catalogue[0] ?? BUILT_IN_SURFACE;
}
