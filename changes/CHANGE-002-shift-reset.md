# CHANGE-002 — Shift-click resets counter

## Request

Add an additional interaction to the existing counter.

A normal click must continue increasing the counter by 2.

Holding Shift while clicking the counter must reset it to 0.

## Business intent

Validate that the autonomous AI factory can implement and verify a behavioural
change while preserving existing functionality and visual appearance.

## Acceptance criteria

- [ ] AC-01: Initial counter displays `Count is 0`.
- [ ] AC-02: One normal click displays `Count is 2`.
- [ ] AC-03: Two normal clicks display `Count is 4`.
- [ ] AC-04: Shift-click when the counter is 4 resets it to `Count is 0`.
- [ ] AC-05: Existing page layout and styling remain unchanged.

## Expected functional changes

New behaviour:

- Shift + click resets the counter to 0.

Existing behaviour must remain:

- normal click increments by 2.

## Expected visual changes

NONE.

No new controls, labels, text, spacing, colours, or layout changes are requested.

## Must remain unchanged

- normal +2 counter behaviour;
- initial `Count is 0` state;
- page layout;
- typography;
- colours;
- spacing;
- Documentation section;
- Connect with us section;
- assets and logos;
- existing visual-regression baseline.

## Out of scope

- adding a Reset button;
- redesign;
- CSS changes;
- dependency upgrades;
- component restructuring;
- changes to GitHub Actions;
- changes to Playwright configuration;
- golden screenshot updates.

## Regression scenarios

- REG-001: Home page loads correctly.
- REG-002: Initial counter displays `Count is 0`.
- REG-003: One normal click results in `Count is 2`.
- REG-004: Two normal clicks result in `Count is 4`.
- REG-005: Shift-click resets the counter from 4 to 0.

## Visual regression scope

- Full home page on initial load.

## Test evidence required

- [x] automated functional tests;
- [x] visual comparison;
- [x] screenshot evidence;
- [x] Playwright trace;
- [x] video where useful.

## Baseline changes authorized?

NO.

The existing golden screenshot must not be modified.

## Human notes

Implement the smallest possible change.

Do not add a visible Reset control.