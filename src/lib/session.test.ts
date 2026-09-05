import { afterEach, describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken, SESSION_DURATION_SECONDS, sessionCookieOptions } from "./session";

const previousSecret = process.env.AUTH_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousSecret;
});

describe("dauerhafte Anmeldung", () => {
  it("kann eine erzeugte Sitzung bei einem späteren Seitenaufruf wieder lesen", async () => {
    process.env.AUTH_SECRET = "test-secret-that-remains-stable";
    const token = await createSessionToken({
      userId: "d8c457c8-2f8a-453a-91fb-f87b4f76ed60",
      username: "admin",
      isAdmin: true,
      mustChangePassword: false,
    });

    await expect(readSessionToken(token)).resolves.toMatchObject({ username: "admin", isAdmin: true });
    expect(sessionCookieOptions).toMatchObject({ sameSite: "lax", path: "/", maxAge: SESSION_DURATION_SECONDS });
  });
});
