/**
 * Loads the analytics tracker, if this deployment has one.
 *
 * This used to be a script tag in both pages, which meant a fork inherited the
 * website id along with the code and quietly reported its own visitors to
 * somebody else's dashboard. Reading it from the environment makes absence the
 * default: no id, no tracker, nothing leaving the page.
 *
 * The cost is that the pageview now waits for the bundle to parse instead of
 * going out during HTML parsing. That is a few milliseconds against reporting
 * strangers' traffic to the wrong account, which is not a close call.
 */
export function loadTracker() {
  const id = import.meta.env.VITE_UMAMI_ID;
  if (!id) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = import.meta.env.VITE_UMAMI_SRC ?? "https://cloud.umami.is/script.js";
  script.dataset.websiteId = id;
  document.head.appendChild(script);
}
