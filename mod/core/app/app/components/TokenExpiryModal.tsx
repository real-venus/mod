"use client";
import React, { useEffect, useState } from 'react';
import { userContext } from '@/context/UserContext';
import { Auth } from '@/client/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface TokenExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TokenExpiryModal: React.FC<TokenExpiryModalProps> = ({ isOpen, onClose }) => {
  const { signIn } = userContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletMode, setWalletMode] = useState<string>('local');

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      setWalletMode(localStorage.getItem('wallet_mode') || 'local');
    }
  }, [isOpen]);

  const handleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const auth = new Auth();
      const walletAddress = localStorage.getItem('wallet_address');
      const mode = localStorage.getItem('wallet_mode') || 'local';

      // Generate new token
      const newToken = await auth.token('', walletAddress, mode);
      localStorage.setItem('wallet_token', newToken);

      // Re-sign in to update context
      await signIn();
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh session');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="bg-black border-4 border-yellow-500/60 rounded-2xl p-8 max-w-md w-full shadow-2xl"
              style={{
                boxShadow: '0 0 40px rgba(234, 179, 8, 0.3), inset 0 0 20px rgba(234, 179, 8, 0.1)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning Icon */}
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-yellow-500/20 rounded-full">
                  <ExclamationTriangleIcon className="w-16 h-16 text-yellow-500" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-3xl font-black text-yellow-500 text-center mb-4 uppercase tracking-wider">
                Session Expired
              </h2>

              {/* Message */}
              <p className="text-white/80 text-center mb-6 font-mono text-sm">
                {walletMode === 'local' 
                  ? 'Your session has expired. Click below to refresh your authentication.'
                  : 'Your session has expired. Please sign in with your wallet to continue.'}
              </p>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border-2 border-red-500/40 rounded-xl">
                  <p className="text-red-400 text-xs font-bold text-center">❌ {error}</p>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full py-4 bg-yellow-500/20 hover:bg-yellow-500/30 border-2 border-yellow-500/60 hover:border-yellow-500 text-yellow-500 rounded-xl font-black text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  boxShadow: '0 0 20px rgba(234, 179, 8, 0.2)'
                }}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                    <span>SIGNING IN...</span>
                  </div>
                ) : (
                  <span>🔐 SIGN IN AGAIN</span>
                )}
              </button>

              {/* Info Text */}
              <p className="text-white/50 text-center mt-4 text-xs font-mono">
                {walletMode === 'local' 
                  ? 'Local key will be used automatically'
                  : 'Your wallet will prompt you to sign'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TokenExpiryModal;