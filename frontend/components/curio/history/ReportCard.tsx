"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Download, FileText, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { UserReportHistoryItem } from "@/types/history";
import { KeycapButton } from "@/components/curio/KeycapButton";
import { downloadReportPdf } from "@/services/historyService";
import { curioToast } from "@/components/curio/CurioToast";

export interface ReportCardProps {
  report: UserReportHistoryItem;
}

export function ReportCard({ report }: ReportCardProps) {
  const [downloading, setDownloading] = useState(false);

  const dateStr = new Date(report.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;

    setDownloading(true);
    try {
      await downloadReportPdf(report.sessionId, report.topic);
      curioToast.success("REPORT DOWNLOADED SUCCESSFULLY");
    } catch (err: any) {
      curioToast.error("FAILED TO DOWNLOAD REPORT", err?.message);
    } finally {
      setDownloading(false);
    }
  };

  const hasGaps = report.gapsCount > 0 || report.misconceptionsCount > 0;

  return (
    <div className="bg-white dark:bg-[#0E1A2B] rounded-[6px] p-5 shadow-sm transition-all duration-200 hover:shadow-md border border-fog dark:border-[#1E3652] flex flex-col justify-between border-l-[3px] border-l-gap-orange">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-gap-orange/10 dark:bg-gap-orange/20 text-gap-orange rounded-[4px] shrink-0">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="font-heading text-lg font-bold text-navy dark:text-[#F0F4F8] truncate">
              {report.title}
            </h3>
          </div>
          <span className="font-mono text-xs text-navy/50 dark:text-[#829AB1] whitespace-nowrap shrink-0">
            {dateStr}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-navy/75 dark:text-[#BAC7D5] mb-3 flex-wrap">
          <span className="font-semibold text-navy dark:text-[#F0F4F8]">{report.masteryLevel}</span>
          <span className="text-fog dark:text-[#2F4D73]">·</span>
          <span className="font-semibold text-cobalt dark:text-[#4D7CFF]">{report.understandingScore}/100</span>
          <span className="text-fog dark:text-[#2F4D73]">·</span>
          <span className="px-1.5 py-0.5 rounded-[3px] bg-ice dark:bg-[#16273F] text-navy/70 dark:text-[#BAC7D5] text-[10px] font-bold">
            v{report.versionNumber}
          </span>
          {report.gapsCount > 0 && (
            <>
              <span className="text-fog dark:text-[#2F4D73]">·</span>
              <span className="text-gap-orange font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {report.gapsCount} {report.gapsCount === 1 ? "gap" : "gaps"}
              </span>
            </>
          )}
          {report.misconceptionsCount > 0 && (
            <>
              <span className="text-fog dark:text-[#2F4D73]">·</span>
              <span className="text-gap-orange/90 font-medium">
                {report.misconceptionsCount} {report.misconceptionsCount === 1 ? "misconception" : "misconceptions"}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-fog/50 dark:border-[#1E3652]/60 mt-2 gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase font-bold text-navy/40 dark:text-[#829AB1] flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          PERSISTED KNOWLEDGE MAP
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-bold uppercase rounded-[4px] border border-fog/80 dark:border-[#2F4D73] bg-white dark:bg-[#16273F] text-navy dark:text-[#F0F4F8] hover:bg-ice dark:hover:bg-[#1A3254] transition-colors cursor-pointer disabled:opacity-50"
            title="Download Gap Report as PDF"
          >
            <Download className={`w-3.5 h-3.5 text-gap-orange ${downloading ? "animate-bounce" : ""}`} />
            <span>{downloading ? "EXPORTING..." : "DOWNLOAD PDF"}</span>
          </button>

          <Link href={`/session/${report.sessionId}/report`}>
            <KeycapButton variant="navy" size="sm">
              VIEW MAP →
            </KeycapButton>
          </Link>
        </div>
      </div>
    </div>
  );
}

