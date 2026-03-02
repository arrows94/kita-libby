## 2026-03-02 - Keyboard Accessibility for Custom Clickable Elements
**Learning:** When making a non-interactive element like a `<div>` or `<article>` clickable using `onClick`, it lacks keyboard support by default. This makes it inaccessible to users navigating via keyboard or screen readers.
**Action:** Always add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler for `Enter` and `Space` when creating custom clickable elements to ensure full accessibility.
