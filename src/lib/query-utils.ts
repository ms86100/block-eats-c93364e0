import { toast } from 'sonner';

/**
 * Escapes special characters in user input before using in ILIKE queries.
 * Prevents pattern injection via % and _ characters.
 */
export function escapeIlike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Centralized API error handler.
 * Extracts a human-readable message from various error shapes
 * (Supabase PostgrestError, Error, string, unknown) and shows a toast.
 * 
 * @param error - The caught error
 * @param fallbackMessage - Message to show if error cannot be parsed
 * @returns The extracted error message string
 */
export function handleApiError(
  error: unknown,
  fallbackMessage = 'Something went wrong'
): string {
  let message = fallbackMessage;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Supabase PostgrestError shape: { message, details, hint, code }
    const pgError = error as { message?: string; details?: string };
    message = pgError.message || pgError.details || fallbackMessage;
  } else if (typeof error === 'string') {
    message = error;
  }

  toast.error(message);
  return message;
}
