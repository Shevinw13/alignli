"use client";

/**
 * SkipToContent
 *
 * A visually-hidden skip link rendered as the first focusable element in the
 * document. When focused (via Tab), it becomes visible with Indigo styling and
 * allows keyboard users to jump directly to the main content area.
 *
 * The target element must have `id="main-content"`.
 */
export function SkipToContent() {
  return (
    <a href="#main-content" className="skip-to-content">
      Skip to main content
    </a>
  );
}
