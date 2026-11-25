"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  Mic,
  BookOpen,
  FileText,
  Download,
  Share2,
} from "lucide-react";
import { KeycapButton } from "@/components/curio/KeycapButton";
import { downloadReportPdf } from "@/services/historyService";
import { curioToast } from "@/components/curio/CurioToast";

export interface GapReportHeaderProps {
  topicName: string;
  sessionId: string;
}

export function GapReportHeader({ topicName, sessionId }: GapReportHeaderProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadReportPdf(sessionId, topicName);
      curioToast.success("GAP REPORT PDF DOWNLOADED");
    } catch (err: any) {
      curioToast.error("DOWNLOAD FAILED", err?.message || "Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <header className="w-full bg-white dark:bg-[#080F1A] border-b border-fog dark:border-[#1E3652] px-4 md:px-6 py-3 flex items-center justify-between shadow-xs sticky top-0 z-30">
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <Link
          href={`/session/${sessionId}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-semibold text-navy/70 dark:text-[#F0F4F8]/70 hover:text-navy dark:hover:text-white transition-colors px-2 py-1 bg-ice/60 dark:bg-[#101F33] border border-fog dark:border-[#1E3652] rounded-[4px] shrink-0"
          title="Back to Session Chat"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">SESSION CHAT</span>
        </Link>
        <span className="text-fog dark:text-[#1E3652] hidden sm:inline">/</span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-navy/50 dark:text-[#F0F4F8]/50 font-bold truncate">
            GAP REPORT
          </div>
          <h1 className="font-heading text-sm md:text-lg font-bold text-navy dark:text-[#F0F4F8] leading-tight truncate max-w-[200px] sm:max-w-md">
            {topicName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* DOWNLOAD PDF ACTION */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase rounded-[4px] border border-gap-orange/60 bg-gap-orange/10 dark:bg-gap-orange/20 text-gap-orange hover:bg-gap-orange hover:text-white transition-all cursor-pointer disabled:opacity-50"
          title="Download Feynman Gap Report as PDF"
        >
          <Download className={`w-3.5 h-3.5 ${downloading ? "animate-bounce" : ""}`} />
          <span className="hidden sm:inline">{downloading ? "EXPORTING..." : "DOWNLOAD REPORT"}</span>
          <span className="sm:hidden">{downloading ? "..." : "PDF"}</span>
        </button>

        <Link
          href="/dashboard"
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold uppercase text-navy/70 dark:text-[#F0F4F8]/70 hover:text-navy dark:hover:text-white hover:bg-ice dark:hover:bg-[#101F33] rounded-[4px] transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-cobalt" />
          <span>DASHBOARD</span>
        </Link>

        <Link
          href="/audio-learning"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold uppercase text-navy/80 dark:text-[#F0F4F8]/80 hover:text-navy dark:hover:text-white bg-gap-orange/10 dark:bg-gap-orange/20 border border-gap-orange/30 dark:border-gap-orange/40 hover:bg-gap-orange/20 rounded-[4px] transition-colors"
          title="Practice this topic in voice"
        >
          <Mic className="w-3.5 h-3.5 text-gap-orange" />
          <span className="hidden sm:inline">AUDIO PRACTICE</span>
        </Link>

        <Link
          href="/history"
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold uppercase text-navy/70 dark:text-[#F0F4F8]/70 hover:text-navy dark:hover:text-white hover:bg-ice dark:hover:bg-[#101F33] rounded-[4px] transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-navy/50 dark:text-[#F0F4F8]/50" />
          <span>HISTORY</span>
        </Link>

        <Link
          href="/topics"
          className="inline-block"
        >
          <KeycapButton variant="navy" size="sm" className="text-xs">
            NEW SESSION +
          </KeycapButton>
        </Link>
      </div>
    </header>
  );
}
