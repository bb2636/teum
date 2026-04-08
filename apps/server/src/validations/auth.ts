import { z } from 'zod';

// Password validation: 8+ chars, must include letters and numbers
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((val) => /[a-zA-Z]/.test(val), 'Password must include letters and numbers')
  .refine((val) => /[0-9]/.test(val), 'Password must include letters and numbers');

// Nickname validation: 2-12 chars, no spaces, alphanumeric + Korean + underscore
const nicknameSchema = z
  .string()
  .min(2, 'Nickname must be 2-12 characters')
  .max(12, 'Nickname must be 2-12 characters')
  .refine((val) => !val.includes(' '), 'Nickname cannot contain spaces')
  .refine((val) => /^[a-zA-Z0-9가-힣_]+$/.test(val), 'Nickname contains invalid characters');

// Signup validation
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  nickname: nicknameSchema,
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  profileImageUrl: z.string().optional(),
  language: z.enum(['ko', 'en']).optional(),
  termsConsents: z.array(
    z.object({
      termsType: z.string(),
      consented: z.boolean(),
    })
  ),
});

// Login validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Phone verification request
export const phoneVerificationRequestSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
});

// Phone verification confirm
export const phoneVerificationConfirmSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

// Email verification request
export const emailVerificationRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Email verification confirm
export const emailVerificationConfirmSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

// Google OAuth callback
export const googleOAuthCallbackSchema = z.object({
  code: z.string(),
});

// Google OAuth onboarding
export const googleOAuthOnboardingSchema = z.object({
  nickname: z.string().min(1, 'Nickname is required').max(100),
  name: z.string().min(1, 'Name is required').max(100),
  dateOfBirth: z.string().optional(),
  country: z.string().optional(),
  termsConsents: z.array(
    z.object({
      termsType: z.string(),
      consented: z.boolean(),
    })
  ),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PhoneVerificationRequestInput = z.infer<typeof phoneVerificationRequestSchema>;
export type PhoneVerificationConfirmInput = z.infer<typeof phoneVerificationConfirmSchema>;
export type EmailVerificationRequestInput = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationConfirmInput = z.infer<typeof emailVerificationConfirmSchema>;
// Apple OAuth callback
export const appleOAuthCallbackSchema = z.object({
  idToken: z.string(),
  authorizationCode: z.string().optional(),
  user: z.object({
    email: z.string().email().optional(),
    name: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }).optional(),
  }).optional(),
});

// Social onboarding (shared by Google and Apple)
export const socialOnboardingSchema = z.object({
  onboardingToken: z.string(),
  email: z.string().email().optional(),
  nickname: nicknameSchema,
  name: z.string().min(1, 'Name is required').max(100),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
  language: z.enum(['ko', 'en']).optional(),
  termsConsents: z.array(
    z.object({
      termsType: z.string(),
      consented: z.boolean(),
    })
  ),
});

export type GoogleOAuthCallbackInput = z.infer<typeof googleOAuthCallbackSchema>;
export type GoogleOAuthOnboardingInput = z.infer<typeof googleOAuthOnboardingSchema>;
export type AppleOAuthCallbackInput = z.infer<typeof appleOAuthCallbackSchema>;
export type SocialOnboardingInput = z.infer<typeof socialOnboardingSchema>;
