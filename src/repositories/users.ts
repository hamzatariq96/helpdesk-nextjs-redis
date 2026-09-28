import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Role, UserRef } from "@/lib/types";

export interface UserRecord {
  id: number;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { rows } = await pool.query(
    `SELECT id, email, name, role, password_hash AS "passwordHash" FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function listAssignableUsers(): Promise<UserRef[]> {
  const { rows } = await pool.query(`SELECT id, name FROM users ORDER BY name`);
  return rows;
}

export async function createUser(input: { email: string; name: string; password: string; role: Role }): Promise<UserRecord> {
  const passwordHash = await hashPassword(input.password);
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, password_hash AS "passwordHash"`,
    [input.email.toLowerCase(), input.name, passwordHash, input.role],
  );
  return rows[0];
}
