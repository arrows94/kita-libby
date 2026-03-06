## 2024-03-04 - Clickable Cards Need Keyboard Support
**Learning:** Book list items were implemented as `<article>` elements with `onClick` handlers but lacked keyboard accessibility. This made it impossible for keyboard users or screen readers to "click" and open the book details.
**Action:** Always add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler checking for `Enter` and `Space` when making semantic non-interactive elements (like `<article>` or `<div>`) act as buttons.

## 2024-05-24 - Accessibility improvements for lists and toggle buttons
**Learning:** React maps that render repeated dynamic items often rely on hardcoded, generic attributes (like `alt="Cover"` or lacking `aria-pressed` for visual toggle states on buttons), resulting in poor screen reader context when multiple such elements are present on the same page.
**Action:** When rendering lists of items with images or custom toggle buttons, dynamically interpolate unique identifiers (like the item title) into the `alt` text, and explicitly provide state attributes like `aria-pressed` based on the item's active state.
