'use client';

import { useState, useEffect } from 'react';
import { getReputationContract, getSigner } from '@/lib/ethereum';
import { ReputationScore, FeedbackEntry } from '@/types/erc8004';
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface ReputationPanelProps {
  agentId: string;
}

export default function ReputationPanel({ agentId }: ReputationPanelProps) {
  const [reputation, setReputation] = useState<ReputationScore | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    rating: 5,
    comment: '',
    taskHash: '',
  });

  useEffect(() => {
    loadReputation();
  }, [agentId]);

  const loadReputation = async () => {
    setIsLoading(true);
    try {
      const contract = getReputationContract();

      // Get reputation summary
      const [totalFeedback, positiveCount, averageRating] = await contract.getReputation(agentId);

      const reputationScore: ReputationScore = {
        agentId,
        totalFeedback: Number(totalFeedback),
        positiveCount: Number(positiveCount),
        negativeCount: Number(totalFeedback) - Number(positiveCount),
        averageRating: Number(averageRating) / 10, // Assuming rating is stored as 0-100
        reputationScore: Number(positiveCount) / Math.max(Number(totalFeedback), 1) * 100,
      };

      setReputation(reputationScore);

      // Get feedback entries
      const feedbackCount = await contract.getFeedbackCount(agentId);
      const feedbackEntries: FeedbackEntry[] = [];

      for (let i = 0; i < Math.min(Number(feedbackCount), 10); i++) {
        const [reviewer, rating, comment, timestamp] = await contract.getFeedback(agentId, i);
        feedbackEntries.push({
          id: `${agentId}-${i}`,
          agentId,
          reviewer,
          rating: Number(rating),
          comment,
          taskHash: '',
          timestamp: Number(timestamp),
        });
      }

      setFeedback(feedbackEntries);
    } catch (error) {
      console.error('Error loading reputation:', error);
      toast.error('Failed to load reputation data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!newFeedback.comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setIsSubmitting(true);
    try {
      const signer = await getSigner();
      const contract = getReputationContract();
      const contractWithSigner = contract.connect(signer);

      const taskHashBytes = newFeedback.taskHash || '0x0000000000000000000000000000000000000000000000000000000000000000';

      const tx = await contractWithSigner.submitFeedback(
        agentId,
        newFeedback.rating,
        newFeedback.comment,
        taskHashBytes
      );

      toast.info('Submitting feedback...');
      await tx.wait();
      toast.success('Feedback submitted successfully!');

      setShowFeedbackForm(false);
      setNewFeedback({ rating: 5, comment: '', taskHash: '' });
      loadReputation();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!reputation) {
    return (
      <div className="text-center p-8 text-gray-500 dark:text-gray-400">
        No reputation data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reputation Summary */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 rounded-xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-900 dark:text-primary-100">
              {reputation.averageRating.toFixed(1)}
            </div>
            <div className="text-sm text-primary-700 dark:text-primary-300 flex items-center justify-center gap-1 mt-1">
              <Star className="w-4 h-4 fill-current" />
              Average Rating
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-900 dark:text-primary-100">
              {reputation.totalFeedback}
            </div>
            <div className="text-sm text-primary-700 dark:text-primary-300 flex items-center justify-center gap-1 mt-1">
              <MessageSquare className="w-4 h-4" />
              Total Reviews
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {reputation.positiveCount}
            </div>
            <div className="text-sm text-primary-700 dark:text-primary-300 flex items-center justify-center gap-1 mt-1">
              <ThumbsUp className="w-4 h-4" />
              Positive
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {reputation.negativeCount}
            </div>
            <div className="text-sm text-primary-700 dark:text-primary-300 flex items-center justify-center gap-1 mt-1">
              <ThumbsDown className="w-4 h-4" />
              Negative
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Form */}
      {showFeedbackForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Submit Feedback
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rating (1-10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={newFeedback.rating}
                onChange={(e) => setNewFeedback({ ...newFeedback, rating: Number(e.target.value) })}
                className="w-full"
              />
              <div className="text-center mt-2">
                <span className="text-2xl font-bold text-primary-600">
                  {newFeedback.rating}
                </span>
                <span className="text-gray-500"> / 10</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comment
              </label>
              <textarea
                value={newFeedback.comment}
                onChange={(e) => setNewFeedback({ ...newFeedback, comment: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Share your experience with this agent..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSubmitFeedback}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
              <button
                onClick={() => setShowFeedbackForm(false)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowFeedbackForm(true)}
          className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-5 h-5" />
          Leave Feedback
        </button>
      )}

      {/* Feedback List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Feedback
        </h3>
        {feedback.length === 0 ? (
          <div className="text-center p-8 text-gray-500 dark:text-gray-400">
            No feedback yet
          </div>
        ) : (
          feedback.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < item.rating
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {item.rating}/10
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(item.timestamp * 1000).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-2">{item.comment}</p>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                By {item.reviewer.slice(0, 6)}...{item.reviewer.slice(-4)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
