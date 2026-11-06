/**
 * Maps Supabase Auth errors to user-facing text. Server/network failures get
 * their own message so a broken setup is never reported as a user mistake.
 */
export function describeAuthError(error: { status?: number; code?: string; message?: string }, fallback: string): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Verify your email to continue. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "Choose a stronger password.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "signup_disabled":
      return "New sign-ups are currently turned off.";
    case "over_email_send_rate_limit":
      return "Too many emails were sent. Wait a few minutes and try again.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "same_password":
      return "Choose a password different from your current one.";
  }
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (!error.status || error.status >= 500) return "The sign-in service couldn't complete this request. Try again in a moment.";
  return error.message || fallback;
}
