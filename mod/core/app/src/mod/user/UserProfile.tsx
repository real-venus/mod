import React, { useState, useEffect } from 'react';
import { UserType } from '@/mod/types';

interface UserProfileProps {
  user: UserType;
  isOpen: boolean;
  onClose: () => void;
  keyInstance: any;
}

export default function UserProfile({ user, isOpen, onClose, keyInstance }: UserProfileProps) {
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifySignature, setVerifySignature] = useState('');
  const [verifyPublicKey, setVerifyPublicKey] = useState('');
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [signResult, setSignResult] = useState<string | null>(null);
  const [autoVerifyResult, setAutoVerifyResult] = useState<string | null>(null);

  useEffect(() => {
    if (signature && message && keyInstance) {
      const publicKey = keyInstance.publicKey || keyInstance.public_key || user.key;
      try {
        const isValid = keyInstance.verify(message, signature, publicKey);
        setAutoVerifyResult(isValid ? '✓ Valid' : '✗ Invalid');
      } catch (error) {
        setAutoVerifyResult(`✗ Error: ${error}`);
      }
    } else {
      setAutoVerifyResult(null);
    }
  }, [signature, message, keyInstance, user.key]);

  const handleSign = () => {
    if (!message.trim()) {
      setSignResult('✗ Enter message');
      return;
    }
    try {
      const sig = keyInstance.sign(message);
      setSignature(sig);
      setSignResult('✓ Signed');
    } catch (error) {
      setSignResult(`✗ Error: ${error}`);
      setSignature('');
    }
  };

  const handleVerify = () => {
    if (!verifyMessage.trim() || !verifySignature.trim() || !verifyPublicKey.trim()) {
      setVerifyResult('✗ All fields required');
      return;
    }
    try {
      const isValid = keyInstance.verify(verifyMessage, verifySignature, verifyPublicKey);
      setVerifyResult(isValid ? '✓ Valid' : '✗ Invalid');
    } catch (error) {
      setVerifyResult(`✗ Error: ${error}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const useMyPublicKey = () => {
    const publicKey = keyInstance?.publicKey || keyInstance?.public_key || user.key;
    setVerifyPublicKey(publicKey);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-black border-l border-gray-800 z-50 overflow-y-auto font-mono" style={{ fontFamily: 'IBM Plex Mono, Courier New, monospace' }}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">USER PROFILE</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>

          <div className="mb-6 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">ADDRESS:</span>
              <span className="text-white text-xs break-all">{user.key}</span>
              <button onClick={() => copyToClipboard(user.key)} className="text-gray-400 hover:text-white">📋</button>
            </div>
            <div><span className="text-gray-400">TYPE:</span> <span className="text-white">{user.crypto_type || 'UNKNOWN'}</span></div>
            <div><span className="text-gray-400">BALANCE:</span> <span className="text-white">{user.balance || 0}</span></div>
          </div>

          <div className="mb-6 p-3 border border-gray-800 rounded">
            <h3 className="text-sm mb-3 text-white font-bold">SIGN MESSAGE</h3>
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-gray-400 text-xs">MESSAGE:</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-black border border-gray-800 text-white p-2 rounded text-sm" rows={3} placeholder="Enter message..." />
              </div>
              <button onClick={handleSign} className="w-full bg-white text-black py-2 px-3 rounded font-bold hover:bg-gray-200 transition text-sm">SIGN</button>
              {signResult && <div className={`p-2 rounded text-xs ${signResult.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{signResult}</div>}
              {signature && (
                <div>
                  <label className="block mb-1 text-gray-400 text-xs">SIGNATURE:</label>
                  <div className="relative">
                    <textarea value={signature} readOnly className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs" rows={3} />
                    <button onClick={() => copyToClipboard(signature)} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xs">📋</button>
                  </div>
                </div>
              )}
              {autoVerifyResult && <div className={`p-2 rounded border text-xs font-bold ${autoVerifyResult.startsWith('✓') ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-red-900/30 border-red-700 text-red-400'}`}>{autoVerifyResult}</div>}
            </div>
          </div>

          <div className="mb-6 p-3 border border-gray-800 rounded">
            <h3 className="text-sm mb-3 text-white font-bold">VERIFY SIGNATURE</h3>
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-gray-400 text-xs">MESSAGE:</label>
                <textarea value={verifyMessage} onChange={(e) => setVerifyMessage(e.target.value)} className="w-full bg-black border border-gray-800 text-white p-2 rounded text-sm" rows={3} placeholder="Enter message..." />
              </div>
              <div>
                <label className="block mb-1 text-gray-400 text-xs">SIGNATURE:</label>
                <textarea value={verifySignature} onChange={(e) => setVerifySignature(e.target.value)} className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs" rows={3} placeholder="Paste signature..." />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-gray-400 text-xs">PUBLIC KEY:</label>
                  <button onClick={useMyPublicKey} className="text-xs bg-gray-800 text-white py-1 px-2 rounded hover:bg-gray-700">USE MY KEY</button>
                </div>
                <input type="text" value={verifyPublicKey} onChange={(e) => setVerifyPublicKey(e.target.value)} className="w-full bg-black border border-gray-800 text-white p-2 rounded text-xs" placeholder="Enter public key..." />
              </div>
              <button onClick={handleVerify} className="w-full bg-white text-black py-2 px-3 rounded font-bold hover:bg-gray-200 transition text-sm">VERIFY</button>
              {verifyResult && <div className={`p-2 rounded border text-xs font-bold ${verifyResult.startsWith('✓') ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-red-900/30 border-red-700 text-red-400'}`}>{verifyResult}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
