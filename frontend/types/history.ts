export interface SessionSummary {
  sessionId: string;
  topicName: string;
  topicId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  understandingScore: number;
  masteryLevel: string;
  turnCount: number;
  durationMinutes: number;
  unresolvedGaps: number;
  resolvedMisconceptions: number;
  createdAt: string;
  completedAt?: string;
}

export interface PracticeQueueItem {
  id: string;
  gapId: string;
  conceptName: string;
  topicName: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  savedAt: string;
}

export interface UserReportHistoryItem {
  id: string;
  sessionId: string;
  title: string;
  topic: string;
  versionNumber: number;
  understandingScore: number;
  masteryLevel: string;
  gapsCount: number;
  misconceptionsCount: number;
  status: string;
  createdAt: string;
}
