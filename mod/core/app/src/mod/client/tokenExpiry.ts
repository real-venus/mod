import { Auth } from './auth';

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
    const walletMode = typeof localStorage !== 'undefined'
      ? localStorage.getItem('wallet_mode') || 'local'
      : 'local';

    if (walletMode === 'local') {
      // For local keys, auto-refresh silently
      this.autoRefreshLocalToken();
    } else {
      // For wallet browser keys (metamask, subwallet, etc), show popup
      this.showSignInPopup();
    }
  }

  /**
   * Auto-refresh token for local keys
   */
  private async autoRefreshLocalToken(): Promise<void> {
    try {
      const walletAddress = localStorage.getItem('wallet_address');
      const newToken = await this.auth.token('', walletAddress, 'local');
      localStorage.setItem('wallet_token', newToken);
      console.log('Token auto-refreshed for local key');
    } catch (error) {
      console.error('Failed to auto-refresh local token:', error);
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
