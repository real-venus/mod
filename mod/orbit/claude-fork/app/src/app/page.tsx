"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const WalletModal = dynamic(() => import("../components/WalletModal"), { ssr: false });

import { EVM_NETWORKS, NETWORK_LOGOS, switchNetwork, getNetworkName, getNativeSymbol } from "../utils/wallet";

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8820";

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
  asks?: Array<{ question: string; answer?: string; timestamp?: number }>;
}

interface TokenStats {
  balance: string;
  symbol: string;
  decimals: number;
  address: string;
  network: string;
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

const STATUS_COLOR_DARK: Record<string, string> = {
  pending: "#ffb000",
  running: "#00aaff",
  completed: "#33ff33",
  failed: "#ff3333",
  cancelled: "#666666",
};

const STATUS_COLOR_LIGHT: Record<string, string> = {
  pending: "#b47800",
  running: "#1a6eb5",
  completed: "#1a7a3a",
  failed: "#cc2222",
  cancelled: "#888888",
};

// ── ASCII Art ────────────────────────────────────────────────────────

const BOOT_ART = `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     ███╗░░░███╗░█████╗░██████╗░░░░░░░█████╗░██╗        ║
║     ████╗░████║██╔══██╗██╔══██╗░░░░░██╔══██╗██║        ║
║     ██╔████╔██║██║░░██║██║░░██║░░░░░███████║██║        ║
║     ██║╚██╔╝██║██║░░██║██║░░██║░░░░░██╔══██║██║        ║
║     ██║░╚═╝░██║╚█████╔╝██████╔╝░░░░░██║░░██║██║        ║
║     ╚═╝░░░░░╚═╝░╚════╝░╚═════╝░░░░░╚═╝░░╚═╝╚═╝        ║
║                                                          ║
║              ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄              ║
║              █  A G E N T   R U N N E R  v1  █            ║
║              ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀              ║
║                                                          ║
║         « Background AI Agent • 8-Bit Terminal »         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝`;

// ── Main Component ───────────────────────────────────────────────────

export default function Home() {
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bootPhase, setBootPhase] = useState(0);
  const [walletType, setWalletType] = useState<"metamask" | "subwallet" | "local" | "password" | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("opus");
  const [agentType, setAgentType] = useState("general");
  const [workDir, setWorkDir] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [streamOutput, setStreamOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(true);
  const [repos, setRepos] = useState<{ name: string; path: string; display: string }[]>([]);
  const [showRepos, setShowRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showModuleOptions, setShowModuleOptions] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [creationMode, setCreationMode] = useState<"edit" | "new">("edit");
  const [selectedModule, setSelectedModule] = useState("claude");
  const [githubUrl, setGithubUrl] = useState("");
  const [anchorDir, setAnchorDir] = useState("~/mod");
  const [modules, setModules] = useState<string[]>([]);
  const [moduleList, setModuleList] = useState<Array<{
    name: string; path: string; display: string; category: string; has_config: boolean;
    app_url: string | null; api_url: string | null; description: string | null;
    fns: string[]; has_app_dir: boolean; has_server_dir: boolean; has_api_dir: boolean;
    owner: string | null; version: string | null; cid: string | null; created_at: number | null;
  }>>([]);
  const [moduleSearch, setModuleSearch] = useState("");
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);
  const [selectedModuleInfo, setSelectedModuleInfo] = useState<typeof moduleList[0] | null>(null);
  const [moduleConfig, setModuleConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [moduleRunning, setModuleRunning] = useState<boolean | null>(null);
  const [togglingModule, setTogglingModule] = useState(false);
  const [expandedAsks, setExpandedAsks] = useState<Set<string>>(new Set());
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<Array<{ name: string; data: string }>>(
    []
  );
  const [theme, setTheme] = useState<"dark" | "light" | "matrix" | "cyberpunk" | "amber" | "ocean" | "ibm" | "win95">("dark");
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);

  // File viewer state
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [viewingFileContent, setViewingFileContent] = useState<string>("");
  const [viewingFileLoading, setViewingFileLoading] = useState(false);
  // Inline search state
  const [inlineSearchMode, setInlineSearchMode] = useState<"off" | "files" | "grep">("off");
  const [inlineSearchQuery, setInlineSearchQuery] = useState("");
  const [inlineSearchResults, setInlineSearchResults] = useState<any[]>([]);
  const [inlineSearchLoading, setInlineSearchLoading] = useState(false);
  const [inlineSelectedIndex, setInlineSelectedIndex] = useState(0);
  const inlineSearchRef = useRef<HTMLInputElement>(null);

  // Token stats modal
  const [showTokenStats, setShowTokenStats] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [loadingTokenStats, setLoadingTokenStats] = useState(false);

  // Wallet modal
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showWalletSidebar, setShowWalletSidebar] = useState(false);

  // Network switcher (header)
  const [currentChainId, setCurrentChainId] = useState<number>(1);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [hasSubWallet, setHasSubWallet] = useState(false);

  // Backend URL state
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showBackendEditor, setShowBackendEditor] = useState(false);
  const [backendInput, setBackendInput] = useState("");

  // API explorer state
  const [apiSelectedEndpoint, setApiSelectedEndpoint] = useState<string | null>(null);
  const [apiParams, setApiParams] = useState<Record<string, string>>({});
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiResponseStatus, setApiResponseStatus] = useState<number | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMethod, setApiMethod] = useState<string>("GET");

  // Direct config from /config endpoint (fallback)
  const [directConfig, setDirectConfig] = useState<any>(null);

  // Changelog state
  const [changelogEntries, setChangelogEntries] = useState<Array<{
    version: string; cid: string; date: string; description: string;
    timestamp: number; file_count?: number;
  }>>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [versionDetail, setVersionDetail] = useState<any>(null);
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);

  // Config tab state
  const [configSubTab, setConfigSubTab] = useState<"functions" | "endpoints" | "settings">("functions");
  const [configSelectedFn, setConfigSelectedFn] = useState<string | null>(null);
  const [configFnParams, setConfigFnParams] = useState<Record<string, string>>({});
  const [configFnResponse, setConfigFnResponse] = useState<string | null>(null);
  const [configFnLoading, setConfigFnLoading] = useState(false);

  // JSON tree viewer state
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // New UI state
  const [moduleTab, setModuleTab] = useState<"app" | "api" | "changelog">("app");
  const [taskSubTab, setTaskSubTab] = useState<"output" | "deltas">("output");
  const [viewMode, setViewMode] = useState<"output" | "code">("output");
  const [directoryTree, setDirectoryTree] = useState<any[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Agent sidebar state (persistent right panel)
  const [tasksSidebarOpen, setTasksSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(480);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isLeftDragging, setIsLeftDragging] = useState(false);
  const [sidebarView, setSidebarView] = useState<"tasks" | "app" | "api" | "changelog" | "config" | "files">("config");

  // Left sidebar (agent) and right sidebar (wallet)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(420);

  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const inlineModuleRef = useRef<HTMLDivElement>(null);
  const headerModuleRef = useRef<HTMLDivElement>(null);
  const [showInlineModuleDropdown, setShowInlineModuleDropdown] = useState(false);
  const [showHeaderModuleDropdown, setShowHeaderModuleDropdown] = useState(false);
  const [headerModuleSearch, setHeaderModuleSearch] = useState("");
  const [showHeaderCreateForm, setShowHeaderCreateForm] = useState<"create" | "fork" | null>(null);
  const [headerNewName, setHeaderNewName] = useState("");
  const [headerGithubUrl, setHeaderGithubUrl] = useState("");
  const headerCreateRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const userDetailsRef = useRef<HTMLDivElement>(null);
  const tokenStatsRef = useRef<HTMLDivElement>(null);

  // Theme-aware helpers
  const isLight = theme === "light";
  const STATUS_COLOR = isLight ? STATUS_COLOR_LIGHT : STATUS_COLOR_DARK;
  const tintBg = isLight ? "rgba(0,0,0,0.02)" : "rgba(51,255,51,0.02)";
  const tintBgStrong = isLight ? "rgba(0,0,0,0.04)" : "rgba(51,255,51,0.03)";
  const subtleBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const subtleBorderStrong = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const faintGreen = isLight ? "rgba(26,122,58,0.06)" : "rgba(51,255,51,0.06)";
  const faintGreenText = isLight ? "rgba(26,122,58,0.25)" : "rgba(51,255,51,0.2)";
  const walletGreen = isLight ? "rgba(26,122,58," : "rgba(51,255,51,";
  const walletAmber = isLight ? "rgba(180,120,0," : "rgba(255,176,0,";
  const apiGreenBorder = isLight ? "rgba(26,122,58,0.3)" : "rgba(51,255,51,0.3)";
  const apiGreenBg = isLight ? "rgba(26,122,58,0.06)" : "rgba(51,255,51,0.05)";
  const apiBlueBorder = isLight ? "rgba(26,110,181,0.3)" : "rgba(0,170,255,0.3)";
  const apiBlueBg = isLight ? "rgba(26,110,181,0.06)" : "rgba(0,170,255,0.05)";
  const apiRedBorder = isLight ? "rgba(204,34,34,0.3)" : "rgba(255,51,51,0.3)";
  const apiRedBg = isLight ? "rgba(204,34,34,0.06)" : "rgba(255,51,51,0.05)";
  const darkOverlay = isLight ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.3)";
  const darkOverlayStrong = isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.4)";

  // Reset all module-specific state when switching modules
  const resetModuleState = useCallback(() => {
    // API explorer
    setApiSelectedEndpoint(null);
    setApiParams({});
    setApiResponse(null);
    setApiResponseStatus(null);
    setApiMethod("GET");
    setApiLoading(false);
    // Config tab
    setConfigSubTab("functions");
    setConfigSelectedFn(null);
    setConfigFnParams({});
    setConfigFnResponse(null);
    setConfigFnLoading(false);
    // Module health
    setModuleRunning(null);
    setTogglingModule(false);
    // Changelog
    setChangelogEntries([]);
    setSelectedVersion(null);
    setVersionDetail(null);
    // File viewer
    setViewingFile(null);
    setViewingFileContent("");
    // Directory tree
    setDirectoryTree([]);
    setExpandedDirs(new Set());
    // JSON tree
    setCollapsedPaths(new Set());
    // Reset sidebar view to default if on a tab that may not exist for new module
    setSidebarView((prev) => (prev === "app" ? "config" : prev));
  }, []);

  // Detect wallet extensions client-side only (avoids hydration mismatch)
  useEffect(() => {
    setHasMetaMask(!!(window as any).ethereum?.isMetaMask);
    setHasSubWallet(!!(window as any).ethereum?.isSubWallet);
  }, []);

  // Detect current chain and listen for changes
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    const fetchChain = async () => {
      try {
        const cid = await ethereum.request({ method: "eth_chainId" });
        setCurrentChainId(parseInt(cid, 16));
      } catch {}
    };
    fetchChain();
    const handler = (cid: string) => setCurrentChainId(parseInt(cid, 16));
    ethereum.on?.("chainChanged", handler);
    return () => ethereum.removeListener?.("chainChanged", handler);
  }, [address]);

  // Boot animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setBootPhase(1), 300),
      setTimeout(() => setBootPhase(2), 800),
      setTimeout(() => setBootPhase(3), 1400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Apply theme to document root
  useEffect(() => {
    const savedTheme = localStorage.getItem("claude_jobs_theme");
    if (savedTheme) {
      setTheme(savedTheme as typeof theme);
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem("claude_jobs_theme", theme);
  }, [theme]);

  // Keyboard shortcuts for inline file search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setInlineSearchMode((prev) => prev === "files" ? "off" : "files");
        setInlineSearchQuery("");
        setInlineSearchResults([]);
        setInlineSelectedIndex(0);
        setTimeout(() => inlineSearchRef.current?.focus(), 50);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setInlineSearchMode((prev) => prev === "grep" ? "off" : "grep");
        setInlineSearchQuery("");
        setInlineSearchResults([]);
        setInlineSelectedIndex(0);
        setTimeout(() => inlineSearchRef.current?.focus(), 50);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Inline search debounce effect
  useEffect(() => {
    if (inlineSearchMode === "off" || !inlineSearchQuery.trim()) {
      setInlineSearchResults([]);
      return;
    }
    const tid = setTimeout(async () => {
      setInlineSearchLoading(true);
      const sd = selectedJob
        ? jobs.find((j) => j.id === selectedJob)?.work_dir || workDir || "~/mod"
        : workDir || "~/mod";
      try {
        if (inlineSearchMode === "files") {
          const r = await fetch(
            `${apiUrl}/files/search?path=${encodeURIComponent(sd)}&query=${encodeURIComponent(inlineSearchQuery)}`
          );
          if (r.ok) { const d = await r.json(); setInlineSearchResults(d.results || []); }
        } else {
          const p = new URLSearchParams({ path: sd, query: inlineSearchQuery });
          const r = await fetch(`${apiUrl}/files/grep?${p}`);
          if (r.ok) { const d = await r.json(); setInlineSearchResults(d.matches || []); }
        }
      } catch { /* ignore */ }
      setInlineSearchLoading(false);
      setInlineSelectedIndex(0);
    }, 300);
    return () => clearTimeout(tid);
  }, [inlineSearchQuery, inlineSearchMode]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
      if (userDetailsRef.current && !userDetailsRef.current.contains(e.target as Node)) {
        setShowUserDetails(false);
      }
      if (tokenStatsRef.current && !tokenStatsRef.current.contains(e.target as Node)) {
        setShowTokenStats(false);
      }
      if (headerModuleRef.current && !headerModuleRef.current.contains(e.target as Node)) {
        setShowHeaderModuleDropdown(false);
      }
      if (headerCreateRef.current && !headerCreateRef.current.contains(e.target as Node)) {
        setShowHeaderCreateForm(null);
      }
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(e.target as Node)) {
        setShowNetworkDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load saved model and backend URL
  useEffect(() => {
    const savedModel = localStorage.getItem("claude_jobs_model");
    if (savedModel) setModel(savedModel);
    const savedAgentType = localStorage.getItem("claude_agent_type");
    if (savedAgentType) setAgentType(savedAgentType);
    const savedUrl = localStorage.getItem("claude_backend_url");
    if (savedUrl) setApiUrl(savedUrl);
  }, []);

  // Load saved sidebar state
  useEffect(() => {
    const savedSidebar = localStorage.getItem("claude_tasks_sidebar_open");
    if (savedSidebar !== null) setTasksSidebarOpen(savedSidebar === "true");
    const savedWidth = localStorage.getItem("claude_tasks_sidebar_width");
    if (savedWidth) setSidebarWidth(parseInt(savedWidth, 10));
    const savedLeft = localStorage.getItem("claude_left_sidebar_open");
    if (savedLeft !== null) setLeftSidebarOpen(savedLeft === "true");
    const savedLeftW = localStorage.getItem("claude_left_sidebar_width");
    if (savedLeftW) setLeftSidebarWidth(parseInt(savedLeftW, 10));
  }, []);

  useEffect(() => {
    localStorage.setItem("claude_tasks_sidebar_open", String(tasksSidebarOpen));
  }, [tasksSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("claude_tasks_sidebar_width", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("claude_left_sidebar_open", String(leftSidebarOpen));
  }, [leftSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("claude_left_sidebar_width", String(leftSidebarWidth));
  }, [leftSidebarWidth]);

  // Check saved token or detect local mode
  useEffect(() => {
    const saved = localStorage.getItem("claude_jobs_token");
    const savedAddr = localStorage.getItem("claude_jobs_address");
    const savedWalletType = localStorage.getItem("claude_jobs_wallet_type") as typeof walletType;
    if (saved && savedAddr) {
      setToken(saved);
      setAddress(savedAddr);
      setWalletType(savedWalletType);
      return;
    }
    // Probe server — if local mode is on, skip auth entirely
    fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then(() => {
        // Try an unauthed request to /jobs — if it works, server is in local mode
        return fetch(`${apiUrl}/jobs`);
      })
      .then((r) => {
        if (r.ok) {
          // Local mode — no auth needed
          setToken("local");
          setAddress("local");
          setWalletType("local");
          localStorage.setItem("claude_jobs_token", "local");
          localStorage.setItem("claude_jobs_address", "local");
          localStorage.setItem("claude_jobs_wallet_type", "local");
        }
      })
      .catch(() => { /* server not reachable, show auth screen */ });
  }, []);

  // Load token stats when address changes
  useEffect(() => {
    if (address && address !== "local") {
      loadTokenStats();
    }
  }, [address]);

  // Check owner status when address changes
  useEffect(() => {
    // Everyone is an owner
    setIsOwner(true);
    setOwnerAddress(address);
  }, [address]);

  // ── Auth ──────────────────────────────────────────────────────────

  const safeJson = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return {}; }
  };

  const signChallenge = async (addr: string, signFn: (msg: string) => Promise<string>) => {
    // Check owner status before authentication
    let wasOwnerSet = false;
    try {
      const ownerRes = await fetch(`${apiUrl}/owner`);
      const ownerData = await safeJson(ownerRes);
      wasOwnerSet = !!ownerData.has_owner;
    } catch { /* owner endpoint not available, skip */ }

    const challengeRes = await fetch(
      `${apiUrl}/auth/challenge?address=${addr}`
    );
    if (!challengeRes.ok) throw new Error("CHALLENGE REQUEST FAILED");
    const { message } = await safeJson(challengeRes);
    if (!message) throw new Error("INVALID CHALLENGE RESPONSE");

    const signature = await signFn(message);

    const verifyRes = await fetch(`${apiUrl}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr, signature, message }),
    });

    const verifyData = await safeJson(verifyRes);
    if (!verifyRes.ok) {
      throw new Error(verifyData.error || "SIGNATURE VERIFICATION FAILED");
    }

    const { token: newToken, address: verifiedAddr } = verifyData;
    if (!newToken || !verifiedAddr) throw new Error("INVALID VERIFY RESPONSE");
    setToken(newToken);
    setAddress(verifiedAddr);
    localStorage.setItem("claude_jobs_token", newToken);
    localStorage.setItem("claude_jobs_address", verifiedAddr);

    // Check if this user became the owner
    if (!wasOwnerSet) {
      try {
        const newOwnerRes = await fetch(`${apiUrl}/owner`);
        const newOwnerData = await safeJson(newOwnerRes);
        if (newOwnerData.has_owner && newOwnerData.owner === verifiedAddr) {
          console.log("✓ You are now the owner of this Claude instance");
        }
      } catch { /* ignore */ }
    }
  };

  const connectWallet = async (type: "metamask" | "subwallet") => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const ethereum = (window as any).ethereum;

      // For SubWallet, request specific provider
      if (type === "subwallet" && ethereum.providers) {
        const subwalletProvider = ethereum.providers.find((p: any) => p.isSubWallet);
        if (!subwalletProvider) throw new Error("SUBWALLET NOT FOUND");
        const accounts: string[] = await subwalletProvider.request({
          method: "eth_requestAccounts",
        });
        if (!accounts.length) throw new Error("NO ACCOUNTS FOUND");
        const addr = accounts[0].toLowerCase();

        await signChallenge(addr, async (msg) => {
          return await subwalletProvider.request({
            method: "personal_sign",
            params: [msg, addr],
          });
        });
        setWalletType("subwallet");
        localStorage.setItem("claude_jobs_wallet_type", "subwallet");
      } else {
        // MetaMask or default provider
        const accounts: string[] = await ethereum.request({
          method: "eth_requestAccounts",
        });
        if (!accounts.length) throw new Error("NO ACCOUNTS FOUND");
        const addr = accounts[0].toLowerCase();

        await signChallenge(addr, async (msg) => {
          return await ethereum.request({
            method: "personal_sign",
            params: [msg, addr],
          });
        });
        setWalletType("metamask");
        localStorage.setItem("claude_jobs_wallet_type", "metamask");
      }
    } catch (e: any) {
      setAuthError(e.message || "AUTHENTICATION FAILED");
    } finally {
      setAuthLoading(false);
    }
  };

  const connectWithPassword = async (password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { ethers } = await import("ethers");
      // Derive a deterministic private key from the password
      const hash = ethers.id(password); // keccak256
      const wallet = new ethers.Wallet(hash);
      const addr = wallet.address.toLowerCase();

      await signChallenge(addr, async (msg) => {
        return await wallet.signMessage(msg);
      });
      setWalletType("password");
      localStorage.setItem("claude_jobs_wallet_type", "password");
    } catch (e: any) {
      setAuthError(e.message || "PASSWORD KEY DERIVATION FAILED");
    } finally {
      setAuthLoading(false);
    }
  };

  const connectLocal = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { ethers } = await import("ethers");

      let mnemonic = localStorage.getItem("claude_jobs_seed");
      let isNew = false;
      if (!mnemonic) {
        const wallet = ethers.Wallet.createRandom();
        mnemonic = wallet.mnemonic!.phrase;
        localStorage.setItem("claude_jobs_seed", mnemonic);
        isNew = true;
      }

      const wallet = ethers.Wallet.fromPhrase(mnemonic);
      const addr = wallet.address.toLowerCase();

      await signChallenge(addr, async (msg) => {
        return await wallet.signMessage(msg);
      });

      setWalletType("local");
      localStorage.setItem("claude_jobs_wallet_type", "local");

      if (isNew) {
        console.log(
          "%c[MOD AI] New local wallet created. Back up your seed phrase from localStorage key 'claude_jobs_seed'",
          "color: #ffb000"
        );
      }
    } catch (e: any) {
      setAuthError(e.message || "LOCAL KEY GENERATION FAILED");
    } finally {
      setAuthLoading(false);
    }
  };

  const disconnect = () => {
    setToken(null);
    setAddress(null);
    setWalletType(null);
    setJobs([]);
    setSelectedJob(null);
    setStreamOutput("");
    setTokenStats(null);
    localStorage.removeItem("claude_jobs_token");
    localStorage.removeItem("claude_jobs_address");
    localStorage.removeItem("claude_jobs_wallet_type");
    if (esRef.current) esRef.current.close();
  };

  // ── Network Switch (header) ───────────────────────────────────────
  const handleHeaderNetworkSwitch = async (targetChainId: number) => {
    if (targetChainId === currentChainId) {
      setShowNetworkDropdown(false);
      return;
    }
    setSwitchingNetwork(true);
    const ok = await switchNetwork(targetChainId);
    setSwitchingNetwork(false);
    setShowNetworkDropdown(false);
    if (ok) setCurrentChainId(targetChainId);
  };

  // ── Token Stats ───────────────────────────────────────────────────

  const loadTokenStats = async () => {
    if (!address || address === "local") return;

    setLoadingTokenStats(true);
    try {
      const { ethers } = await import("ethers");
      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        setTokenStats({
          balance: "0.00",
          symbol: "ETH",
          decimals: 18,
          address: address,
          network: "Unknown",
        });
        return;
      }

      const provider = new ethers.BrowserProvider(ethereum);
      const balance = await provider.getBalance(address);
      const network = await provider.getNetwork();

      setTokenStats({
        balance: ethers.formatEther(balance),
        symbol: "ETH",
        decimals: 18,
        address: address,
        network: network.name || `Chain ${network.chainId}`,
      });
    } catch (e) {
      console.error("Failed to load token stats:", e);
      setTokenStats({
        balance: "0.00",
        symbol: "ETH",
        decimals: 18,
        address: address || "",
        network: "Unknown",
      });
    } finally {
      setLoadingTokenStats(false);
    }
  };

  // ── Authed Fetch ──────────────────────────────────────────────────

  const authFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      if (!token) throw new Error("NOT AUTHENTICATED");
      const headers: Record<string, string> = {
        ...((opts.headers as Record<string, string>) || {}),
        "Content-Type": "application/json",
      };
      // In local mode, no bearer token needed
      if (token !== "local") {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(`${apiUrl}${path}`, { ...opts, headers });
    },
    [token, apiUrl]
  );

  // ── Directory Tree ────────────────────────────────────────────────

  const collectDirPaths = (tree: any[]): string[] => {
    const paths: string[] = [];
    for (const item of tree) {
      if (item.type === "directory") {
        paths.push(item.path);
        if (item.children) paths.push(...collectDirPaths(item.children));
      }
    }
    return paths;
  };

  const fetchDirectoryTree = useCallback(async (path?: string) => {
    try {
      const targetPath = path || (selectedJob ? jobs.find(j => j.id === selectedJob)?.work_dir : workDir) || "~/mod";
      const res = await fetch(`${apiUrl}/files/tree?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        const tree = data.tree || [];
        setDirectoryTree(tree);
        // Auto-expand all directories
        const allDirs = collectDirPaths(tree);
        setExpandedDirs(new Set(allDirs));
      }
    } catch (e) {
      console.error("Failed to fetch directory tree:", e);
    }
  }, [selectedJob, jobs, workDir, apiUrl]);

  // Load directory tree on mount and when relevant state changes
  useEffect(() => {
    fetchDirectoryTree();
  }, [selectedJob, workDir]);

  // Also reload when switching to changelog tab if empty
  useEffect(() => {
    if (moduleTab === "changelog" && changelogEntries.length === 0) {
      fetchChangelog();
    }
  }, [moduleTab]);

  // Load file content for viewer
  const loadFileContent = useCallback(async (filePath: string) => {
    setViewingFile(filePath);
    setViewingFileLoading(true);
    try {
      const res = await fetch(`${apiUrl}/files/content?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setViewingFileContent(data.content || "");
      } else {
        setViewingFileContent("// Failed to load file");
      }
    } catch {
      setViewingFileContent("// Error loading file");
    } finally {
      setViewingFileLoading(false);
    }
  }, [apiUrl]);

  // Handle sidebar resize dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isLeftDragging) {
        const newWidth = e.clientX;
        setLeftSidebarWidth(Math.max(280, Math.min(800, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsLeftDragging(false);
    };

    if (isLeftDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isLeftDragging]);

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
      setError("API OFFLINE — run: cd api && cargo run");
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
      if (agentType && agentType !== "general") body.agent_type = agentType;
      if (images.length > 0) body.images = images;

      // Edit mode - edit existing module
      if (creationMode === "edit") {
        // If a module is selected, use that as work_dir
        if (selectedModule.trim()) {
          // Enforce _outer restriction for non-owners
          if (!isOwner && !selectedModule.includes("_outer/") && !selectedModule.startsWith("_outer.")) {
            setError("NON-OWNERS CAN ONLY EDIT MODULES IN _outer FOLDER");
            setSubmitting(false);
            return;
          }
          body.work_dir = `${anchorDir}/mod/orbit/${selectedModule}`;
        }
        // Otherwise use the manual work_dir input
        else if (workDir.trim()) {
          body.work_dir = workDir.trim();
        }
      }
      // New mode - create new module
      else if (creationMode === "new") {
        if (!moduleName.trim()) {
          setError("MODULE NAME REQUIRED");
          setSubmitting(false);
          return;
        }

        // For non-owners, enforce _outer folder for new modules
        let finalModuleName = moduleName.trim();
        if (!isOwner && !finalModuleName.startsWith("_outer/")) {
          finalModuleName = `_outer/${finalModuleName}`;
        }

        body.module_name = finalModuleName;
        body.creation_mode = creationMode;
        body.anchor_dir = anchorDir;

        // Add GitHub URL if provided
        if (githubUrl.trim()) {
          body.github_url = githubUrl.trim();
        }
      }

      const res = await authFetch("/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("SUBMIT FAILED");
      const job = await res.json();
      setPrompt("");
      setImages([]);
      setModuleName("");
      setGithubUrl("");
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
    const es = new EventSource(`${apiUrl}/jobs/${jobId}/stream`);
    esRef.current = es;
    es.onmessage = (event) => {
      if (event.data === "[DONE]" || event.data === "[CANCELLED]") { es.close(); fetchJobs(); return; }
      setStreamOutput((prev) => prev + event.data);
    };
    es.addEventListener("complete", (event: any) => {
      setStreamOutput(event.data);
      es.close();
    });
    es.onerror = () => { es.close(); fetchJobs(); };
  };

  const cancelJob = async (id: string) => {
    // Close the stream immediately so UI stops updating
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
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

  const toggleAsks = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedAsks((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  // ── Task Actions (Copy/Edit/Fork/Create) ───────────────────────────
  const extractModuleFromWorkDir = (workDir: string): string | null => {
    const match = workDir.match(/\/orbit\/([^/]+)/);
    return match ? match[1] : null;
  };

  const copyTaskToInput = (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrompt(job.prompt);
    setModel(job.model);
    setCreationMode("edit");
    if (job.work_dir) {
      const mod = extractModuleFromWorkDir(job.work_dir);
      if (mod) {
        const moduleInfo = moduleList.find(m => m.name === mod);
        if (moduleInfo) {
          setSelectedModule(mod);
          setSelectedModuleInfo(moduleInfo);
          setWorkDir(moduleInfo.path);
          fetchModuleConfig(mod);
        }
      }
    }
  };

  const forkTask = (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrompt(job.prompt);
    setModel(job.model);
    setCreationMode("new");
    if (job.work_dir) {
      const mod = extractModuleFromWorkDir(job.work_dir);
      if (mod) setModuleName(mod + "-fork");
    }
  };

  const headerCreateOrFork = async () => {
    if (!headerNewName.trim() || !token) return;
    setSubmitting(true);
    try {
      let finalName = headerNewName.trim();
      if (!isOwner && !finalName.startsWith("_outer/")) {
        finalName = `_outer/${finalName}`;
      }

      const defaultPrompt = showHeaderCreateForm === "fork"
        ? `Fork the module "${selectedModule}" into a new module called "${finalName}". Copy all source files, config.json, and directory structure. Update any self-references to use the new module name.`
        : `Create a new module called "${finalName}". Set up the standard module structure with config.json, mod.py, and a README.md.`;

      const body: any = {
        prompt: defaultPrompt,
        model,
        module_name: finalName,
        creation_mode: "new",
        anchor_dir: anchorDir,
      };

      if (showHeaderCreateForm === "fork" && selectedModule) {
        body.prompt = `Fork the module "${selectedModule}" into a new module called "${finalName}". Copy all source files, config.json, and directory structure. Update any self-references to use the new module name.`;
        body.fork_from = selectedModule;
      }

      if (headerGithubUrl.trim()) {
        body.github_url = headerGithubUrl.trim();
      }

      const res = await authFetch("/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("SUBMIT FAILED");
      const job = await res.json();
      setHeaderNewName("");
      setHeaderGithubUrl("");
      setShowHeaderCreateForm(null);
      setSelectedJob(job.id);
      fetchJobs();
      startStream(job.id);
      // Open agent panel to see progress
      setLeftSidebarOpen(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const rerunTask = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    setSubmitting(true);
    try {
      const body: any = { prompt: job.prompt, model: job.model };
      if (job.work_dir) body.work_dir = job.work_dir;
      const res = await authFetch("/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("SUBMIT FAILED");
      const newJob = await res.json();
      setSelectedJob(newJob.id);
      fetchJobs();
      startStream(newJob.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePromptExpand = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  // ── Repo Search ────────────────────────────────────────────────────
  const searchRepos = useCallback(async (q: string) => {
    try {
      const res = await fetch(`${apiUrl}/repos?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos || []);
        // Extract module names from orbit directory
        const orbitModules = data.repos
          .filter((r: any) => r.path.includes('/mod/orbit/'))
          .map((r: any) => r.name);
        setModules(orbitModules);
      }
    } catch { /* ignore */ }
  }, [apiUrl]);

  const fetchModules = useCallback(async (q: string = "", anchor?: string) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (anchor || anchorDir) params.set("anchor", anchor || anchorDir);
      const res = await fetch(`${apiUrl}/modules?${params}`);
      if (res.ok) {
        const data = await res.json();
        setModuleList(data.modules || []);
      }
    } catch { /* ignore */ }
  }, [anchorDir, apiUrl]);

  const fetchModuleConfig = useCallback(async (name: string) => {
    setLoadingConfig(true);
    setModuleConfig(null);
    try {
      const params = new URLSearchParams();
      if (anchorDir) params.set("anchor", anchorDir);
      const res = await fetch(`${apiUrl}/modules/${encodeURIComponent(name)}/config?${params}`);
      if (res.ok) {
        const data = await res.json();
        setModuleConfig(data);
      }
    } catch { /* ignore */ }
    finally { setLoadingConfig(false); }
  }, [anchorDir, apiUrl]);

  // Fetch direct config from /config endpoint on mount
  const fetchDirectConfig = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/config`);
      if (res.ok) {
        const data = await res.json();
        setDirectConfig(data);
      }
    } catch { /* ignore */ }
  }, [apiUrl]);

  useEffect(() => {
    fetchDirectConfig();
  }, [fetchDirectConfig]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Auto-select default module ("claude") once module list loads
  useEffect(() => {
    if (selectedModule && moduleList.length > 0 && !selectedModuleInfo) {
      const match = moduleList.find((m) => m.name === selectedModule);
      if (match) {
        setSelectedModuleInfo(match);
        setWorkDir(match.path);
        fetchModuleConfig(match.name);
      }
    }
  }, [moduleList, selectedModule, selectedModuleInfo]);

  // ── Module health check ────────────────────────────────────────────
  const checkModuleHealth = useCallback(async () => {
    if (!selectedModuleInfo?.api_url) {
      setModuleRunning(null);
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${selectedModuleInfo.api_url}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      setModuleRunning(res.ok);
    } catch {
      setModuleRunning(false);
    }
  }, [selectedModuleInfo]);

  useEffect(() => {
    checkModuleHealth();
    if (!selectedModuleInfo?.api_url) return;
    const interval = setInterval(checkModuleHealth, 5000);
    return () => clearInterval(interval);
  }, [checkModuleHealth]);

  // ── Toggle module (start/stop) ─────────────────────────────────────
  const toggleModule = useCallback(async () => {
    if (!selectedModuleInfo || !token || togglingModule) return;
    setTogglingModule(true);
    try {
      if (moduleRunning) {
        const config = moduleConfig?.config || directConfig;
        const port = config?.port || config?.urls?.api?.match(/:(\d+)/)?.[1];
        if (port) {
          await authFetch("/jobs", {
            method: "POST",
            body: JSON.stringify({
              prompt: `Kill the process running on port ${port} using: lsof -ti:${port} | xargs kill -9 2>/dev/null; echo "Stopped module on port ${port}"`,
              model: "haiku",
              work_dir: selectedModuleInfo.path,
            }),
          });
        }
      } else {
        await authFetch("/jobs", {
          method: "POST",
          body: JSON.stringify({
            prompt: `Start this module by running its start script. Look for start.sh in the current directory or scripts/start.sh and run it in the background. If there is no start.sh, look for a Python module with mod.py and run: python -m uvicorn {module_name}.mod:app --host 0.0.0.0 --port {port} where you determine the module_name and port from config.json`,
            model: "haiku",
            work_dir: selectedModuleInfo.path,
          }),
        });
      }
      setTimeout(() => {
        checkModuleHealth();
        setTogglingModule(false);
      }, 3000);
    } catch {
      setTogglingModule(false);
    }
  }, [selectedModuleInfo, token, togglingModule, moduleRunning, moduleConfig, directConfig, authFetch, checkModuleHealth]);

  useEffect(() => {
    searchRepos("");
  }, [searchRepos]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (repoRef.current && !repoRef.current.contains(e.target as Node)) {
        setShowRepos(false);
      }
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(e.target as Node)) {
        setShowModuleDropdown(false);
      }
      if (inlineModuleRef.current && !inlineModuleRef.current.contains(e.target as Node)) {
        setShowInlineModuleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filter jobs based on search query and status
  const filteredJobs = jobs.filter((job) => {
    // Status filter
    if (statusFilter && job.status !== statusFilter) return false;

    // Search query filter
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.prompt.toLowerCase().includes(query) ||
      job.id.toLowerCase().includes(query) ||
      job.model.toLowerCase().includes(query) ||
      job.status.toLowerCase().includes(query) ||
      (job.work_dir && job.work_dir.toLowerCase().includes(query))
    );
  });

  const selectedJobData = jobs.find((j) => j.id === selectedJob);
  const runningCount = jobs.filter((j) => j.status === "running").length;

  // Colorize output with diff highlighting
  const renderOutput = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Diff removals
      if (line.startsWith("│- ")) {
        return <span key={i} style={{ color: "var(--crt-red)" }}>{line}{"\n"}</span>;
      }
      // Diff additions
      if (line.startsWith("│+ ")) {
        return <span key={i} style={{ color: "var(--accent-color)" }}>{line}{"\n"}</span>;
      }
      // Edit/Write headers
      if (line.startsWith("┌─ EDIT:") || line.startsWith("┌─ WRITE:")) {
        return <span key={i} style={{ color: "var(--crt-amber)", fontWeight: "bold" }}>{line}{"\n"}</span>;
      }
      // Diff separator
      if (line === "│───" || line === "└─") {
        return <span key={i} style={{ color: "var(--crt-amber)", opacity: 0.4 }}>{line}{"\n"}</span>;
      }
      // Bash commands
      if (line.startsWith("$ ")) {
        return <span key={i} style={{ color: "var(--crt-blue)" }}>{line}{"\n"}</span>;
      }
      // Tool use markers
      if (line.startsWith("⚡ ")) {
        return <span key={i} style={{ color: "var(--crt-amber)" }}>{line}{"\n"}</span>;
      }
      return <span key={i} style={{ color: "var(--text-primary)" }}>{line}{"\n"}</span>;
    });
  };

  // Effective config: prefer moduleConfig, fallback to directConfig (hoisted before early return)
  const effectiveConfig = moduleConfig?.config || directConfig;

  // Auto-collapse nested objects (depth >= 2) when config loads
  useEffect(() => {
    if (!effectiveConfig) return;
    const paths = new Set<string>();
    const walk = (obj: any, p: string, depth: number) => {
      if (obj && typeof obj === "object") {
        if (depth >= 2) paths.add(p);
        if (Array.isArray(obj)) obj.forEach((v: any, i: number) => walk(v, `${p}[${i}]`, depth + 1));
        else Object.keys(obj).forEach(k => walk(obj[k], `${p}.${k}`, depth + 1));
      }
    };
    walk(effectiveConfig, "$", 0);
    setCollapsedPaths(paths);
  }, [effectiveConfig]);

  const fireApiRequest = useCallback(async (endpoint: string, method: string, params: Record<string, string>) => {
    const baseUrl = selectedModuleInfo?.api_url || apiUrl;
    setApiLoading(true);
    setApiResponse(null);
    setApiResponseStatus(null);
    try {
      // Build URL with path params replaced
      let url = endpoint;
      const queryParams = new URLSearchParams();
      const bodyParams: Record<string, any> = {};
      const ec = moduleConfig?.config || directConfig;
      const endpointConfig = ec?.endpoints?.[endpoint];
      const inputs = endpointConfig?.input || [];

      for (const [key, value] of Object.entries(params)) {
        if (!value && value !== "0") continue;
        if (url.includes(`{${key}}`)) {
          url = url.replace(`{${key}}`, encodeURIComponent(value));
        } else if (method === "GET") {
          queryParams.set(key, value);
        } else {
          // Check schema for type coercion
          const inputDef = inputs.find((i: any) => i.name === key);
          if (inputDef?.type === "bool") {
            bodyParams[key] = value === "true";
          } else if (inputDef?.type === "int") {
            bodyParams[key] = parseInt(value, 10);
          } else if (inputDef?.type === "list") {
            try { bodyParams[key] = JSON.parse(value); } catch { bodyParams[key] = value; }
          } else {
            bodyParams[key] = value;
          }
        }
      }

      const qs = queryParams.toString();
      const fullUrl = `${baseUrl}${url}${qs ? `?${qs}` : ""}`;
      const headers: Record<string, string> = {};
      if (method !== "GET") headers["Content-Type"] = "application/json";
      if (token && token !== "local") headers["Authorization"] = `Bearer ${token}`;
      const endpointAuth = endpointConfig?.auth;

      const opts: RequestInit = { method, headers };
      if (method !== "GET" && method !== "DELETE" && Object.keys(bodyParams).length > 0) {
        opts.body = JSON.stringify(bodyParams);
      }

      const res = await fetch(fullUrl, opts);
      setApiResponseStatus(res.status);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setApiResponse(JSON.stringify(json, null, 2));
      } catch {
        setApiResponse(text);
      }
    } catch (err: any) {
      setApiResponseStatus(0);
      setApiResponse(`Error: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  }, [selectedModuleInfo, apiUrl, moduleConfig, directConfig, token]);

  // ── Fire a function from the config schema ──
  const fireConfigFn = useCallback(async (fnName: string, params: Record<string, string>) => {
    const baseUrl = selectedModuleInfo?.api_url || apiUrl;
    setConfigFnLoading(true);
    setConfigFnResponse(null);
    try {
      const schema = effectiveConfig?.schema?.[fnName];
      const inputs = schema?.input || [];
      const bodyParams: Record<string, any> = {};
      for (const input of inputs) {
        const val = params[input.name];
        if (val !== undefined && val !== "") {
          if (input.type === "bool") bodyParams[input.name] = val === "true";
          else if (input.type === "int" || input.type === "float") bodyParams[input.name] = Number(val);
          else if (input.type === "list") { try { bodyParams[input.name] = JSON.parse(val); } catch { bodyParams[input.name] = val; } }
          else bodyParams[input.name] = val;
        }
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token && token !== "local") headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/forward`, {
        method: "POST",
        headers,
        body: JSON.stringify({ fn: fnName, ...bodyParams }),
      });
      const text = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { formatted = text; }
      setConfigFnResponse(`[${res.status}] ${formatted}`);
    } catch (e: any) {
      setConfigFnResponse(`[ERROR] ${e.message}`);
    } finally {
      setConfigFnLoading(false);
    }
  }, [selectedModuleInfo, apiUrl, effectiveConfig, token]);

  // Fetch changelog from API (must be before early return to maintain hook order)
  const fetchChangelog = useCallback(async () => {
    setChangelogLoading(true);
    try {
      const res = await fetch(`${apiUrl}/changelog`);
      if (res.ok) {
        const data = await res.json();
        setChangelogEntries(data.changelog || []);
      }
    } catch (e) {
      console.error("Failed to fetch changelog:", e);
    } finally {
      setChangelogLoading(false);
    }
  }, [apiUrl]);

  // Fetch a specific version detail (must be before early return to maintain hook order)
  const fetchVersionDetail = useCallback(async (version: string) => {
    setVersionDetailLoading(true);
    setSelectedVersion(version);
    try {
      const res = await fetch(`${apiUrl}/versions/${encodeURIComponent(version)}`);
      if (res.ok) {
        const data = await res.json();
        setVersionDetail(data);
      }
    } catch (e) {
      console.error("Failed to fetch version detail:", e);
    } finally {
      setVersionDetailLoading(false);
    }
  }, [apiUrl]);

  // ── JSON Tree Helpers (must be before early return to maintain hook order)
  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const copyValue = useCallback((path: string, value: any) => {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  }, []);

  const collapseAll = useCallback((data: any, prefix = "$") => {
    const paths = new Set<string>();
    const walk = (obj: any, p: string) => {
      if (obj && typeof obj === "object") {
        paths.add(p);
        if (Array.isArray(obj)) obj.forEach((v: any, i: number) => walk(v, `${p}[${i}]`));
        else Object.keys(obj).forEach(k => walk(obj[k], `${p}.${k}`));
      }
    };
    walk(data, prefix);
    setCollapsedPaths(paths);
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedPaths(new Set());
  }, []);

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
            background: isLight
              ? "radial-gradient(ellipse at center, rgba(0,0,0,0.02) 0%, transparent 70%)"
              : "radial-gradient(ellipse at center, rgba(51,255,51,0.03) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full px-4">
          {/* Boot Art */}
          <pre
            className="text-crt-green leading-none select-none whitespace-pre transition-opacity duration-700"
            style={{
              fontSize: "9px",
              textShadow: isLight ? "none" : "0 0 10px rgba(51,255,51,0.4), 0 0 3px rgba(51,255,51,0.2)",
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
            <div className="border-2 border-crt-green/30 p-4 space-y-1" style={{ background: tintBg }}>
              <div className="text-[14px] text-crt-green/60">SYSTEM CHECK ............ OK</div>
              <div className="text-[14px] text-crt-green/60">CLAUDE ENGINE ........... READY</div>
              <div className="text-[14px] text-crt-green/60">JOB SCHEDULER ........... ACTIVE</div>
              <div className="text-[14px] text-crt-green/60">SSE STREAM .............. ENABLED</div>
              <div className="text-[14px] text-crt-amber/80 mt-2">
                ⚠ WALLET SIGNATURE REQUIRED FOR ACCESS
              </div>
              {!hasMetaMask && !hasSubWallet && (
                <div className="text-[14px] text-crt-green/40">
                  ◇ NO WEB3 WALLET — LOCAL KEY MODE AVAILABLE
                </div>
              )}
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
                <span className="text-crt-amber text-[13px]">⬡</span>
                <h2
                  className="text-[14px] text-crt-amber"
                  style={{ textShadow: "0 0 8px rgba(255,176,0,0.4)" }}
                >
                  WALLET AUTHENTICATION
                </h2>
              </div>

              <div className="text-[14px] text-crt-green/50 mb-4 leading-relaxed">
                Sign a cryptographic challenge to authenticate.
                Your signature is verified server-side via ecrecover and
                becomes a 24-hour bearer token for all API requests.
              </div>

              <div className="flex flex-col items-center gap-4">
                {(hasMetaMask || hasSubWallet) && (
                  <>
                    <div className="flex gap-2 w-full max-w-xs">
                      {hasMetaMask && (
                        <button
                          onClick={() => connectWallet("metamask")}
                          disabled={authLoading}
                          className="pixel-btn pixel-btn-amber flex-1 text-[13px] py-3"
                          style={{ letterSpacing: "2px" }}
                        >
                          {authLoading ? (
                            <span className="animate-pulse">SIGNING...</span>
                          ) : (
                            "METAMASK"
                          )}
                        </button>
                      )}
                      {hasSubWallet && (
                        <button
                          onClick={() => connectWallet("subwallet")}
                          disabled={authLoading}
                          className="pixel-btn pixel-btn-blue flex-1 text-[13px] py-3"
                          style={{ letterSpacing: "2px" }}
                        >
                          {authLoading ? (
                            <span className="animate-pulse">SIGNING...</span>
                          ) : (
                            "SUBWALLET"
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-full max-w-xs">
                      <div className="flex-1 border-t border-crt-green/10" />
                      <span className="text-[13px] text-crt-green/20">OR</span>
                      <div className="flex-1 border-t border-crt-green/10" />
                    </div>
                  </>
                )}

                <button
                  onClick={connectLocal}
                  disabled={authLoading}
                  className="pixel-btn w-full max-w-xs text-[13px] py-3"
                  style={{ letterSpacing: "2px" }}
                >
                  {authLoading && !hasMetaMask && !hasSubWallet ? (
                    <span className="animate-pulse">GENERATING KEY...</span>
                  ) : (
                    "USE  LOCAL  KEY"
                  )}
                </button>

                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="flex-1 border-t border-crt-green/10" />
                  <span className="text-[13px] text-crt-green/20">OR</span>
                  <div className="flex-1 border-t border-crt-green/10" />
                </div>

                {!showPasswordInput ? (
                  <button
                    onClick={() => setShowPasswordInput(true)}
                    className="pixel-btn w-full max-w-xs text-[13px] py-3"
                    style={{ letterSpacing: "2px" }}
                  >
                    USE  PASSWORD  KEY
                  </button>
                ) : (
                  <div className="w-full max-w-xs space-y-2">
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full px-3 py-2 text-[13px] bg-crt-dark text-crt-green border-2 border-crt-amber/40 font-pixel"
                      style={{ letterSpacing: "1px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && passwordInput.trim()) connectWithPassword(passwordInput.trim());
                      }}
                    />
                    <button
                      onClick={() => passwordInput.trim() && connectWithPassword(passwordInput.trim())}
                      disabled={authLoading || !passwordInput.trim()}
                      className="pixel-btn pixel-btn-amber w-full text-[13px] py-3"
                      style={{ letterSpacing: "2px" }}
                    >
                      {authLoading ? (
                        <span className="animate-pulse">DERIVING KEY...</span>
                      ) : (
                        "CONNECT  WITH  PASSWORD"
                      )}
                    </button>
                  </div>
                )}

                <div className="text-[13px] text-crt-green/25">
                  Password derives a deterministic wallet key via keccak256
                </div>
              </div>

              {authError && (
                <div className="mt-4 border-2 border-crt-red/60 p-3" style={{ background: "rgba(255,51,51,0.05)" }}>
                  <div className="text-[14px] text-crt-red text-center">{authError}</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-[13px] text-crt-green/20 mt-4">
            BISMILLAH ░ MOD AI v1.0 ░ POWERED BY RUST + NEXT.JS
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  const renderDirectoryTree = (tree: any[], depth: number = 0): JSX.Element[] => {
    return tree.map((item, idx) => {
      const isExpanded = expandedDirs.has(item.path);
      const isDir = item.type === "directory";

      return (
        <div key={item.path + idx} style={{ marginLeft: `${depth * 12}px` }}>
          <div
            className="flex items-center gap-1.5 py-1 px-2 hover:bg-crt-green/5 cursor-pointer transition-colors text-[14px]"
            onClick={() => {
              if (isDir) {
                const newExpanded = new Set(expandedDirs);
                if (isExpanded) {
                  newExpanded.delete(item.path);
                } else {
                  newExpanded.add(item.path);
                }
                setExpandedDirs(newExpanded);
              } else {
                loadFileContent(item.path);
              }
            }}
          >
            {isDir ? (
              <span className="text-crt-amber/70">{isExpanded ? "📂" : "📁"}</span>
            ) : (
              <span className="text-crt-blue/50">📄</span>
            )}
            <span className="text-crt-green/80 truncate font-code" style={{ fontSize: "14px" }}>
              {item.name}
            </span>
          </div>
          {isDir && isExpanded && item.children && renderDirectoryTree(item.children, depth + 1)}
        </div>
      );
    });
  };

  const getLanguageFromPath = (filePath: string): string => {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
      py: "python", js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
      rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c", sh: "bash",
      json: "json", md: "markdown", yaml: "yaml", yml: "yaml", toml: "toml",
      xml: "xml", html: "html", css: "css", sql: "sql", rb: "ruby",
    };
    return map[ext] || "text";
  };

  const renderChangelogTab = () => {
    if (changelogLoading) {
      return (
        <div className="flex-1 flex items-center justify-center h-full">
          <span className="text-[14px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
            Loading changelog...
          </span>
        </div>
      );
    }

    if (changelogEntries.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full p-6">
          <span className="text-[48px] text-crt-green/10">v0</span>
          <span className="text-[14px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
            No versions yet
          </span>
          <p className="text-[14px] text-crt-green/20 text-center max-w-xs">
            Use <code className="text-crt-amber/40">c.snapshot(&quot;description&quot;)</code> from the Python SDK to create
            the first version. Each version is stored permanently on IPFS.
          </p>
          <button
            onClick={fetchChangelog}
            className="pixel-btn text-[14px] px-3 py-1.5 mt-2"
            style={{ background: "var(--accent-color)", color: "#000" }}
          >
            REFRESH
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Changelog Header */}
        <div
          className="px-4 py-2 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,170,255,0.02)" }}
        >
          <div>
            <span className="text-[14px] text-crt-blue/70 uppercase" style={{ letterSpacing: "1.5px" }}>
              VERSION HISTORY
            </span>
            <div className="text-[14px] text-crt-green/40 mt-0.5">
              {changelogEntries.length} version{changelogEntries.length !== 1 ? "s" : ""} on IPFS
            </div>
          </div>
          <button
            onClick={fetchChangelog}
            className="text-[14px] text-crt-green/40 hover:text-crt-green/70 transition-colors"
          >
            REFRESH
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Version List */}
          <div className="overflow-y-auto" style={{ maxHeight: selectedVersion ? "40%" : "100%" }}>
            {changelogEntries.map((entry, i) => {
              const isSelected = selectedVersion === entry.version;
              const isLatest = i === 0;
              return (
                <div
                  key={entry.version}
                  onClick={() => fetchVersionDetail(entry.version)}
                  className={`px-4 py-3 cursor-pointer border-b transition-all ${
                    isSelected ? "bg-crt-blue/10" : "hover:bg-white/[0.02]"
                  }`}
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-bold ${isLatest ? "text-crt-green" : "text-crt-amber/70"}`}>
                        v{entry.version}
                      </span>
                      {isLatest && (
                        <span className="text-[13px] px-1.5 py-0.5 bg-crt-green/20 text-crt-green rounded" style={{ letterSpacing: "1px" }}>
                          LATEST
                        </span>
                      )}
                    </div>
                    <span className="text-[14px] text-crt-green/30">{entry.date}</span>
                  </div>
                  <div className="text-[14px] text-crt-green/50 mt-1">{entry.description}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[13px] text-crt-green/25 font-mono">
                      {entry.cid?.substring(0, 20)}...
                    </span>
                    {entry.file_count && (
                      <span className="text-[13px] text-crt-green/25">
                        {entry.file_count} files
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Version Detail Panel */}
          {selectedVersion && (
            <div className="flex-1 border-t overflow-y-auto" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div
                className="px-4 py-2 border-b flex items-center justify-between sticky top-0 z-10"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "var(--bg-secondary)" }}
              >
                <span className="text-[14px] text-crt-blue uppercase" style={{ letterSpacing: "1px" }}>
                  v{selectedVersion}
                </span>
                <button
                  onClick={() => { setSelectedVersion(null); setVersionDetail(null); }}
                  className="text-[14px] text-crt-red/50 hover:text-crt-red/70"
                >
                  CLOSE
                </button>
              </div>

              {versionDetailLoading ? (
                <div className="p-4 text-[14px] text-crt-green/30">Loading version data...</div>
              ) : versionDetail ? (
                <div className="p-4">
                  <div className="text-[14px] text-crt-green/60 mb-3">
                    {versionDetail.version?.description || "No description"}
                  </div>

                  {/* CID with link */}
                  <div className="mb-3">
                    <div className="text-[14px] text-crt-green/30 mb-1" style={{ letterSpacing: "1px" }}>IPFS CID</div>
                    <a
                      href={versionDetail.gateway}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] text-crt-blue/70 hover:text-crt-blue font-mono break-all transition-colors"
                    >
                      {versionDetail.version?.cid}
                    </a>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-[14px]">
                    <div>
                      <span className="text-crt-green/30">Date</span>
                      <div className="text-crt-green/60">{versionDetail.version?.date}</div>
                    </div>
                    {versionDetail.version?.file_count && (
                      <div>
                        <span className="text-crt-green/30">Files</span>
                        <div className="text-crt-green/60">{versionDetail.version.file_count}</div>
                      </div>
                    )}
                  </div>

                  {/* Restore hint */}
                  <div className="mt-4 p-2 border rounded" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
                    <div className="text-[14px] text-crt-amber/50 mb-1">RESTORE THIS VERSION</div>
                    <code className="text-[14px] text-crt-green/40 block">
                      c.restore_version(&quot;{selectedVersion}&quot;, dry_run=False)
                    </code>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-[14px] text-crt-green/30">Select a version to view details</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDirectoryTab = () => {
    const fileWorkDir = selectedJob ? jobs.find(j => j.id === selectedJob)?.work_dir || workDir : workDir || "~/mod";

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Directory Header with Inline Search */}
        <div
          style={{
            borderBottom: `1px solid ${subtleBorder}`,
            background: tintBg,
          }}
        >
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-crt-green/70" style={{ letterSpacing: "1.5px" }}>
                📁 FILES
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setInlineSearchMode((prev) => prev === "files" ? "off" : "files");
                  setInlineSearchQuery("");
                  setInlineSearchResults([]);
                  setTimeout(() => inlineSearchRef.current?.focus(), 50);
                }}
                className={`text-[13px] px-1.5 py-0.5 border transition-all uppercase ${
                  inlineSearchMode === "files"
                    ? "border-crt-blue text-crt-blue bg-crt-blue/10"
                    : "border-crt-blue/30 text-crt-blue/60 hover:text-crt-blue hover:border-crt-blue"
                }`}
                title="Search files by name (Ctrl+P)"
                style={{ letterSpacing: "0.5px" }}
              >
                🔍 FILES
              </button>
              <button
                onClick={() => {
                  setInlineSearchMode((prev) => prev === "grep" ? "off" : "grep");
                  setInlineSearchQuery("");
                  setInlineSearchResults([]);
                  setTimeout(() => inlineSearchRef.current?.focus(), 50);
                }}
                className={`text-[13px] px-1.5 py-0.5 border transition-all uppercase ${
                  inlineSearchMode === "grep"
                    ? "border-crt-blue text-crt-blue bg-crt-blue/10"
                    : "border-crt-blue/30 text-crt-blue/60 hover:text-crt-blue hover:border-crt-blue"
                }`}
                title="Search file contents (Ctrl+Shift+F)"
                style={{ letterSpacing: "0.5px" }}
              >
                🔎 GREP
              </button>
              <button
                onClick={() => fetchDirectoryTree()}
                className="text-[13px] px-1.5 py-0.5 border border-crt-green/20 text-crt-green/40 hover:text-crt-green/70 hover:border-crt-green/40 transition-all"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          {/* Inline Search Bar */}
          {inlineSearchMode !== "off" && (
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 px-2 py-1.5 border border-crt-blue/30 bg-black/40"
                style={{ borderRadius: "2px" }}
              >
                <span className="text-[14px] text-crt-blue/60">
                  {inlineSearchMode === "files" ? "🔍" : "🔎"}
                </span>
                <input
                  ref={inlineSearchRef}
                  type="text"
                  value={inlineSearchQuery}
                  onChange={(e) => setInlineSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setInlineSearchMode("off");
                      setInlineSearchQuery("");
                      setInlineSearchResults([]);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setInlineSelectedIndex((p) => Math.min(p + 1, inlineSearchResults.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setInlineSelectedIndex((p) => Math.max(p - 1, 0));
                    } else if (e.key === "Enter" && inlineSearchResults[inlineSelectedIndex]) {
                      const r = inlineSearchResults[inlineSelectedIndex];
                      loadFileContent(r.path);
                      setModuleTab("app");
                      setInlineSearchMode("off");
                      setInlineSearchQuery("");
                      setInlineSearchResults([]);
                    }
                  }}
                  placeholder={inlineSearchMode === "files" ? "Search files by name..." : "Search file contents..."}
                  className="flex-1 bg-transparent border-none outline-none text-[13px] text-white font-code"
                  autoFocus
                />
                {inlineSearchLoading && (
                  <span className="text-[14px] text-crt-green/40 animate-pulse">...</span>
                )}
                <span className="text-[13px] text-white/20">ESC</span>
              </div>

              {/* Inline Results */}
              {inlineSearchResults.length > 0 && (
                <div className="mt-1 max-h-[240px] overflow-y-auto border border-white/5 bg-black/60" style={{ borderRadius: "2px" }}>
                  {inlineSearchResults.map((result, idx) => (
                    <div
                      key={inlineSearchMode === "files" ? result.path : `${result.path}-${result.line}-${idx}`}
                      onClick={() => {
                        loadFileContent(result.path);
                        setModuleTab("app");
                        setInlineSearchMode("off");
                        setInlineSearchQuery("");
                        setInlineSearchResults([]);
                      }}
                      onMouseEnter={() => setInlineSelectedIndex(idx)}
                      className="px-2 py-1.5 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: idx === inlineSelectedIndex ? "rgba(0,170,255,0.15)" : "transparent",
                        borderLeft: idx === inlineSelectedIndex ? "2px solid #00aaff" : "2px solid transparent",
                      }}
                    >
                      {inlineSearchMode === "files" ? (
                        <>
                          <div className="text-[14px] text-white font-code">{result.filename}</div>
                          <div className="text-[14px] text-white/30 font-code truncate">{result.path}</div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] text-crt-blue font-code">{result.filename}</span>
                            <span className="text-[14px] text-white/30 font-code">:{result.line}</span>
                          </div>
                          <div className="text-[14px] text-white/50 font-code truncate whitespace-pre">{result.content}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {inlineSearchQuery && !inlineSearchLoading && inlineSearchResults.length === 0 && (
                <div className="mt-1 text-center text-[14px] text-white/20 py-2 font-code">No results</div>
              )}
            </div>
          )}
        </div>

        {/* Path display */}
        {(selectedJob || workDir) && (
          <div className="px-3 py-1 border-b text-[14px] text-crt-green/30 truncate font-code" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {fileWorkDir}
          </div>
        )}

        {/* Side-by-side: file tree + file content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: File tree */}
          <div
            className="overflow-y-auto p-2 shrink-0 border-r"
            style={{
              width: viewingFile ? "200px" : "100%",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            {directoryTree.length > 0 ? (
              renderDirectoryTree(directoryTree, 0)
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <span className="text-[13px] text-crt-green/50">📂 No files loaded</span>
                <span className="text-[14px] text-crt-green/30">Select a module above or click refresh</span>
                <button
                  onClick={() => fetchDirectoryTree()}
                  className="text-[14px] px-3 py-1.5 border border-crt-green/30 text-crt-green/60 hover:text-crt-green hover:border-crt-green transition-all"
                >
                  ↻ LOAD FILES
                </button>
              </div>
            )}
          </div>

          {/* Right: File content viewer */}
          {viewingFile && (
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* File header */}
              <div
                className="px-3 py-1.5 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,170,255,0.03)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] text-crt-blue font-bold truncate font-code">
                    {viewingFile.split("/").pop()}
                  </span>
                  <span className="text-[14px] text-crt-green/30 uppercase shrink-0 font-code">
                    {getLanguageFromPath(viewingFile)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[14px] text-crt-green/20 font-code">
                    {viewingFileContent.split("\n").length} lines
                  </span>
                  <button
                    onClick={() => { setViewingFile(null); setViewingFileContent(""); }}
                    className="text-[13px] px-1.5 py-0.5 border border-crt-red/30 text-crt-red/50 hover:text-crt-red hover:border-crt-red transition-all"
                    title="Close file"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {/* File path */}
              <div className="px-3 py-0.5 text-[14px] text-crt-green/20 truncate border-b shrink-0 font-code" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                {viewingFile}
              </div>
              {/* File content */}
              <div className="flex-1 overflow-auto">
                {viewingFileLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[14px] text-crt-blue animate-pulse">Loading file...</span>
                  </div>
                ) : (
                  <pre
                    className="m-0 p-3 text-[13px] leading-relaxed font-code whitespace-pre"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {viewingFileContent.split("\n").map((line, i) => (
                      <div key={i} className="flex hover:bg-crt-green/5">
                        <span
                          className="select-none text-right pr-3 shrink-0"
                          style={{ color: "var(--text-tertiary)", opacity: 0.3, minWidth: "3em" }}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1">{line || " "}</span>
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTasksTab = () => {
    const filteredJobs = jobs.filter((j) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        j.prompt.toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q) ||
        j.model.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q) ||
        (j.work_dir && j.work_dir.toLowerCase().includes(q));
      const matchesStatus = !statusFilter || j.status === statusFilter;
      // Filter by selected module - match on orbit path suffix (work_dir may have expanded ~ to /Users/...)
      const matchesModule = !selectedModule || (j.work_dir && (j.work_dir.includes(`/orbit/${selectedModule}`) || j.work_dir.includes("/orbit/claude")));
      return matchesSearch && matchesStatus && matchesModule;
    });

    return (
      <div className={`flex flex-col overflow-hidden ${selectedJob ? '' : 'flex-1'}`} style={selectedJob ? { maxHeight: '50%' } : {}}>
        {/* NEW TASK FORM - Sleek unified input */}
        <div className="border-b-2 p-4 flex flex-col" style={{ borderColor: subtleBorder, background: tintBg, minHeight: "50%" }}>
          <div
            className="border-2 border-crt-amber/40 relative flex-1 flex flex-col"
            style={{ background: darkOverlay }}
          >
            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what Claude should do... (paste images here)  [Enter=submit, Shift+Enter=newline]"
              className="w-full p-4 pb-10 text-[16px] resize-none rounded-none bg-transparent border-0 outline-none flex-1"
              style={{ lineHeight: "1.6", color: "var(--text-primary)", minHeight: "120px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitJob();
                }
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith("image/")) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (!file) continue;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = reader.result as string;
                      setImages((prev) => [...prev, { name: file.name || `image-${Date.now()}.png`, data: base64 }]);
                    };
                    reader.readAsDataURL(file);
                  }
                }
              }}
            />

            {/* Bottom bar inside textarea border */}
            <div
              className="flex items-center gap-2 px-3 py-2 border-t border-crt-amber/20 shrink-0"
              style={{ background: darkOverlayStrong }}
            >
              {/* Model selector */}
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  localStorage.setItem("claude_jobs_model", e.target.value);
                }}
                className="px-2 py-1 text-[13px] bg-transparent text-crt-green border border-crt-green/20 font-pixel uppercase cursor-pointer hover:border-crt-green/40 transition-colors"
                style={{ maxWidth: "160px" }}
              >
                <option value="opus">OPUS 4.6</option>
                <option value="sonnet">SONNET 4.5</option>
                <option value="haiku">HAIKU 4.5</option>
              </select>

              {/* Divider */}
              <div className="w-px h-5 bg-crt-green/15" />

              {/* Inline Module Bubble */}
              <div className="relative" ref={inlineModuleRef}>
                {showInlineModuleDropdown ? (
                  <input
                    type="text"
                    autoFocus
                    value={selectedModule ? selectedModule : moduleSearch}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModuleSearch(v);
                      setSelectedModule("");
                      setSelectedModuleInfo(null);
                      fetchModules(v);
                    }}
                    onFocus={(e) => {
                      e.target.select();
                      if (!moduleList.length) fetchModules(moduleSearch);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && moduleList.length > 0) {
                        const firstModule = moduleList[0];
                        setSelectedModule(firstModule.name);
                        setSelectedModuleInfo(firstModule);
                        setWorkDir(firstModule.path);
                        setModuleSearch("");
                        setShowInlineModuleDropdown(false);
                        setShowModuleDropdown(false);
                        fetchModuleConfig(firstModule.name);
                      }
                      if (e.key === "Escape") {
                        setShowInlineModuleDropdown(false);
                      }
                    }}
                    onBlur={() => {
                      // small delay so click on dropdown item fires first
                      setTimeout(() => setShowInlineModuleDropdown(false), 150);
                    }}
                    placeholder="module..."
                    className="px-2 py-1 text-[13px] bg-transparent text-crt-green border border-crt-green/40 font-pixel uppercase outline-none w-[140px]"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setShowInlineModuleDropdown(true);
                      if (!moduleList.length) fetchModules(moduleSearch);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[13px] border border-crt-green/30 text-crt-green font-pixel uppercase cursor-pointer hover:border-crt-green/60 hover:bg-crt-green/5 transition-all"
                    title="Click to change module"
                  >
                    <span style={{ color: "var(--crt-green)", opacity: 0.5 }}>/</span>
                    {selectedModule || "claude"}
                    <span style={{ color: "var(--crt-green)", opacity: 0.3, fontSize: "13px" }}>▼</span>
                  </button>
                )}
                {showInlineModuleDropdown && moduleList.length > 0 && (
                  <div
                    className="absolute left-0 bottom-full mb-1 border border-crt-green/30 max-h-[200px] overflow-y-auto z-50 rounded-sm min-w-[220px]"
                    style={{ background: "var(--bg-primary)", boxShadow: "0 -8px 32px rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
                  >
                    {moduleList.map((m) => (
                      <div
                        key={m.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedModule(m.name);
                          setSelectedModuleInfo(m);
                          setWorkDir(m.path);
                          setModuleSearch("");
                          setShowInlineModuleDropdown(false);
                          setShowModuleDropdown(false);
                          fetchModuleConfig(m.name);
                        }}
                        className={`px-3 py-2 cursor-pointer hover:bg-crt-green/10 transition-colors border-b border-crt-green/5 ${m.name === selectedModule ? 'bg-crt-green/8' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-crt-green font-code">{m.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 border font-code ${m.category === "core" ? "border-crt-red/30 text-crt-red/50" : "border-crt-green/15 text-crt-green/25"}`}>
                              {m.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {m.app_url && (
                              <span className="text-xs px-1.5 py-0.5 border border-crt-blue/40 text-crt-blue bg-crt-blue/10">APP</span>
                            )}
                            {m.api_url && (
                              <span className="text-xs px-1.5 py-0.5 border border-crt-amber/40 text-crt-amber bg-crt-amber/10">API</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-crt-green/15" />

              {/* Image count badge */}
              {images.length > 0 && (
                <div className="relative group flex items-center">
                  <span
                    className="text-[14px] px-2 py-1 border border-crt-blue/30 text-crt-blue/70 uppercase cursor-default"
                    style={{ letterSpacing: "0.5px" }}
                  >
                    {images.length} IMG{images.length > 1 ? "S" : ""}
                  </span>
                  <button
                    onClick={() => setImages([])}
                    className="text-[14px] text-crt-red/60 hover:text-crt-red ml-1 transition-colors"
                    title="Clear all images"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Submit button */}
              <button
                onClick={submitJob}
                disabled={submitting || !prompt.trim()}
                className="pixel-btn text-[13px] py-1.5 px-6 uppercase"
                style={{ letterSpacing: "1.5px" }}
              >
                {submitting ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  "EXEC"
                )}
              </button>
            </div>
          </div>


        </div>

        {/* Search & Filter Bar */}
        <div className="border-b px-3 py-1.5 flex items-center gap-2" style={{ borderColor: subtleBorder }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter..."
            className="flex-1 min-w-0 px-2 py-1 text-[13px] border-none bg-transparent text-crt-green/70 focus:outline-none placeholder:text-crt-green/20"
          />
          <div className="flex gap-2 shrink-0 items-center">
            {["running", "pending", "completed", "failed", "cancelled"].map((status) => {
              const count = jobs.filter(j => j.status === status && (!selectedModule || (j.work_dir && (j.work_dir.includes(`/orbit/${selectedModule}`) || j.work_dir.includes("/orbit/claude"))))).length;
              if (count === 0) return null;
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(isActive ? null : status)}
                  className="text-[13px] transition-opacity whitespace-nowrap border-none bg-transparent cursor-pointer"
                  style={{
                    color: isActive ? STATUS_COLOR[status] : `${STATUS_COLOR[status]}66`,
                    opacity: isActive ? 1 : 0.6,
                  }}
                  title={STATUS_LABEL[status]}
                >
                  {STATUS_ICON[status]}{count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto">
          {loading && !jobs.length ? (
            <div className="p-8 text-center">
              <p className="text-[14px] cursor-blink" style={{ color: "var(--text-tertiary)" }}>
                LOADING JOBS
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[14px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                No agent tasks found
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob === job.id;
              const color = STATUS_COLOR[job.status];
              const isPromptExpanded = expandedPrompts.has(job.id);
              const moduleName = job.work_dir ? extractModuleFromWorkDir(job.work_dir) : null;
              return (
                <div
                  key={job.id}
                  onClick={() => viewJob(job)}
                  className="cursor-pointer transition-all duration-150 border-b"
                  style={{
                    borderColor: faintGreen,
                    borderLeft: isSelected ? `4px solid ${color}` : "4px solid transparent",
                    background: isSelected ? `${color}10` : "transparent",
                  }}
                >
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[14px] ${job.status === "running" ? "led-pulse" : ""}`} style={{ color }}>
                          {STATUS_ICON[job.status]}
                        </span>
                        <span className="text-[14px] font-pixel" style={{ color, letterSpacing: "0.5px" }}>
                          {STATUS_LABEL[job.status]}
                        </span>
                        <span className="text-[13px] font-pixel" style={{ color: "var(--crt-amber)", opacity: 0.4, letterSpacing: "0.5px" }}>
                          {job.model === "opus" ? "OPUS 4.6" : job.model === "sonnet" ? "SONNET 4.5" : job.model === "haiku" ? "HAIKU 4.5" : job.model.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(job.status === "running" || job.status === "pending") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                            className="text-[13px] px-2 py-1 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all uppercase"
                            style={{ letterSpacing: "0.5px" }}
                            title="Cancel task"
                          >
                            CANCEL
                          </button>
                        )}
                        {(job.status === "completed" || job.status === "failed" || job.status === "cancelled") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                            className="text-[13px] px-2 py-1 border border-red-500/30 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500 transition-all uppercase"
                            style={{ letterSpacing: "0.5px" }}
                            title="Delete task"
                          >
                            DEL
                          </button>
                        )}
                        <span className="text-[13px]" style={{ color: faintGreenText }}>
                          {timeSince(job.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Prompt - click to expand/collapse */}
                    <div
                      onClick={(e) => { if (job.prompt.length > 80) togglePromptExpand(job.id, e); }}
                      className="mb-1"
                      style={{ cursor: job.prompt.length > 80 ? "pointer" : "default" }}
                    >
                      <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)", whiteSpace: isPromptExpanded ? "pre-wrap" : "nowrap", overflow: isPromptExpanded ? "visible" : "hidden", textOverflow: isPromptExpanded ? "clip" : "ellipsis" }}>
                        {isPromptExpanded ? job.prompt : (job.prompt.length > 80 ? job.prompt.slice(0, 80) + "..." : job.prompt)}
                      </p>
                      {job.prompt.length > 80 && (
                        <span className="text-[14px]" style={{ color: "var(--crt-blue)", opacity: 0.5 }}>
                          {isPromptExpanded ? "▲ COLLAPSE" : "▼ EXPAND"}
                        </span>
                      )}
                    </div>

                    {job.work_dir && (
                      <p className="text-[13px] truncate mb-1.5" style={{ color: "var(--crt-amber)", opacity: 0.5 }}>
                        {moduleName ? `◈ ${moduleName.toUpperCase()}` : `📁 ${job.work_dir}`}
                      </p>
                    )}

                    {/* Action button: COPY */}
                    <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => copyTaskToInput(job, e)}
                        className="text-[14px] px-2 py-0.5 border border-crt-blue/30 text-crt-blue/70 hover:bg-crt-blue/15 hover:border-crt-blue/60 hover:text-crt-blue transition-all uppercase"
                        style={{ letterSpacing: "0.5px" }}
                        title="Copy prompt & module into input"
                      >
                        ⧉ COPY
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderAppTab = () => {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* App Content */}
        <div className="flex-1 overflow-hidden">
          {selectedModuleInfo?.app_url ? (
            <iframe
              src={selectedModuleInfo.app_url}
              className="w-full h-full border-0"
              title="Module App"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
              <span className="text-[48px] text-crt-green/10">🎨</span>
              <span className="text-[14px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
                No app available
              </span>
              <p className="text-[14px] text-crt-green/20 text-center max-w-xs">
                {selectedModule
                  ? `Module "${selectedModule}" does not have an app interface.`
                  : "Select a module with an app to view it here."}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };


  // Depth-based guide line colors for the JSON tree
  const DEPTH_COLORS = [
    "#ff6b6b", // red
    "#ffa502", // orange
    "#ffd43b", // yellow
    "#51cf66", // green
    "#22b8cf", // cyan
    "#748ffc", // blue
    "#cc5de8", // purple
    "#ff6b9d", // pink
  ];

  const renderJsonNode = (key: string | number | null, value: any, path: string, depth: number, isLast: boolean, isArrayItem: boolean): React.ReactNode => {
    const isCollapsed = collapsedPaths.has(path);
    const isCopied = copiedPath === path;
    const isPrimitive = value === null || typeof value !== "object";
    const guideColor = DEPTH_COLORS[depth % DEPTH_COLORS.length];

    // Depth guide lines (vertical colored bars)
    const renderGuides = (d: number) => {
      const guides = [];
      for (let i = 0; i < d; i++) {
        guides.push(
          <span
            key={i}
            className="inline-block shrink-0"
            style={{
              width: "16px",
              borderLeft: `2px solid ${DEPTH_COLORS[i % DEPTH_COLORS.length]}`,
              opacity: 0.2,
              height: "100%",
              minHeight: "18px",
            }}
          />
        );
      }
      return guides;
    };

    // Type badge for values
    const typeBadge = (val: any) => {
      if (val === null) return <span className="text-[13px] px-1 py-px rounded ml-1" style={{ color: "#888", background: "rgba(136,136,136,0.1)", border: "1px solid rgba(136,136,136,0.15)" }}>null</span>;
      if (typeof val === "boolean") return <span className="text-[13px] px-1 py-px rounded ml-1" style={{ color: "#ff79c6", background: "rgba(255,121,198,0.08)", border: "1px solid rgba(255,121,198,0.15)" }}>bool</span>;
      if (typeof val === "number") return <span className="text-[13px] px-1 py-px rounded ml-1" style={{ color: "#bd93f9", background: "rgba(189,147,249,0.08)", border: "1px solid rgba(189,147,249,0.15)" }}>num</span>;
      if (typeof val === "string" && val.startsWith("0x")) return <span className="text-[13px] px-1 py-px rounded ml-1" style={{ color: "#50fa7b", background: "rgba(80,250,123,0.08)", border: "1px solid rgba(80,250,123,0.15)" }}>addr</span>;
      if (typeof val === "string" && val.startsWith("http")) return <span className="text-[13px] px-1 py-px rounded ml-1" style={{ color: "#8be9fd", background: "rgba(139,233,253,0.08)", border: "1px solid rgba(139,233,253,0.15)" }}>url</span>;
      return null;
    };

    // Render value portion with enhanced colors
    const renderVal = () => {
      if (value === null) return <span style={{ color: "#6272a4", fontStyle: "italic" }}>null</span>;
      if (typeof value === "boolean") return <span style={{ color: "#ff79c6", fontWeight: "bold", textShadow: "0 0 6px rgba(255,121,198,0.3)" }}>{String(value)}</span>;
      if (typeof value === "number") return <span style={{ color: "#bd93f9", textShadow: "0 0 6px rgba(189,147,249,0.3)" }}>{value}</span>;
      if (typeof value === "string") {
        const isUrl = value.startsWith("http");
        const isAddr = value.startsWith("0x");
        const color = isUrl ? "#8be9fd" : isAddr ? "#50fa7b" : "#f1fa8c";
        const glow = isUrl ? "rgba(139,233,253,0.2)" : isAddr ? "rgba(80,250,123,0.2)" : "rgba(241,250,140,0.15)";
        return <span style={{ color, textShadow: `0 0 4px ${glow}` }}>&quot;{value}&quot;</span>;
      }
      return null;
    };

    // Primitive
    if (isPrimitive) {
      return (
        <div
          key={path}
          className="group/jrow flex items-stretch transition-colors"
          style={{
            background: "transparent",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `rgba(${depth % 2 === 0 ? "255,255,255" : "139,233,253"},0.03)`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {renderGuides(depth)}
          <div className="flex-1 flex items-center py-[2px] pl-1">
            {key !== null && !isArrayItem && (
              <><span style={{ color: "#8be9fd", fontWeight: "bold" }}>&quot;{key}&quot;</span><span style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>: </span></>
            )}
            {isArrayItem && key !== null && (
              <span className="text-[14px] mr-1.5 inline-flex items-center justify-center w-4 text-center" style={{ color: "var(--text-tertiary)", opacity: 0.35 }}>{key}</span>
            )}
            {renderVal()}
            {typeBadge(value)}
            {!isLast && <span style={{ color: "var(--text-tertiary)", opacity: 0.25 }}>,</span>}
          </div>
          <span
            onClick={() => copyValue(path, value)}
            className="cursor-pointer opacity-0 group-hover/jrow:opacity-60 hover:!opacity-100 text-[14px] px-2 py-0 mr-2 rounded transition-all select-none shrink-0 flex items-center"
            style={{ color: isCopied ? "#50fa7b" : "var(--text-tertiary)", background: isCopied ? "rgba(80,250,123,0.1)" : "rgba(255,255,255,0.04)" }}
            title="Copy value"
          >
            {isCopied ? "✓ copied" : "⧉"}
          </span>
        </div>
      );
    }

    // Object / Array
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v: any, i: number) => [i, v] as [number, any]) : Object.entries(value);
    const count = entries.length;
    const openBracket = isArray ? "[" : "{";
    const closeBracket = isArray ? "]" : "}";
    const bracketColor = DEPTH_COLORS[depth % DEPTH_COLORS.length];

    if (count === 0) {
      return (
        <div key={path} className="flex items-stretch" style={{}}>
          {renderGuides(depth)}
          <div className="flex items-center py-[2px] pl-1">
            {key !== null && !isArrayItem && (
              <><span style={{ color: "#8be9fd", fontWeight: "bold" }}>&quot;{key}&quot;</span><span style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>: </span></>
            )}
            <span style={{ color: bracketColor, opacity: 0.5 }}>{openBracket}{closeBracket}</span>
            {!isLast && <span style={{ color: "var(--text-tertiary)", opacity: 0.25 }}>,</span>}
          </div>
        </div>
      );
    }

    return (
      <div key={path}>
        {/* Header row */}
        <div
          className="group/jrow flex items-stretch cursor-pointer transition-colors"
          style={{ background: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `rgba(${depth % 2 === 0 ? "255,255,255" : "139,233,253"},0.03)`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          onClick={() => toggleCollapse(path)}
        >
          {renderGuides(depth)}
          <span className="w-4 flex items-center justify-center text-[13px] shrink-0 select-none transition-transform" style={{ color: bracketColor }}>
            {isCollapsed ? "▸" : "▾"}
          </span>
          <div className="flex-1 flex items-center py-[2px]">
            {key !== null && !isArrayItem && (
              <><span style={{ color: "#8be9fd", fontWeight: "bold" }}>&quot;{key}&quot;</span><span style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>: </span></>
            )}
            {isArrayItem && key !== null && (
              <span className="text-[14px] mr-1.5 inline-flex items-center justify-center w-4 text-center" style={{ color: "var(--text-tertiary)", opacity: 0.35 }}>{key}</span>
            )}
            <span style={{ color: bracketColor, fontWeight: "bold", textShadow: `0 0 8px ${bracketColor}44` }}>{openBracket}</span>
            {isCollapsed && (
              <>
                <span className="text-[14px] px-1.5 mx-1 rounded-sm inline-flex items-center gap-1" style={{
                  color: bracketColor,
                  background: `${bracketColor}11`,
                  border: `1px solid ${bracketColor}22`,
                }}>
                  <span style={{ opacity: 0.7 }}>{isArray ? "▤" : "◈"}</span>
                  {count} {isArray ? (count === 1 ? "item" : "items") : (count === 1 ? "key" : "keys")}
                </span>
                <span style={{ color: bracketColor, fontWeight: "bold", textShadow: `0 0 8px ${bracketColor}44` }}>{closeBracket}</span>
                {!isLast && <span style={{ color: "var(--text-tertiary)", opacity: 0.25 }}>,</span>}
              </>
            )}
          </div>
          <span
            onClick={(e) => { e.stopPropagation(); copyValue(path, value); }}
            className="cursor-pointer opacity-0 group-hover/jrow:opacity-60 hover:!opacity-100 text-[14px] px-2 py-0 mr-2 rounded transition-all select-none shrink-0 flex items-center"
            style={{ color: isCopied ? "#50fa7b" : "var(--text-tertiary)", background: isCopied ? "rgba(80,250,123,0.1)" : "rgba(255,255,255,0.04)" }}
            title="Copy object"
          >
            {isCopied ? "✓ copied" : "⧉"}
          </span>
        </div>
        {/* Children */}
        {!isCollapsed && (
          <>
            {entries.map(([k, v]: [any, any], idx: number) => {
              const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
              return renderJsonNode(k, v, childPath, depth + 1, idx === count - 1, isArray);
            })}
            <div className="flex items-stretch">
              {renderGuides(depth)}
              <span className="w-4 inline-block shrink-0" />
              <span style={{ color: bracketColor, fontWeight: "bold", textShadow: `0 0 8px ${bracketColor}44` }}>{closeBracket}</span>
              {!isLast && <span style={{ color: "var(--text-tertiary)", opacity: 0.25 }}>,</span>}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderConfigTab = () => {
    const cfg = effectiveConfig;
    if (!cfg) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full p-6">
          <span className="text-[48px] opacity-10">⚙️</span>
          <span className="text-[14px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
            {loadingConfig ? "Loading config..." : "No config loaded"}
          </span>
          <button
            onClick={fetchDirectConfig}
            className="text-[14px] px-3 py-1 border border-crt-green/30 text-crt-green/60 hover:bg-crt-green/10 transition-all uppercase"
            style={{ letterSpacing: "1px" }}
          >
            Retry
          </button>
        </div>
      );
    }

    const endpointCount = cfg.endpoints ? Object.keys(cfg.endpoints).length : 0;
    const fnCount = cfg.fns ? cfg.fns.length : 0;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Config Header - Enhanced */}
        <div
          className="px-4 py-3 border-b shrink-0"
          style={{
            borderColor: "rgba(255,176,0,0.15)",
            background: "linear-gradient(180deg, rgba(255,176,0,0.06) 0%, rgba(255,176,0,0.01) 100%)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold" style={{ color: "var(--crt-amber)", letterSpacing: "2px", textShadow: "0 0 10px rgba(255,176,0,0.4)" }}>
                {cfg.name?.toUpperCase() || "MODULE"}
              </span>
              <span className="text-[14px] px-1.5 py-0.5 rounded-sm" style={{ color: "#50fa7b", background: "rgba(80,250,123,0.1)", border: "1px solid rgba(80,250,123,0.2)" }}>
                v{cfg.version || "?"}
              </span>
              <span className="text-[14px] px-1.5 py-0.5 rounded-sm" style={{ color: "var(--crt-blue)", background: "rgba(0,170,255,0.08)", border: "1px solid rgba(0,170,255,0.15)" }}>
                :{cfg.port || "?"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => collapseAll(cfg)}
                className="text-[13px] px-2.5 py-1 rounded-sm transition-all hover:brightness-125"
                style={{
                  color: "#ffa502",
                  background: "rgba(255,165,2,0.08)",
                  border: "1px solid rgba(255,165,2,0.2)",
                  letterSpacing: "0.5px",
                }}
                title="Collapse all nested objects"
              >
                ◇ COLLAPSE
              </button>
              <button
                onClick={expandAll}
                className="text-[13px] px-2.5 py-1 rounded-sm transition-all hover:brightness-125"
                style={{
                  color: "#51cf66",
                  background: "rgba(81,207,102,0.08)",
                  border: "1px solid rgba(81,207,102,0.2)",
                  letterSpacing: "0.5px",
                }}
                title="Expand all nested objects"
              >
                ◆ EXPAND
              </button>
              <button
                onClick={() => copyValue("$root", cfg)}
                className="text-[13px] px-2.5 py-1 rounded-sm transition-all hover:brightness-125"
                style={{
                  color: copiedPath === "$root" ? "#50fa7b" : "#748ffc",
                  background: copiedPath === "$root" ? "rgba(80,250,123,0.12)" : "rgba(116,143,252,0.08)",
                  border: `1px solid ${copiedPath === "$root" ? "rgba(80,250,123,0.3)" : "rgba(116,143,252,0.2)"}`,
                  letterSpacing: "0.5px",
                }}
                title="Copy entire config JSON"
              >
                {copiedPath === "$root" ? "✓ COPIED" : "⧉ COPY ALL"}
              </button>
            </div>
          </div>
          {/* Stats bar */}
          <div className="flex items-center gap-3 text-[14px]">
            {endpointCount > 0 && (
              <span style={{ color: "#ff6b6b", opacity: 0.7 }}>
                ● {endpointCount} endpoints
              </span>
            )}
            {fnCount > 0 && (
              <span style={{ color: "#ffd43b", opacity: 0.7 }}>
                ● {fnCount} functions
              </span>
            )}
            {cfg.owner && (
              <span style={{ color: "#50fa7b", opacity: 0.5 }}>
                ● {cfg.owner.slice(0, 6)}...{cfg.owner.slice(-4)}
              </span>
            )}
            <span style={{ color: "var(--text-tertiary)", opacity: 0.3 }}>config.json</span>
          </div>
        </div>

        {/* Collapsible JSON Tree - Enhanced */}
        <div
          className="flex-1 overflow-y-auto overflow-x-auto px-1 py-2 text-[13px] font-mono leading-[1.5]"
          style={{
            color: "var(--crt-green)",
            background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 2%)",
          }}
        >
          {renderJsonNode(null, cfg, "$", 0, true, false)}
        </div>
      </div>
    );
  };

  const renderApiTab = () => {
    const endpoints = effectiveConfig?.endpoints || {};
    const endpointKeys = Object.keys(endpoints);
    const baseUrl = selectedModuleInfo?.api_url || apiUrl;

    if (!effectiveConfig || endpointKeys.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full p-6">
          <span className="text-[48px] text-crt-green/10">⚙️</span>
          <span className="text-[14px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
            {loadingConfig ? "Loading config..." : "No API endpoints"}
          </span>
          <p className="text-[13px] text-crt-green/20 text-center max-w-xs">
            {selectedModule
              ? `Select a module with endpoints in config.json`
              : "Select a module to explore its API."}
          </p>
        </div>
      );
    }

    const currentEndpoint = apiSelectedEndpoint ? endpoints[apiSelectedEndpoint] : null;
    const currentInputs: Array<{ name: string; type: string; value: any }> = currentEndpoint?.input || [];
    // Extract path params from endpoint pattern
    const pathParams = apiSelectedEndpoint ? (apiSelectedEndpoint.match(/\{(\w+)\}/g) || []).map((p: string) => p.slice(1, -1)) : [];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* API Header */}
        <div
          className="px-4 py-2 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,51,51,0.02)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[14px] text-crt-red/70 uppercase" style={{ letterSpacing: "1.5px" }}>
                API EXPLORER
              </span>
              <span className="text-[13px] text-crt-amber/50">{baseUrl}</span>
            </div>
            <span className="text-[13px] text-crt-green/30">{endpointKeys.length} endpoints</span>
          </div>
        </div>

        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Endpoint List (left side) */}
          <div className="overflow-y-auto border-r" style={{ borderColor: "rgba(255,255,255,0.08)", width: "260px", minWidth: "200px", flexShrink: 0 }}>
            {endpointKeys.map((ep) => {
              const info = endpoints[ep];
              const methods = Array.isArray(info.method) ? info.method : [info.method];
              const isSelected = apiSelectedEndpoint === ep;
              return (
                <div
                  key={ep}
                  onClick={() => {
                    setApiSelectedEndpoint(ep);
                    setApiMethod(methods[0]);
                    setApiParams({});
                    setApiResponse(null);
                    setApiResponseStatus(null);
                  }}
                  className="px-3 py-1.5 cursor-pointer border-b transition-all"
                  style={{
                    borderColor: "rgba(255,255,255,0.04)",
                    background: isSelected ? "rgba(255,51,51,0.08)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {methods.map((m: string) => (
                        <span
                          key={m}
                          className="text-[13px] px-1.5 py-0.5 font-bold border"
                          style={{
                            color: m === "GET" ? "var(--crt-green)" : m === "POST" ? "var(--crt-blue)" : "var(--crt-red)",
                            borderColor: m === "GET" ? apiGreenBorder : m === "POST" ? apiBlueBorder : apiRedBorder,
                            background: m === "GET" ? apiGreenBg : m === "POST" ? apiBlueBg : apiRedBg,
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                    <span className="text-[14px] font-mono truncate" style={{ color: isSelected ? "var(--crt-red)" : "var(--text-primary)", opacity: isSelected ? 1 : 0.7 }}>
                      {ep}
                    </span>
                    {info.auth && <span className="text-[13px] px-1 py-0.5 border border-crt-amber/30 text-crt-amber/60">AUTH</span>}
                  </div>
                  <div className="text-[13px] mt-0.5 truncate" style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>
                    {info.docs}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Endpoint Detail (right side) */}
          {apiSelectedEndpoint && currentEndpoint ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Method + Path + Send */}
              <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {Array.isArray(currentEndpoint.method) ? (
                  <select
                    value={apiMethod}
                    onChange={(e) => setApiMethod(e.target.value)}
                    className="text-[13px] font-bold px-2 py-1 border bg-transparent font-mono"
                    style={{
                      color: apiMethod === "GET" ? "var(--crt-green)" : apiMethod === "POST" ? "var(--crt-blue)" : "var(--crt-red)",
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    {(currentEndpoint.method as string[]).map((m: string) => (
                      <option key={m} value={m} style={{ background: "#111", color: "#fff" }}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <span
                    className="text-[13px] font-bold px-2 py-1 border"
                    style={{
                      color: currentEndpoint.method === "GET" ? "var(--crt-green)" : currentEndpoint.method === "POST" ? "var(--crt-blue)" : "var(--crt-red)",
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    {currentEndpoint.method}
                  </span>
                )}
                <span className="text-[14px] font-mono flex-1" style={{ color: "var(--text-primary)", opacity: 0.8 }}>
                  {apiSelectedEndpoint}
                </span>
                <button
                  onClick={() => fireApiRequest(apiSelectedEndpoint, apiMethod, apiParams)}
                  disabled={apiLoading}
                  className="text-[13px] font-bold px-3 py-1 border transition-all"
                  style={{
                    color: apiLoading ? "var(--text-tertiary)" : "#000",
                    background: apiLoading ? "transparent" : "var(--crt-green)",
                    borderColor: "var(--crt-green)",
                    letterSpacing: "1px",
                    opacity: apiLoading ? 0.5 : 1,
                  }}
                >
                  {apiLoading ? "..." : "SEND"}
                </button>
              </div>

              {/* Params */}
              {(currentInputs.length > 0 || pathParams.length > 0) && (
                <div className="px-3 py-2 border-b space-y-1.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <span className="text-[13px] uppercase" style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1px" }}>
                    Parameters
                  </span>
                  {pathParams.map((p: string) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="text-[13px] font-mono w-24 shrink-0" style={{ color: "var(--crt-amber)" }}>{`{${p}}`}</span>
                      <input
                        type="text"
                        value={apiParams[p] || ""}
                        onChange={(e) => setApiParams({ ...apiParams, [p]: e.target.value })}
                        className="flex-1 text-[13px] font-mono px-2 py-1 border bg-transparent"
                        style={{ color: "var(--text-primary)", borderColor: "rgba(255,255,255,0.1)" }}
                        placeholder={`path param: ${p}`}
                        onKeyDown={(e) => { if (e.key === "Enter") fireApiRequest(apiSelectedEndpoint!, apiMethod, apiParams); }}
                      />
                    </div>
                  ))}
                  {currentInputs.map((input: any) => (
                    <div key={input.name} className="flex items-center gap-2">
                      <span className="text-[13px] font-mono w-24 shrink-0 truncate" style={{ color: "var(--text-primary)", opacity: 0.6 }} title={`${input.name} (${input.type})`}>
                        {input.name}
                      </span>
                      {input.type === "bool" ? (
                        <select
                          value={apiParams[input.name] || ""}
                          onChange={(e) => setApiParams({ ...apiParams, [input.name]: e.target.value })}
                          className="flex-1 text-[13px] font-mono px-2 py-1 border bg-transparent"
                          style={{ color: "var(--text-primary)", borderColor: "rgba(255,255,255,0.1)" }}
                        >
                          <option value="" style={{ background: "#111" }}>—</option>
                          <option value="true" style={{ background: "#111" }}>true</option>
                          <option value="false" style={{ background: "#111" }}>false</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={apiParams[input.name] || ""}
                          onChange={(e) => setApiParams({ ...apiParams, [input.name]: e.target.value })}
                          className="flex-1 text-[13px] font-mono px-2 py-1 border bg-transparent"
                          style={{ color: "var(--text-primary)", borderColor: "rgba(255,255,255,0.1)" }}
                          placeholder={input.value === "_empty" ? `required (${input.type})` : `${input.type}${input.value != null ? ` = ${input.value}` : ""}`}
                          onKeyDown={(e) => { if (e.key === "Enter") fireApiRequest(apiSelectedEndpoint!, apiMethod, apiParams); }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Response */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-3 py-1 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <span className="text-[13px] uppercase" style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1px" }}>
                    Response
                  </span>
                  {apiResponseStatus !== null && (
                    <span
                      className="text-[13px] font-bold px-1.5 py-0.5"
                      style={{
                        color: apiResponseStatus >= 200 && apiResponseStatus < 300 ? "var(--crt-green)" : apiResponseStatus === 0 ? "var(--crt-red)" : "var(--crt-amber)",
                      }}
                    >
                      {apiResponseStatus === 0 ? "ERR" : apiResponseStatus}
                    </span>
                  )}
                </div>
                <pre className="flex-1 overflow-y-auto px-3 py-2 m-0 text-[13px] font-mono leading-relaxed" style={{ color: "var(--text-primary)", opacity: 0.8 }}>
                  {apiLoading ? "Sending request..." : apiResponse || "Hit SEND to execute the request"}
                </pre>
              </div>
            </div>
          ) : (
            /* No endpoint selected */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <span className="text-[14px] text-crt-green/20 uppercase" style={{ letterSpacing: "1px" }}>
                Select an endpoint
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <header
        className="flex flex-col border-b-2 shrink-0"
        style={{
          borderColor: "var(--accent-color)",
          background: "var(--bg-secondary)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        {/* Top row - Module selector, tabs, and controls */}
        <div className="flex items-center px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Module selector dropdown */}
            <div className="relative" ref={headerModuleRef}>
              {showHeaderModuleDropdown ? (
                <input
                  type="text"
                  autoFocus
                  value={headerModuleSearch}
                  onChange={(e) => {
                    setHeaderModuleSearch(e.target.value);
                    fetchModules(e.target.value);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                    if (!moduleList.length) fetchModules(headerModuleSearch);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && moduleList.length > 0) {
                      const firstModule = moduleList[0];
                      setSelectedModule(firstModule.name);
                      setSelectedModuleInfo(firstModule);
                      setWorkDir(firstModule.path);
                      setHeaderModuleSearch("");
                      setShowHeaderModuleDropdown(false);
                      fetchModuleConfig(firstModule.name);
                    }
                    if (e.key === "Escape") {
                      setShowHeaderModuleDropdown(false);
                      setHeaderModuleSearch("");
                    }
                  }}
                  placeholder="search modules..."
                  className="px-3 py-1.5 bg-transparent text-crt-green border border-crt-green/40 font-code outline-none w-[200px]"
                  style={{ letterSpacing: "1px", fontSize: "24px" }}
                />
              ) : (
                <button
                  onClick={() => {
                    setShowHeaderModuleDropdown(true);
                    setHeaderModuleSearch("");
                    if (!moduleList.length) fetchModules("");
                  }}
                  className="flex items-center gap-2 font-bold text-crt-green font-code cursor-pointer hover:text-crt-green/80 transition-colors group"
                  style={{ letterSpacing: "1px", fontSize: "24px" }}
                  title="Click to switch module"
                >
                  {selectedModule || "claude"}
                  <span style={{ color: "var(--crt-green)", opacity: 0.3, fontSize: "14px", transition: "opacity 0.2s" }} className="group-hover:!opacity-60">▼</span>
                </button>
              )}
              {showHeaderModuleDropdown && moduleList.length > 0 && (
                <div
                  className="absolute left-0 top-full mt-1 border border-crt-green/30 max-h-[300px] overflow-y-auto z-50 rounded-sm min-w-[280px]"
                  style={{ background: "var(--bg-primary)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
                >
                  {moduleList.map((m) => (
                    <div
                      key={m.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedModule(m.name);
                        setSelectedModuleInfo(m);
                        setWorkDir(m.path);
                        setHeaderModuleSearch("");
                        setShowHeaderModuleDropdown(false);
                        setShowModuleDropdown(false);
                        fetchModuleConfig(m.name);
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-crt-green/10 transition-colors border-b border-crt-green/5 ${m.name === selectedModule ? 'bg-crt-green/8' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-crt-green font-code">{m.name}</span>
                          <span className={`text-[13px] px-1.5 py-0.5 border font-code ${m.category === "core" ? "border-crt-red/30 text-crt-red/50" : "border-crt-green/15 text-crt-green/25"}`}>
                            {m.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {m.app_url && (
                            <span className="text-[13px] px-1.5 py-0.5 border border-crt-blue/40 text-crt-blue bg-crt-blue/10">APP</span>
                          )}
                          {m.api_url && (
                            <span className="text-[13px] px-1.5 py-0.5 border border-crt-amber/40 text-crt-amber bg-crt-amber/10">API</span>
                          )}
                        </div>
                      </div>
                      {m.description && (
                        <div className="text-[13px] text-crt-green/30 mt-0.5 truncate">{m.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedModule && effectiveConfig?.owner && (
              <span
                className="text-sm px-2 py-1 border border-crt-green/20 text-crt-green/50 truncate max-w-[160px] font-mono"
                title={effectiveConfig.owner}
                style={{ letterSpacing: "0.5px" }}
              >
                {effectiveConfig.owner.slice(0, 6)}··{effectiveConfig.owner.slice(-4)}
              </span>
            )}

          </div>

          {/* Network + Wallet Widget */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Network Switcher */}
            {address && address !== "local" && (
              <div className="relative" ref={networkDropdownRef}>
                <button
                  onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 transition-all group"
                  style={{
                    border: showNetworkDropdown ? "1px solid var(--accent-color)" : "1px solid rgba(51,255,51,0.2)",
                    borderRadius: "3px",
                    background: showNetworkDropdown ? "rgba(51,255,51,0.06)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!showNetworkDropdown) {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,255,51,0.35)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(51,255,51,0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showNetworkDropdown) {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,255,51,0.2)";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                  title="Switch network"
                >
                  <span
                    className="w-[18px] h-[18px] flex items-center justify-center"
                    style={{ color: NETWORK_LOGOS[currentChainId]?.color || "var(--crt-green)" }}
                    dangerouslySetInnerHTML={{
                      __html: `<svg viewBox="0 0 24 24" width="18" height="18">${NETWORK_LOGOS[currentChainId]?.svg || '<circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.3"/>'}</svg>`
                    }}
                  />
                  <span className="text-[13px] font-bold tracking-wide" style={{ color: "var(--crt-green)" }}>
                    {getNetworkName(currentChainId)}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {showNetworkDropdown ? "▴" : "▾"}
                  </span>
                </button>

                {/* Network Dropdown - Grid Layout */}
                {showNetworkDropdown && (
                  <div
                    className="absolute top-full right-0 mt-1 z-50 p-3 network-dropdown"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid rgba(255,176,0,0.2)",
                      borderRadius: "6px",
                      boxShadow: "0 12px 48px rgba(0,0,0,0.7), 0 0 20px rgba(255,176,0,0.05)",
                      minWidth: "380px",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] tracking-[2px] font-bold" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>SELECT NETWORK</span>
                      <button
                        onClick={() => setShowNetworkDropdown(false)}
                        className="text-[9px] px-2 py-0.5 transition-all"
                        style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--crt-red)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
                      >
                        ESC
                      </button>
                    </div>

                    {/* Mainnets */}
                    <div className="mb-2">
                      <div className="text-[9px] tracking-[2px] mb-2 px-1" style={{ color: "var(--crt-amber)", opacity: 0.6 }}>MAINNET</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {EVM_NETWORKS.filter(n => !n.testnet).map(n => (
                          <button
                            key={n.chainId}
                            onClick={() => handleHeaderNetworkSwitch(n.chainId)}
                            disabled={switchingNetwork}
                            className="flex flex-col items-center gap-1.5 p-2.5 transition-all rounded"
                            style={{
                              border: n.chainId === currentChainId ? `1px solid ${NETWORK_LOGOS[n.chainId]?.color || "var(--crt-amber)"}60` : "1px solid rgba(255,255,255,0.04)",
                              background: n.chainId === currentChainId ? `${NETWORK_LOGOS[n.chainId]?.color || "var(--crt-amber)"}10` : "rgba(0,0,0,0.15)",
                              opacity: switchingNetwork ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (n.chainId !== currentChainId) {
                                e.currentTarget.style.borderColor = `${NETWORK_LOGOS[n.chainId]?.color || "#ffb000"}40`;
                                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (n.chainId !== currentChainId) {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                                e.currentTarget.style.background = "rgba(0,0,0,0.15)";
                              }
                            }}
                          >
                            <span
                              className="w-[24px] h-[24px] flex items-center justify-center"
                              style={{ color: NETWORK_LOGOS[n.chainId]?.color || "#888" }}
                              dangerouslySetInnerHTML={{
                                __html: `<svg viewBox="0 0 24 24" width="24" height="24">${NETWORK_LOGOS[n.chainId]?.svg || '<circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.3"/>'}</svg>`
                              }}
                            />
                            <span className="text-[9px] font-bold tracking-wide text-center" style={{ color: n.chainId === currentChainId ? NETWORK_LOGOS[n.chainId]?.color || "var(--crt-amber)" : "var(--text-secondary)" }}>
                              {n.name}
                            </span>
                            {n.chainId === currentChainId && (
                              <span className="w-[4px] h-[4px] rounded-full led-pulse" style={{ background: "var(--crt-green)", boxShadow: "0 0 6px var(--crt-green)" }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

                    {/* Testnets */}
                    <div>
                      <div className="text-[9px] tracking-[2px] mb-2 px-1" style={{ color: "var(--crt-blue)", opacity: 0.6 }}>TESTNET</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {EVM_NETWORKS.filter(n => n.testnet).map(n => (
                          <button
                            key={n.chainId}
                            onClick={() => handleHeaderNetworkSwitch(n.chainId)}
                            disabled={switchingNetwork}
                            className="flex flex-col items-center gap-1.5 p-2.5 transition-all rounded"
                            style={{
                              border: n.chainId === currentChainId ? `1px solid ${NETWORK_LOGOS[n.chainId]?.color || "var(--crt-blue)"}60` : "1px solid rgba(255,255,255,0.04)",
                              background: n.chainId === currentChainId ? `${NETWORK_LOGOS[n.chainId]?.color || "var(--crt-blue)"}10` : "rgba(0,0,0,0.15)",
                              opacity: switchingNetwork ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (n.chainId !== currentChainId) {
                                e.currentTarget.style.borderColor = `${NETWORK_LOGOS[n.chainId]?.color || "#00aaff"}40`;
                                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (n.chainId !== currentChainId) {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                                e.currentTarget.style.background = "rgba(0,0,0,0.15)";
                              }
                            }}
                          >
                            <span
                              className="w-[24px] h-[24px] flex items-center justify-center"
                              style={{ color: NETWORK_LOGOS[n.chainId]?.color || "#888" }}
                              dangerouslySetInnerHTML={{
                                __html: `<svg viewBox="0 0 24 24" width="24" height="24">${NETWORK_LOGOS[n.chainId]?.svg || '<circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.3"/>'}</svg>`
                              }}
                            />
                            <span className="text-[9px] font-bold tracking-wide text-center" style={{ color: n.chainId === currentChainId ? NETWORK_LOGOS[n.chainId]?.color || "var(--crt-blue)" : "var(--text-secondary)" }}>
                              {n.name}
                            </span>
                            {n.chainId === currentChainId && (
                              <span className="w-[4px] h-[4px] rounded-full led-pulse" style={{ background: "var(--crt-green)", boxShadow: "0 0 6px var(--crt-green)" }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Address + Copy */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (address && address !== "local") {
                  navigator.clipboard.writeText(address);
                  setCopiedAddress(true);
                  setTimeout(() => setCopiedAddress(false), 1500);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
              style={{
                border: copiedAddress ? "1px solid var(--crt-green)" : "1px solid rgba(51,255,51,0.2)",
                background: copiedAddress ? "rgba(51,255,51,0.08)" : "transparent",
                borderRadius: "3px",
              }}
              onMouseEnter={(e) => {
                if (!copiedAddress) {
                  e.currentTarget.style.borderColor = "rgba(51,255,51,0.35)";
                  e.currentTarget.style.background = "rgba(51,255,51,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!copiedAddress) {
                  e.currentTarget.style.borderColor = "rgba(51,255,51,0.2)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
              title={copiedAddress ? "Copied!" : `Copy: ${address}`}
            >
              <span className="text-[13px] font-bold font-mono" style={{ color: copiedAddress ? "var(--crt-green)" : "var(--crt-green)", letterSpacing: "0.5px", opacity: copiedAddress ? 1 : 0.7 }}>
                {copiedAddress ? "COPIED" : address === "local" ? "LOCAL" : `${address?.slice(0, 6)}··${address?.slice(-4)}`}
              </span>
              <svg className="w-3.5 h-3.5" style={{ color: copiedAddress ? "var(--crt-green)" : "var(--crt-green)", opacity: copiedAddress ? 1 : 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {copiedAddress ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
            </button>

            {/* Wallet Expand Button */}
            {address && address !== "local" && walletType && (
              <button
                onClick={() => setShowWalletSidebar(!showWalletSidebar)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 transition-all"
                style={{
                  border: showWalletSidebar ? "1px solid var(--crt-blue)" : "1px solid rgba(0,170,255,0.2)",
                  background: showWalletSidebar ? "rgba(0,170,255,0.08)" : "transparent",
                  borderRadius: "3px",
                  color: showWalletSidebar ? "var(--crt-blue)" : "rgba(0,170,255,0.6)",
                }}
                onMouseEnter={(e) => {
                  if (!showWalletSidebar) {
                    e.currentTarget.style.borderColor = "rgba(0,170,255,0.4)";
                    e.currentTarget.style.background = "rgba(0,170,255,0.04)";
                    e.currentTarget.style.color = "var(--crt-blue)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showWalletSidebar) {
                    e.currentTarget.style.borderColor = "rgba(0,170,255,0.2)";
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(0,170,255,0.6)";
                  }
                }}
                title={showWalletSidebar ? "Close wallet" : "Open wallet"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
                <span className="text-[11px] font-bold tracking-wide">
                  {showWalletSidebar ? "▸" : "◂"}
                </span>
              </button>
            )}
          </div>
          </div>

        {/* Second row - Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 py-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {/* Create / Fork buttons */}
          <div className="relative" ref={headerCreateRef}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setShowHeaderCreateForm(showHeaderCreateForm === "create" ? null : "create");
                  setHeaderNewName("");
                  setHeaderGithubUrl("");
                }}
                className="text-[13px] px-1.5 py-0.5 border transition-all hover:brightness-125"
                style={{
                  borderColor: showHeaderCreateForm === "create" ? "var(--crt-green)" : "rgba(51,255,51,0.2)",
                  color: showHeaderCreateForm === "create" ? "var(--crt-green)" : "rgba(51,255,51,0.5)",
                  background: showHeaderCreateForm === "create" ? "rgba(51,255,51,0.08)" : "transparent",
                  letterSpacing: "1px",
                }}
                title="Create new module"
              >
                + NEW
              </button>
              <button
                onClick={() => {
                  setShowHeaderCreateForm(showHeaderCreateForm === "fork" ? null : "fork");
                  setHeaderNewName(selectedModule ? selectedModule + "-fork" : "");
                  setHeaderGithubUrl("");
                }}
                className="text-[13px] px-1.5 py-0.5 border transition-all hover:brightness-125"
                style={{
                  borderColor: showHeaderCreateForm === "fork" ? "var(--crt-amber)" : "rgba(255,176,0,0.2)",
                  color: showHeaderCreateForm === "fork" ? "var(--crt-amber)" : "rgba(255,176,0,0.5)",
                  background: showHeaderCreateForm === "fork" ? "rgba(255,176,0,0.08)" : "transparent",
                  letterSpacing: "1px",
                }}
                title={`Fork ${selectedModule || "module"}`}
              >
                ⑂ FORK
              </button>
            </div>

            {/* Create/Fork dropdown form */}
            {showHeaderCreateForm && (
              <div
                className="absolute left-0 top-full mt-1 border z-50 p-3 flex flex-col gap-2 min-w-[300px]"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: showHeaderCreateForm === "fork" ? "rgba(255,176,0,0.3)" : "rgba(51,255,51,0.3)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                <div className="text-[13px] font-bold uppercase" style={{
                  letterSpacing: "1.5px",
                  color: showHeaderCreateForm === "fork" ? "var(--crt-amber)" : "var(--crt-green)",
                }}>
                  {showHeaderCreateForm === "fork" ? `⑂ FORK FROM ${selectedModule?.toUpperCase() || "?"}` : "+ CREATE MODULE"}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={headerNewName}
                  onChange={(e) => setHeaderNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") headerCreateOrFork();
                    if (e.key === "Escape") setShowHeaderCreateForm(null);
                  }}
                  placeholder="module name..."
                  className="px-2 py-1.5 text-[14px] bg-transparent border font-code outline-none"
                  style={{
                    borderColor: showHeaderCreateForm === "fork" ? "rgba(255,176,0,0.3)" : "rgba(51,255,51,0.3)",
                    color: "var(--text-primary)",
                  }}
                />
                {showHeaderCreateForm === "create" && (
                  <input
                    type="text"
                    value={headerGithubUrl}
                    onChange={(e) => setHeaderGithubUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") headerCreateOrFork();
                      if (e.key === "Escape") setShowHeaderCreateForm(null);
                    }}
                    placeholder="github url (optional)..."
                    className="px-2 py-1.5 text-[14px] bg-transparent border border-crt-green/20 font-code outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={headerCreateOrFork}
                    disabled={!headerNewName.trim() || submitting}
                    className="pixel-btn text-[14px] py-1 px-4 uppercase flex-1"
                    style={{ letterSpacing: "1px", opacity: headerNewName.trim() ? 1 : 0.4 }}
                  >
                    {submitting ? "..." : showHeaderCreateForm === "fork" ? "FORK" : "CREATE"}
                  </button>
                  <button
                    onClick={() => setShowHeaderCreateForm(null)}
                    className="text-[14px] px-2 py-1 border border-crt-red/20 text-crt-red/50 hover:text-crt-red hover:border-crt-red/40 transition-all"
                  >
                    ESC
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="mx-1" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", height: "14px" }} />

          <button
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            className="text-[13px] transition-all px-1.5 py-0.5 mr-1"
            style={{
              letterSpacing: "1.5px",
              color: leftSidebarOpen ? "var(--crt-blue)" : "var(--text-tertiary)",
              opacity: leftSidebarOpen ? 1 : 0.5,
              border: leftSidebarOpen ? "1px solid rgba(0,170,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
              background: leftSidebarOpen ? "rgba(0,170,255,0.08)" : "transparent",
            }}
            title={leftSidebarOpen ? "Hide agent" : "Show agent"}
          >
            {leftSidebarOpen ? "◂" : "▸"} AGENT
          </button>
          <button
            onClick={() => setSidebarView("config")}
            className="text-[13px] transition-all px-1.5 py-0.5"
            style={{
              letterSpacing: "1.5px",
              color: sidebarView === "config" ? "var(--crt-amber)" : "var(--text-tertiary)",
              borderBottom: sidebarView === "config" ? "1px solid var(--crt-amber)" : "1px solid transparent",
              opacity: sidebarView === "config" ? 1 : 0.5,
            }}
          >
            CONFIG
          </button>
          <button
            onClick={() => setSidebarView("api")}
            className="text-[13px] transition-all px-1.5 py-0.5"
            style={{
              letterSpacing: "1.5px",
              color: sidebarView === "api" ? "var(--crt-red)" : "var(--text-tertiary)",
              borderBottom: sidebarView === "api" ? "1px solid var(--crt-red)" : "1px solid transparent",
              opacity: sidebarView === "api" ? 1 : 0.5,
            }}
          >
            API
          </button>
          {selectedModuleInfo?.app_url && (
            <button
              onClick={() => setSidebarView("app")}
              className="text-[13px] transition-all px-1.5 py-0.5"
              style={{
                letterSpacing: "1.5px",
                color: sidebarView === "app" ? "var(--crt-green)" : "var(--text-tertiary)",
                borderBottom: sidebarView === "app" ? "1px solid var(--crt-green)" : "1px solid transparent",
                opacity: sidebarView === "app" ? 1 : 0.5,
              }}
            >
              APP
            </button>
          )}
          <button
            onClick={() => setSidebarView("files")}
            className="text-[13px] transition-all px-1.5 py-0.5"
            style={{
              letterSpacing: "1.5px",
              color: sidebarView === "files" ? "var(--crt-green)" : "var(--text-tertiary)",
              borderBottom: sidebarView === "files" ? "1px solid var(--crt-green)" : "1px solid transparent",
              opacity: sidebarView === "files" ? 1 : 0.5,
            }}
          >
            FILES
          </button>
          <button
            onClick={() => { setSidebarView("changelog"); if (changelogEntries.length === 0) fetchChangelog(); }}
            className="text-[13px] transition-all px-1.5 py-0.5"
            style={{
              letterSpacing: "1.5px",
              color: sidebarView === "changelog" ? "#cc5de8" : "var(--text-tertiary)",
              borderBottom: sidebarView === "changelog" ? "1px solid #cc5de8" : "1px solid transparent",
              opacity: sidebarView === "changelog" ? 1 : 0.5,
            }}
          >
            LOG
          </button>
          {/* ON/OFF toggle */}
          {selectedModuleInfo?.api_url && moduleRunning !== null && (
            <button
              onClick={toggleModule}
              disabled={togglingModule}
              className="flex items-center gap-1 px-1.5 py-0.5 border text-[14px] transition-all hover:brightness-125 ml-1"
              style={{
                borderColor: togglingModule
                  ? `${walletAmber}0.4)`
                  : moduleRunning
                    ? `${walletGreen}0.4)`
                    : `${isLight ? "rgba(204,34,34," : "rgba(255,50,50,"}0.3)`,
                color: togglingModule
                  ? "var(--crt-amber)"
                  : moduleRunning
                    ? "var(--crt-green)"
                    : "var(--crt-red)",
                cursor: togglingModule ? "wait" : "pointer",
                letterSpacing: "0.5px",
              }}
              title={togglingModule ? "Toggling..." : moduleRunning ? "Stop module" : "Start module"}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${togglingModule ? "led-pulse" : ""}`}
                style={{
                  background: togglingModule
                    ? "var(--crt-amber)"
                    : moduleRunning
                      ? "var(--crt-green)"
                      : "var(--crt-red)",
                  boxShadow: `0 0 4px ${togglingModule ? "var(--crt-amber)" : moduleRunning ? "var(--crt-green)" : "var(--crt-red)"}`,
                }}
              />
              {togglingModule ? "..." : moduleRunning ? "ON" : "OFF"}
            </button>
          )}

        </div>

        {/* ── Third row: My Mods ─────────────────────────────── */}
        {address && moduleList.length > 0 && (() => {
          const myMods = moduleList.filter(
            (m) => m.owner && address && m.owner.toLowerCase() === address.toLowerCase()
          );
          if (myMods.length === 0) return null;
          return (
            <div
              className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span
                className="text-[14px] uppercase shrink-0 mr-1"
                style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1.5px" }}
              >
                MY MODS
              </span>
              {myMods.map((m) => (
                <button
                  key={m.name}
                  onClick={() => {
                    setSelectedModule(m.name);
                    setSelectedModuleInfo(m);
                    setWorkDir(m.path);
                    fetchModuleConfig(m.name);
                  }}
                  className="text-[13px] px-2 py-0.5 border transition-all hover:brightness-125 shrink-0"
                  style={{
                    letterSpacing: "0.5px",
                    borderColor: m.name === selectedModule
                      ? "var(--crt-green)"
                      : "rgba(51,255,51,0.15)",
                    color: m.name === selectedModule
                      ? "var(--crt-green)"
                      : "rgba(51,255,51,0.5)",
                    background: m.name === selectedModule
                      ? "rgba(51,255,51,0.1)"
                      : "transparent",
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          );
        })()}

      </header>

      {error && (
        <div className="mx-4 mt-2 p-3 border-2 border-crt-red/50" style={{ background: "rgba(255,51,51,0.05)" }}>
          <div className="text-[14px] text-crt-red flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* ── Left Sidebar: Agent ──────────────────────── */}
        <div
          className="flex flex-col overflow-hidden shrink-0 border-r-2"
          style={{
            width: leftSidebarOpen ? `${leftSidebarWidth}px` : "0px",
            minWidth: leftSidebarOpen ? "280px" : "0px",
            maxWidth: "50vw",
            borderColor: leftSidebarOpen ? "var(--accent-color)" : "transparent",
            background: "var(--bg-secondary)",
            transition: isLeftDragging ? "none" : "width 0.2s ease, min-width 0.2s ease",
          }}
        >
          {leftSidebarOpen && (
            <>
              {/* Left sidebar header */}
              <div className="flex items-center justify-between border-b-2 px-3 py-2 shrink-0" style={{ borderColor: subtleBorderStrong, background: tintBgStrong }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ letterSpacing: "1.5px", color: "var(--crt-blue)" }}>AGENT</span>

                  {/* Agent type selector */}
                  <select
                    value={agentType}
                    onChange={(e) => {
                      setAgentType(e.target.value);
                      localStorage.setItem("claude_agent_type", e.target.value);
                    }}
                    className="px-1.5 py-0.5 text-[13px] bg-transparent border border-crt-amber/20 font-pixel uppercase cursor-pointer hover:border-crt-amber/40 transition-colors"
                    style={{ color: "var(--crt-amber)", letterSpacing: "0.5px" }}
                    title="Select agent type"
                  >
                    <option value="general">GENERAL</option>
                    <option value="bash">BASH</option>
                    <option value="explore">EXPLORE</option>
                    <option value="plan">PLAN</option>
                  </select>

                  {jobs.filter(j => j.status === "running").length > 0 && (
                    <span className="text-[14px] px-1.5 py-0.5 border border-crt-blue/30 text-crt-blue led-pulse" style={{ letterSpacing: "0.5px" }}>
                      {jobs.filter(j => j.status === "running").length} RUNNING
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setLeftSidebarOpen(false)}
                  className="text-[13px] px-1.5 py-0.5 text-crt-green/40 hover:text-crt-red hover:bg-crt-red/10 transition-all"
                  title="Close agent sidebar"
                >
                  ✕
                </button>
              </div>

              {/* Agent content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {renderTasksTab()}

                {/* Agent Output/Deltas */}
                {selectedJobData && (
                  <div className="flex-1 flex flex-col overflow-hidden border-t-2" style={{ borderColor: "rgba(255,255,255,0.1)", minHeight: "40%" }}>
                    <div className="flex border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)", background: "var(--bg-primary)" }}>
                      <button
                        onClick={() => setTaskSubTab("output")}
                        className={`px-5 py-1.5 text-[13px] transition-all ${
                          taskSubTab === "output" ? "border-b-2" : "opacity-40 hover:opacity-70"
                        }`}
                        style={{
                          color: taskSubTab === "output" ? "var(--text-primary)" : "var(--text-tertiary)",
                          borderColor: taskSubTab === "output" ? "var(--accent-color)" : "transparent",
                          letterSpacing: "1.5px",
                        }}
                      >
                        OUTPUT
                      </button>
                      <button
                        onClick={() => setTaskSubTab("deltas")}
                        className={`px-5 py-1.5 text-[13px] transition-all ${
                          taskSubTab === "deltas" ? "border-b-2" : "opacity-40 hover:opacity-70"
                        }`}
                        style={{
                          color: taskSubTab === "deltas" ? "var(--crt-amber)" : "var(--text-tertiary)",
                          borderColor: taskSubTab === "deltas" ? "var(--crt-amber)" : "transparent",
                          letterSpacing: "1.5px",
                        }}
                      >
                        DELTAS
                      </button>
                      <div className="ml-auto flex items-center gap-2 pr-3">
                        <span className="text-[14px]" style={{ color: STATUS_COLOR[selectedJobData.status], letterSpacing: "0.5px" }}>
                          {STATUS_ICON[selectedJobData.status]} {STATUS_LABEL[selectedJobData.status]}
                        </span>
                        <button
                          onClick={() => { setSelectedJob(null); setStreamOutput(""); }}
                          className="px-1.5 py-0.5 text-[13px] text-crt-green/40 hover:text-crt-red hover:bg-crt-red/10 transition-all"
                          title="Close output panel"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* OUTPUT tab content */}
                    {taskSubTab === "output" && (
                      <div ref={outputRef} className="flex-1 overflow-y-auto pb-4">
                        <pre
                          className="px-6 pt-3 m-0 whitespace-pre-wrap text-[13px] leading-relaxed font-mono"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {(streamOutput || selectedJobData.output)
                            ? renderOutput(streamOutput || selectedJobData.output)
                            : (selectedJobData.status === "pending" ? (
                              <span style={{ color: "var(--crt-amber)", opacity: 0.7 }}>
                                {"░░░ QUEUED — WAITING FOR WORKER ░░░\n\n"}
                                {"The task will begin shortly..."}
                              </span>
                            ) : selectedJobData.status === "running" ? (
                              <span className="cursor-blink" style={{ color: "var(--crt-blue)" }}>
                                {"CONNECTING TO LIVE STREAM"}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                                {"— NO OUTPUT —"}
                              </span>
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
                    )}

                    {/* DELTAS tab content */}
                    {taskSubTab === "deltas" && (
                      <div className="flex-1 overflow-hidden">
                        {(() => {
                          const output = streamOutput || selectedJobData?.output || "";
                          const blocks: { type: string; file: string; lines: string[] }[] = [];
                          const outputLines = output.split("\n");
                          let current: { type: string; file: string; lines: string[] } | null = null;
                          for (const line of outputLines) {
                            if (line.startsWith("┌─ EDIT:") || line.startsWith("┌─ WRITE:")) {
                              const type = line.startsWith("┌─ EDIT:") ? "EDIT" : "WRITE";
                              const file = line.replace(/^┌─ (EDIT|WRITE):\s*/, "").trim();
                              current = { type, file, lines: [] };
                              blocks.push(current);
                            } else if (line === "└─" && current) {
                              current = null;
                            } else if (current) {
                              current.lines.push(line);
                            }
                          }
                          const totalAdded = blocks.reduce((sum, b) => sum + b.lines.filter(l => l.startsWith("│+ ")).length, 0);
                          const totalRemoved = blocks.reduce((sum, b) => sum + b.lines.filter(l => l.startsWith("│- ")).length, 0);
                          const uniqueFiles = new Set(blocks.map(b => b.file)).size;

                          if (blocks.length === 0) {
                            return (
                              <div className="h-full flex flex-col items-center justify-center gap-3">
                                <span className="text-[24px] opacity-10">◇</span>
                                <span className="text-[13px] text-crt-green/20" style={{ letterSpacing: "2px" }}>
                                  NO FILE CHANGES
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div className="h-full overflow-y-auto">
                              <div
                                className="px-5 py-2 flex items-center gap-4 border-b sticky top-0 z-10"
                                style={{ borderColor: "rgba(255,255,255,0.08)", background: "var(--bg-primary)" }}
                              >
                                <span className="text-[13px]" style={{ color: "var(--text-tertiary)", opacity: 0.6, letterSpacing: "1px" }}>
                                  {uniqueFiles} {uniqueFiles === 1 ? "FILE" : "FILES"}
                                </span>
                                <span className="text-[13px]" style={{ color: "var(--crt-amber)", opacity: 0.6, letterSpacing: "1px" }}>
                                  {blocks.length} {blocks.length === 1 ? "BLOCK" : "BLOCKS"}
                                </span>
                                <span className="text-[13px] font-bold" style={{ color: "var(--accent-color)", letterSpacing: "1px" }}>
                                  +{totalAdded}
                                </span>
                                <span className="text-[13px] font-bold" style={{ color: "var(--crt-red)", letterSpacing: "1px" }}>
                                  -{totalRemoved}
                                </span>
                              </div>
                              <div className="px-4 py-3 space-y-3">
                                {blocks.map((block, idx) => {
                                  const added = block.lines.filter(l => l.startsWith("│+ ")).length;
                                  const removed = block.lines.filter(l => l.startsWith("│- ")).length;
                                  return (
                                    <div
                                      key={idx}
                                      className="rounded border"
                                      style={{
                                        borderColor: block.type === "WRITE" ? "var(--crt-blue)" : "var(--crt-amber)",
                                        background: "rgba(0,0,0,0.3)",
                                      }}
                                    >
                                      <div
                                        className="px-3 py-1.5 text-[14px] font-bold flex items-center gap-2 border-b"
                                        style={{
                                          color: block.type === "WRITE" ? "var(--crt-blue)" : "var(--crt-amber)",
                                          borderColor: "rgba(255,255,255,0.06)",
                                          background: block.type === "WRITE" ? "rgba(0,100,255,0.05)" : "rgba(255,176,0,0.05)",
                                          letterSpacing: "1px",
                                        }}
                                      >
                                        <span>{block.type === "WRITE" ? "✚" : "✎"}</span>
                                        <span style={{ opacity: 0.5 }}>{block.type}</span>
                                        <span style={{ color: "var(--text-primary)", fontWeight: "normal", opacity: 0.8 }}>
                                          {block.file.split("/").pop()}
                                        </span>
                                        <span className="ml-auto flex gap-2">
                                          {added > 0 && <span style={{ color: "var(--accent-color)", fontWeight: "bold" }}>+{added}</span>}
                                          {removed > 0 && <span style={{ color: "var(--crt-red)", fontWeight: "bold" }}>-{removed}</span>}
                                        </span>
                                      </div>
                                      <div className="px-1 text-[14px] text-crt-green/30 truncate" style={{ padding: "2px 12px" }}>
                                        {block.file}
                                      </div>
                                      <pre className="px-3 py-2 text-[14px] leading-relaxed font-mono overflow-x-auto m-0" style={{ maxHeight: "300px", overflowY: "auto" }}>
                                        {block.lines.map((line, li) => {
                                          if (line.startsWith("│- ")) {
                                            return <span key={li} style={{ color: "var(--crt-red)" }}>{line}{"\n"}</span>;
                                          }
                                          if (line.startsWith("│+ ")) {
                                            return <span key={li} style={{ color: "var(--accent-color)" }}>{line}{"\n"}</span>;
                                          }
                                          if (line === "│───") {
                                            return <span key={li} style={{ color: "var(--crt-amber)", opacity: 0.3 }}>{line}{"\n"}</span>;
                                          }
                                          return <span key={li} style={{ color: "var(--text-primary)", opacity: 0.6 }}>{line}{"\n"}</span>;
                                        })}
                                      </pre>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Left Resize Handle ──────────────────────── */}
        {leftSidebarOpen && (
          <div
            onMouseDown={() => setIsLeftDragging(true)}
            style={{
              width: "6px",
              cursor: "col-resize",
              background: isLeftDragging ? "var(--accent-color)" : "transparent",
              transition: "background 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--accent-color)"; }}
            onMouseLeave={(e) => { if (!isLeftDragging) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title="Drag to resize"
          />
        )}

        {/* ── Center: Main Content ──────────────────────── */}
        <div
          className="flex-1 flex flex-col overflow-hidden min-w-0"
          style={{ background: "var(--bg-secondary)" }}
        >
              {/* Main Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {sidebarView === "config" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {renderConfigTab()}
                  </div>
                ) : sidebarView === "api" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {renderApiTab()}
                  </div>
                ) : sidebarView === "app" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {renderAppTab()}
                  </div>
                ) : sidebarView === "files" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {renderDirectoryTab()}
                  </div>
                ) : sidebarView === "changelog" ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {renderChangelogTab()}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {renderConfigTab()}
                  </div>
                )}
              </div>
        </div>

        {/* ── Right Sidebar: Wallet ──────────────────────── */}
        {showWalletSidebar && address && address !== "local" && walletType && (
          <>
            <div
              className="shrink-0"
              style={{
                width: "6px",
                cursor: "col-resize",
                background: "transparent",
                transition: "background 0.15s ease",
                flexShrink: 0,
                borderLeft: "1px solid var(--accent-color)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--accent-color)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            />
            <div
              className="flex flex-col overflow-hidden shrink-0"
              style={{
                width: "380px",
                minWidth: "320px",
                maxWidth: "50vw",
                background: "var(--bg-primary)",
              }}
            >
              {/* Wallet sidebar header */}
              <div
                className="flex items-center justify-between px-4 py-2 shrink-0"
                style={{
                  borderBottom: "1px solid rgba(0,170,255,0.12)",
                  background: "linear-gradient(180deg, rgba(0,170,255,0.04) 0%, transparent 100%)",
                }}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" style={{ color: "var(--crt-blue)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                  <span className="text-[11px] font-bold tracking-[2px]" style={{ color: "var(--crt-blue)" }}>WALLET</span>
                </div>
                <button
                  onClick={() => setShowWalletSidebar(false)}
                  className="text-[11px] px-1.5 py-0.5 transition-all"
                  style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--crt-red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
                >
                  ✕
                </button>
              </div>
              {/* Inline WalletModal */}
              <WalletModal
                address={address}
                walletType={walletType}
                onClose={() => setShowWalletSidebar(false)}
                onDisconnect={() => {
                  setShowWalletSidebar(false);
                  disconnect();
                }}
                inline={true}
                isOwner={isOwner}
                onNetworkChange={() => {
                  const ethereum = (window as any).ethereum;
                  if (ethereum) {
                    ethereum.request({ method: "eth_chainId" }).then((cid: string) => {
                      setCurrentChainId(parseInt(cid, 16));
                    }).catch(() => {});
                  }
                }}
              />
            </div>
          </>
        )}

      </div>


      {/* ── Status Bar ───────────────────────────────────────────── */}
      <footer
        className="flex items-center justify-between px-5 py-1.5 border-t-4"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--accent-color)",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[13px]"
            style={{
              color: "var(--text-tertiary)",
              letterSpacing: "1px",
              opacity: 0.5,
            }}
          >
            MOD AI v1.0
          </span>
          <span style={{ color: "var(--text-tertiary)", opacity: 0.2 }}>
            ░
          </span>
          <span
            className="text-[13px]"
            style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
          >
            BISMILLAH
          </span>
        </div>
        <div className="flex items-center gap-3">
          {showBackendEditor ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const url = backendInput.trim();
                if (url) {
                  setApiUrl(url);
                  localStorage.setItem("claude_backend_url", url);
                }
                setShowBackendEditor(false);
              }}
            >
              <span className="text-[13px]" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
                BACKEND:
              </span>
              <input
                autoFocus
                className="text-[13px] bg-transparent border-b outline-none"
                style={{
                  color: "var(--accent-color)",
                  borderColor: "var(--accent-color)",
                  width: "220px",
                  fontFamily: "inherit",
                }}
                value={backendInput}
                onChange={(e) => setBackendInput(e.target.value)}
                onBlur={() => setShowBackendEditor(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowBackendEditor(false);
                }}
                placeholder="http://localhost:8820"
              />
            </form>
          ) : (
            <span
              className="text-[13px] cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
              onClick={() => {
                setBackendInput(apiUrl);
                setShowBackendEditor(true);
              }}
              title="Click to change backend URL"
            >
              BACKEND: {apiUrl.replace(/^https?:\/\//, "")}
            </span>
          )}
          <span style={{ color: "var(--text-tertiary)", opacity: 0.2 }}>
            │
          </span>
          {/* Theme Selector */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="pixel-btn text-[13px] py-0.5 px-2"
              style={{
                background: "var(--accent-color)",
                color: theme === "light" ? "#fff" : "#000",
              }}
              title="Change theme"
            >
              {theme.toUpperCase()}
            </button>
            {showThemeMenu && (
              <div
                className="absolute right-0 bottom-full mb-1 border-2 z-50 min-w-[140px]"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--accent-color)",
                  boxShadow: "0 0 20px rgba(0,0,0,0.5)",
                }}
              >
                {(["dark", "light", "matrix", "cyberpunk", "amber", "ocean", "ibm", "win95"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setShowThemeMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[14px] hover:opacity-100 transition-all border-b"
                    style={{
                      color: "var(--text-primary)",
                      opacity: theme === t ? 1 : 0.6,
                      background: theme === t ? "rgba(255,255,255,0.05)" : "transparent",
                      borderColor: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {theme === t && "▸ "}{t.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span style={{ color: "var(--text-tertiary)", opacity: 0.2 }}>
            │
          </span>
          <span
            className="text-[13px]"
            style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
          >
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </footer>

      {/* Wallet Modal */}
      {showWalletModal && address && address !== "local" && walletType && (
        <WalletModal
          address={address}
          walletType={walletType}
          onClose={() => setShowWalletModal(false)}
          onDisconnect={() => {
            setShowWalletModal(false);
            disconnect();
          }}
          onNetworkChange={() => {
            const ethereum = (window as any).ethereum;
            if (ethereum) {
              ethereum.request({ method: "eth_chainId" }).then((cid: string) => {
                setCurrentChainId(parseInt(cid, 16));
              }).catch(() => {});
            }
          }}
        />
      )}


    </div>
  );
}
