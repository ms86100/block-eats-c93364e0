import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps technical/system error messages to user-friendly text.
 * Use in catch blocks instead of showing raw error.message.
 */
export function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const lower = msg.toLowerCase();

  if (lower.includes('jwt') || lower.includes('token') || lower.includes('refresh_token')) {
    return 'Your session has expired. Please log in again.';
  }
  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
    return "You don't have permission for this action.";
  }
  if (lower.includes('networkerror') || lower.includes('failed to fetch') || lower.includes('network request failed')) {
    return 'Please check your internet connection and try again.';
  }
  if (lower.includes('duplicate key') || lower.includes('unique constraint') || lower.includes('already exists')) {
    return 'This entry already exists. Please try a different value.';
  }
  if (lower.includes('not found') || lower.includes('no rows')) {
    return 'The requested item was not found. It may have been removed.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request took too long. Please try again.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email before logging in. Check your inbox.';
  }
  if (lower.includes('storage') && lower.includes('quota')) {
    return 'Storage limit reached. Please free up space and try again.';
  }

  // Fallback: return original if it looks user-friendly (short, no technical jargon)
  if (msg.length > 0 && msg.length < 120 && !lower.includes('error') && !lower.includes('exception')) {
    return msg;
  }

  return 'Something went wrong. Please try again.';
}
