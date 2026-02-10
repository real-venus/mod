"use client";
import { Auth } from './auth';
import { toast } from 'react-toastify';

export class TokenExpiryHandler {
  private auth: Auth;
  private checkInterval: NodeJS.Timeout | null = null;
  private onExpiry: () => void;
  private walletMode: string;

  constructor(
    auth: Auth,
    onExpiry: () => void,
    private checkIntervalMs: number = 60000 // Check every minute
  ) {
    this.auth = auth;
    this.onExpiry = onExpiry;
    this.walletMode = typeof localStorage !== 'undefined' 
      ? localStorage.getItem('wallet_mode') || 'local'
      : 'local';
  }

  /**
   * Start monitoring token expiry
   */
  public startMonitoring(): void {
    this.stopMonitoring();
    
    this.checkInterval = setInterval(() => {
      this.checkTokenExpiry();
    }, this.checkIntervalMs);

    // Also check immediately
    this.checkTokenExpiry();
  }

  /**
   * Stop monitoring token expiry
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if token is expired and trigger appropriate action
   */
  private checkTokenExpiry(): void {
    if (typeof localStorage === 'undefined') return;

    const token = localStorage.getItem('wallet_token');
    if (!token) {
      this.handleExpiredToken();
      return;
    }

    try {
      const isExpired = this.isTokenExpired(token);
      if (isExpired) {
        this.handleExpiredToken();
      }
    } catch (error) {
      console.error('Error checking token expiry:', error);
      this.handleExpiredToken();
    }
  }

  /**
   * Handle expired token based on wallet mode
   */
  private handleExpiredToken(): void {
    // Always attempt auto-refresh for all wallet modes
    this.autoRefreshToken();
  }

  /**
   * Auto-refresh token for all wallet modes
   */
  private async autoRefreshToken(): Promise<void> {
    try {
      const walletAddress = localStorage.getItem('wallet_address');
      const walletMode = localStorage.getItem('wallet_mode') || 'local';

      console.log(`Auto-refreshing token for ${walletMode} wallet...`);
      const newToken = await this.auth.token('', walletAddress, walletMode);
      localStorage.setItem('wallet_token', newToken);

      console.log(`✅ Token auto-refreshed successfully for ${walletMode} wallet`);

      // Update the client with the new token
      if (typeof window !== 'undefined' && (window as any).__userContextClient) {
        (window as any).__userContextClient.token = newToken;
      }

      // Show success notification
      toast.success('🔐 Session refreshed automatically', {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error('Failed to auto-refresh token:', error);
      // Show error notification
      toast.error('⚠️ Session refresh failed - please sign in', {
        position: 'bottom-right',
        autoClose: 5000,
      });
      // Only show popup if auto-refresh fails
      this.showSignInPopup();
    }
  }

  /**
   * Show sign-in popup for wallet browser keys
   */
  private showSignInPopup(): void {
    this.stopMonitoring();
    this.onExpiry();
  }

  /**
   * Check if token is expired (helper method)
   */
  public isTokenExpired(token: string, bufferSeconds: number = 300): boolean {
    try {
      const authData = this.auth.token2data(token);
      const tokenTime = parseFloat(authData.time);
      const currentTime = Date.now() / 1000;
      const age = currentTime - tokenTime;
      
      // Check if token age exceeds maxAge minus buffer
      return age >= ((this.auth as any)['maxAge'] - bufferSeconds);
    } catch (error) {
      return true; // Treat invalid tokens as expired
    }
  }
}

export default TokenExpiryHandler;
