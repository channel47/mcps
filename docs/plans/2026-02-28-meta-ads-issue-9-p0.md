# Meta Ads Issue #9 (P0) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all P0 blockers from issue #9 so `meta-ads` is safe and functionally complete for pre-publish checks.

**Architecture:** Keep changes local to `meta-ads` request/tool layers. Move auth from querystring to headers in the shared HTTP client, add missing insights query surface (`breakdowns`) in tool schema + request param builder, and reuse cursor pagination logic pattern in `list_accounts` so account enumeration is complete.

**Tech Stack:** Node.js ESM, native `node:test`, MCP server schema in `server/index.js`.

---

### Task 1: Move Graph auth token out of URL query params

**Files:**
- Modify: `meta-ads/test/http.test.js`
- Modify: `meta-ads/server/http.js`
- Modify: `meta-ads/README.md`

**Step 1: Write the failing test**

Add/replace HTTP tests to assert:
- URL does **not** include `access_token=...`
- `Authorization: Bearer <token>` is sent in request headers

**Step 2: Run test to verify it fails**

Run: `cd meta-ads && node --test test/http.test.js`
Expected: FAIL due to old URL-token behavior.

**Step 3: Write minimal implementation**

Update `metaRequest` in `server/http.js`:
- Remove token arg from URL builder
- Stop setting `access_token` search param
- Add `Authorization` header with bearer token

Update README behavior note to reflect header-based auth.

**Step 4: Run test to verify it passes**

Run: `cd meta-ads && node --test test/http.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add meta-ads/server/http.js meta-ads/test/http.test.js meta-ads/README.md
git commit -m "fix(meta-ads): send access token via authorization header"
```

### Task 2: Add `breakdowns` support to `query` insights requests

**Files:**
- Modify: `meta-ads/test/query.test.js`
- Modify: `meta-ads/server/tools/query.js`
- Modify: `meta-ads/server/index.js`
- Modify: `meta-ads/README.md`

**Step 1: Write the failing test**

Add query test for `entity: "insights"` with `breakdowns: ["age","gender"]` asserting serialized request param:
- `capturedParams.breakdowns === "age,gender"`

**Step 2: Run test to verify it fails**

Run: `cd meta-ads && node --test test/query.test.js`
Expected: FAIL because `breakdowns` is not currently passed through.

**Step 3: Write minimal implementation**

In `buildBaseParams` for insights:
- Accept optional `breakdowns` array
- Join and set `queryParams.breakdowns`

In `server/index.js`:
- Add schema property for `breakdowns` as array of strings

Update README insights params section to document `breakdowns`.

**Step 4: Run test to verify it passes**

Run: `cd meta-ads && node --test test/query.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add meta-ads/server/tools/query.js meta-ads/server/index.js meta-ads/test/query.test.js meta-ads/README.md
git commit -m "feat(meta-ads): support insights breakdown dimensions"
```

### Task 3: Add cursor pagination to `list_accounts`

**Files:**
- Modify: `meta-ads/test/list-accounts.test.js`
- Modify: `meta-ads/server/tools/list-accounts.js`

**Step 1: Write the failing test**

Add test where mocked request returns:
- first page with cursor + one account
- second page with additional account

Assert:
- both pages are requested
- final response contains merged accounts
- `after` cursor is passed on follow-up request

**Step 2: Run test to verify it fails**

Run: `cd meta-ads && node --test test/list-accounts.test.js`
Expected: FAIL because current tool only reads first `response.data`.

**Step 3: Write minimal implementation**

Implement `fetchAllPages` loop in `list-accounts.js`:
- start from base params
- keep requesting while `paging.cursors.after` exists
- merge all `data` rows before mapping/filtering

**Step 4: Run test to verify it passes**

Run: `cd meta-ads && node --test test/list-accounts.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add meta-ads/server/tools/list-accounts.js meta-ads/test/list-accounts.test.js
git commit -m "fix(meta-ads): paginate list_accounts across graph cursors"
```

### Task 4: Full regression for P0 scope

**Files:**
- Test: `meta-ads/test/*.test.js`

**Step 1: Run full meta-ads tests**

Run: `cd meta-ads && npm test`
Expected: PASS all suites.

**Step 2: Quick static contract check**

Run: `cd meta-ads && node --test test/index-schema.test.js`
Expected: PASS and schema changes included.

**Step 3: Commit (if doing a single combined commit instead of per-task commits)**

```bash
git add meta-ads docs/plans/2026-02-28-meta-ads-issue-9-p0.md
git commit -m "fix(meta-ads): resolve issue #9 p0 blockers"
```
