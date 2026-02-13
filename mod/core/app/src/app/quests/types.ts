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

export type QuestTab = 'browse' | 'myQuests' | 'myResponses' | 'create';

export function getStatusStyle(status: string) {
  switch (status) {
    case 'open':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'completed':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'in_review':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'cancelled':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'rejected':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'pending':
      return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30';
    default:
      return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30';
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
