import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface RequestEmailVerificationResponse {
  message: string;
  expiresIn: number;
  code?: string; // Development mode only
}

export interface ConfirmEmailVerificationResponse {
  message: string;
  verified: boolean;
}

export interface CheckEmailExistsResponse {
  exists: boolean;
}

// Check if email exists (mutation - for on-demand checks)
export function useCheckEmailExists() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest<{ data: CheckEmailExistsResponse }>(
        `/auth/check-email?email=${encodeURIComponent(email)}`
      );
      return response.data;
    },
  });
}

// Check if email exists (query - for real-time validation)
export function useEmailDuplicateCheck(email: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['email-check', email],
    queryFn: async () => {
      const response = await apiRequest<{ data: CheckEmailExistsResponse }>(
        `/auth/check-email?email=${encodeURIComponent(email)}`
      );
      return response.data;
    },
    enabled: enabled && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    staleTime: 0,
  });
}

// Request email verification code
export function useRequestEmailVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest<{ data: RequestEmailVerificationResponse }>(
        '/auth/email/request',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      return response.data;
    },
  });
}

// Request email verification code for password reset (email must exist)
export function useRequestEmailVerificationForPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest<{ data: RequestEmailVerificationResponse }>(
        '/auth/email/request-for-password-reset',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      return response.data;
    },
  });
}

// Confirm email verification code
export function useConfirmEmailVerification() {
  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await apiRequest<{ data: ConfirmEmailVerificationResponse }>(
        '/auth/email/confirm',
        {
          method: 'POST',
          body: JSON.stringify({ email, code }),
        }
      );
      return response.data;
    },
  });
}
