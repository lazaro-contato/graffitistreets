/**
 * What one visit produced. Filled in entirely on the client.
 *
 * There is deliberately nothing here that identifies a person. Where the visit
 * came from is worked out server side from the request address and stored as a
 * place — the address itself is personal data under the LGPD, and the question
 * being asked is "which countries", not "which person".
 */
export type SessionReport = {
  id: string;
  startedAt: number;
  /** Time with the page actually in front of someone. */
  activeMs: number;
  /** Of that, time in the street rather than in a menu. */
  playingMs: number;
  /** Sprays and paint runs finished. */
  marks: number;
  viewport: { width: number; height: number };
  /** Set when the report has reached a server. */
  sent: boolean;
};

const QUEUE_KEY = "graffiti.sessions";
const SAVE_EVERY_MS = 5000;
/** A single frame can never be worth more than this, whatever the clock says. */
const MAX_TICK_MS = 1000;

function readQueue(): SessionReport[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SessionReport[]) : [];
  } catch {
    return []; // private mode, cleared storage, corrupted value — all the same
  }
}

function writeQueue(reports: SessionReport[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(reports));
  } catch {
    // Storage full or blocked. Losing analytics is never worth an exception.
  }
}

/**
 * Times a visit and keeps the result until something can collect it.
 *
 * Reports queue up in localStorage rather than being posted as they happen,
 * so the backend can arrive later and drain whatever is waiting — including
 * from visits that happened before it existed.
 */
export class Session {
  private report: SessionReport;
  private lastTick = performance.now();
  private lastSave = 0;

  constructor() {
    this.report = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      activeMs: 0,
      playingMs: 0,
      marks: 0,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sent: false,
    };

    document.addEventListener("visibilitychange", () => {
      // Coming back from a hidden tab, the clock has run but the visit has
      // not. Without this the whole absence lands in the next frame's delta.
      if (!document.hidden) this.lastTick = performance.now();
    });

    // pagehide fires where beforeunload does not — notably on mobile, where a
    // tab is usually discarded rather than closed.
    window.addEventListener("pagehide", () => this.save());
  }

  /** Called once a frame. `playing` means the street, not a menu. */
  update(playing: boolean) {
    const now = performance.now();
    const elapsed = Math.min(now - this.lastTick, MAX_TICK_MS);
    this.lastTick = now;

    // A hidden tab is not a visit. Some browsers stop the frame loop entirely
    // and some throttle it to a crawl, so this cannot be left to the loop.
    if (document.hidden) return;

    this.report.activeMs += elapsed;
    if (playing) this.report.playingMs += elapsed;

    if (now - this.lastSave > SAVE_EVERY_MS) this.save();
  }

  countMark() {
    this.report.marks++;
  }

  /** The visit so far, as it would be reported. */
  get snapshot(): Readonly<SessionReport> {
    return this.report;
  }

  private save() {
    this.lastSave = performance.now();
    const queue = readQueue().filter((r) => r.id !== this.report.id);
    queue.push(this.report);
    writeQueue(queue);
  }

  /** Everything waiting to be collected, this visit included. */
  static pending(): SessionReport[] {
    return readQueue().filter((r) => !r.sent);
  }

  /** Marks reports as collected once a server has acknowledged them. */
  static markSent(ids: readonly string[]) {
    const taken = new Set(ids);
    writeQueue(
      readQueue().map((r) => (taken.has(r.id) ? { ...r, sent: true } : r)),
    );
  }
}
