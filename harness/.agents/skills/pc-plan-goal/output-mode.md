# Output mode

Determine the mode only from the first whitespace-delimited token of `$ARGUMENTS`.

- `pr`: remove the token, push the feature branch, and create a PR.
- `push`: remove the token and push the feature branch.
- Any other first token: keep the full input and merge locally into the default branch.

Words such as "push notifications" or "PR template" inside the feature description are feature data. They do not change output mode.
