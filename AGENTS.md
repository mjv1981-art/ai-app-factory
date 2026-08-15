# AI App Factory — Governance Rules

## Core principle

Every change must be minimal, traceable, testable, and reviewable.

A successful implementation is not enough.
Unrequested changes are regressions.

## Mandatory workflow

1. Read the Change Contract before modifying anything.
2. Work only on a non-protected branch.
3. Implement the smallest change necessary.
4. Do not modify unrelated functionality or UI.
5. Run the existing QA suite.
6. Add tests when the requested behaviour is not adequately covered.
7. Open a Pull Request.
8. Do not merge unless required QA checks pass.

## Protected assets

Agents must NOT:

- update visual regression baselines without explicit approval;
- delete or weaken existing regression tests;
- disable failing tests;
- change QA thresholds to make tests pass;
- modify GitHub Actions QA workflows unless explicitly requested;
- bypass branch protection;
- push directly to main;
- silently broaden the requested scope.

## Visual baselines

Golden screenshots represent approved UX.

A visual mismatch must be treated as a regression unless the Change Contract
explicitly declares the visual difference as expected.

Never run:

npx playwright test --update-snapshots

unless the Change Contract explicitly authorizes baseline replacement.

## Minimum-change rule

Prefer:

- fewer files changed;
- smaller diffs;
- existing components;
- existing architecture;
- localized modifications.

Avoid refactoring unrelated code merely because it could be improved.

## Required completion report

Every implementation must report:

- files changed;
- requested behaviour implemented;
- tests added or changed;
- regression results;
- visual-regression results;
- known limitations;
- any unexpected impact discovered.