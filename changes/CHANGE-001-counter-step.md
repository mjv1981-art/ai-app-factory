# CHANGE-001 — Counter increments by two

## Request

Change the counter button so that each click increases the counter by 2 instead of 1.

## Business intent

This is the first controlled change used to validate the AI application factory.

## Acceptance criteria

- [ ] AC-01: On initial page load the button displays `Count is 0`.
- [ ] AC-02: After one click the button displays `Count is 2`.
- [ ] AC-03: After two clicks the button displays `Count is 4`.
- [ ] AC-04: Existing page layout and styling remain unchanged.

## Expected functional changes

Counter increment changes from +1 per click to +2 per click.

## Expected visual changes

NONE on initial page load.

Only the number displayed inside the counter button changes after the user interacts with it.

## Must remain unchanged

- page layout;
- typography;
- colours;
- spacing;
- navigation;
- Documentation section;
- Connect with us section;
- assets and logos;
- initial visual state;
- existing visual-regression baseline.

## Out of scope

- redesign;
- CSS refactoring;
- dependency upgrades;
- component restructuring;
- changes to GitHub Actions;
- changes to Playwright configuration.

## Regression scenarios

- REG-001: Home page loads correctly.
- REG-002: Initial counter displays `Count is 0`.
- REG-003: One click results in `Count is 2`.
- REG-004: Two clicks result in `Count is 4`.

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