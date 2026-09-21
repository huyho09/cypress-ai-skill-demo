---
ticket: SUR-1
title: Member login with email and password
source: https://example.atlassian.net/browse/SUR-1
generated: 2026-09-17
---

# SUR-1 — Member login with email and password

## Scope

Covers signing in to Surveyz with an email address and password: the successful
path through to the dashboard, the credential-rejection path, the form's own
validation gate, and the two criteria that cannot be verified by an automated
run against the UAT environment.

## Test Cases

### SUR-1-TC-01 — Valid credentials land on the dashboard with account info in the header

- **Priority:** P1
- **Type:** E2E
- **Automate:** yes

**Preconditions**
- An active member account exists, supplied as `TEST_USER` / `TEST_PASS`.

**Steps**
1. Visit the login page.
2. Enter the member's email address and leave the field.
3. Enter the member's password and leave the field.
4. Submit the form.

**Expected**
- The login request returns 200.
- The URL becomes `/dashboard/home`.
- The header greets the member by first name and shows the reward balance.

### SUR-1-TC-02 — An incorrect password keeps the member on the login page

- **Priority:** P1
- **Type:** E2E
- **Automate:** yes

**Preconditions**
- The email address of `TEST_USER` is registered.

**Steps**
1. Visit the login page.
2. Enter the registered email address.
3. Enter a password that is not the account's password.
4. Submit the form.

**Expected**
- The URL is still the login page.
- An error message is shown.
- The error does not state whether the email address is registered.

### SUR-1-TC-03 — The Login button stays disabled until both fields are valid

- **Priority:** P2
- **Type:** E2E
- **Automate:** yes

**Steps**
1. Visit the login page.
2. Observe the Login button with both fields empty.
3. Enter a valid email address and leave the field, with the password still empty.
4. Enter a password.

**Expected**
- The button is disabled while both fields are empty.
- The button is still disabled with only the email address filled in.
- The button becomes enabled once both fields hold valid values.

### SUR-1-TC-04 — The password field masks its value

- **Priority:** P3
- **Type:** Manual
- **Automate:** no

**Steps**
1. Visit the login page.
2. Type a password into the password field.

**Expected**
- The characters are replaced by mask characters on screen.

**Notes**
- Asserting `type="password"` would pass while the rendered text is still
  readable, so this is checked by eye rather than automated.

### SUR-1-TC-05 — Members outside Australia see the geo-restriction modal

- **Priority:** P2
- **Type:** E2E
- **Automate:** no

**Preconditions**
- A client IP address outside Australia.

**Steps**
1. Visit the login page from a non-Australian IP address.

**Expected**
- The geo-restriction modal is shown and cannot be dismissed.
- The dashboard is not reachable.

**Notes**
- The automated suite stubs the country lookup to `AU` so results do not depend
  on the runner's location. Stubbing it to a different country would only prove
  the stub works, not that the restriction holds, so this stays a manual check
  from a real non-AU connection.

## Open Questions

- TC-02: the ticket requires the error not to reveal whether the email address
  is registered, but does not give the copy. The test asserts only that an error
  appears and that it does not contain the submitted address — tighten it once
  the wording is confirmed.
