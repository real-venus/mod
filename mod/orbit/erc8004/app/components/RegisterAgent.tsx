'use client';

import { useState } from 'react';
import { getSigner, getIdentityContract } from '@/lib/ethereum';
import { AgentMetadata } from '@/types/erc8004';
import { Bot, Upload, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function RegisterAgent() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState<AgentMetadata>({
    name: '',
    description: '',
    version: '1.0.0',
    capabilities: [],
    communicationProtocols: [],
    endpoint: '',
    avatar: '',
  });
  const [capabilityInput, setCapabilityInput] = useState('');
  const [protocolInput, setProtocolInput] = useState('');

  const handleAddCapability = () => {
    if (capabilityInput.trim()) {
      setFormData({
        ...formData,
        capabilities: [...formData.capabilities, capabilityInput.trim()],
      });
      setCapabilityInput('');
    }
  };

  const handleAddProtocol = () => {
    if (protocolInput.trim()) {
      setFormData({
        ...formData,
        communicationProtocols: [...formData.communicationProtocols, protocolInput.trim()],
      });
      setProtocolInput('');
    }
  };

  const handleRemoveCapability = (index: number) => {
    setFormData({
      ...formData,
      capabilities: formData.capabilities.filter((_, i) => i !== index),
    });
  };

  const handleRemoveProtocol = (index: number) => {
    setFormData({
      ...formData,
      communicationProtocols: formData.communicationProtocols.filter((_, i) => i !== index),
    });
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsRegistering(true);
    try {
      // In production, you'd upload metadata to IPFS and get the URI
      const metadataJSON = JSON.stringify(formData);
      const metadataURI = `data:application/json;base64,${btoa(metadataJSON)}`;

      const signer = await getSigner();
      const contract = getIdentityContract();
      const contractWithSigner = contract.connect(signer);

      const tx = await contractWithSigner.registerAgent(metadataURI);
      toast.info('Transaction submitted. Waiting for confirmation...');

      const receipt = await tx.wait();
      const tokenId = receipt.logs[0].topics[1]; // Extract tokenId from event

      toast.success(`Agent registered successfully! Token ID: ${BigInt(tokenId).toString()}`);

      // Reset form
      setFormData({
        name: '',
        description: '',
        version: '1.0.0',
        capabilities: [],
        communicationProtocols: [],
        endpoint: '',
        avatar: '',
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Failed to register agent');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-8 h-8 text-primary-600" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Register AI Agent
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Agent Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="My AI Agent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Describe what your agent does..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Version
            </label>
            <input
              type="text"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Endpoint (Optional)
            </label>
            <input
              type="url"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Capabilities
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={capabilityInput}
              onChange={(e) => setCapabilityInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCapability()}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., text-generation, image-analysis"
            />
            <button
              onClick={handleAddCapability}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.capabilities.map((cap, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm flex items-center gap-2"
              >
                {cap}
                <button
                  onClick={() => handleRemoveCapability(index)}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Communication Protocols
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={protocolInput}
              onChange={(e) => setProtocolInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddProtocol()}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., HTTP, WebSocket, gRPC"
            />
            <button
              onClick={handleAddProtocol}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.communicationProtocols.map((proto, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm flex items-center gap-2"
              >
                {proto}
                <button
                  onClick={() => handleRemoveProtocol(index)}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleRegister}
          disabled={isRegistering || !formData.name || !formData.description}
          className="w-full mt-6 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Register Agent
            </>
          )}
        </button>
      </div>
    </div>
  );
}
