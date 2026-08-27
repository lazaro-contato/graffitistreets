import { LINKS } from "../config";
import { GITHUB_ICON } from "../ui/Icons";
import { wireLink } from "../ui/Links";
import { loadTracker } from "../telemetry/tracker";
import { showVersion } from "../ui/Version";
import { apply as applyLocale, getLocale, t } from "../i18n/i18n";

type Piece = { src: string; width: number; height: number; title?: string };

const MANIFEST = "/gallery/index.json";

// The same three the game's front screen carries, wired the same way, so the
// two headers cannot drift out of step.
function wireHeader() {
  wireLink("bar-submit", LINKS.SUBMIT[getLocale()]);
  wireLink("bar-source", LINKS.SOURCE, GITHUB_ICON);
}

function fileNameOf(src: string) {
  return src.split("/").pop() || "graffiti-streets.png";
}

/**
 * The full-size view.
 *
 * Sharing goes for the file itself before the link, because a share sheet
 * handed a file can hand it on to anything — a chat, a photo library, a draft
 * — while a link only works somewhere that unfurls links. Where neither is
 * available the URL goes to the clipboard, which is the last thing that always
 * works.
 */
function buildViewer() {
  const root = document.getElementById("viewer")!;
  const image = document.getElementById("viewer-image") as HTMLImageElement;
  const download = document.getElementById(
    "viewer-download",
  ) as HTMLAnchorElement;
  const share = document.getElementById("viewer-share") as HTMLButtonElement;
  const close = document.getElementById("viewer-close") as HTMLButtonElement;

  let current: Piece | null = null;
  let lastFocused: HTMLElement | null = null;

  const hide = () => {
    root.hidden = true;
    document.body.style.overflow = "";
    current = null;
    lastFocused?.focus();
  };

  const open = (piece: Piece, from: HTMLElement) => {
    current = piece;
    lastFocused = from;
    image.src = piece.src;
    download.href = piece.src;
    download.download = fileNameOf(piece.src);
    share.textContent = t("gallery.share");
    root.hidden = false;
    // The page behind must not scroll while a full-screen view is up.
    document.body.style.overflow = "hidden";
    close.focus();
  };

  close.addEventListener("click", hide);
  root.addEventListener("click", (e) => {
    // Only the backdrop closes; clicks that land on the image or the buttons
    // are meant for them.
    if (e.target === root) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !root.hidden) hide();
  });

  share.addEventListener("click", async () => {
    if (!current) return;
    const url = new URL(current.src, location.origin).href;

    try {
      const blob = await fetch(current.src).then((r) => r.blob());
      const file = new File([blob], fileNameOf(current.src), {
        type: blob.type,
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Graffiti Streets" });
        return;
      }
      if (navigator.share) {
        await navigator.share({ url, title: "Graffiti Streets" });
        return;
      }
    } catch (error) {
      // Dismissing the share sheet rejects, and that is not a failure.
      if ((error as Error)?.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      share.textContent = t("gallery.copied");
      window.setTimeout(() => (share.textContent = t("gallery.share")), 1800);
    } catch {
      // Clipboard blocked. Nothing useful left to try.
    }
  });

  return { open };
}

function render(pieces: Piece[], viewer: { open: (p: Piece, from: HTMLElement) => void }) {
  const host = document.getElementById("pieces")!;
  const empty = document.getElementById("empty")!;

  if (pieces.length === 0) {
    empty.hidden = false;
    return;
  }

  for (const piece of pieces) {
    const button = document.createElement("button");
    button.className = "piece";
    button.type = "button";

    const image = document.createElement("img");
    image.src = piece.src;
    image.alt = piece.title ?? "";
    image.loading = "lazy";
    image.decoding = "async";
    // Given up front so the column keeps the right height before the file
    // arrives. Without them the whole grid reflows as each image lands.
    image.width = piece.width;
    image.height = piece.height;

    button.appendChild(image);
    button.addEventListener("click", () => viewer.open(piece, button));
    host.appendChild(button);
  }
}

async function start() {
  showVersion();
  loadTracker();
  wireHeader();
  applyLocale();
  document.title = t("gallery.meta.title");

  const pieces = await fetch(MANIFEST)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => (data?.pieces as Piece[]) ?? [])
    .catch(() => [] as Piece[]);

  // Gone either way: a manifest that arrived, and one that never did and left
  // the empty state to explain itself.
  document.getElementById("loading")?.remove();
  render(pieces, buildViewer());
}

start();
