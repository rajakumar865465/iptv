'use client';

/**
 * Bottom safe-area spacer for small screens.
 *
 * The StickyMobileCTA floating bar is `fixed` at the bottom with `z-40` and
 * already accounts for the device safe area via
 * `paddingBottom: max(12px, env(safe-area-inset-bottom))`. Without this
 * spacer, the bar overlaps the page's last section (Buy License banner, footer,
 * etc.) on mobile, hiding the bottom ~88px of content.
 *
 * This spacer adds the same height on top of the safe-area inset so the
 * floating bar sits beside the content instead of on top of it.
 */
const MOBILE_CTA_BAR_HEIGHT = 88; // px — bar button height (52) + padding/border

export default function MobileBottomSpacer() {
  return (
    <div
      style={{
        paddingBottom: `calc(${MOBILE_CTA_BAR_HEIGHT}px + max(12px, env(safe-area-inset-bottom)))`,
      }}
      className="md:hidden"
      aria-hidden="true"
    />
  );
}
