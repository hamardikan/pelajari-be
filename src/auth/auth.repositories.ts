import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { users } from '../db/schema.js';
import type { UserData } from '../db/schema.js';
import type { RegisterData, UpdateProfileData } from './auth.schemas.js';

export type CreateUserData = Omit<RegisterData, 'password'> & {
  hashedPassword: string;
};

export type UserRecord = {
  id: string;
  data: UserData;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthRepository = {
  findUserByEmail: (email: string) => Promise<UserRecord | null>;
  findUserById: (userId: string) => Promise<UserRecord | null>;
  createUser: (userData: CreateUserData) => Promise<UserRecord>;
  updateUserPassword: (userId: string, hashedPassword: string) => Promise<void>;
  updateUserProfile: (userId: string, profileData: UpdateProfileData) => Promise<UserRecord>;
  deactivateUser: (userId: string, reason?: string) => Promise<void>;
  updateLastLogin: (userId: string) => Promise<void>;
  findUsersByManager: (managerId: string) => Promise<UserRecord[]>;
  assignManager: (userId: string, managerId: string) => Promise<void>;
  updateUserRole: (userId: string, role: 'user' | 'manager') => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  getUserCount: () => Promise<number>;
  findActiveUsers: (limit?: number, offset?: number) => Promise<UserRecord[]>;
};

function createAuthRepository(db: Database, logger: Logger): AuthRepository {
  async function findUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      logger.debug({ email }, 'Finding user by email');
      
      const result = await db
        .select()
        .from(users)
        .where(eq(sql`${users.data}->>'email'`, email))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ email }, 'User not found by email');
        return null;
      }

      const user = result[0];
      if (!user) {
        return null;
      }
      
      return {
        id: user.id,
        data: user.data as UserData,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      logger.error({ error, email }, 'Error finding user by email');
      throw error;
    }
  }

  async function findUserById(userId: string): Promise<UserRecord | null> {
    try {
      logger.debug({ userId }, 'Finding user by ID');
      
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ userId }, 'User not found by ID');
        return null;
      }

      const user = result[0];
      if (!user) {
        return null;
      }
      
      return {
        id: user.id,
        data: user.data as UserData,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error finding user by ID');
      throw error;
    }
  }

  async function createUser(userData: CreateUserData): Promise<UserRecord> {
    try {
      logger.info({ email: userData.email, role: userData.role }, 'Creating new user');
      
      const userDataToStore: UserData = {
        email: userData.email,
        hashedPassword: userData.hashedPassword,
        name: userData.name,
        role: userData.role,
        managerId: userData.managerId,
        isActive: true,
        profileData: {
          skills: [],
          goals: [],
        },
      };

      const result = await db
        .insert(users)
        .values({
          data: userDataToStore,
        })
        .returning();

      const newUser = result[0];
      if (!newUser) {
        throw new Error('Failed to create user - no result returned');
      }
      
      logger.info({ userId: newUser.id, email: userData.email }, 'User created successfully');

      return {
        id: newUser.id,
        data: newUser.data as UserData,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };
    } catch (error) {
      logger.error({ error, email: userData.email }, 'Error creating user');
      throw error;
    }
  }

  async function updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    try {
      logger.info({ userId }, 'Updating user password');
      
      await db
        .update(users)
        .set({
          data: sql`jsonb_set(${users.data}, '{hashedPassword}', ${JSON.stringify(hashedPassword)})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.info({ userId }, 'User password updated successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Error updating user password');
      throw error;
    }
  }

  async function updateUserProfile(userId: string, profileData: UpdateProfileData): Promise<UserRecord> {
    try {
      logger.info({ userId }, 'Updating user profile');
      
      const updateData: Record<string, unknown> = {};
      
      if (profileData.name) {
        updateData.name = profileData.name;
      }
      
      if (profileData.profileData) {
        updateData.profileData = profileData.profileData;
      }

      await db
        .update(users)
        .set({
          data: sql`${users.data} || ${JSON.stringify(updateData)}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      const updatedUser = await findUserById(userId);
      if (!updatedUser) {
        throw new Error('User not found after update');
      }

      logger.info({ userId }, 'User profile updated successfully');
      return updatedUser;
    } catch (error) {
      logger.error({ error, userId }, 'Error updating user profile');
      throw error;
    }
  }

  async function deactivateUser(userId: string, reason?: string): Promise<void> {
    try {
      logger.info({ userId, reason }, 'Deactivating user');
      
      await db
        .update(users)
        .set({
          data: sql`jsonb_set(${users.data}, '{isActive}', 'false')`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.info({ userId }, 'User deactivated successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Error deactivating user');
      throw error;
    }
  }

  async function updateLastLogin(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      await db
        .update(users)
        .set({
          data: sql`jsonb_set(${users.data}, '{lastLoginAt}', ${JSON.stringify(now)})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.debug({ userId }, 'User last login updated');
    } catch (error) {
      logger.error({ error, userId }, 'Error updating last login');
      throw error;
    }
  }

  async function findUsersByManager(managerId: string): Promise<UserRecord[]> {
    try {
      logger.debug({ managerId }, 'Finding users by manager');
      
      const result = await db
        .select()
        .from(users)
        .where(eq(sql`${users.data}->>'managerId'`, managerId));

      return result.map(user => ({
        id: user.id,
        data: user.data as UserData,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    } catch (error) {
      logger.error({ error, managerId }, 'Error finding users by manager');
      throw error;
    }
  }

  async function assignManager(userId: string, managerId: string): Promise<void> {
    try {
      logger.info({ userId, managerId }, 'Assigning manager to user');
      
      await db
        .update(users)
        .set({
          data: sql`jsonb_set(${users.data}, '{managerId}', ${JSON.stringify(managerId)})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.info({ userId, managerId }, 'Manager assigned successfully');
    } catch (error) {
      logger.error({ error, userId, managerId }, 'Error assigning manager');
      throw error;
    }
  }

  async function updateUserRole(userId: string, role: 'user' | 'manager'): Promise<void> {
    try {
      logger.info({ userId, role }, 'Updating user role');
      
      await db
        .update(users)
        .set({
          data: sql`jsonb_set(${users.data}, '{role}', ${JSON.stringify(role)})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.info({ userId, role }, 'User role updated successfully');
    } catch (error) {
      logger.error({ error, userId, role }, 'Error updating user role');
      throw error;
    }
  }

  async function checkEmailExists(email: string): Promise<boolean> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(sql`${users.data}->>'email'`, email));

      return Number(result[0]?.count) > 0;
    } catch (error) {
      logger.error({ error, email }, 'Error checking email existence');
      throw error;
    }
  }

  async function getUserCount(): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(sql`${users.data}->>'isActive'`, 'true'));

      return Number(result[0]?.count) || 0;
    } catch (error) {
      logger.error({ error }, 'Error getting user count');
      throw error;
    }
  }

  async function findActiveUsers(limit: number = 50, offset: number = 0): Promise<UserRecord[]> {
    try {
      logger.debug({ limit, offset }, 'Finding active users');
      
      const result = await db
        .select()
        .from(users)
        .where(eq(sql`${users.data}->>'isActive'`, 'true'))
        .limit(limit)
        .offset(offset);

      return result.map(user => ({
        id: user.id,
        data: user.data as UserData,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    } catch (error) {
      logger.error({ error, limit, offset }, 'Error finding active users');
      throw error;
    }
  }

  return {
    findUserByEmail,
    findUserById,
    createUser,
    updateUserPassword,
    updateUserProfile,
    deactivateUser,
    updateLastLogin,
    findUsersByManager,
    assignManager,
    updateUserRole,
    checkEmailExists,
    getUserCount,
    findActiveUsers,
  };
}

export { createAuthRepository }; 