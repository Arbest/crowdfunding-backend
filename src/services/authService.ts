import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { UserRole } from '../types/index.js';
import type { IUserDocument } from '../types/index.js';

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  user: IUserDocument;
  token: string;
  expiresAt: Date;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { email, password, firstName, lastName } = input;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    roles: [UserRole.USER],
  });

  // Create session
  const { token, expiresAt } = await createSession(user._id.toString());

  return { user, token, expiresAt };
}

export async function login(input: LoginInput, ip?: string, userAgent?: string): Promise<AuthResult> {
  const { email, password } = input;

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Create session
  const { token, expiresAt } = await createSession(user._id.toString(), ip, userAgent);

  return { user, token, expiresAt };
}

export async function logout(sessionId: string): Promise<void> {
  await Session.findByIdAndDelete(sessionId);
}

export async function logoutAll(userId: string): Promise<void> {
  await Session.deleteMany({ userId });
}

async function createSession(
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({
    userId,
    tokenHash,
    expiresAt,
    ip,
    userAgent,
  });

  return { token, expiresAt };
}

export async function refreshSession(sessionId: string): Promise<{ expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await Session.findByIdAndUpdate(sessionId, { expiresAt });

  return { expiresAt };
}
