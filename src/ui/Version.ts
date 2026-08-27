/**
 * Stamps the build's version into the corner of the page.
 *
 * It is there for bug reports. Somebody describing a problem can read the
 * build off the screen instead of being asked which one they were on, and an
 * old answer stops looking like a current one. Quiet enough to ignore while
 * playing, legible the moment you look for it.
 */
export function showVersion() {
  const el = document.getElementById("version");
  if (el) el.textContent = `v${__APP_VERSION__}`;
}
