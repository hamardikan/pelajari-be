import { z } from 'zod';

// Login schema
const loginSchema = z.object({
  email: z.string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'Password is required'),
});

// Registration schema
const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  email: z.string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  role: z.enum(['user', 'manager'], {
    errorMap: () => ({ message: 'Role must be either "user" or "manager"' }),
  }).default('user'),
  managerId: z.string()
    .uuid('Manager ID must be a valid UUID')
    .optional(),
});

// Token refresh schema
const refreshTokenSchema = z.object({
  refreshToken: z.string()
    .min(1, 'Refresh token is required'),
});

// Password reset request schema
const requestPasswordResetSchema = z.object({
  email: z.string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
});

// Password reset confirmation schema
const confirmPasswordResetSchema = z.object({
  token: z.string()
    .min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string()
    .min(1, 'Password confirmation is required'),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// Change password schema (for authenticated users)
const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string()
    .min(1, 'Password confirmation is required'),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  }
);

// Update profile schema
const updateProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim()
    .optional(),
  profileData: z.object({
    avatar: z.string().url('Avatar must be a valid URL').optional(),
    bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
    skills: z.array(z.string().trim().min(1)).max(20, 'Maximum 20 skills allowed').optional(),
    goals: z.array(z.string().trim().min(1)).max(10, 'Maximum 10 goals allowed').optional(),
  }).optional(),
});

// User ID parameter schema
const userIdParamsSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
});

// Manager assignment schema (for managers to assign team members)
const assignManagerSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  managerId: z.string().uuid('Manager ID must be a valid UUID'),
});

// Role update schema (for admin operations)
const updateUserRoleSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  role: z.enum(['user', 'manager'], {
    errorMap: () => ({ message: 'Role must be either "user" or "manager"' }),
  }),
});

// Account deactivation schema
const deactivateAccountSchema = z.object({
  reason: z.string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
  password: z.string()
    .min(1, 'Password is required for account deactivation'),
});

// Type exports for use in handlers and services
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type RefreshTokenData = z.infer<typeof refreshTokenSchema>;
export type RequestPasswordResetData = z.infer<typeof requestPasswordResetSchema>;
export type ConfirmPasswordResetData = z.infer<typeof confirmPasswordResetSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type AssignManagerData = z.infer<typeof assignManagerSchema>;
export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;
export type DeactivateAccountData = z.infer<typeof deactivateAccountSchema>;

// Schema collection for easy import
const authSchemas = {
  login: loginSchema,
  register: registerSchema,
  refreshToken: refreshTokenSchema,
  requestPasswordReset: requestPasswordResetSchema,
  confirmPasswordReset: confirmPasswordResetSchema,
  changePassword: changePasswordSchema,
  updateProfile: updateProfileSchema,
  userIdParams: userIdParamsSchema,
  assignManager: assignManagerSchema,
  updateUserRole: updateUserRoleSchema,
  deactivateAccount: deactivateAccountSchema,
};

export {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  changePasswordSchema,
  updateProfileSchema,
  userIdParamsSchema,
  assignManagerSchema,
  updateUserRoleSchema,
  deactivateAccountSchema,
  authSchemas,
}; 