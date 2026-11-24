import argon2 from 'argon2';

/** argon2id. Tests use a much cheaper cost so the suite stays fast. */
const hashOptions: argon2.HashOptions & { raw?: false } =
    process.env.NODE_ENV === 'test'
        ? {
              type: argon2.argon2id,
              memoryCost: 1024,
              timeCost: 1,
              parallelism: 1,
          }
        : { type: argon2.argon2id };

export function hashPassword(password: string): Promise<string> {
    return argon2.hash(password, hashOptions);
}

export async function verifyPassword(
    hash: string,
    password: string,
): Promise<boolean> {
    try {
        return await argon2.verify(hash, password);
    } catch {
        return false;
    }
}

/**
 * Login verifies against this when the email is unknown, so a missing account
 * takes as long as a wrong password and response time doesn't reveal which
 * emails are registered.
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
    dummyHash ??= hashPassword('dummy-password-for-timing');
    return dummyHash;
}
