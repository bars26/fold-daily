import type { Fold, Puzzle } from './fold.ts';

export type FoldPostData = {
  kind?: 'daily' | 'custom';
  author?: string;
  n: number;
  date: string;
  tier: string;
  target: string;
  par: number;
};

export type Streak = { current: number; best: number };

export type MyResult = { folds: number; ms: number; hints: number; onTime: boolean };

export type Stats = {
  players: number;
  /** fold count → number of players whose best was that many folds */
  histogram: Record<string, number>;
};

export type InitResponse = {
  type: 'init';
  kind: 'daily' | 'custom';
  /** Creator's username for community puzzles. */
  author: string | null;
  puzzle: Puzzle;
  tier: string;
  date: string;
  today: number;
  username: string | null;
  mine: MyResult | null;
  streak: Streak | null;
  stats: Stats;
};

export type SolveRequest = { folds: Fold[]; ms: number; hints: number };

export type SolveResponse = {
  type: 'solve';
  mine: MyResult;
  improved: boolean;
  streak: Streak | null;
  stats: Stats;
  rank: number | null;
};

export type LeaderEntry = { username: string; folds: number; ms: number };

export type LeaderboardResponse = {
  type: 'leaderboard';
  top: LeaderEntry[];
  me: (LeaderEntry & { rank: number }) | null;
};

export type ShareResponse = { type: 'share'; ok: true };

export type ArchiveEntry = {
  postId: string;
  title: string;
  /** Short line under the title: date and tier, or the creator. */
  detail: string;
  target: string;
  par: number;
  players: number;
  mine: MyResult | null;
  today: boolean;
};

export type ArchiveResponse = { type: 'archive'; daily: ArchiveEntry[]; community: ArchiveEntry[] };

export type CreateRequest = { w: number; h: number; front: number[]; folds: Fold[] };

export type CreateResponse = { type: 'create'; url: string; par: number };

export type ErrorResponse = { status: 'error'; message: string };
