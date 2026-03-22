"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Share2,
  Download,
  RefreshCw,
  Mail,
  KeyRound,
  Tag,
  FileText,
  X,
  Check,
} from "lucide-react";

interface Account {
  id: string;
  email: string;
  label: string;
  recovery: string;
  notes: string;
  tags: string[];
  created: number;
  password?: string;
}

export default function ProtonManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const api = async (body: any) => {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Remove ${email}?`)) return;
    const result = await api({ action: "remove", id });
    if (result.status === "removed") {
      toast.success(`Removed ${email}`);
      fetchAccounts();
    } else {
      toast.error(result.error);
    }
  };

  const handleReveal = async (id: string) => {
    if (revealedPasswords[id]) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    const result = await api({ action: "get", id });
    if (result.password) {
      setRevealedPasswords((prev) => ({ ...prev, [id]: result.password }));
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleShare = async (id: string, email: string) => {
    const result = await api({ action: "share", id });
    if (result.token) {
      navigator.clipboard.writeText(result.token);
      toast.success(`Share token copied — expires in ${result.expires_in}`);
    } else {
      toast.error(result.error);
    }
  };

  const handleExport = async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "proton_accounts.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Mail className="text-proton-purple" size={32} />
            Proton Manager
          </h1>
          <p className="text-proton-muted mt-1">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 rounded-lg bg-proton-card border border-proton-border text-proton-text hover:border-proton-purple transition-colors text-sm flex items-center gap-2"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 rounded-lg bg-proton-card border border-proton-border text-proton-text hover:border-proton-purple transition-colors text-sm flex items-center gap-2"
          >
            <Share2 size={14} /> Import
          </button>
          <button
            onClick={() => fetchAccounts()}
            className="px-3 py-2 rounded-lg bg-proton-card border border-proton-border text-proton-text hover:border-proton-purple transition-colors text-sm"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-proton-purple text-white hover:bg-opacity-80 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Plus size={14} /> Add Account
          </button>
        </div>
      </div>

      {/* Account Grid */}
      {loading ? (
        <div className="text-center text-proton-muted py-20">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-20 text-proton-muted">
          <Mail size={48} className="mx-auto mb-4 opacity-30" />
          <p>No accounts yet</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-proton-purple text-white text-sm"
          >
            Add your first account
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((acct) => (
            <AccountCard
              key={acct.id}
              account={acct}
              revealed={revealedPasswords[acct.id]}
              onReveal={() => handleReveal(acct.id)}
              onCopy={handleCopy}
              onShare={() => handleShare(acct.id, acct.email)}
              onDelete={() => handleDelete(acct.id, acct.email)}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onAdd={async (data) => {
            const result = await api({ action: "add", ...data });
            if (result.status === "added") {
              toast.success(`Added ${result.email}`);
              setShowAdd(false);
              fetchAccounts();
            } else {
              toast.error(result.error);
            }
          }}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={async (token) => {
            const result = await api({ action: "import", token });
            if (result.status === "imported") {
              toast.success(`Imported ${result.email}`);
              setShowImport(false);
              fetchAccounts();
            } else {
              toast.error(result.error);
            }
          }}
        />
      )}
    </div>
  );
}

function AccountCard({
  account,
  revealed,
  onReveal,
  onCopy,
  onShare,
  onDelete,
}: {
  account: Account;
  revealed?: string;
  onReveal: () => void;
  onCopy: (text: string, label: string) => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-proton-card border border-proton-border rounded-xl p-5 hover:border-proton-purple/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">{account.label}</span>
            {account.tags?.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 bg-proton-purple/20 text-proton-purple rounded"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="text-proton-text text-sm mt-0.5">{account.email}</p>
        </div>
        <button onClick={onDelete} className="text-proton-muted hover:text-red-400 transition-colors">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Password row */}
      <div className="flex items-center gap-2 mb-3 bg-proton-deeper rounded-lg px-3 py-2">
        <KeyRound size={14} className="text-proton-muted" />
        <span className="text-sm font-mono flex-1 text-proton-text">
          {revealed || "••••••••••••"}
        </span>
        <button onClick={onReveal} className="text-proton-muted hover:text-white transition-colors">
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        {revealed && (
          <button
            onClick={() => onCopy(revealed, "Password")}
            className="text-proton-muted hover:text-white transition-colors"
          >
            <Copy size={14} />
          </button>
        )}
      </div>

      {account.recovery && (
        <p className="text-xs text-proton-muted mb-2">
          Recovery: {account.recovery}
        </p>
      )}
      {account.notes && (
        <p className="text-xs text-proton-muted mb-2 flex items-center gap-1">
          <FileText size={10} /> {account.notes}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-proton-border">
        <button
          onClick={() => onCopy(account.email, "Email")}
          className="text-xs px-2 py-1 rounded bg-proton-deeper text-proton-text hover:text-white transition-colors flex items-center gap-1"
        >
          <Copy size={10} /> Email
        </button>
        <button
          onClick={onShare}
          className="text-xs px-2 py-1 rounded bg-proton-deeper text-proton-text hover:text-white transition-colors flex items-center gap-1"
        >
          <Share2 size={10} /> Share
        </button>
      </div>
    </div>
  );
}

function AddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    email: "",
    password: "",
    recovery: "",
    label: "",
    notes: "",
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onAdd({
      ...form,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-proton-dark border border-proton-border rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Account</h2>
          <button onClick={onClose} className="text-proton-muted hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Email *</label>
            <input
              type="email"
              placeholder="user@proton.me"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Password *</label>
            <input
              type="password"
              placeholder="Account password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Label</label>
            <input
              placeholder="e.g. work, personal"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Recovery</label>
            <input
              placeholder="Recovery email or phone"
              value={form.recovery}
              onChange={(e) => setForm({ ...form, recovery: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Notes</label>
            <textarea
              placeholder="Optional notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Tags (comma-separated)</label>
            <input
              placeholder="shared, team, dev"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-proton-border text-proton-text hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-lg bg-proton-purple text-white hover:bg-opacity-80 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              {submitting ? "Adding..." : <><Check size={14} /> Add</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onImport(token);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-proton-dark border border-proton-border rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Import from Share Token</h2>
          <button onClick={onClose} className="text-proton-muted hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-proton-muted mb-1 block">Share Token</label>
            <input
              placeholder="Paste share token here"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="w-full font-mono text-xs"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-proton-border text-proton-text hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !token}
              className="flex-1 px-4 py-2 rounded-lg bg-proton-purple text-white hover:bg-opacity-80 transition-colors text-sm font-medium"
            >
              {submitting ? "Importing..." : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
