import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  const { app } = buildApp(
    { CLIENT_ORIGIN: "http://localhost:5173", LOG_LEVEL: "silent" },
    () => 3,
  );
  afterEach(() => app.close());

  it("returns status, uptime and room count", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      uptime: expect.any(Number),
      rooms: 3,
    });
  });
});
