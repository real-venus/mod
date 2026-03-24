"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const WalletModal = dynamic(() => import("../components/WalletModal"), { ssr: false });
const FileSearch = dynamic(() => import("../components/FileSearch"), { ssr: false });
const ContentSearch = dynamic(() => import("../components/ContentSearch"), { ssr: false });

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
║     ███╗░░░███╗░█████╗░██████╗░░░░░░░█████╗░██╗        ║
║     ████╗░████║██╔══██╗██╔══██╗░░░░░██╔══██╗██║        ║
║     ██╔████╔██║██║░░██║██║░░██║░░░░░███████║██║        ║
║     ██║╚██╔╝██║██║░░██║██║░░██║░░░░░██╔══██║██║        ║
║     ██║░╚═╝░██║╚█████╔╝██████╔╝░░░░░██║░░██║██║        ║
║     ╚═╝░░░░░╚═╝░╚════╝░╚═════╝░░░░░╚═╝░░╚═╝╚═╝        ║
║                                                          ║
║              ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄              ║
║              █  T A S K   R U N N E R  v1  █              ║
║              ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀              ║
║                                                          ║
║         « Background AI Tasks • 8-Bit Terminal »         ║
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
    fns: string[]; has_app_dir: boolean; has_server_dir: boolean;
  }>>([]);
  const [moduleSearch, setModuleSearch] = useState("");
  const [showModuleDropdown, setShowModuleDropdown] = useState(false);
  const [selectedModuleInfo, setSelectedModuleInfo] = useState<typeof moduleList[0] | null>(null);
  const [moduleConfig, setModuleConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [expandedAsks, setExpandedAsks] = useState<Set<string>>(new Set());
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
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [showContentSearch, setShowContentSearch] = useState(false);

  // Token stats modal
  const [showTokenStats, setShowTokenStats] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [loadingTokenStats, setLoadingTokenStats] = useState(false);

  // Wallet modal
  const [showWalletModal, setShowWalletModal] = useState(false);

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

  // Config tab state
  const [configSubTab, setConfigSubTab] = useState<"functions" | "endpoints" | "settings">("functions");
  const [configSelectedFn, setConfigSelectedFn] = useState<string | null>(null);
  const [configFnParams, setConfigFnParams] = useState<Record<string, string>>({});
  const [configFnResponse, setConfigFnResponse] = useState<string | null>(null);
  const [configFnLoading, setConfigFnLoading] = useState(false);

  // New UI state
  const [rightTab, setRightTab] = useState<"files" | "app" | "api" | "config" | "output" | "changes">("output");
  const [viewMode, setViewMode] = useState<"output" | "code">("output");
  const [directoryTree, setDirectoryTree] = useState<any[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Resizable divider state
  const [dividerPosition, setDividerPosition] = useState(40); // percentage for left panel (tasks)
  const [isDragging, setIsDragging] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const userDetailsRef = useRef<HTMLDivElement>(null);
  const tokenStatsRef = useRef<HTMLDivElement>(null);

  // Detect wallet extensions client-side only (avoids hydration mismatch)
  useEffect(() => {
    setHasMetaMask(!!(window as any).ethereum?.isMetaMask);
    setHasSubWallet(!!(window as any).ethereum?.isSubWallet);
  }, []);

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

  // Keyboard shortcuts for file search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setShowFileSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setShowContentSearch(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load saved backend URL
  useEffect(() => {
    const savedUrl = localStorage.getItem("claude_backend_url");
    if (savedUrl) setApiUrl(savedUrl);
  }, []);

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

  // Also reload when switching to files tab if empty
  useEffect(() => {
    if (rightTab === "files" && directoryTree.length === 0) {
      fetchDirectoryTree();
    }
  }, [rightTab]);

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

  // Handle divider dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newPosition = (e.clientX / window.innerWidth) * 100;
      setDividerPosition(Math.max(25, Math.min(75, newPosition))); // clamp between 25-75%
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
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
  }, [isDragging]);

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
      setSelectedModule("");
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
              fontSize: "9px",
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
              <div className="text-[12px] text-crt-green/60">SYSTEM CHECK ............ OK</div>
              <div className="text-[12px] text-crt-green/60">CLAUDE ENGINE ........... READY</div>
              <div className="text-[12px] text-crt-green/60">JOB SCHEDULER ........... ACTIVE</div>
              <div className="text-[12px] text-crt-green/60">SSE STREAM .............. ENABLED</div>
              <div className="text-[12px] text-crt-amber/80 mt-2">
                ⚠ WALLET SIGNATURE REQUIRED FOR ACCESS
              </div>
              {!hasMetaMask && !hasSubWallet && (
                <div className="text-[12px] text-crt-green/40">
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
                <span className="text-crt-amber text-[18px]">⬡</span>
                <h2
                  className="text-[16px] text-crt-amber"
                  style={{ textShadow: "0 0 8px rgba(255,176,0,0.4)" }}
                >
                  WALLET AUTHENTICATION
                </h2>
              </div>

              <div className="text-[12px] text-crt-green/50 mb-4 leading-relaxed">
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
                          className="pixel-btn pixel-btn-amber flex-1 text-[14px] py-3"
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
                          className="pixel-btn pixel-btn-blue flex-1 text-[14px] py-3"
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
                      <span className="text-[14px] text-crt-green/20">OR</span>
                      <div className="flex-1 border-t border-crt-green/10" />
                    </div>
                  </>
                )}

                <button
                  onClick={connectLocal}
                  disabled={authLoading}
                  className="pixel-btn w-full max-w-xs text-[14px] py-3"
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
                  <span className="text-[14px] text-crt-green/20">OR</span>
                  <div className="flex-1 border-t border-crt-green/10" />
                </div>

                {!showPasswordInput ? (
                  <button
                    onClick={() => setShowPasswordInput(true)}
                    className="pixel-btn w-full max-w-xs text-[14px] py-3"
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
                      className="w-full px-3 py-2 text-[14px] bg-crt-dark text-crt-green border-2 border-crt-amber/40 font-pixel"
                      style={{ letterSpacing: "1px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && passwordInput.trim()) connectWithPassword(passwordInput.trim());
                      }}
                    />
                    <button
                      onClick={() => passwordInput.trim() && connectWithPassword(passwordInput.trim())}
                      disabled={authLoading || !passwordInput.trim()}
                      className="pixel-btn pixel-btn-amber w-full text-[14px] py-3"
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

                <div className="text-[14px] text-crt-green/25">
                  Password derives a deterministic wallet key via keccak256
                </div>
              </div>

              {authError && (
                <div className="mt-4 border-2 border-crt-red/60 p-3" style={{ background: "rgba(255,51,51,0.05)" }}>
                  <div className="text-[12px] text-crt-red text-center">{authError}</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-[14px] text-crt-green/20 mt-4">
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
            className="flex items-center gap-1.5 py-1 px-2 hover:bg-crt-green/5 cursor-pointer transition-colors text-[12px]"
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
            <span className="text-crt-green/80 truncate" style={{ fontSize: "12px" }}>
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

  const renderDirectoryTab = () => {
    const fileWorkDir = selectedJob ? jobs.find(j => j.id === selectedJob)?.work_dir || workDir : workDir || "~/mod";

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Directory Header with Search Buttons */}
        <div
          className="px-3 py-2 border-b flex items-center justify-between"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(51,255,51,0.02)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-crt-green/70" style={{ letterSpacing: "1.5px" }}>
              📁 FILES
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFileSearch(true)}
              className="text-[9px] px-1.5 py-0.5 border border-crt-blue/30 text-crt-blue/60 hover:text-crt-blue hover:border-crt-blue transition-all uppercase"
              title="Search files by name (Ctrl+P)"
              style={{ letterSpacing: "0.5px" }}
            >
              🔍 FILES
            </button>
            <button
              onClick={() => setShowContentSearch(true)}
              className="text-[9px] px-1.5 py-0.5 border border-crt-blue/30 text-crt-blue/60 hover:text-crt-blue hover:border-crt-blue transition-all uppercase"
              title="Search file contents (Ctrl+Shift+F)"
              style={{ letterSpacing: "0.5px" }}
            >
              🔎 GREP
            </button>
            <button
              onClick={() => fetchDirectoryTree()}
              className="text-[9px] px-1.5 py-0.5 border border-crt-green/20 text-crt-green/40 hover:text-crt-green/70 hover:border-crt-green/40 transition-all"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Path display */}
        {(selectedJob || workDir) && (
          <div className="px-3 py-1 border-b text-[10px] text-crt-green/30 truncate" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
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
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-[11px] text-crt-green/30">No directory loaded</span>
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
                  <span className="text-[11px] text-crt-blue font-bold truncate">
                    {viewingFile.split("/").pop()}
                  </span>
                  <span className="text-[9px] text-crt-green/30 uppercase shrink-0">
                    {getLanguageFromPath(viewingFile)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-crt-green/20">
                    {viewingFileContent.split("\n").length} lines
                  </span>
                  <button
                    onClick={() => { setViewingFile(null); setViewingFileContent(""); }}
                    className="text-[9px] px-1.5 py-0.5 border border-crt-red/30 text-crt-red/50 hover:text-crt-red hover:border-crt-red transition-all"
                    title="Close file"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {/* File path */}
              <div className="px-3 py-0.5 text-[9px] text-crt-green/20 truncate border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                {viewingFile}
              </div>
              {/* File content */}
              <div className="flex-1 overflow-auto">
                {viewingFileLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[11px] text-crt-blue animate-pulse">Loading file...</span>
                  </div>
                ) : (
                  <pre
                    className="m-0 p-3 text-[11px] leading-relaxed font-mono whitespace-pre"
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
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* NEW TASK FORM - Sleek unified input */}
        <div className="border-b-2 p-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(51,255,51,0.02)" }}>
          <div
            className="border-2 border-crt-amber/40 relative"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what Claude should do... (paste images here)  [Enter=submit, Shift+Enter=newline]"
              className="w-full p-2.5 pb-8 text-[12px] resize-none rounded-none bg-transparent border-0 outline-none"
              style={{ lineHeight: "1.6", color: "var(--text-primary)", height: "200px" }}
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
              className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5 border-t border-crt-amber/20"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              {/* Model selector */}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-1.5 py-0.5 text-[10px] bg-transparent text-crt-green border border-crt-green/20 font-pixel uppercase cursor-pointer hover:border-crt-green/40 transition-colors"
                style={{ maxWidth: "140px" }}
              >
                <option value="opus">OPUS 4.6</option>
                <option value="sonnet">SONNET 4.5</option>
                <option value="haiku">HAIKU 4.5</option>
              </select>

              {/* Divider */}
              <div className="w-px h-3.5 bg-crt-green/15" />

              {/* Edit/New mode toggle */}
              {["edit", "new"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCreationMode(mode as any)}
                  className={`text-[9px] px-1.5 py-0.5 border transition-all uppercase ${
                    creationMode === mode
                      ? "border-crt-amber text-crt-amber bg-crt-amber/10"
                      : "border-crt-green/15 text-crt-green/40 hover:border-crt-green/30"
                  }`}
                  style={{ letterSpacing: "0.5px" }}
                >
                  {mode}
                </button>
              ))}

              {/* Divider */}
              <div className="w-px h-3.5 bg-crt-green/15" />

              {/* Image count badge */}
              {images.length > 0 && (
                <div className="relative group flex items-center">
                  <span
                    className="text-[9px] px-1.5 py-0.5 border border-crt-blue/30 text-crt-blue/70 uppercase cursor-default"
                    style={{ letterSpacing: "0.5px" }}
                  >
                    {images.length} IMG{images.length > 1 ? "S" : ""}
                  </span>
                  <button
                    onClick={() => setImages([])}
                    className="text-[8px] text-crt-red/60 hover:text-crt-red ml-1 transition-colors"
                    title="Clear all images"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Config/Schema indicator */}
              {effectiveConfig && (
                <button
                  onClick={() => setRightTab("config")}
                  className="text-[9px] text-crt-amber/40 uppercase truncate hover:text-crt-amber/70 transition-colors cursor-pointer"
                  style={{ letterSpacing: "0.5px", maxWidth: "160px" }}
                  title={`${effectiveConfig?.fns?.length || 0} fns | ${Object.keys(effectiveConfig?.endpoints || {}).length} endpoints — click to open config`}
                >
                  {effectiveConfig?.fns?.length || 0} fns · {Object.keys(effectiveConfig?.endpoints || {}).length} ep
                </button>
              )}

              {/* Submit button */}
              <button
                onClick={submitJob}
                disabled={submitting || !prompt.trim()}
                className="pixel-btn text-[9px] py-0.5 px-3 uppercase"
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

          {/* Module config/schema summary — compact collapsible */}
          {effectiveConfig && (
            <details className="mt-2">
              <summary
                className="text-[9px] text-crt-amber/50 uppercase cursor-pointer hover:text-crt-amber/70 transition-colors select-none"
                style={{ letterSpacing: "1px" }}
              >
                {effectiveConfig?.name || selectedModule} — {effectiveConfig?.description ? effectiveConfig.description.slice(0, 60) : "config"}{effectiveConfig?.description?.length > 60 ? "..." : ""}
              </summary>
              <div
                className="mt-1.5 p-2 border border-crt-green/10 text-[9px] max-h-32 overflow-y-auto"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                {/* Schema: function list */}
                {effectiveConfig?.schema && (
                  <div className="space-y-0.5">
                    <span className="text-crt-amber/40 uppercase block mb-1" style={{ letterSpacing: "0.5px" }}>Schema</span>
                    {Object.entries(effectiveConfig.schema).map(([fn, schema]: [string, any]) => (
                      <div key={fn} className="flex items-baseline gap-2">
                        <span className="text-crt-green/60">{fn}</span>
                        <span className="text-crt-green/25">({(schema?.input || []).map((p: any) => p.name).join(", ")})</span>
                        {schema?.docs && <span className="text-crt-green/20 truncate flex-1">— {schema.docs}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {/* Endpoints */}
                {effectiveConfig?.endpoints && (
                  <div className="space-y-0.5 mt-2">
                    <span className="text-crt-amber/40 uppercase block mb-1" style={{ letterSpacing: "0.5px" }}>Endpoints</span>
                    {Object.entries(effectiveConfig.endpoints).map(([path, ep]: [string, any]) => (
                      <div key={path} className="flex items-baseline gap-2">
                        <span className="text-crt-blue/50">{Array.isArray(ep.method) ? ep.method.join("|") : ep.method}</span>
                        <span className="text-crt-green/60">{path}</span>
                        {ep.docs && <span className="text-crt-green/20 truncate flex-1">— {ep.docs}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* NEW MODE: Module name and optional GitHub URL */}
          {creationMode === "new" && (
            <div className="space-y-1.5 mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="module-name"
                  className="flex-1 px-2 py-1 text-[11px] bg-crt-dark text-crt-green border border-crt-green/20 font-mono"
                />
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setGithubUrl(url);
                    if (url && !moduleName) {
                      const match = url.match(/github\.com\/[^/]+\/([^/]+?)(?:\.git)?$/);
                      if (match) setModuleName(match[1]);
                    }
                  }}
                  placeholder="github url (optional)"
                  className="flex-1 px-2 py-1 text-[11px] bg-crt-dark text-crt-green border border-crt-green/20 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="border-b px-4 py-2 flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(51,255,51,0.02)" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Filter tasks..."
            className="flex-1 min-w-0 px-3 py-1 text-[11px] border border-crt-green/20 bg-crt-dark text-crt-green"
          />
          <div className="flex gap-1.5 shrink-0">
            {["running", "pending", "completed", "failed", "cancelled"].map((status) => {
              const count = jobs.filter(j => j.status === status).length;
              if (count === 0) return null;
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(isActive ? null : status)}
                  className={`text-[10px] px-1.5 py-0.5 border transition-colors uppercase whitespace-nowrap ${
                    isActive ? 'border-crt-green text-crt-green' : 'border-crt-green/20 text-crt-green/50'
                  }`}
                  style={{
                    background: isActive ? `${STATUS_COLOR[status]}15` : 'transparent',
                    letterSpacing: '0.5px'
                  }}
                >
                  {STATUS_ICON[status]} {STATUS_LABEL[status]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Task List */}
        <div className="overflow-y-auto" style={{ maxHeight: "30vh" }}>
          {loading && !jobs.length ? (
            <div className="p-8 text-center">
              <p className="text-[11px] cursor-blink" style={{ color: "var(--text-tertiary)" }}>
                LOADING JOBS
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                No tasks found
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob === job.id;
              const color = STATUS_COLOR[job.status];
              return (
                <div
                  key={job.id}
                  onClick={() => viewJob(job)}
                  className="cursor-pointer transition-all duration-150 border-b"
                  style={{
                    borderColor: "rgba(51,255,51,0.06)",
                    borderLeft: isSelected ? `4px solid ${color}` : "4px solid transparent",
                    background: isSelected ? `${color}10` : "transparent",
                  }}
                >
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] ${job.status === "running" ? "led-pulse" : ""}`} style={{ color }}>
                          {STATUS_ICON[job.status]}
                        </span>
                        <span className="text-[10px] font-pixel" style={{ color, letterSpacing: "0.5px" }}>
                          {STATUS_LABEL[job.status]}
                        </span>
                        <span className="text-[9px] font-pixel" style={{ color: "var(--crt-amber)", opacity: 0.4, letterSpacing: "0.5px" }}>
                          {job.model === "opus" ? "OPUS 4.6" : job.model === "sonnet" ? "SONNET 4.5" : job.model === "haiku" ? "HAIKU 4.5" : job.model.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(job.status === "running" || job.status === "pending") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                            className="text-[9px] px-1.5 py-0.5 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all uppercase"
                            style={{ letterSpacing: "0.5px" }}
                            title="Cancel task"
                          >
                            CANCEL
                          </button>
                        )}
                        {(job.status === "completed" || job.status === "failed" || job.status === "cancelled") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                            className="text-[9px] px-1.5 py-0.5 border border-red-500/30 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500 transition-all uppercase"
                            style={{ letterSpacing: "0.5px" }}
                            title="Delete task"
                          >
                            DEL
                          </button>
                        )}
                        <span className="text-[10px]" style={{ color: "rgba(51,255,51,0.2)" }}>
                          {timeSince(job.created_at)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed mb-1" style={{ color: "var(--text-secondary)" }}>
                      {job.prompt.length > 60 ? job.prompt.slice(0, 60) + "..." : job.prompt}
                    </p>
                    {job.work_dir && (
                      <p className="text-[10px] truncate" style={{ color: "var(--crt-amber)", opacity: 0.5 }}>
                        📁 {job.work_dir}
                      </p>
                    )}
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
        {/* App Header */}
        <div
          className="px-4 py-3 border-b"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(51,255,51,0.02)",
          }}
        >
          <span className="text-[12px] text-crt-green/70 uppercase" style={{ letterSpacing: "1.5px" }}>
            🎨 APP URL
          </span>
          {selectedModuleInfo?.app_url && (
            <div className="text-[11px] text-crt-blue mt-1 truncate">
              {selectedModuleInfo.app_url}
            </div>
          )}
        </div>

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
              <span className="text-[11px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
                No app available
              </span>
              <p className="text-[10px] text-crt-green/20 text-center max-w-xs">
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

  const renderConfigTab = () => {
    const cfg = effectiveConfig;
    if (!cfg) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full p-6">
          <span className="text-[48px] opacity-10">⚙️</span>
          <span className="text-[11px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
            {loadingConfig ? "Loading config..." : "No config loaded"}
          </span>
          <button
            onClick={fetchDirectConfig}
            className="text-[10px] px-3 py-1 border border-crt-green/30 text-crt-green/60 hover:bg-crt-green/10 transition-all uppercase"
            style={{ letterSpacing: "1px" }}
          >
            Retry
          </button>
        </div>
      );
    }

    const schema = cfg.schema || {};
    const fnNames = Object.keys(schema);
    const endpoints = cfg.endpoints || {};
    const endpointKeys = Object.keys(endpoints);
    const selectedSchema = configSelectedFn ? schema[configSelectedFn] : null;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Config Header */}
        <div
          className="px-4 py-2 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,176,0,0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-bold" style={{ color: "var(--crt-amber)", letterSpacing: "1.5px" }}>
                {cfg.name?.toUpperCase() || "MODULE"}
              </span>
              <span className="text-[10px] ml-2" style={{ color: "var(--text-tertiary)" }}>v{cfg.version || "?"}</span>
            </div>
            <span className="text-[9px] px-2 py-0.5 border" style={{ color: "var(--crt-green)", borderColor: "rgba(51,255,51,0.2)" }}>
              PORT {cfg.port || "?"}
            </span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
            {cfg.description || "No description"}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {(["functions", "endpoints", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setConfigSubTab(tab)}
              className={`flex-1 px-3 py-2 text-[10px] uppercase transition-all ${
                configSubTab === tab
                  ? "border-b-2"
                  : "opacity-40 hover:opacity-70"
              }`}
              style={{
                letterSpacing: "1px",
                color: configSubTab === tab
                  ? (tab === "functions" ? "var(--crt-green)" : tab === "endpoints" ? "var(--crt-blue)" : "var(--crt-amber)")
                  : "var(--text-tertiary)",
                borderColor: configSubTab === tab
                  ? (tab === "functions" ? "var(--crt-green)" : tab === "endpoints" ? "var(--crt-blue)" : "var(--crt-amber)")
                  : "transparent",
              }}
            >
              {tab === "functions" ? `${fnNames.length} FNS` : tab === "endpoints" ? `${endpointKeys.length} EP` : "INFO"}
            </button>
          ))}
        </div>

        {/* Sub-tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {configSubTab === "functions" && (
            <div className="flex-1 flex overflow-hidden">
              {/* Function list */}
              <div className="overflow-y-auto border-r" style={{ borderColor: "rgba(255,255,255,0.06)", width: "40%", minWidth: "120px" }}>
                {fnNames.map((fn) => {
                  const s = schema[fn];
                  const isActive = configSelectedFn === fn;
                  return (
                    <div
                      key={fn}
                      onClick={() => {
                        setConfigSelectedFn(fn);
                        setConfigFnParams({});
                        setConfigFnResponse(null);
                      }}
                      className="px-3 py-2 cursor-pointer border-b transition-all"
                      style={{
                        borderColor: "rgba(255,255,255,0.04)",
                        background: isActive ? "rgba(51,255,51,0.08)" : "transparent",
                      }}
                    >
                      <div className="text-[11px] font-mono font-bold" style={{ color: isActive ? "var(--crt-green)" : "var(--text-primary)", opacity: isActive ? 1 : 0.7 }}>
                        {fn}
                      </div>
                      <div className="text-[9px] mt-0.5 truncate" style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>
                        {s?.docs ? s.docs.slice(0, 50) : `${(s?.input || []).length} params`}
                      </div>
                    </div>
                  );
                })}
                {fnNames.length === 0 && (
                  <div className="p-4 text-[10px] text-center" style={{ color: "var(--text-tertiary)", opacity: 0.3 }}>
                    No functions defined
                  </div>
                )}
              </div>

              {/* Function detail */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {configSelectedFn && selectedSchema ? (
                  <>
                    {/* Function header */}
                    <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-mono font-bold" style={{ color: "var(--crt-green)" }}>
                          {configSelectedFn}()
                        </span>
                        <button
                          onClick={() => fireConfigFn(configSelectedFn, configFnParams)}
                          disabled={configFnLoading}
                          className="text-[10px] font-bold px-3 py-1 border transition-all"
                          style={{
                            color: configFnLoading ? "var(--text-tertiary)" : "#000",
                            background: configFnLoading ? "transparent" : "var(--crt-green)",
                            borderColor: "var(--crt-green)",
                            letterSpacing: "1px",
                            opacity: configFnLoading ? 0.5 : 1,
                          }}
                        >
                          {configFnLoading ? "..." : "RUN"}
                        </button>
                      </div>
                      <div className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                        {selectedSchema.docs || "No documentation"}
                      </div>
                      {selectedSchema.output && (
                        <div className="text-[9px] mt-0.5" style={{ color: "var(--crt-blue)", opacity: 0.5 }}>
                          returns: {selectedSchema.output.type}
                        </div>
                      )}
                    </div>

                    {/* Params */}
                    {(selectedSchema.input || []).length > 0 && (
                      <div className="px-3 py-2 border-b space-y-1.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                        <span className="text-[9px] uppercase block" style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1px" }}>
                          Parameters
                        </span>
                        {(selectedSchema.input || []).map((input: any) => (
                          <div key={input.name} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono w-24 shrink-0 truncate" style={{ color: "var(--text-primary)", opacity: 0.6 }} title={`${input.name} (${input.type})`}>
                              {input.name}
                              {input.value === "_empty" && <span style={{ color: "var(--crt-red)" }}>*</span>}
                            </span>
                            {input.type === "bool" ? (
                              <select
                                value={configFnParams[input.name] || ""}
                                onChange={(e) => setConfigFnParams({ ...configFnParams, [input.name]: e.target.value })}
                                className="flex-1 text-[10px] font-mono px-2 py-1 border bg-transparent"
                                style={{ color: "var(--text-primary)", borderColor: "rgba(255,255,255,0.1)" }}
                              >
                                <option value="" style={{ background: "#111" }}>--</option>
                                <option value="true" style={{ background: "#111" }}>true</option>
                                <option value="false" style={{ background: "#111" }}>false</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={configFnParams[input.name] || ""}
                                onChange={(e) => setConfigFnParams({ ...configFnParams, [input.name]: e.target.value })}
                                className="flex-1 text-[10px] font-mono px-2 py-1 border bg-transparent"
                                style={{ color: "var(--text-primary)", borderColor: "rgba(255,255,255,0.1)" }}
                                placeholder={input.value === "_empty" ? `required (${input.type})` : `${input.type}${input.value != null ? ` = ${input.value}` : ""}`}
                                onKeyDown={(e) => { if (e.key === "Enter") fireConfigFn(configSelectedFn!, configFnParams); }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Response */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-3 py-1 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.2)" }}>
                        <span className="text-[9px] uppercase" style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1px" }}>
                          Response
                        </span>
                      </div>
                      <pre className="flex-1 overflow-y-auto px-3 py-2 m-0 text-[10px] font-mono leading-relaxed" style={{ color: "var(--text-primary)", opacity: 0.8 }}>
                        {configFnLoading ? "Running..." : configFnResponse || "Select params and hit RUN"}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
                    <span className="text-[10px] uppercase" style={{ color: "var(--text-tertiary)", opacity: 0.3, letterSpacing: "1px" }}>
                      Select a function
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {configSubTab === "endpoints" && (
            <div className="flex-1 overflow-y-auto">
              {endpointKeys.map((ep) => {
                const info = endpoints[ep];
                const methods = Array.isArray(info.method) ? info.method : [info.method];
                return (
                  <div
                    key={ep}
                    onClick={() => {
                      setRightTab("api");
                      setApiSelectedEndpoint(ep);
                      setApiMethod(methods[0]);
                      setApiParams({});
                      setApiResponse(null);
                      setApiResponseStatus(null);
                    }}
                    className="px-3 py-2 cursor-pointer border-b transition-all hover:bg-white/[0.02]"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {methods.map((m: string) => (
                          <span
                            key={m}
                            className="text-[9px] px-1.5 py-0.5 font-bold border"
                            style={{
                              color: m === "GET" ? "var(--crt-green)" : m === "POST" ? "var(--crt-blue)" : "var(--crt-red)",
                              borderColor: m === "GET" ? "rgba(51,255,51,0.3)" : m === "POST" ? "rgba(0,170,255,0.3)" : "rgba(255,51,51,0.3)",
                              background: m === "GET" ? "rgba(51,255,51,0.05)" : m === "POST" ? "rgba(0,170,255,0.05)" : "rgba(255,51,51,0.05)",
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-primary)", opacity: 0.7 }}>
                        {ep}
                      </span>
                      {info.auth && <span className="text-[8px] px-1 py-0.5 border border-crt-amber/30 text-crt-amber/60">AUTH</span>}
                    </div>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>
                      {info.docs}
                    </div>
                    {info.output && (
                      <div className="text-[8px] mt-0.5 font-mono" style={{ color: "var(--crt-blue)", opacity: 0.3 }}>
                        {typeof info.output === "string" ? info.output : Object.keys(info.output).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {endpointKeys.length === 0 && (
                <div className="p-6 text-[10px] text-center" style={{ color: "var(--text-tertiary)", opacity: 0.3 }}>
                  No endpoints defined
                </div>
              )}
            </div>
          )}

          {configSubTab === "settings" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Module info */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase block" style={{ color: "var(--crt-amber)", opacity: 0.6, letterSpacing: "1px" }}>
                  Module Info
                </span>
                {[
                  ["Name", cfg.name],
                  ["Version", cfg.version],
                  ["Port", cfg.port],
                  ["App URL", cfg.urls?.app],
                  ["API URL", cfg.urls?.api],
                ].map(([label, val]) => val && (
                  <div key={String(label)} className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>{label}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-primary)", opacity: 0.8 }}>{String(val)}</span>
                  </div>
                ))}
              </div>

              {/* Function summary */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase block" style={{ color: "var(--crt-amber)", opacity: 0.6, letterSpacing: "1px" }}>
                  Functions ({cfg.fns?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1">
                  {(cfg.fns || []).map((fn: string) => (
                    <button
                      key={fn}
                      onClick={() => { setConfigSubTab("functions"); setConfigSelectedFn(fn); setConfigFnParams({}); setConfigFnResponse(null); }}
                      className="text-[9px] px-2 py-0.5 border transition-all hover:bg-crt-green/10"
                      style={{
                        color: "var(--crt-green)",
                        borderColor: "rgba(51,255,51,0.2)",
                        fontFamily: "monospace",
                      }}
                    >
                      {fn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint summary */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase block" style={{ color: "var(--crt-amber)", opacity: 0.6, letterSpacing: "1px" }}>
                  Endpoints ({endpointKeys.length})
                </span>
                <div className="space-y-1">
                  {endpointKeys.map((ep) => {
                    const info = endpoints[ep];
                    const methods = Array.isArray(info.method) ? info.method : [info.method];
                    return (
                      <div
                        key={ep}
                        onClick={() => { setRightTab("api"); setApiSelectedEndpoint(ep); setApiMethod(methods[0]); setApiParams({}); setApiResponse(null); setApiResponseStatus(null); }}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] px-1 py-0.5 transition-all"
                      >
                        {methods.map((m: string) => (
                          <span key={m} className="text-[8px] font-bold" style={{ color: m === "GET" ? "var(--crt-green)" : m === "POST" ? "var(--crt-blue)" : "var(--crt-red)", minWidth: "30px" }}>
                            {m}
                          </span>
                        ))}
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-primary)", opacity: 0.6 }}>
                          {ep}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              {cfg.description && (
                <div className="space-y-1">
                  <span className="text-[9px] uppercase block" style={{ color: "var(--crt-amber)", opacity: 0.6, letterSpacing: "1px" }}>
                    Description
                  </span>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-primary)", opacity: 0.6 }}>
                    {cfg.description}
                  </p>
                </div>
              )}
            </div>
          )}
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
          <span className="text-[11px] text-crt-green/30 uppercase" style={{ letterSpacing: "1px" }}>
            {loadingConfig ? "Loading config..." : "No API endpoints"}
          </span>
          <p className="text-[10px] text-crt-green/20 text-center max-w-xs">
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
            <div>
              <span className="text-[12px] text-crt-red/70 uppercase" style={{ letterSpacing: "1.5px" }}>
                API EXPLORER
              </span>
              <div className="text-[10px] text-crt-amber/50 mt-0.5">{baseUrl}</div>
            </div>
            <span className="text-[10px] text-crt-green/30">{endpointKeys.length} endpoints</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Endpoint List */}
          <div className="overflow-y-auto border-b" style={{ borderColor: "rgba(255,255,255,0.08)", maxHeight: "35%" }}>
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
                          className="text-[9px] px-1.5 py-0.5 font-bold border"
                          style={{
                            color: m === "GET" ? "var(--crt-green)" : m === "POST" ? "var(--crt-blue)" : "var(--crt-red)",
                            borderColor: m === "GET" ? "rgba(51,255,51,0.3)" : m === "POST" ? "rgba(0,170,255,0.3)" : "rgba(255,51,51,0.3)",
                            background: m === "GET" ? "rgba(51,255,51,0.05)" : m === "POST" ? "rgba(0,170,255,0.05)" : "rgba(255,51,51,0.05)",
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: isSelected ? "var(--crt-red)" : "var(--text-primary)", opacity: isSelected ? 1 : 0.7 }}>
                      {ep}
                    </span>
                    {info.auth && <span className="text-[8px] px-1 py-0.5 border border-crt-amber/30 text-crt-amber/60">AUTH</span>}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>
                    {info.docs}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Endpoint Detail */}
          {apiSelectedEndpoint && currentEndpoint && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Method + Path + Send */}
              <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {Array.isArray(currentEndpoint.method) ? (
                  <select
                    value={apiMethod}
                    onChange={(e) => setApiMethod(e.target.value)}
                    className="text-[10px] font-bold px-2 py-1 border bg-transparent font-mono"
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
                    className="text-[10px] font-bold px-2 py-1 border"
                    style={{
                      color: currentEndpoint.method === "GET" ? "var(--crt-green)" : currentEndpoint.method === "POST" ? "var(--crt-blue)" : "var(--crt-red)",
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    {currentEndpoint.method}
                  </span>
                )}
                <span className="text-[11px] font-mono flex-1" style={{ color: "var(--text-primary)", opacity: 0.8 }}>
                  {apiSelectedEndpoint}
                </span>
                <button
                  onClick={() => fireApiRequest(apiSelectedEndpoint, apiMethod, apiParams)}
                  disabled={apiLoading}
                  className="text-[10px] font-bold px-3 py-1 border transition-all"
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
                  <span className="text-[9px] uppercase" style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1px" }}>
                    Parameters
                  </span>
                  {pathParams.map((p: string) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-24 shrink-0" style={{ color: "var(--crt-amber)" }}>{`{${p}}`}</span>
                      <input
                        type="text"
                        value={apiParams[p] || ""}
                        onChange={(e) => setApiParams({ ...apiParams, [p]: e.target.value })}
                        className="flex-1 text-[10px] font-mono px-2 py-1 border bg-transparent"
                        style={{ color: "var(--text-primary)", borderColor: "rgba(255,255,255,0.1)" }}
                        placeholder={`path param: ${p}`}
                        onKeyDown={(e) => { if (e.key === "Enter") fireApiRequest(apiSelectedEndpoint!, apiMethod, apiParams); }}
                      />
                    </div>
                  ))}
                  {currentInputs.map((input: any) => (
                    <div key={input.name} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-24 shrink-0 truncate" style={{ color: "var(--text-primary)", opacity: 0.6 }} title={`${input.name} (${input.type})`}>
                        {input.name}
                      </span>
                      {input.type === "bool" ? (
                        <select
                          value={apiParams[input.name] || ""}
                          onChange={(e) => setApiParams({ ...apiParams, [input.name]: e.target.value })}
                          className="flex-1 text-[10px] font-mono px-2 py-1 border bg-transparent"
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
                          className="flex-1 text-[10px] font-mono px-2 py-1 border bg-transparent"
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
                  <span className="text-[9px] uppercase" style={{ color: "var(--text-tertiary)", opacity: 0.4, letterSpacing: "1px" }}>
                    Response
                  </span>
                  {apiResponseStatus !== null && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5"
                      style={{
                        color: apiResponseStatus >= 200 && apiResponseStatus < 300 ? "var(--crt-green)" : apiResponseStatus === 0 ? "var(--crt-red)" : "var(--crt-amber)",
                      }}
                    >
                      {apiResponseStatus === 0 ? "ERR" : apiResponseStatus}
                    </span>
                  )}
                </div>
                <pre className="flex-1 overflow-y-auto px-3 py-2 m-0 text-[10px] font-mono leading-relaxed" style={{ color: "var(--text-primary)", opacity: 0.8 }}>
                  {apiLoading ? "Sending request..." : apiResponse || "Hit SEND to execute the request"}
                </pre>
              </div>
            </div>
          )}

          {/* No endpoint selected */}
          {!apiSelectedEndpoint && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <span className="text-[11px] text-crt-green/20 uppercase" style={{ letterSpacing: "1px" }}>
                Select an endpoint above
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
        className="flex flex-col border-b-4"
        style={{
          borderColor: "var(--accent-color)",
          background: "var(--bg-secondary)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {/* Top row - Module selector and controls */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3 flex-1">
            {/* Module Selector */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="flex-1 relative" ref={moduleDropdownRef}>
                <input
                  type="text"
                  value={selectedModule ? selectedModule : moduleSearch}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModuleSearch(v);
                    setSelectedModule("");
                    setSelectedModuleInfo(null);
                    setShowModuleDropdown(true);
                    fetchModules(v);
                  }}
                  onFocus={(e) => {
                    e.target.select();
                    setShowModuleDropdown(true);
                    if (!moduleList.length) fetchModules(moduleSearch);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && moduleList.length > 0) {
                      const firstModule = moduleList[0];
                      setSelectedModule(firstModule.name);
                      setSelectedModuleInfo(firstModule);
                      setWorkDir(firstModule.path);
                      setModuleSearch("");
                      setShowModuleDropdown(false);
                      fetchModuleConfig(firstModule.name);
                    }
                  }}
                  placeholder="Search modules..."
                  className="w-full px-2 py-1 text-[11px] border border-crt-green/20 bg-crt-dark text-crt-green font-mono"
                />
                {showModuleDropdown && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1 border border-crt-green/30 max-h-[200px] overflow-y-auto z-50"
                    style={{ background: "var(--bg-primary)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
                  >
                    {moduleList.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-crt-green/30">No modules found</div>
                    ) : (
                      moduleList.map((m) => (
                        <div
                          key={m.name}
                          onClick={() => {
                            setSelectedModule(m.name);
                            setSelectedModuleInfo(m);
                            setWorkDir(m.path);
                            setModuleSearch("");
                            setShowModuleDropdown(false);
                            fetchModuleConfig(m.name);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-crt-green/10 transition-colors border-b border-crt-green/5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-crt-green">{m.name}</span>
                              <span className={`text-[10px] px-1 py-0.5 border ${m.category === "core" ? "border-crt-red/30 text-crt-red/50" : "border-crt-green/15 text-crt-green/25"}`}>
                                {m.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {m.app_url && (
                                <span className="text-[10px] px-1 py-0.5 border border-crt-blue/40 text-crt-blue bg-crt-blue/10">
                                  APP
                                </span>
                              )}
                              {m.api_url && (
                                <span className="text-[10px] px-1 py-0.5 border border-crt-amber/40 text-crt-amber bg-crt-amber/10">
                                  API
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedModule && (
                <button
                  onClick={() => {
                    setSelectedModule("");
                    setSelectedModuleInfo(null);
                    setModuleConfig(null);
                    setWorkDir("");
                    setModuleSearch("");
                  }}
                  className="text-[10px] text-crt-red/60 hover:text-crt-red transition-colors px-1.5 py-1 border border-crt-red/30 hover:border-crt-red/50 uppercase"
                  style={{ letterSpacing: "0.5px" }}
                >
                  CLR
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Selector */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="pixel-btn text-[16px] py-1 px-3"
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
                  className="absolute right-0 top-full mt-1 border-2 z-50 min-w-[140px]"
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
                      className="w-full text-left px-3 py-2 text-[12px] hover:opacity-100 transition-all border-b"
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

            {/* Owner Status Badge */}
            {address !== "local" && (
              <div
                className={`border px-2 py-0.5 flex items-center gap-1.5 ${
                  isOwner
                    ? "border-crt-green/30 bg-crt-green/5"
                    : "border-crt-amber/30 bg-crt-amber/5"
                }`}
                title={isOwner ? "You are the owner" : "You are not the owner"}
              >
                <span className="text-[13px]" style={{ color: isOwner ? "var(--crt-green)" : "var(--crt-amber)", opacity: 0.5 }}>
                  ROLE
                </span>
                <span
                  className="text-[14px]"
                  style={{
                    color: isOwner ? "var(--crt-green)" : "var(--crt-amber)",
                    textShadow: isOwner ? "0 0 6px rgba(51,255,51,0.3)" : "0 0 6px rgba(255,176,0,0.3)",
                  }}
                >
                  {isOwner ? "◆ OWNER" : "○ USER"}
                </span>
              </div>
            )}

            {/* Wallet Info - Clickable */}
            <button
              onClick={() => setShowWalletModal(true)}
              className="border border-crt-amber/30 px-2 py-0.5 flex items-center gap-1.5 hover:border-crt-amber/50 transition-all hover:bg-crt-amber/5"
              title="View wallet details"
            >
              <span className="text-[13px] text-crt-amber/50">{address === "local" ? "MODE" : "WALLET"}</span>
              <span className="text-[14px] text-crt-amber" style={{ textShadow: "0 0 6px rgba(255,176,0,0.3)" }}>
                {address === "local" ? "LOCAL" : `${address?.slice(0, 6)}··${address?.slice(-4)}`}
              </span>
            </button>

            {/* Disconnect Button */}
            <button onClick={disconnect} className="pixel-btn pixel-btn-red text-[14px] py-0.5 px-2">
              ✕
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-2 p-3 border-2 border-crt-red/50" style={{ background: "rgba(255,51,51,0.05)" }}>
          <div className="text-[12px] text-crt-red flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Left Panel: Tasks ──────────────────────── */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            background: "var(--bg-primary)",
            width: rightSidebarCollapsed ? "100%" : `${dividerPosition}%`,
          }}
        >
          {renderTasksTab()}
        </div>

        {/* ── Draggable Divider ──────────────────────── */}
        {!rightSidebarCollapsed && (
          <div
            onMouseDown={() => setIsDragging(true)}
            className="w-1 cursor-col-resize hover:bg-crt-green/30 transition-colors relative group"
            style={{
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-crt-green/10" />
          </div>
        )}

        {/* ── Right Panel: Module Info & Output ──────────────────────── */}
        {!rightSidebarCollapsed && (
          <div
            className="flex flex-col overflow-hidden"
            style={{
              background: "var(--bg-secondary)",
              width: `${100 - dividerPosition}%`,
            }}
          >
            {/* Tab Headers */}
            <div className="flex border-b-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <button
                onClick={() => setRightTab("output")}
                className={`flex-1 px-3 py-2.5 text-[11px] transition-all ${
                  rightTab === "output"
                    ? "bg-crt-blue/10 text-crt-blue border-b-2 border-crt-blue"
                    : "text-crt-green/50 hover:text-crt-green/70"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                📟 OUTPUT
              </button>
              <button
                onClick={() => setRightTab("changes")}
                className={`flex-1 px-3 py-2.5 text-[11px] transition-all ${
                  rightTab === "changes"
                    ? "bg-crt-green/10 text-crt-green border-b-2 border-crt-green"
                    : "text-crt-green/50 hover:text-crt-green/70"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                🔀 CHANGES
              </button>
              <button
                onClick={() => setRightTab("files")}
                className={`flex-1 px-3 py-2.5 text-[11px] transition-all ${
                  rightTab === "files"
                    ? "bg-crt-amber/10 text-crt-amber border-b-2 border-crt-amber"
                    : "text-crt-green/50 hover:text-crt-green/70"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                📁 FILES
              </button>
              <button
                onClick={() => setRightTab("app")}
                className={`flex-1 px-3 py-2.5 text-[11px] transition-all ${
                  rightTab === "app"
                    ? "bg-crt-blue/10 text-crt-blue border-b-2 border-crt-blue"
                    : "text-crt-green/50 hover:text-crt-green/70"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                🎨 APP
              </button>
              <button
                onClick={() => setRightTab("config")}
                className={`flex-1 px-3 py-2.5 text-[11px] transition-all ${
                  rightTab === "config"
                    ? "bg-crt-amber/10 text-crt-amber border-b-2 border-crt-amber"
                    : "text-crt-green/50 hover:text-crt-green/70"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                ⚙️ CONFIG
              </button>
              <button
                onClick={() => setRightTab("api")}
                className={`flex-1 px-3 py-2.5 text-[11px] transition-all ${
                  rightTab === "api"
                    ? "bg-crt-red/10 text-crt-red border-b-2 border-crt-red"
                    : "text-crt-green/50 hover:text-crt-green/70"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                🔌 API
              </button>
              <button
                onClick={() => setRightSidebarCollapsed(true)}
                className="px-3 py-2.5 text-[11px] text-crt-green/50 hover:text-crt-red/70 hover:bg-crt-red/5 transition-all border-l"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
                title="Collapse sidebar"
              >
                ✕
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {rightTab === "output" ? (
                selectedJobData ? (
                  <>
                    {/* Output Terminal */}
                    <div className="h-full overflow-hidden relative">
                      {/* Terminal decoration */}
                      <div
                        className="absolute top-0 left-0 right-0 px-5 py-1 flex items-center justify-between border-b z-10"
                        style={{
                          background: "var(--bg-primary)",
                          borderColor: "rgba(255,255,255,0.08)",
                          opacity: 0.98,
                        }}
                      >
                        <span
                          className="text-[14px]"
                          style={{
                            color: "var(--text-tertiary)",
                            opacity: 0.5,
                          }}
                        >
                          OUTPUT TERMINAL
                        </span>
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: "#ff3333" }} />
                          <span className="w-2 h-2 rounded-full" style={{ background: "#ffb000" }} />
                          <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent-color)" }} />
                        </div>
                      </div>

                      <pre
                        ref={outputRef}
                        className="h-full overflow-y-auto pt-8 pb-4 px-6 m-0 whitespace-pre-wrap text-[14px] leading-relaxed font-mono"
                        style={{
                          color: "var(--text-primary)",
                        }}
                      >
                        {(streamOutput || selectedJobData.output)
                          ? renderOutput(streamOutput || selectedJobData.output)
                          : (selectedJobData.status === "pending" ? (
                            <span
                              style={{
                                color: "var(--crt-amber)",
                                opacity: 0.7,
                              }}
                            >
                              {"░░░ QUEUED — WAITING FOR WORKER ░░░\n\n"}
                              {"The task will begin shortly..."}
                            </span>
                          ) : selectedJobData.status === "running" ? (
                            <span
                              className="cursor-blink"
                              style={{
                                color: "var(--crt-blue)",
                              }}
                            >
                              {"CONNECTING TO LIVE STREAM"}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-tertiary)",
                                opacity: 0.5,
                              }}
                            >
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
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <pre
                      className="text-crt-green/10 leading-tight select-none"
                      style={{ fontSize: "11px" }}
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
                    <p className="text-[12px] text-crt-green/15" style={{ letterSpacing: "2px" }}>
                      AWAITING SELECTION
                    </p>
                  </div>
                )
              ) : rightTab === "changes" ? (
                (() => {
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
                  if (blocks.length === 0) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full">
                        <pre className="text-crt-green/10 leading-tight select-none" style={{ fontSize: "11px" }}>
{`
     ╔═══════════════════════════════════╗
     ║                                   ║
     ║       ┌───────────────────┐       ║
     ║       │                   │       ║
     ║       │  NO FILE CHANGES  │       ║
     ║       │     DETECTED      │       ║
     ║       │                   │       ║
     ║       └───────────────────┘       ║
     ║                                   ║
     ╚═══════════════════════════════════╝
`}
                        </pre>
                        <p className="text-[12px] text-crt-green/15" style={{ letterSpacing: "2px" }}>
                          AWAITING DELTAS
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="h-full overflow-y-auto">
                      <div
                        className="px-5 py-1 flex items-center justify-between border-b sticky top-0 z-10"
                        style={{
                          background: "var(--bg-primary)",
                          borderColor: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <span className="text-[14px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
                          FILE DELTAS — {blocks.length} {blocks.length === 1 ? "CHANGE" : "CHANGES"}
                        </span>
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: "var(--accent-color)" }} />
                          <span className="w-2 h-2 rounded-full" style={{ background: "#ffb000" }} />
                          <span className="w-2 h-2 rounded-full" style={{ background: "#ff3333" }} />
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-3">
                        {blocks.map((block, idx) => (
                          <div
                            key={idx}
                            className="rounded border"
                            style={{
                              borderColor: block.type === "WRITE" ? "var(--crt-blue)" : "var(--crt-amber)",
                              background: "rgba(0,0,0,0.3)",
                            }}
                          >
                            <div
                              className="px-3 py-1.5 text-[11px] font-bold flex items-center gap-2 border-b"
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
                            </div>
                            <div className="px-1 text-[11px] text-crt-green/30 truncate" style={{ padding: "2px 12px" }}>
                              {block.file}
                            </div>
                            <pre className="px-3 py-2 text-[12px] leading-relaxed font-mono overflow-x-auto m-0" style={{ maxHeight: "300px", overflowY: "auto" }}>
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
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : rightTab === "files" ? (
                renderDirectoryTab()
              ) : rightTab === "app" ? (
                renderAppTab()
              ) : rightTab === "config" ? (
                renderConfigTab()
              ) : (
                renderApiTab()
              )}
            </div>
          </div>
        )}

        {/* Collapsed Sidebar Toggle Button */}
        {rightSidebarCollapsed && (
          <button
            onClick={() => setRightSidebarCollapsed(false)}
            className="absolute right-0 top-1/2 -translate-y-1/2 px-2 py-8 bg-crt-green/10 hover:bg-crt-green/20 border-l-2 border-crt-green/30 transition-all z-50"
            style={{
              writingMode: "vertical-rl",
              letterSpacing: "2px",
            }}
            title="Show module panel"
          >
            <span className="text-[11px] text-crt-green">◀ MOD PANEL</span>
          </button>
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
            className="text-[14px]"
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
            className="text-[14px]"
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
              <span className="text-[14px]" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
                BACKEND:
              </span>
              <input
                autoFocus
                className="text-[14px] bg-transparent border-b outline-none"
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
              className="text-[14px] cursor-pointer hover:opacity-70 transition-opacity"
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
          <span
            className="text-[14px]"
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
        />
      )}

      {/* File Search Modal */}
      <FileSearch
        workDir={selectedJob ? jobs.find(j => j.id === selectedJob)?.work_dir || workDir || "~/mod" : workDir || "~/mod"}
        onFileSelect={(path: string) => {
          loadFileContent(path);
          setRightTab("files");
        }}
        isOpen={showFileSearch}
        onClose={() => setShowFileSearch(false)}
      />

      {/* Content Search Modal */}
      <ContentSearch
        workDir={selectedJob ? jobs.find(j => j.id === selectedJob)?.work_dir || workDir || "~/mod" : workDir || "~/mod"}
        onFileSelect={(path: string) => {
          loadFileContent(path);
          setRightTab("files");
        }}
        isOpen={showContentSearch}
        onClose={() => setShowContentSearch(false)}
      />
    </div>
  );
}
