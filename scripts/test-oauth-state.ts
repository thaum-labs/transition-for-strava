import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { resetEnvCacheForTests } from "../src/lib/env";
import { createOAuthState, verifyOAuthState } from "../src/lib/oauthState";

const SECRET = "test-session-secret-at-least-32-chars-long!!";

function setTestEnv(secret = SECRET) {
  process.env.SESSION_SECRET = secret;
  process.env.STRAVA_CLIENT_ID = "12345";
  process.env.STRAVA_CLIENT_SECRET = "test-client-secret";
  process.env.STRAVA_REDIRECT_URI =
    "http://localhost:3000/api/auth/strava/callback";
  process.env.APP_BASE_URL = "http://localhost:3000";
  resetEnvCacheForTests();
}

describe("signed OAuth state (no cookie)", () => {
  before(() => setTestEnv());

  it("creates a verifiable state without any cookie", async () => {
    const state = await createOAuthState();
    assert.equal(typeof state, "string");
    assert.equal(state.split(".").length, 3);
    assert.equal(await verifyOAuthState(state), true);
  });

  it("rejects tampered state", async () => {
    const state = await createOAuthState();
    const tampered = `${state.slice(0, -6)}AAAAAA`;
    assert.equal(await verifyOAuthState(tampered), false);
  });

  it("rejects empty / garbage state", async () => {
    assert.equal(await verifyOAuthState(""), false);
    assert.equal(await verifyOAuthState("not-a-jwt"), false);
    assert.equal(await verifyOAuthState("a.b.c"), false);
  });

  it("rejects state signed with a different secret", async () => {
    const state = await createOAuthState();
    setTestEnv("different-secret-also-at-least-32-chars!");
    assert.equal(await verifyOAuthState(state), false);
    setTestEnv(SECRET);
  });

  it("round-trips multiple independent states", async () => {
    const a = await createOAuthState();
    const b = await createOAuthState();
    assert.notEqual(a, b);
    assert.equal(await verifyOAuthState(a), true);
    assert.equal(await verifyOAuthState(b), true);
  });
});

describe("OAuth start → callback handlers (desktop-safe, no state cookie)", () => {
  before(() => setTestEnv());

  it("start redirects to Strava with a signed state query param", async () => {
    const { GET: start } = await import("../app/api/auth/strava/start/route");
    const res = await start();
    assert.equal(res.status, 302);
    const location = res.headers.get("location");
    assert.ok(location, "missing Location header");
    const url = new URL(location!);
    assert.equal(url.hostname, "www.strava.com");
    assert.equal(url.pathname, "/oauth/authorize");
    const state = url.searchParams.get("state");
    assert.ok(state);
    assert.equal(await verifyOAuthState(state!), true);
    // Must not require setting an oauth-state cookie to succeed
    const setCookie = res.headers.getSetCookie?.() ?? [];
    assert.equal(
      setCookie.some((c) => c.startsWith("pp_oauth_state=")),
      false,
    );
  });

  it("callback accepts signed state with no pp_oauth_state cookie", async () => {
    const state = await createOAuthState();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth/token")) {
        return Response.json({
          access_token: "access-token-test",
          refresh_token: "refresh-token-test",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }) as typeof fetch;

    try {
      const { GET: callback } = await import(
        "../app/api/auth/strava/callback/route"
      );
      const req = new Request(
        `http://localhost:3000/api/auth/strava/callback?code=test-code&state=${encodeURIComponent(state)}&scope=activity:read_all`,
        { headers: { host: "localhost:3000", "x-forwarded-proto": "http" } },
      );
      // Intentionally no Cookie header — desktop/mobile must work without it
      const res = await callback(req);
      assert.equal(res.status, 200, await res.clone().text());
      const body = await res.text();
      assert.match(body, /\/activities/);
      const cookies = res.headers.getSetCookie();
      assert.ok(
        cookies.some((c) => c.startsWith("pp_session=")),
        `expected pp_session cookie, got: ${cookies.join(" | ")}`,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("callback rejects missing cookie AND invalid state (still Invalid OAuth state)", async () => {
    const { GET: callback } = await import(
      "../app/api/auth/strava/callback/route"
    );
    const req = new Request(
      "http://localhost:3000/api/auth/strava/callback?code=test-code&state=forged",
      { headers: { host: "localhost:3000" } },
    );
    const res = await callback(req);
    assert.equal(res.status, 400);
    assert.match(await res.text(), /Invalid OAuth state/);
  });

  it("simulates desktop cookie loss: valid signed state still logs in", async () => {
    // Reproduces the desktop failure mode of the old cookie-based flow:
    // start "sets" a cookie that never arrives, but signed state is in the URL.
    const { GET: start } = await import("../app/api/auth/strava/start/route");
    const startRes = await start();
    const location = startRes.headers.get("location")!;
    const state = new URL(location).searchParams.get("state")!;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes("oauth/token")) {
        return Response.json({
          access_token: "a",
          refresh_token: "r",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      throw new Error(`Unexpected fetch: ${input}`);
    }) as typeof fetch;

    try {
      const { GET: callback } = await import(
        "../app/api/auth/strava/callback/route"
      );
      // No Cookie header at all — what desktop sees when Set-Cookie was dropped
      const res = await callback(
        new Request(
          `https://transitionforstrava.com/api/auth/strava/callback?code=abc&state=${encodeURIComponent(state)}`,
          {
            headers: {
              host: "transitionforstrava.com",
              "x-forwarded-proto": "https",
              "x-forwarded-host": "transitionforstrava.com",
            },
          },
        ),
      );
      assert.equal(res.status, 200, await res.clone().text());
      assert.ok(
        res.headers.getSetCookie().some((c) => c.startsWith("pp_session=")),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
