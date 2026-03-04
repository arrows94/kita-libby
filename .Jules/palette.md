## 2024-03-04 - Clickable Cards Need Keyboard Support
**Learning:** Book list items were implemented as `<article>` elements with `onClick` handlers but lacked keyboard accessibility. This made it impossible for keyboard users or screen readers to "click" and open the book details.
**Action:** Always add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler checking for `Enter` and `Space` when making semantic non-interactive elements (like `<article>` or `<div>`) act as buttons.
