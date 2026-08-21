# CHANGE-003 - Add Reset button

## Request

Add a visible `Reset` button next to the existing counter. Do not change the rest of the page.

## Business intent

Allow users to reset the counter through a clear, dedicated control while preserving all existing counter behaviour and unrelated page content.

## Acceptance criteria

- [ ] AC-01: On initial page load, the counter displays `Count is 0` and a button labelled `Reset` is visible next to it.
- [ ] AC-02: A normal click on the counter continues to increase the count by 2.
- [ ] AC-03: Shift-clicking the counter continues to reset the count to 0.
- [ ] AC-04: Clicking `Reset` after the count has increased resets the count to 0.
- [ ] AC-05: Clicking `Reset` when the count is already 0 leaves it at 0 without an error.
- [ ] AC-06: The `Reset` control is implemented as an accessible button identifiable by its `Reset` name.
- [ ] AC-07: No page content, functionality, or layout changes occur outside the counter-control area.

## Expected functional changes

New behaviour:

- clicking the dedicated `Reset` button sets the counter value to 0.

Existing behaviour must remain:

- the initial counter value is 0;
- a normal counter click increments the value by 2;
- Shift-clicking the counter resets the value to 0.

## Expected visual changes

A single visible button labelled `Reset` is added next to the counter.

Only the counter-control area may change sufficiently to place the two controls next to each other. No other visual change is expected.

## Must remain unchanged

- initial counter text `Count is 0`;
- normal +2 counter behaviour;
- Shift-click reset behaviour;
- hero artwork, logos, heading, and introductory text;
- Documentation section and its links;
- Connect with us section and its links;
- page typography and colour palette;
- page borders, decorative ticks, and spacer;
- layout and spacing outside the counter-control area;
- responsive behaviour outside the counter-control area;
- existing external link targets;
- application dependencies and configuration.

## Out of scope

- removing or changing Shift-click reset behaviour;
- changing the counter increment amount;
- adding confirmation, notification, animation, persistence, or disabled states;
- changing text other than adding the `Reset` label;
- redesigning unrelated controls or page sections;
- broad CSS refactoring or component restructuring;
- dependency upgrades;
- changes to Playwright configuration or GitHub Actions;
- changes to visual-regression thresholds.

## Regression scenarios

- REG-001: The home page loads and the `Get started` heading remains visible.
- REG-002: The initial counter displays `Count is 0`.
- REG-003: One normal counter click displays `Count is 2`.
- REG-004: Two normal counter clicks display `Count is 4`.
- REG-005: Shift-clicking the counter when it displays `Count is 4` resets it to `Count is 0`.
- REG-006: Clicking `Reset` when the counter displays a non-zero value resets it to `Count is 0`.
- REG-007: After a reset, a normal counter click displays `Count is 2`.
- REG-008: Clicking `Reset` while the counter displays `Count is 0` leaves it at `Count is 0`.
- REG-009: Existing Documentation and Connect with us content and links remain present.

## Visual regression scope

- Full home page on initial load: the only approved difference is the addition of the `Reset` button next to the counter and the minimum local spacing/layout adjustment required for it.
- Counter-control area at supported desktop and responsive viewport sizes: both controls remain adjacent and usable without overlapping or clipping.
- Hero, introductory content, Documentation section, Connect with us section, decorative ticks, borders, and spacer: no visual differences are permitted.

## Test evidence required

- [x] automated functional tests;
- [x] visual comparison;
- [x] screenshot evidence;
- [x] Playwright trace;
- [x] video where useful.

## Baseline changes authorized?

YES.

Only `tests/home.spec.js-snapshots/home-page-chromium-win32.png` may be updated, because the explicitly requested visible `Reset` button necessarily changes the approved initial home-page screenshot. The replacement baseline may differ only in the counter-control area. No other baseline or QA threshold may change.

## Human notes

Implement the smallest possible localized change. Existing Playwright selectors that assume the page contains only one button must be made specific enough to distinguish the counter button from the new `Reset` button. Do not modify repository files while preparing this contract.
## Human visual approval

- Status: APPROVED
- Date: 2026-08-21
- Approved visual change: visible Reset button adjacent to the existing counter.
- Authorized baseline update:
  	ests/home.spec.js-snapshots/home-page-chromium-win32.png
- No other visual baseline changes are authorized.
- Human reviewed the Playwright Actual screenshot before approval.