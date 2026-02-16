export interface Quest {
  id: string;
  title: string;
  description: string;
  reward: number;
  creator: string;
  status: 'open' | 'in_review' | 'completed' | 'cancelled';
  tags: string[];
  deadline?: number;
  created_at: number;
  updated_at: number;
  responses: any[];
  approved_response?: string;
}

export interface QuestResponse {
  id: string;
  quest_id: string;
  responder: string;
  content: string;
  attachments: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
}

export interface LeaderboardEntry {
  responder: string;
  total_earned: number;
  quests_completed: number;
}

export interface QuestCreatorEntry {
  creator: string;
  quests_created: number;
  total_reward_posted: number;
  quests_completed: number;
  total_responses: number;
}

export type QuestTab = 'quests' | 'responses' | 'stats' | 'leaderboard' | 'create' | 'docs';

export function getStatusStyle(status: string) {
  switch (status) {
    case 'open':
      return 'bg-green-500/10 text-green-400 border-green-500/40';
    case 'completed':
      return 'bg-blue-400/10 text-blue-400 border-blue-400/40';
    case 'in_review':
      return 'bg-amber-400/10 text-amber-400 border-amber-400/40';
    case 'cancelled':
      return 'bg-red-400/10 text-red-400 border-red-400/40';
    case 'approved':
      return 'bg-green-500/10 text-green-400 border-green-500/40';
    case 'rejected':
      return 'bg-red-400/10 text-red-400 border-red-400/40';
    case 'pending':
      return 'bg-amber-400/10 text-amber-400 border-amber-400/40';
    default:
      return 'bg-white/5 text-white/40 border-white/20';
  }
}

export function formatTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
