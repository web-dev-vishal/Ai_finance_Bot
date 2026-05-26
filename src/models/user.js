/**
 * User model — stores registered users with hashed passwords.
 * Passwords are hashed with bcryptjs (12 rounds) before storage.
 */
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import dbConnection from '../config/database.js';

const SALT_ROUNDS = 12;

class UserModel {
  constructor() {
    this.collection = null;
  }

  initialize() {
    this.collection = dbConnection.getDatabase().collection('users');
  }

  // ── Register ──────────────────────────────────────────────────────────────
  /**
   * Create a new user. Throws if email already exists.
   * @param {{ name: string, email: string, password: string }} args
   * @returns {Promise<{ _id, name, email, createdAt }>}
   */
  async create({ name, email, password }) {
    if (!name?.trim())  throw new Error('Name is required.');
    if (!email?.trim()) throw new Error('Email is required.');
    if (!password)      throw new Error('Password is required.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');

    const normalizedEmail = email.trim().toLowerCase();

    // Check for duplicate
    const existing = await this.collection.findOne({ email: normalizedEmail });
    if (existing) throw new Error(`An account with email "${normalizedEmail}" already exists.`);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const doc = {
      name:         name.trim(),
      email:        normalizedEmail,
      passwordHash,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    };

    const result = await this.collection.insertOne(doc);
    const { passwordHash: _ph, ...safe } = doc;
    return { ...safe, _id: result.insertedId };
  }

  // ── Find by email ─────────────────────────────────────────────────────────
  async findByEmail(email) {
    if (!email) return null;
    return await this.collection.findOne({ email: email.trim().toLowerCase() });
  }

  // ── Find by ID ────────────────────────────────────────────────────────────
  async findById(id) {
    if (!id || !/^[a-f\d]{24}$/i.test(id)) return null;
    return await this.collection.findOne({ _id: new ObjectId(id) });
  }

  // ── Verify password ───────────────────────────────────────────────────────
  /**
   * Returns the user document (without passwordHash) if credentials are valid.
   * Returns null if email not found or password is wrong.
   */
  async verifyCredentials(email, password) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return null;

    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  // ── Update password ───────────────────────────────────────────────────────
  async updatePassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { passwordHash, updatedAt: new Date() } }
    );
  }
}

export default new UserModel();
