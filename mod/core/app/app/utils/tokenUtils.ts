/**
 * Token utility functions for managing authentication tokens
 */

import { Auth } from '@/client/auth';

/**
 * Check if a token is expired or about to expire
 * @param token - The token to check
 * @param bufferSeconds - Buffer time in seconds before considering token expired (default: 300 = 5 minutes)
 * @returns true if token is expired or about to expire
 */
export function isTokenExpiringSoon(token: string, bufferSeconds: number = 300): boolean {
  try {
    const auth = new Auth();
    const authData = auth.token2data(token);
    const tokenTime = parseFloat(authData.time);
    const currentTime = Date.now() / 1000;
    const age = currentTime - tokenTime;

    // Default maxAge is 3600 seconds (1 hour)
    const maxAge = 3600;

    // Check if token age is approaching maxAge
    return age >= (maxAge - bufferSeconds);
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true; // Treat invalid tokens as expired
  }
}

/**
 * Get a fresh token from localStorage or refresh if needed
 * Uses per-account token caching to avoid regenerating tokens when switching accounts
 * @param walletAddress - The wallet address
 * @param walletMode - The wallet mode (local, metamask, etc.)
 * @returns Promise<string> - Fresh token
 */
export async function getFreshToken(
  walletAddress?: string | null,
  walletMode?: string | null
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const storedAddress = walletAddress || localStorage.getItem('wallet_address');
    const storedMode = walletMode || localStorage.getItem('wallet_mode') || 'local';

    if (!storedAddress) {
      console.error('No wallet address found');
      return null;
    }

    // Use per-account token cache
    const tokenCacheKey = `wallet_token_${storedAddress.toLowerCase()}`;
    const cachedToken = localStorage.getItem(tokenCacheKey);

    // If token doesn't exist or is expiring soon, refresh it
    if (!cachedToken || isTokenExpiringSoon(cachedToken)) {
      console.log(`Token for ${storedAddress} is missing or expiring soon, refreshing...`);
      const auth = new Auth();
      const newToken = await auth.token('', storedAddress, storedMode);

      // Cache token for this specific account
      localStorage.setItem(tokenCacheKey, newToken);

      // Also update the global wallet_token for backwards compatibility
      localStorage.setItem('wallet_token', newToken);

      // Update user data in localStorage
      const storedUser = localStorage.getItem('user_data');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          parsedUser.token = newToken;
          localStorage.setItem('user_data', JSON.stringify(parsedUser));
        } catch (e) {
          console.error('Failed to update user data with new token:', e);
        }
      }

      return newToken;
    }

    // Update global wallet_token to match cached token
    localStorage.setItem('wallet_token', cachedToken);

    return cachedToken;
  } catch (error) {
    console.error('Error getting fresh token:', error);
    return null;
  }
}

/**
 * Handle API errors and check for token expiry errors
 * @param error - The error object or response
 * @returns true if the error is a token expiry error
 */
export function isTokenExpiryError(error: any): boolean {
  if (!error) return false;

  // Check if it's an API error response
  if (error.error && typeof error.error === 'string') {
    return error.error.includes('Token is stale') || error.error.includes('stale');
  }

  // Check if it's an exception
  const errorMsg = error.message || error.toString();
  return errorMsg.includes('Token is stale') || errorMsg.includes('stale');
}
