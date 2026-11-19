---
name: test-review
description: Use when reviewing the tests in a FoodMe pull request or branch diff (apps/backend, apps/web, apps/admin), in CI or locally, to report badly written tests and production changes that have no test.
---

# Test review

You review **tests only**. General code review is done by a different job. Report exactly two things:

1. **Bad tests**: new or changed tests that are wrong, weak, flaky or break house style.
2. **Missing tests**: production changes in the diff that no test covers.

You don't edit files, run tests or push. CI already builds and runs the suites.

## 1. Collect the change

- CI (PR number given): `gh pr view <n> --json title,body,headRefName,baseRefName,files` and `gh pr diff <n>`.
- Local, branch checked out: `git diff main...HEAD` and `git log main..HEAD --oneline`.
- Local, branch not checked out (`<ref>`, e.g. `origin/feature/x`): `git diff main...<ref>`, and read its files with `git show "${REF}:path"` (braces matter in zsh). `Grep` only sees the working tree, so check coverage on that branch with `git grep <pattern> <ref> -- apps/`.

Sort every changed file into one bucket:

| App | Test files | Production files |
|---|---|---|
| backend | `apps/backend/src/test/**` | `apps/backend/src/main/**` |
| web | `apps/web/e2e/**` | `apps/web/src/**` |
| admin | `apps/admin/e2e/**` | `apps/admin/src/**` |

Ignore everything else (CI, docs, rules, lockfiles, Dockerfiles). Read the **whole** test file and the production code it exercises, not just the diff hunk. Before calling a test missing, `Grep` the existing suite: an older test may already cover it.

Web and admin have **no unit-test runner**. Their only tests are Playwright specs in `e2e/`, so a "missing test" there means a missing e2e scenario.

## 2. Bad tests: checklist

Flag a test only when you can point at the line and say what goes wrong.

**All apps**
- No assertion, or the assertion can't fail (asserts on a value the test itself set).
- Asserts only "success" (`status().isOk()`, `toBeVisible()` on a page shell) when the behaviour under test is a value: a total, a status, which items show, an error message.
- Test name doesn't match what it checks, or one test checks several unrelated behaviours. Acting and then reading the result back (POST, then GET to confirm) is one behaviour, not two.
- Depends on another test running first, on execution order, on global counts, or on unsorted list order.
- Fixed sleeps: `Thread.sleep`, `page.waitForTimeout`. `SimulatedLatencyConfig` adds 200–1500 ms to every API call, so sleeps are flaky by design here.
- Swallows failures: `try/catch` around the act step, conditional `if (visible)` branches, `.catch(() => {})`.
- Disabled or focused: `@Disabled`, `test.skip`, `test.only`, `test.fixme` without a ticket reference.
- Copies a pattern from a test marked `FM-FLAKE-nn`.

**Backend** (house style is in the `backend-tests` skill; read it)
- Error case asserts the status but not `$.message`.
- Protected endpoint tested without the anonymous `isUnauthorized()` case, or without the wrong-role `isForbidden()` case where a role applies.
- Hand-written JSON strings instead of `objectMapper.writeValueAsString(Map.of(...))`; JSON field names that differ from the API contract.
- Mutates seed rows from `data.sql`, or creates data that isn't unique per test (no `UUID`).
- Uses `@TestMethodOrder` / `@Order`.
- Gives itself a private datasource or context (`@TestPropertySource`, `@DirtiesContext`) to dodge interference from other tests, instead of making its assertions independent.
- Unit test that starts Spring (`@SpringBootTest`) for pure logic, mocks the class under test, or mocks DTOs/entities.
- `verify(...)` on interactions when the result could be asserted instead.
- URL built from constants instead of a literal path.
- Name not in `action_condition_expectedResult` form; class or method made `public`.

**Web and admin (Playwright)**
- `data-testid` added to app code or used in a spec.
- New selectors on CSS classes or DOM structure where a role, label or text selector exists.
- Non-retrying assertions: `expect(await locator.textContent()).toBe(...)`, `expect(await locator.isVisible()).toBe(true)`. Use `await expect(locator).toHaveText(...)` / `toBeVisible()`.
- Hardcoded `http://localhost:...` for the app under test instead of `baseURL` (calls to the backend API via `VITE_API_BASE_URL` fallback are fine).
- Relies on specific seed IDs or names that the deployed data may not have, instead of picking from the list.
- Web specs run `fullyParallel`: shared state between tests (module-level variables, one cart across tests) is a bug.
- Admin: logs in with copied steps instead of the shared `loginAsAdmin` helper.

## 3. Missing tests: what needs coverage

| Change in the diff | Needs |
|---|---|
| New or changed backend endpoint | `<Controller>Test` cases: happy path, each `BadRequestException` / validation branch with its message, 404, 401 anonymous, 403 wrong role or not the owner |
| New branch in a service (validation, state check, calculation, ownership check) | A test that reaches that branch, integration or unit |
| New request DTO constraint (`@NotNull`, `@Min`, `@Size`...) or a field with no constraint that the DB limits | A test that sends the invalid value |
| Uniqueness / "only once" rule | A test that does it twice |
| Arithmetic (rounding, averages, totals) | A test with values where the rounding choice changes the result |
| Bug fix (`fix/` branch, `fix(...)` commit or a bug ticket) | A regression test that would fail without the fix |
| New web page, route, form or user flow | A spec in `apps/web/e2e/` that drives it, including a validation error from the zod schema |
| New admin page, field or action | A spec in `apps/admin/e2e/` |
| Flyway migration | No test can prove it (tests use H2 with Flyway off). Say so as a note, not a missing test |

No test needed for: styling, copy or translation-only changes, logging, config, renames, and the intentional demo behaviour listed in `CLAUDE.md` (`SimulatedLatencyConfig`, `FlakyHeartbeatJob`, `/api/debug/boom`, `HttpLoggingFilter`).

For each gap, name the concrete case and the **correct** expected result, like "cancelling another customer's order → 403", not "add more tests". If reading the code tells you that test would fail today, add "likely fails today": that's a bug the test would catch. One row per case. Values that hit the same branch (0 and 6 for a 1–5 range) share a row.

## 4. Severity

- **High**: a test that passes while the feature is broken; no test for an auth, ownership, payment, data-integrity or security rule (XSS, injection), or for a case marked "likely fails today"; a bug fix with no regression test.
- **Medium**: a missing validation, edge or error case; a weak assertion; a flaky pattern.
- **Low**: naming, selector style, duplication.

## 5. Report

Every report uses one of the templates in `templates/`. Copy the template and replace each `{{...}}` placeholder. Don't add, rename or reorder sections.

| Situation | Template |
|---|---|
| At least one bad test or missing test, any severity | `templates/report-issues.md` |
| No bad tests and no missing tests, or no files under `apps/` changed | `templates/report-passed.md`, copied **verbatim** |

- `report-passed.md` is static. The quality gate looks for its exact line `✅ Everything passed`. Never write that line in any other report, and never use the passed template when you found even one Low finding.
- In `report-issues.md`: one table row per finding, numbered `B1, B2…` and `M1, M2…`, sorted High → Low. If a table has no rows, replace the table with `None.` Delete the `### Notes` section if you have no notes. Notes never affect the result.

**CI** (the prompt gives a PR number and a report path):
1. For each bad test, post an inline comment on its line with `mcp__github_inline_comment__create_inline_comment` (`confirmed: true`), using `templates/inline-comment.md`. Keep the first line `<!-- claude-test-review -->`: the workflow uses it to delete old inline comments when it re-runs. Missing tests are never inline.
2. Write the filled report to the report path with `Write`. **Don't** post it yourself. The workflow posts it and replaces the previous report comment on the PR.

**Local:** print the filled report.
