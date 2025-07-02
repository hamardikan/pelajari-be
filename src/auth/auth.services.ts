import type { Logger } from 'pino';
import type { AuthRepository, UserRecord } from './auth.repositories.js';
import type { LoginData, RegisterData, RefreshTokenData, ChangePasswordData, UpdateProfileData } from './auth.schemas.js';
import type { createJwtUtils } from '../shared/utils/jwt.js';
import type { createPasswordUtils } from '../shared/utils/password.js';

import { createUnauthorizedError, createBusinessLogicError, createValidationError } from '../shared/middleware/error.middleware.js';

export type AuthServiceDependencies = {
  authRepository: AuthRepository;
  logger: Logger;
  jwtUtils: ReturnType<typeof createJwtUtils>;
  passwordUtils: ReturnType<typeof createPasswordUtils>;
};

export type LoginResult = {
  user: UserPublic;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
};

export type UserPublic = {
  id: string;
  name: string;
  email: string;
  role: string;
  managerId?: string;
  isActive: boolean;
  profileData: {
    avatar?: string;
    bio?: string;
    skills: string[];
    goals: string[];
  };
  createdAt: Date;
  updatedAt: Date;
};

export type AuthService = {
  registerUser: (userData: RegisterData) => Promise<UserPublic>;
  loginUser: (credentials: LoginData) => Promise<LoginResult>;
  refreshToken: (refreshData: RefreshTokenData) => Promise<LoginResult>;
  logout: (userId: string) => Promise<void>;
  changePassword: (userId: string, passwordData: ChangePasswordData) => Promise<void>;
  updateProfile: (userId: string, profileData: UpdateProfileData) => Promise<UserPublic>;
  getUserProfile: (userId: string) => Promise<UserPublic>;
  deactivateAccount: (userId: string, reason?: string) => Promise<void>;
  assignManager: (userId: string, managerId: string) => Promise<void>;
  getUsersByManager: (managerId: string) => Promise<UserPublic[]>;
  updateUserRole: (userId: string, role: 'user' | 'manager') => Promise<void>;
};

function sanitizeUser(userRecord: UserRecord): UserPublic {
  return {
    id: userRecord.id,
    name: userRecord.data.name,
    email: userRecord.data.email,
    role: userRecord.data.role,
    managerId: userRecord.data.managerId,
    isActive: userRecord.data.isActive,
    profileData: userRecord.data.profileData,
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
  };
}

function createAuthService(dependencies: AuthServiceDependencies): AuthService {
  const { authRepository, logger, jwtUtils, passwordUtils } = dependencies;

  async function registerUser(userData: RegisterData): Promise<UserPublic> {
    logger.info({ email: userData.email, role: userData.role }, 'Starting user registration');

    // Check if email already exists
    const existingUser = await authRepository.findUserByEmail(userData.email);

    if (existingUser) {
      throw createBusinessLogicError('User with this email already exists');
    }

    // Validate manager hierarchy if role is user and managerId is provided
    if (userData.role === 'user' && userData.managerId) {
      const manager = await authRepository.findUserById(userData.managerId);

      if (!manager) {
        throw createValidationError('Invalid manager ID provided');
      }

      if (manager.data.role !== 'manager') {
        throw createValidationError('Assigned manager must have manager role');
      }

      if (!manager.data.isActive) {
        throw createValidationError('Assigned manager is not active');
      }
    }

    // Hash password
    const hashedPassword = await passwordUtils.hashPassword(userData.password);

    // Create user
    const createUserData = {
      name: userData.name,
      email: userData.email,
      hashedPassword,
      role: userData.role,
      managerId: userData.managerId,
    };

    const newUser = await authRepository.createUser(createUserData);

    logger.info({ userId: newUser.id, email: userData.email }, 'User registered successfully');
    return sanitizeUser(newUser);
  }

  async function loginUser(credentials: LoginData): Promise<LoginResult> {
    logger.info({ email: credentials.email }, 'Starting user login');

    // Find user by email
    const user = await authRepository.findUserByEmail(credentials.email);

    if (!user) {
      logger.warn({ email: credentials.email }, 'Login attempt with non-existent email');
      throw createUnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (!user.data.isActive) {
      logger.warn({ userId: user.id, email: credentials.email }, 'Login attempt by deactivated user');
      throw createUnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await passwordUtils.comparePassword(
      credentials.password,
      user.data.hashedPassword
    );

    if (!isPasswordValid) {
      logger.warn({ userId: user.id, email: credentials.email }, 'Login attempt with invalid password');
      throw createUnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.data.email,
      role: user.data.role,
      managerId: user.data.managerId,
    };

    const tokens = await jwtUtils.generateTokenPair(tokenPayload);

    // Update last login
    await authRepository.updateLastLogin(user.id);

    logger.info({ userId: user.id, email: credentials.email }, 'User logged in successfully');

    return {
      user: sanitizeUser(user),
      tokens,
    };
  }

  async function refreshToken(refreshData: RefreshTokenData): Promise<LoginResult> {
    logger.debug('Processing token refresh');

    // Verify refresh token
    const tokenResult = await jwtUtils.verifyRefreshToken(refreshData.refreshToken);

    if (!tokenResult.success || !tokenResult.payload) {
      logger.warn('Invalid refresh token provided');
      throw createUnauthorizedError('Invalid refresh token');
    }

    const { userId } = tokenResult.payload;

    // Find user
    const user = await authRepository.findUserById(userId);

    if (!user) {
      logger.warn({ userId }, 'Refresh token for non-existent user');
      throw createUnauthorizedError('User not found');
    }

    // Check if user is still active
    if (!user.data.isActive) {
      logger.warn({ userId }, 'Refresh token for deactivated user');
      throw createUnauthorizedError('Account is deactivated');
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user.id,
      email: user.data.email,
      role: user.data.role,
      managerId: user.data.managerId,
    };

    const tokens = await jwtUtils.generateTokenPair(tokenPayload);

    logger.info({ userId }, 'Token refreshed successfully');

    return {
      user: sanitizeUser(user),
      tokens,
    };
  }

  async function logout(userId: string): Promise<void> {
    logger.info({ userId }, 'User logout');
    // In a real implementation, you might want to invalidate tokens
    // For now, we just log the logout event
    // Token invalidation would require a token blacklist or similar mechanism
  }

  async function changePassword(userId: string, passwordData: ChangePasswordData): Promise<void> {
    logger.info({ userId }, 'Starting password change');

    // Find user
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw createUnauthorizedError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await passwordUtils.comparePassword(
      passwordData.currentPassword,
      user.data.hashedPassword
    );

    if (!isCurrentPasswordValid) {
      logger.warn({ userId }, 'Password change attempt with invalid current password');
      throw createUnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await passwordUtils.hashPassword(passwordData.newPassword);

    // Update password
    await authRepository.updateUserPassword(userId, hashedNewPassword);

    logger.info({ userId }, 'Password changed successfully');
  }

  async function updateProfile(userId: string, profileData: UpdateProfileData): Promise<UserPublic> {
    logger.info({ userId }, 'Updating user profile');

    const updatedUser = await authRepository.updateUserProfile(userId, profileData);

    logger.info({ userId }, 'User profile updated successfully');
    return sanitizeUser(updatedUser);
  }

  async function getUserProfile(userId: string): Promise<UserPublic> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw createUnauthorizedError('User not found');
    }

    return sanitizeUser(user);
  }

  async function deactivateAccount(userId: string, reason?: string): Promise<void> {
    logger.info({ userId, reason }, 'Deactivating user account');

    await authRepository.deactivateUser(userId, reason);

    logger.info({ userId }, 'User account deactivated successfully');
  }

  async function assignManager(userId: string, managerId: string): Promise<void> {
    logger.info({ userId, managerId }, 'Assigning manager to user');

    // Verify manager exists and has correct role
    const manager = await authRepository.findUserById(managerId);

    if (!manager) {
      throw createValidationError('Manager not found');
    }

    if (manager.data.role !== 'manager') {
      throw createValidationError('Assigned user must have manager role');
    }

    if (!manager.data.isActive) {
      throw createValidationError('Manager is not active');
    }

    await authRepository.assignManager(userId, managerId);

    logger.info({ userId, managerId }, 'Manager assigned successfully');
  }

  async function getUsersByManager(managerId: string): Promise<UserPublic[]> {
    const users = await authRepository.findUsersByManager(managerId);

    return users.map(sanitizeUser);
  }

  async function updateUserRole(userId: string, role: 'user' | 'manager'): Promise<void> {
    logger.info({ userId, role }, 'Updating user role');

    await authRepository.updateUserRole(userId, role);

    logger.info({ userId, role }, 'User role updated successfully');
  }

  return {
    registerUser,
    loginUser,
    refreshToken,
    logout,
    changePassword,
    updateProfile,
    getUserProfile,
    deactivateAccount,
    assignManager,
    getUsersByManager,
    updateUserRole,
  };
}

export { createAuthService, sanitizeUser }; 