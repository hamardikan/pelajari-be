import bcrypt from 'bcryptjs';

export type PasswordValidationResult = {
  isValid: boolean;
  errors: string[];
  score: number;
};

export type PasswordHashingConfig = {
  saltRounds: number;
};

const DEFAULT_SALT_ROUNDS = 12;

function hashPassword(password: string, saltRounds: number = DEFAULT_SALT_ROUNDS): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (error, hash) => {
      if (error) {
        reject(error);
      } else if (hash) {
        resolve(hash);
      } else {
        reject(new Error('Hash generation failed'));
      }
    });
  });
}

function comparePassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (error, result) => {
      if (error) {
        reject(error);
      } else if (typeof result === 'boolean') {
        resolve(result);
      } else {
        reject(new Error('Password comparison failed'));
      }
    });
  });
}

function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // Length validation
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  // Uppercase letter validation
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Lowercase letter validation
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Number validation
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character validation
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Common password patterns
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters (3+ times)
    /123456|654321/, // Sequential numbers
    /abcdef|fedcba/, // Sequential letters
    /password|Password|PASSWORD/, // Common words
    /qwerty|QWERTY/, // Keyboard patterns
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common patterns or sequences');
      score = Math.max(0, score - 1);
      break;
    }
  }

  // Entropy bonus
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.8) {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(10, score), // Cap score at 10
  };
}

function generateSalt(rounds: number = DEFAULT_SALT_ROUNDS): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.genSalt(rounds, (error, salt) => {
      if (error) {
        reject(error);
      } else if (salt) {
        resolve(salt);
      } else {
        reject(new Error('Salt generation failed'));
      }
    });
  });
}

function getPasswordStrengthLevel(score: number): 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' {
  if (score <= 2) return 'very-weak';
  if (score <= 4) return 'weak';
  if (score <= 6) return 'fair';
  if (score <= 8) return 'good';
  return 'strong';
}

function createPasswordUtils(config: PasswordHashingConfig = { saltRounds: DEFAULT_SALT_ROUNDS }) {
  return {
    hashPassword: (password: string) => hashPassword(password, config.saltRounds),
    comparePassword,
    validatePasswordStrength,
    generateSalt: () => generateSalt(config.saltRounds),
    getPasswordStrengthLevel,
  };
}

function isPasswordExpired(passwordCreatedAt: Date, maxAgeInDays: number): boolean {
  const now = new Date();
  const ageInMs = now.getTime() - passwordCreatedAt.getTime();
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
  
  return ageInDays > maxAgeInDays;
}

function generateRandomPassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  // Ensure at least one character from each category
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateSalt,
  getPasswordStrengthLevel,
  createPasswordUtils,
  isPasswordExpired,
  generateRandomPassword,
}; 