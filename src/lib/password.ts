import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when the email doesn't exist, so a wrong email takes as long
// as a wrong password and response time doesn't reveal which accounts exist.
export const DUMMY_HASH = "$2a$10$HwfdYiGNXM/W55Mi7T8JheGXpe.cK5ZXlmbf/uXlZ.a2OtEAoy2uu";
