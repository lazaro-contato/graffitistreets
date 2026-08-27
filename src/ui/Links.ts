/**
 * Points an anchor at a URL, or takes it off the page if there is none.
 *
 * Absence is a real state here rather than a failure: a checkout with no
 * configuration should show a clean menu, not a row of links to nowhere. The
 * markup carries `hidden` so nothing flashes before this runs.
 */
export function wireLink(id: string, href: string | null, icon?: string) {
  const anchor = document.getElementById(id) as HTMLAnchorElement | null;
  if (!anchor) return;

  if (!href) {
    anchor.remove();
    return;
  }

  anchor.href = href;
  if (icon) anchor.innerHTML = icon;
  anchor.hidden = false;
}
