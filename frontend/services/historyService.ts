import { SessionSummary, PracticeQueueItem, UserReportHistoryItem } from "@/types/history";
import { SessionListResponse } from "@/types/progress";
import { apiClient } from "./apiClient";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const QUEUE_STORAGE_KEY = "curio_practice_queue";

function getStoredPracticeQueue(): PracticeQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredPracticeQueue(items: PracticeQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export const DEFAULT_CONFIDENCE = 0.6;

export function formatConfidenceScore(
  confidence?: number | null,
  defaultConfidence: number = DEFAULT_CONFIDENCE
): number {
  const effective = confidence ?? defaultConfidence;
  if (effective > 1) {
    return Math.round(effective);
  }
  return Math.round(effective * 100);
}

export async function getSessionHistory(page: number = 1, pageSize: number = 20): Promise<SessionSummary[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("curio_access_token") : null;

  if (token) {
    try {
      const res = await apiClient<SessionListResponse>("/sessions", {
        params: { page, page_size: pageSize },
      });

      if (res && Array.isArray(res.items)) {
        return res.items.map((item) => {
          const confidencePct = formatConfidenceScore(item.confidence);
          const rawItem = item as unknown as { turn_count?: number; turnCount?: number };
          const turnCount = rawItem.turn_count ?? rawItem.turnCount ?? 0;

          let durationMinutes = 0;
          if (item.created_at && item.last_active_at) {
            const start = new Date(item.created_at).getTime();
            const end = new Date(item.last_active_at).getTime();
            if (!isNaN(start) && !isNaN(end) && end >= start) {
              durationMinutes = Math.round((end - start) / 60000);
            }
          }

          return {
            sessionId: item.session_id,
            topicName: item.topic,
            topicId: item.session_id,
            status: item.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
            understandingScore: confidencePct,
            masteryLevel:
              confidencePct >= 80 ? "Mastery" : confidencePct >= 60 ? "Proficient" : "Developing",
            turnCount,
            durationMinutes,
            unresolvedGaps: 0,
            resolvedMisconceptions: 0,
            createdAt: item.created_at,
            completedAt: item.status === "COMPLETED" ? item.last_active_at : undefined,
          };
        });
      }
    } catch (err) {
      console.warn("[historyService] Failed to load sessions from API, trying local repository:", err);
    }
  }

  // Fallback to local session repository for offline learners
  try {
    const { getSessionRepository } = await import("./sessionRepository");
    const repo = getSessionRepository();
    const repoSessions = await repo.listSessions();

    if (repoSessions && repoSessions.length > 0) {
      return repoSessions.map((s) => {
        const confidencePct = formatConfidenceScore(s.understandingScore ?? s.confidence, 0.25);
        return {
          sessionId: s.sessionId,
          topicName: s.topicName,
          topicId: s.topicId || s.sessionId,
          status: s.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
          understandingScore: confidencePct,
          masteryLevel:
            s.masteryLevel ||
            (confidencePct >= 80
              ? "Mastery"
              : confidencePct >= 60
              ? "Proficient"
              : "Developing"),
          turnCount: s.turnCount ?? 0,
          durationMinutes: s.durationMinutes ?? 0,
          unresolvedGaps: s.unresolvedGaps || 0,
          resolvedMisconceptions: s.resolvedMisconceptions || 0,
          createdAt: s.createdAt,
          completedAt: s.completedAt,
        };
      });
    }
  } catch (err) {
    console.warn("[historyService] Local repository fallback error:", err);
  }

  return [];
}

interface RawBackendUserReportItem {
  id: string;
  session_id: string;
  title: string;
  topic: string;
  version_number: number;
  understanding_score: number;
  mastery_level: string;
  gaps_count: number;
  misconceptions_count: number;
  status: string;
  created_at: string;
}

interface BackendUserReportListResponse {
  items: RawBackendUserReportItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export async function getUserGapReports(page: number = 1, pageSize: number = 50): Promise<UserReportHistoryItem[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("curio_access_token") : null;
  if (!token) return [];

  try {
    const res = await apiClient<BackendUserReportListResponse>("/reports", {
      params: { page, page_size: pageSize },
    });

    if (res && Array.isArray(res.items)) {
      return res.items.map((r) => {
        const score = formatConfidenceScore(r.understanding_score);
        return {
          id: r.id,
          sessionId: r.session_id,
          title: r.title,
          topic: r.topic,
          versionNumber: r.version_number,
          understandingScore: score,
          masteryLevel: r.mastery_level,
          gapsCount: r.gaps_count,
          misconceptionsCount: r.misconceptions_count,
          status: r.status,
          createdAt: r.created_at,
        };
      });
    }
  } catch (err) {
    console.warn("[historyService] Failed to load gap reports from API:", err);
  }
  return [];
}

export async function downloadReportPdf(sessionId: string, topicName: string = "report"): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("curio_access_token") : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const url = `${baseUrl}/sessions/${sessionId}/report/download`;

  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { credentials: "include", headers });
  if (!res.ok) {
    throw new Error(`Failed to download report (HTTP ${res.status})`);
  }

  // Extract attachment filename from header if present
  let filename = `curio-gap-report-${topicName.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}.pdf`;
  const disposition = res.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }, 100);
}

export async function getPracticeQueue(): Promise<PracticeQueueItem[]> {
  await delay(50);
  return getStoredPracticeQueue();
}

export async function saveToPracticeQueue(item: Omit<PracticeQueueItem, "id" | "savedAt">): Promise<void> {
  await delay(50);
  const current = getStoredPracticeQueue();
  const newItem: PracticeQueueItem = {
    ...item,
    id: "pq_" + Date.now(),
    savedAt: new Date().toISOString(),
  };
  setStoredPracticeQueue([newItem, ...current]);
}
