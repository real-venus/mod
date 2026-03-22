"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8820";

// ── Types ────────────────────────────────────────────────────────────

interface Job {
  id: string;
  prompt: string;
  model: string;
  work_dir: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  output: string;
  error: string | null;
  pid: number | null;
  created_at: number;
  updated_at: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeSince(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

const STATUS_ICON: Record<string, string> = {
  pending: "◇",
  running: "▶",
  completed: "✦",
  failed: "✕",
  cancelled: "■",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "QUEUED",
  running: "RUNNING",
  completed: "COMPLETE",
  failed: "FAILED",
  cancelled: "KILLED",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#ffb000",
  running: "#00aaff",
  completed: "#33ff33",
  failed: "#ff3333",
  cancelled: "#666666",
};

// ── ASCII Art ────────────────────────────────────────────────────────

const BOOT_ART = `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     ░█████╗░██╗░░░░░░█████╗░██╗░░░██╗██████╗░███████╗  ║
║     ██╔══██╗██║░░░░░██╔══██╗██║░░░██║██╔══██╗██╔════╝  ║
║     ██║░░╚═╝██║░░░░░███████║██║░░░██║██║░░██║█████╗░░  ║
║     ██║░░██╗██║░░░░░██╔══██║██║░░░██║██║░░██║██╔══╝░░  ║
║     ╚█████╔╝███████╗██║░░██║╚██████╔╝██████╔╝███████╗  ║
║     ░╚════╝░╚══════╝╚═╝░░╚═╝░╚═════╝░╚═════╝░╚══════╝  ║
║                                                          ║
║              ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄              ║
║              █  J O B   R U N N E R  v1  █              ║
║              ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀              ║
║                                                          ║
║         « Background AI Tasks • 8-Bit Terminal »         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝`;

const COMPUTER_ART = `
       ╔══════════════════╗
       ║  ┌────────────┐  ║
       ║  │  IDENTITY   │  ║
       ║  │  VERIFIED   │  ║
       ║  │    ◆ ◆ ◆   │  ║
       ║  └────────────┘  ║
       ╚══════╤════╤══════╝
              │    │
         ═════╧════╧═════`;

// ── Main Component ───────────────────────────────────────────────────

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bootPhase, setBootPhase] = useState(0);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("sonnet");
  const [workDir, setWorkDir] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [streamOutput, setStreamOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(true);
  const outputRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Boot animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setBootPhase(1), 300),
      setTimeout(() => setBootPhase(2), 800),
      setTimeout(() => setBootPhase(3), 1400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Check saved token
  useEffect(() => {
    const saved = localStorage.getItem("claude_jobs_token");
    const savedAddr = localStorage.getItem("claude_jobs_address");
    if (saved && savedAddr) {
      setToken(saved);
      setAddress(savedAddr);
    }
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────

  const connectWallet = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("METAMASK NOT DETECTED — INSTALL THE EXTENSION");
      }
      const ethereum = (window as any).ethereum;
      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts.length) throw new Error("NO ACCOUNTS FOUND");
      const addr = accounts[0].toLowerCase();

      const challengeRes = await fetch(
        `${API_URL}/auth/challenge?address=${addr}`
      );
      if (!challengeRes.ok) throw new Error("CHALLENGE REQUEST FAILED");
      const { message } = await challengeRes.json();

      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, addr],
      });

      const verifyRes = await fetch(`${API_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, signature, message }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "SIGNATURE VERIFICATION FAILED");
      }

      const { token: newToken, address: verifiedAddr } =
        await verifyRes.json();
      setToken(newToken);
      setAddress(verifiedAddr);
      localStorage.setItem("claude_jobs_token", newToken);
      localStorage.setItem("claude_jobs_address", verifiedAddr);
    } catch (e: any) {
      setAuthError(e.message || "AUTHENTICATION FAILED");
    } finally {
      setAuthLoading(false);
    }
  };

  const disconnect = () => {
    setToken(null);
    setAddress(null);
    setJobs([]);
    setSelectedJob(null);
    setStreamOutput("");
    localStorage.removeItem("claude_jobs_token");
    localStorage.removeItem("claude_jobs_address");
    if (esRef.current) esRef.current.close();
  };

  // ── Authed Fetch ──────────────────────────────────────────────────

  const authFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      if (!token) throw new Error("NOT AUTHENTICATED");
      return fetch(`${API_URL}${path}`, {
        ...opts,
        headers: {
          ...opts.headers,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    },
    [token]
  );

  // ── Jobs ──────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch("/jobs");
      if (res.status === 401) { disconnect(); return; }
      if (!res.ok) throw new Error("FETCH FAILED");
      const data = await res.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch {
      setError("SERVER OFFLINE — run: cd server && cargo run");
    } finally {
      setLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (!token) return;
    fetchJobs();
    const iv = setInterval(fetchJobs, 4000);
    return () => clearInterval(iv);
  }, [token, fetchJobs]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamOutput]);

  const submitJob = async () => {
    if (!prompt.trim() || !token) return;
    setSubmitting(true);
    try {
      const body: any = { prompt: prompt.trim(), model };
      if (workDir.trim()) body.work_dir = workDir.trim();
      const res = await authFetch("/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("SUBMIT FAILED");
      const job = await res.json();
      setPrompt("");
      setSelectedJob(job.id);
      fetchJobs();
      startStream(job.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startStream = (jobId: string) => {
    if (esRef.current) esRef.current.close();
    setStreamOutput("");
    const es = new EventSource(`${API_URL}/jobs/${jobId}/stream`);
    esRef.current = es;
    es.onmessage = (event) => {
      if (event.data === "[DONE]") { es.close(); fetchJobs(); return; }
      setStreamOutput((prev) => prev + event.data);
    };
    es.addEventListener("complete", (event: any) => {
      setStreamOutput(event.data);
      es.close();
    });
    es.onerror = () => { es.close(); fetchJobs(); };
  };

  const cancelJob = async (id: string) => {
    await authFetch(`/jobs/${id}/cancel`, { method: "POST" });
    fetchJobs();
  };

  const deleteJob = async (id: string) => {
    await authFetch(`/jobs/${id}`, { method: "DELETE" });
    if (selectedJob === id) { setSelectedJob(null); setStreamOutput(""); }
    fetchJobs();
  };

  const viewJob = (job: Job) => {
    setSelectedJob(job.id);
    if (job.status === "running") {
      startStream(job.id);
    } else {
      setStreamOutput(job.output);
      if (esRef.current) esRef.current.close();
    }
  };

  const selectedJobData = jobs.find((j) => j.id === selectedJob);
  const runningCount = jobs.filter((j) => j.status === "running").length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;

  // ═══════════════════════════════════════════════════════════════════
  // AUTH SCREEN — IBM BOOT STYLE
  // ═══════════════════════════════════════════════════════════════════

  if (!token) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-crt-darker relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(51,255,51,0.03) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full px-4">
          {/* Boot Art */}
          <pre
            className="text-crt-green leading-none select-none whitespace-pre transition-opacity duration-700"
            style={{
              fontSize: "6px",
              textShadow: "0 0 10px rgba(51,255,51,0.4), 0 0 3px rgba(51,255,51,0.2)",
              opacity: bootPhase >= 1 ? 1 : 0,
            }}
          >
            {BOOT_ART}
          </pre>

          {/* Boot Messages */}
          <div
            className="w-full max-w-lg transition-opacity duration-500"
            style={{ opacity: bootPhase >= 2 ? 1 : 0 }}
          >
            <div className="border-2 border-crt-green/30 p-4 space-y-1" style={{ background: "rgba(51,255,51,0.02)" }}>
              <p className="text-[9px] text-crt-green/60">SYSTEM CHECK ............ OK</p>
              <p className="text-[9px] text-crt-green/60">CLAUDE ENGINE ........... READY</p>
              <p className="text-[9px] text-crt-green/60">JOB SCHEDULER ........... ACTIVE</p>
              <p className="text-[9px] text-crt-green/60">SSE STREAM .............. ENABLED</p>
              <p className="text-[9px] text-crt-amber/80 mt-2">
                ⚠ WALLET SIGNATURE REQUIRED FOR ACCESS
              </p>
            </div>
          </div>

          {/* Auth Card */}
          <div
            className="w-full max-w-lg transition-all duration-500"
            style={{
              opacity: bootPhase >= 3 ? 1 : 0,
              transform: bootPhase >= 3 ? "translateY(0)" : "translateY(10px)",
            }}
          >
            <div
              className="border-2 border-crt-amber p-6"
              style={{
                background: "rgba(255,176,0,0.03)",
                boxShadow: "0 0 30px rgba(255,176,0,0.05), inset 0 0 30px rgba(255,176,0,0.02)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-crt-amber text-[14px]">⬡</span>
                <h2
                  className="text-[11px] text-crt-amber"
                  style={{ textShadow: "0 0 8px rgba(255,176,0,0.4)" }}
                >
                  WALLET AUTHENTICATION
                </h2>
              </div>

              <p className="text-[8px] text-crt-green/50 mb-4 leading-relaxed">
                Sign a cryptographic challenge with your MetaMask wallet.
                Your signature is verified server-side via ecrecover and
                becomes a 24-hour bearer token for all API requests.
              </p>

              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={connectWallet}
                  disabled={authLoading}
                  className="pixel-btn pixel-btn-amber w-full max-w-xs text-[10px] py-3"
                  style={{
                    letterSpacing: "2px",
                  }}
                >
                  {authLoading ? (
                    <span className="animate-pulse">AWAITING SIGNATURE...</span>
                  ) : (
                    "CONNECT  METAMASK"
                  )}
                </button>

                <p className="text-[7px] text-crt-green/25">
                  ↑ This will open MetaMask to sign a message
                </p>
              </div>

              {authError && (
                <div className="mt-4 border-2 border-crt-red/60 p-3" style={{ background: "rgba(255,51,51,0.05)" }}>
                  <p className="text-[8px] text-crt-red text-center">{authError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-[7px] text-crt-green/20 mt-4">
            BISMILLAH ░ CLAUDE JOBS v1.0 ░ POWERED BY RUST + NEXT.JS
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-crt-darker">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b-2 border-crt-green/20"
        style={{ background: "linear-gradient(180deg, #0d0d0d 0%, #080808 100%)" }}>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-crt-green text-[14px]" style={{ textShadow: "0 0 10px rgba(51,255,51,0.5)" }}>◈</span>
            <h1 className="text-[12px] text-crt-green" style={{ textShadow: "0 0 8px rgba(51,255,51,0.3)", letterSpacing: "3px" }}>
              CLAUDE JOBS
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 border border-crt-green/10 px-3 py-1">
            <span className={`text-[7px] ${runningCount > 0 ? "text-crt-blue led-pulse" : "text-crt-green/30"}`}>
              ● {runningCount} ACTIVE
            </span>
            <span className="text-crt-green/10">│</span>
            <span className="text-[7px] text-crt-green/40">
              ✦ {completedCount} DONE
            </span>
            <span className="text-crt-green/10">│</span>
            <span className="text-[7px] text-crt-green/30">
              Σ {jobs.length} TOTAL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="border border-crt-amber/30 px-3 py-1 flex items-center gap-2">
            <span className="text-[6px] text-crt-amber/50">WALLET</span>
            <span className="text-[9px] text-crt-amber" style={{ textShadow: "0 0 6px rgba(255,176,0,0.3)" }}>
              {address?.slice(0, 6)}··{address?.slice(-4)}
            </span>
          </div>
          <button onClick={disconnect} className="pixel-btn pixel-btn-red text-[7px] py-1 px-3">
            ✕
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-2 p-3 border-2 border-crt-red/50" style={{ background: "rgba(255,51,51,0.05)" }}>
          <p className="text-[8px] text-crt-red flex items-center gap-2">
            <span>⚠</span> {error}
          </p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Panel ─────────────────────────────────────────── */}
        <div className="w-[440px] min-w-[340px] border-r-2 border-crt-green/15 flex flex-col">

          {/* Submit Toggle */}
          <button
            onClick={() => setShowSubmit(!showSubmit)}
            className="flex items-center justify-between px-4 py-2 border-b border-crt-green/10 hover:bg-crt-green/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-crt-amber">{showSubmit ? "▼" : "▶"}</span>
              <span className="text-[9px] text-crt-amber" style={{ textShadow: "0 0 6px rgba(255,176,0,0.2)", letterSpacing: "1px" }}>
                NEW TASK
              </span>
            </div>
            <span className="text-[7px] text-crt-green/20">⌘+ENTER TO SUBMIT</span>
          </button>

          {/* Submit Form */}
          {showSubmit && (
            <div className="p-4 border-b-2 border-crt-green/15" style={{ background: "rgba(255,176,0,0.01)" }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what Claude should do..."
                className="w-full h-24 p-3 text-[10px] resize-none rounded-none"
                style={{ lineHeight: "1.8" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) submitJob();
                }}
              />
              <div className="flex gap-2 mt-3 items-center">
                <div className="flex items-center gap-1 border border-crt-green/20 px-1">
                  <span className="text-[7px] text-crt-green/30 px-1">MODEL</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="px-2 py-1.5 text-[9px] bg-crt-dark text-crt-green border-none font-pixel"
                  >
                    <option value="haiku">HAIKU</option>
                    <option value="sonnet">SONNET</option>
                    <option value="opus">OPUS</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={workDir}
                  onChange={(e) => setWorkDir(e.target.value)}
                  placeholder="~/project"
                  className="flex-1 px-3 py-1.5 text-[9px]"
                />
                <button
                  onClick={submitJob}
                  disabled={submitting || !prompt.trim()}
                  className="pixel-btn text-[9px] py-1.5 px-5"
                  style={{ letterSpacing: "2px" }}
                >
                  {submitting ? (
                    <span className="animate-pulse">SENDING</span>
                  ) : (
                    "EXECUTE"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Job List Header */}
          <div className="px-4 py-2 border-b border-crt-green/10 flex items-center justify-between">
            <span className="text-[8px] text-crt-green/40" style={{ letterSpacing: "2px" }}>
              ─── TASK QUEUE ───
            </span>
            <span className="text-[7px] text-crt-green/20">{jobs.length} jobs</span>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto">
            {loading && !jobs.length ? (
              <div className="p-8 text-center">
                <p className="text-[9px] text-crt-green/40 cursor-blink">LOADING JOBS</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <pre className="text-[6px] text-crt-green/15 leading-tight inline-block">
{`  ┌──────────────┐
  │              │
  │   NO TASKS   │
  │    YET ◇     │
  │              │
  └──────────────┘`}
                </pre>
                <p className="text-[8px] text-crt-green/25">
                  Create your first task above
                </p>
              </div>
            ) : (
              jobs.map((job) => {
                const isSelected = selectedJob === job.id;
                const color = STATUS_COLOR[job.status];
                return (
                  <div
                    key={job.id}
                    onClick={() => viewJob(job)}
                    className="cursor-pointer transition-all duration-100 group"
                    style={{
                      borderBottom: "1px solid rgba(51,255,51,0.06)",
                      borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                      background: isSelected ? `${color}08` : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "rgba(51,255,51,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div className="px-4 py-3">
                      {/* Status Row */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] ${job.status === "running" ? "led-pulse" : ""}`}
                            style={{ color }}
                          >
                            {STATUS_ICON[job.status]}
                          </span>
                          <span className="text-[8px] font-pixel" style={{ color, letterSpacing: "1px" }}>
                            {STATUS_LABEL[job.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[7px] text-crt-green/25 border border-crt-green/10 px-1.5 py-0.5">
                            {job.model.toUpperCase()}
                          </span>
                          <span className="text-[7px] text-crt-green/20">
                            {timeSince(job.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Prompt */}
                      <p className="text-[9px] text-crt-green/70 leading-relaxed truncate">
                        {job.prompt.length > 70 ? job.prompt.slice(0, 70) + "..." : job.prompt}
                      </p>

                      {/* Actions */}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[6px] text-crt-green/15 font-mono">
                          {job.id.slice(0, 8)}
                        </span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {job.status === "running" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                              className="text-[7px] text-crt-red hover:text-crt-red/80 font-pixel px-2 py-0.5 border border-crt-red/30 hover:border-crt-red/60 transition-colors"
                            >
                              KILL
                            </button>
                          )}
                          {["completed", "failed", "cancelled"].includes(job.status) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                              className="text-[7px] text-crt-green/30 hover:text-crt-red font-pixel px-2 py-0.5 border border-crt-green/10 hover:border-crt-red/40 transition-colors"
                            >
                              DELETE
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel: Output ────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#060606" }}>
          {selectedJobData ? (
            <>
              {/* Job Detail Header */}
              <div className="px-5 py-4 border-b-2 border-crt-green/15" style={{ background: "#0a0a0a" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[12px] ${selectedJobData.status === "running" ? "led-pulse" : ""}`}
                      style={{ color: STATUS_COLOR[selectedJobData.status] }}
                    >
                      {STATUS_ICON[selectedJobData.status]}
                    </span>
                    <span
                      className="text-[10px] font-pixel"
                      style={{
                        color: STATUS_COLOR[selectedJobData.status],
                        letterSpacing: "1px",
                        textShadow: `0 0 8px ${STATUS_COLOR[selectedJobData.status]}40`,
                      }}
                    >
                      {STATUS_LABEL[selectedJobData.status]}
                    </span>
                    <span className="text-crt-green/10">│</span>
                    <span className="text-[9px] text-crt-amber/70 border border-crt-amber/20 px-2 py-0.5">
                      {selectedJobData.model.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[8px] text-crt-green/25 font-mono">
                    {selectedJobData.id.slice(0, 12)}
                  </span>
                </div>

                <p className="text-[10px] text-crt-green/60 leading-relaxed mb-2">
                  {selectedJobData.prompt}
                </p>

                <div className="flex items-center gap-4 text-[7px] text-crt-green/25">
                  {selectedJobData.work_dir && (
                    <span>DIR: {selectedJobData.work_dir}</span>
                  )}
                  <span>CREATED: {formatDate(selectedJobData.created_at)}</span>
                  {selectedJobData.pid && <span>PID: {selectedJobData.pid}</span>}
                </div>
              </div>

              {/* Output Terminal */}
              <div className="flex-1 overflow-hidden relative">
                {/* Terminal decoration */}
                <div className="absolute top-0 left-0 right-0 px-5 py-1 flex items-center justify-between border-b border-crt-green/8 z-10"
                  style={{ background: "rgba(6,6,6,0.95)" }}>
                  <span className="text-[6px] text-crt-green/20">OUTPUT TERMINAL</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#ff3333" }} />
                    <span className="w-2 h-2 rounded-full" style={{ background: "#ffb000" }} />
                    <span className="w-2 h-2 rounded-full" style={{ background: "#33ff33" }} />
                  </div>
                </div>

                <pre
                  ref={outputRef}
                  className="h-full overflow-y-auto pt-8 pb-4 px-5 m-0 whitespace-pre-wrap text-[11px] leading-relaxed font-mono"
                  style={{ color: "rgba(51,255,51,0.85)" }}
                >
                  {streamOutput ||
                    selectedJobData.output ||
                    (selectedJobData.status === "pending" ? (
                      <span className="text-crt-amber/50">
                        {"░░░ QUEUED — WAITING FOR WORKER ░░░\n\n"}
                        {"The task will begin shortly..."}
                      </span>
                    ) : selectedJobData.status === "running" ? (
                      <span className="text-crt-blue/60 cursor-blink">
                        {"CONNECTING TO LIVE STREAM"}
                      </span>
                    ) : (
                      <span className="text-crt-green/25">{"— NO OUTPUT —"}</span>
                    ))}
                  {selectedJobData.error && (
                    <span className="text-crt-red block mt-6 pt-3 border-t-2 border-crt-red/20">
                      {"╔══ ERROR ══════════════════════════\n"}
                      {"║ " + selectedJobData.error + "\n"}
                      {"╚══════════════════════════════════"}
                    </span>
                  )}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <pre
                className="text-crt-green/10 leading-tight select-none"
                style={{ fontSize: "7px" }}
              >
{`
     ╔═══════════════════════════════════╗
     ║                                   ║
     ║       ┌───────────────────┐       ║
     ║       │   ◇  ◇  ◇  ◇  ◇ │       ║
     ║       │                   │       ║
     ║       │  SELECT A TASK    │       ║
     ║       │  TO VIEW OUTPUT   │       ║
     ║       │                   │       ║
     ║       │   ◇  ◇  ◇  ◇  ◇ │       ║
     ║       └───────────────────┘       ║
     ║                                   ║
     ╚═══════════════════════════════════╝
`}
              </pre>
              <p className="text-[8px] text-crt-green/15" style={{ letterSpacing: "2px" }}>
                AWAITING SELECTION
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ───────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-5 py-1.5 border-t-2 border-crt-green/15"
        style={{ background: "#080808" }}>
        <div className="flex items-center gap-3">
          <span className="text-[7px] text-crt-green/25" style={{ letterSpacing: "1px" }}>
            CLAUDE JOBS v1.0
          </span>
          <span className="text-crt-green/10">░</span>
          <span className="text-[7px] text-crt-green/20">BISMILLAH</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[7px] text-crt-green/20">
            BACKEND: localhost:8820
          </span>
          <span className="text-crt-green/10">│</span>
          <span className="text-[7px] text-crt-green/20">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </footer>
    </div>
  );
}
