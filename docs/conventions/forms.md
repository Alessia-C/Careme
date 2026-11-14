# Forms

Moved from CLAUDE.md. Read it when building or changing any form with user input (except login and signup).

- Forms (create/edit drawers and any form that holds user input, except login and signup): when the user has unsaved changes (a value differs from its initial one), every way of leaving asks first.
  - Closing the form (Cancel, X, Esc, backdrop) opens the shared "Unsaved changes" modal (`role="alertdialog"`, Figma node 185:3099) with "Discard" and "Continue editing".
  - In-app navigation (Back/Forward, links, logout) is blocked with `useBlocker` and shows the same modal.
  - Reload or tab close uses the native `beforeunload` prompt, registered only while the form is dirty.
  - Session expiry/401 redirects are never blocked.
  - A form with no changes, or one just submitted successfully, leaves without asking.
  - Reuse the one shared confirmation component and the dirty tracking of `useForm`: do not reimplement them per form.
  - Every form issue lists these cases in its acceptance criteria.
