import { STRINGS, type Locale } from "./strings";

const STORED = "graffiti.locale";
const listeners: (() => void)[] = [];

/**
 * Portuguese for a Portuguese browser, English for everyone else.
 *
 * `navigator.languages` is the ordered list the visitor actually configured,
 * so somebody with pt-BR second still gets Portuguese. A stored choice always
 * wins: picking a language is a decision, and a decision outranks a guess.
 */
function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORED);
    if (saved === "pt" || saved === "en") return saved;
  } catch {
    // private mode — fall through to the browser's own setting
  }

  const preferred = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return preferred.some((tag) => tag.toLowerCase().startsWith("pt"))
    ? "pt"
    : "en";
}

let current: Locale = detect();

export function getLocale(): Locale {
  return current;
}

export function t(key: string): string {
  // Falling back to the key itself makes a missing string obvious on screen
  // rather than rendering an empty element nobody notices.
  return STRINGS[current][key] ?? STRINGS.pt[key] ?? key;
}

export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORED, locale);
  } catch {
    // The choice still applies to this visit.
  }
  apply();
  for (const listener of listeners) listener();
}

export function onLocaleChange(listener: () => void) {
  listeners.push(listener);
}

/**
 * Rewrites every `data-i18n` element in the document.
 *
 * Generated markup carries the attribute too, which is why switching language
 * never rebuilds the menu or the backpack — one pass over the DOM reaches the
 * static copy and the generated copy alike.
 */
export function apply(root: ParentNode = document) {
  for (const node of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n!);
  }

  document.documentElement.lang = current === "pt" ? "pt-BR" : "en";
  document.title = t("meta.title");
}
