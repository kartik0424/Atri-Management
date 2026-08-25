import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../db/pool.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { LoginInput } from './auth.validation.js';

const JWT_SECRET = process.env.JWT_SECRET || 'atri-management-secret-key-fallback';
const JWT_EXPIRES_IN = '7d';

export async function login(input: LoginInput) {
  const result = await pool.query(
    'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
    [input.email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(input.password, user.password_hash);

  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    },
  };
}

export async function getCurrentUser(userId: number) {
  const result = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('User not found');
  }

  return result.rows[0];
}
