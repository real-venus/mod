"use client";

import { useEffect, useRef } from "react";
import { useSystemLog, LogEntry } from "../lib/system-log";

export default function SystemLog() {
  const { logs } = useSystemLog();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const levelColor: Record<string, string> = {
    INFO: "text-ibm-gray-light",
    TRADE: "text-ibm-green",
    WARN: "text-ibm-amber",
    ERROR: "text-ibm-red",
    SYS: "text-ibm-blue",
  };

  return (
    <div className="panel-glow bg-ibm-panel">
      <div className="px-4 py-2 border-b border-ibm-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-ibm-green animate-pulse" />
          <h3 className="text-[11px] text-ibm-gray-light tracking-widest">SYSTEM LOG</h3>
        </div>
        <span className="text-[10px] text-ibm-gray">{logs.length} entries</span>
      </div>
      <div
        ref={containerRef}
        className="h-48 overflow-y-auto px-4 py-2 font-mono text-[10px] leading-relaxed"
      >
        {logs.map((log: LogEntry, i: number) => (
          <div key={i} className="flex gap-2">
            <span className="text-ibm-gray shrink-0">[{log.timestamp}]</span>
            <span className={`shrink-0 w-12 ${levelColor[log.level] || "text-ibm-gray-light"}`}>{log.level}</span>
            <span className={log.level === "TRADE" ? "text-ibm-green" : log.level === "ERROR" ? "text-ibm-red" : "text-ibm-gray-light"}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-ibm-gray">WAITING FOR EVENTS...</div>
        )}
      </div>
    </div>
  );
}
