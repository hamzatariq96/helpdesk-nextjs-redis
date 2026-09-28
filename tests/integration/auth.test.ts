import { login, LOGIN_ATTEMPTS } from "@/lib/authService";
import { HttpError } from "@/lib/errors";
import { getSession } from "@/lib/session";
import { makeUser, useCleanState } from "../helpers";

useCleanState();

async function expectStatus(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toBeInstanceOf(HttpError);
  await promise.catch((error: HttpError) => expect(error.status).toBe(status));
}

describe("login", () => {
  it("opens a session for valid credentials", async () => {
    const user = await makeUser("Sara Khan", "admin");

    const result = await login("sara.khan@example.com", "correct-horse", "10.0.0.1");

    expect(result.user).toEqual(user);
    expect(await getSession(result.sessionId)).toEqual(user);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await makeUser("Sara Khan");

    await expectStatus(login("sara.khan@example.com", "wrong", "10.0.0.1"), 401);
    await expectStatus(login("nobody@example.com", "wrong", "10.0.0.1"), 401);
  });

  it("blocks after too many failed attempts, even with the right password", async () => {
    await makeUser("Sara Khan");
    for (let i = 0; i < LOGIN_ATTEMPTS; i++) {
      await expectStatus(login("sara.khan@example.com", "wrong", "10.0.0.1"), 401);
    }

    await expectStatus(login("sara.khan@example.com", "correct-horse", "10.0.0.1"), 429);
  });

  it("does not let one address lock the account for others", async () => {
    await makeUser("Sara Khan");
    for (let i = 0; i < LOGIN_ATTEMPTS; i++) {
      await login("sara.khan@example.com", "wrong", "10.0.0.1").catch(() => undefined);
    }

    await expect(login("sara.khan@example.com", "correct-horse", "10.0.0.2")).resolves.toHaveProperty("sessionId");
  });

  it("clears the counter after a successful login", async () => {
    await makeUser("Sara Khan");
    for (let i = 0; i < LOGIN_ATTEMPTS - 1; i++) {
      await login("sara.khan@example.com", "wrong", "10.0.0.1").catch(() => undefined);
    }
    await login("sara.khan@example.com", "correct-horse", "10.0.0.1");

    for (let i = 0; i < LOGIN_ATTEMPTS - 1; i++) {
      await login("sara.khan@example.com", "wrong", "10.0.0.1").catch(() => undefined);
    }
    await expect(login("sara.khan@example.com", "correct-horse", "10.0.0.1")).resolves.toHaveProperty("sessionId");
  });
});
