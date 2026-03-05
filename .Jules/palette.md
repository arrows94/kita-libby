## 2024-03-04 - Clickable Cards Need Keyboard Support
**Learning:** Book list items were implemented as `<article>` elements with `onClick` handlers but lacked keyboard accessibility. This made it impossible for keyboard users or screen readers to "click" and open the book details.
**Action:** Always add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler checking for `Enter` and `Space` when making semantic non-interactive elements (like `<article>` or `<div>`) act as buttons.

## 2024-03-05 - Auth Form Enter-to-Submit Broken
**Learning:** The login inputs (role select and password) were wrapped in an empty React fragment (`<>`) instead of a semantic `<form>`. This prevented users from pressing 'Enter' to submit the form, breaking an expected accessibility standard. Additionally, these form elements lacked visible labels and matching `aria-label`s, causing issues for screen readers.
**Action:** Always wrap interactive authentication or data entry inputs in a `<form>` tag and use `onSubmit` to leverage native HTML behaviors like Enter-to-submit. Add `aria-label` attributes to fields where visible labels are omitted.
