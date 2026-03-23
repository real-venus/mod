'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getValidationContract, getSigner } from '@/lib/ethereum';
import { ValidationProof } from '@/types/erc8004';
import { Shield, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface ValidationPanelProps {
  agentId: string;
}

const PROOF_TYPES = [
  { value: 0, label: 'Optimistic', description: 'Stakers re-run and verify the task' },
  { value: 1, label: 'ZK-Proof', description: 'Zero-knowledge cryptographic proof' },
  { value: 2, label: 'TEE', description: 'Trusted Execution Environment attestation' },
];

const PROOF_STATUS = [
  { value: 0, label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  { value: 1, label: 'Verified', icon: CheckCircle, color: 'text-green-600' },
  { value: 2, label: 'Failed', icon: XCircle, color: 'text-red-600' },
];

export default function ValidationPanel({ agentId }: ValidationPanelProps) {
  const [validations, setValidations] = useState<ValidationProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newValidation, setNewValidation] = useState({
    taskHash: '',
    proofType: 0,
    proofData: '',
  });

  useEffect(() => {
    loadValidations();
  }, [agentId]);

  const loadValidations = async () => {
    setIsLoading(true);
    try {
      const contract = getValidationContract();
      const validationIds = await contract.getAgentValidations(agentId);

      const validationProofs: ValidationProof[] = [];
      for (const id of validationIds) {
        const [agId, taskHash, proofType, validator, status, timestamp] =
          await contract.getValidation(id);

        validationProofs.push({
          id: id.toString(),
          agentId: agId.toString(),
          taskHash,
          proofType: ['optimistic', 'zk-proof', 'tee'][Number(proofType)] as any,
          proofData: '',
          validator,
          status: ['pending', 'verified', 'failed'][Number(status)] as any,
          timestamp: Number(timestamp),
        });
      }

      setValidations(validationProofs);
    } catch (error) {
      console.error('Error loading validations:', error);
      toast.error('Failed to load validation data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitValidation = async () => {
    if (!newValidation.taskHash || !newValidation.proofData) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const signer = await getSigner();
      const contract = getValidationContract();
      const contractWithSigner = contract.connect(signer);

      const proofDataBytes = ethers.toUtf8Bytes(newValidation.proofData);

      const tx = await contractWithSigner.submitValidation(
        agentId,
        newValidation.taskHash,
        newValidation.proofType,
        proofDataBytes
      );

      toast.info('Submitting validation proof...');
      await tx.wait();
      toast.success('Validation proof submitted successfully!');

      setShowSubmitForm(false);
      setNewValidation({ taskHash: '', proofType: 0, proofData: '' });
      loadValidations();
    } catch (error: any) {
      console.error('Error submitting validation:', error);
      toast.error(error.message || 'Failed to submit validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusInfo = (status: string) => {
    return PROOF_STATUS.find(s => s.label.toLowerCase() === status) || PROOF_STATUS[0];
  };

  const getProofTypeInfo = (type: string) => {
    const typeMap: any = { 'optimistic': 0, 'zk-proof': 1, 'tee': 2 };
    return PROOF_TYPES[typeMap[type]] || PROOF_TYPES[0];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Validation Stats */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-xl p-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-900 dark:text-green-100">
              {validations.length}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 flex items-center justify-center gap-1 mt-1">
              <Shield className="w-4 h-4" />
              Total Validations
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-900 dark:text-green-100">
              {validations.filter(v => v.status === 'verified').length}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 flex items-center justify-center gap-1 mt-1">
              <CheckCircle className="w-4 h-4" />
              Verified
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-900 dark:text-green-100">
              {validations.filter(v => v.status === 'pending').length}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 flex items-center justify-center gap-1 mt-1">
              <Clock className="w-4 h-4" />
              Pending
            </div>
          </div>
        </div>
      </div>

      {/* Submit Validation Form */}
      {showSubmitForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Submit Validation Proof
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Task Hash
              </label>
              <input
                type="text"
                value={newValidation.taskHash}
                onChange={(e) => setNewValidation({ ...newValidation, taskHash: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proof Type
              </label>
              <div className="space-y-2">
                {PROOF_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      newValidation.proofType === type.value
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                    }`}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      checked={newValidation.proofType === type.value}
                      onChange={(e) => setNewValidation({ ...newValidation, proofType: Number(e.target.value) })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {type.label}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {type.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proof Data
              </label>
              <textarea
                value={newValidation.proofData}
                onChange={(e) => setNewValidation({ ...newValidation, proofData: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
                placeholder="Enter proof data..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSubmitValidation}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Proof'}
              </button>
              <button
                onClick={() => setShowSubmitForm(false)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowSubmitForm(true)}
          className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Shield className="w-5 h-5" />
          Submit Validation Proof
        </button>
      )}

      {/* Validations List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Validation History
        </h3>
        {validations.length === 0 ? (
          <div className="text-center p-8 text-gray-500 dark:text-gray-400">
            No validations yet
          </div>
        ) : (
          validations.map((validation) => {
            const statusInfo = getStatusInfo(validation.status);
            const StatusIcon = statusInfo.icon;
            const proofTypeInfo = getProofTypeInfo(validation.proofType);

            return (
              <div
                key={validation.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                    <span className={`font-semibold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(validation.timestamp * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded">
                      {proofTypeInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Task:</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white">
                      {validation.taskHash.slice(0, 10)}...{validation.taskHash.slice(-8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Validator:</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white">
                      {validation.validator.slice(0, 6)}...{validation.validator.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
