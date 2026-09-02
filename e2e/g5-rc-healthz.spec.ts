import { expect, test } from "@playwright/test";

test("G5 RC healthz checks the approved public database boundary", async ({ request }) => {
  const response = await request.get("/api/healthz");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toMatchObject({ ok: true, db: "up" });
  expect(typeof body.ts).toBe("number");
});
