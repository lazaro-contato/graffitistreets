---
name: add-a-cap
description: Add a new cap or tool to the backpack — the config row, the shape, the two languages, and how sizing behaves. Use when adding or changing anything that appears in the backpack.
---

# Add a cap

A cap is a data row, not a class. Nothing about it is hardcoded in a system, so
adding one is the same five edits every time.

## The two categories are not cosmetic

`CAP_CATEGORIES` splits the backpack into **caps** and **tools**, and the
difference is real behaviour:

- **Caps** — circle, square, flare. Width follows distance to the wall: closer
  is smaller and denser, out to `SPRAY.MAX_DISTANCE`.
- **Tools** — roller, marker, calligraphy. Width is whatever the wheel set,
  wherever you stand. Closer to a drawing instrument than to a can.

Decide which one the new thing is before writing anything. It changes how it
feels far more than the shape does.

## The five edits

1. **`src/config.ts`** — a row in `CAPS`: `id`, `shape`, `category`, `size`,
   and whatever the shape needs. Every number goes here, with a comment saying
   why it is that number.
2. **`src/paint/CapGeometry.ts`** — the shape, if it is not one that already
   exists. It is drawn in stroke-space; the size multiplier is applied for you.
3. **`src/i18n/strings.ts`** — a label in **both** locales. `cap` and `flare`
   stay in English in Portuguese too; those are the words the graffiti world
   uses in both languages.
4. **The backpack** picks it up from `capsIn(category)` with no further edit.
   If you find yourself adding it to a list in `Inventory.ts`, something is
   wrong — go back to the config.
5. **The crosshair** sizes itself from the cap. Check it matches the paint at
   both ends of the range; a mismatch there is the single most noticeable
   defect a cap can have.

## The trap

`SprayCan.radiusAt()` multiplies by the wheel multiplier **only** in `auto`
sizing:

```ts
const widest = BASE_RADIUS_M * cap.size * (this.sizing === "auto" ? this.sizeMultiplier : 1);
```

In `fixed` the multiplier is already baked into `reach()`. Applying it in both
places counts the wheel twice and the cap grows quadratically — it looks like a
bug in the wheel, not in the cap.

## Check

Paint with it at `MIN_DISTANCE` and at `MAX_DISTANCE`. Check a circle is round
at both. Switch between auto and fixed sizing and confirm the width behaves as
the category promises. Then follow `verify-a-change`.
