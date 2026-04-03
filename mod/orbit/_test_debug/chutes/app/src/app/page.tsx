"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ImageResult {
  url?: string;
  b64_json?: string;
}

type Tab = "chat" | "images" | "models";

// ── ASCII Art ────────────────────────────────────────────────────────

const LOGO = `
 ░█████╗░██╗░░██╗██╗░░░██╗████████╗███████╗░██████╗
 ██╔══██╗██║░░██║██║░░░██║╚══██╔══╝██╔════╝██╔════╝
 ██║░░╚═╝███████║██║░░░██║░░░██║░░░█████╗░░╚█████╗░
 ██║░░██╗██╔══██║██║░░░██║░░░██║░░░██╔══╝░░░╚═══██╗
 ╚█████╔╝██║░░██║╚██████╔╝░░░██║░░░███████╗██████╔╝
 ░╚════╝░╚═╝░░╚═╝░╚═════╝░░░░╚═╝░░░╚══════╝╚═════╝`;

const GPU_ART = `
  ┌─────────────────────────────┐
  │ ████████████████████████████ │
  │ █ ◈ GPU INFERENCE READY ◈ █ │
  │ ████████████████████████████ │
  │  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓  ▓▓▓▓   │
  │  VRAM   CUDA  TENSOR STREAM │
  └────────────┬────────────────┘
               │
         ══════╧══════`;

// ── Main Component ───────────────────────────────────────────────────

export default function Home() {
  // Auth
  const [apiKey, setApiKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [connected, setConnected] = useState(false);

  // Navigation
  const [tab, setTab] = useState<Tab>("chat");

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(true);
  const [streamText, setStreamText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState("unsloth/Llama-3.3-70B-Instruct");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Images
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgModel, setImgModel] = useState("");
  const [imgSize, setImgSize] = useState("1024x1024");
  const [imgCount, setImgCount] = useState(1);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [imgLoading, setImgLoading] = useState(false);

  // Models
  const [models, setModels] = useState<any[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);

  // Stats
  const [tokenCount, setTokenCount] = useState({ prompt: 0, completion: 0 });
  const [latency, setLatency] = useState(0);

  // Boot
  const [bootPhase, setBootPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setBootPhase(1), 200),
      setTimeout(() => setBootPhase(2), 600),
      setTimeout(() => setBootPhase(3), 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Restore API key
  useEffect(() => {
    const saved = localStorage.getItem("chutes_api_key");
    if (saved) {
      setApiKey(saved);
      setConnected(true);
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  // ── Auth ──────────────────────────────────────────────────────────

  const connect = () => {
    if (!keyInput.trim()) return;
    const key = keyInput.trim();
    setApiKey(key);
    localStorage.setItem("chutes_api_key", key);
    setConnected(true);
  };

  const disconnect = () => {
    setApiKey("");
    setConnected(false);
    localStorage.removeItem("chutes_api_key");
    setMessages([]);
    setModels([]);
    setImages([]);
  };

  // ── Chat ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMsg: Message = { role: "user", content: chatInput.trim() };
    const allMessages = [...messages, userMsg];
    if (systemPrompt.trim()) {
      const sysExists = allMessages[0]?.role === "system";
      if (!sysExists) {
        allMessages.unshift({ role: "system", content: systemPrompt.trim() });
      }
    }

    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsGenerating(true);
    setStreamText("");
    setLatency(0);

    const start = Date.now();

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          temperature,
          max_tokens: maxTokens,
          stream: streaming,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      if (streaming && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                setStreamText(fullText);
              }
              if (parsed.usage) {
                setTokenCount({
                  prompt: parsed.usage.prompt_tokens || 0,
                  completion: parsed.usage.completion_tokens || 0,
                });
              }
            } catch {
              /* skip malformed chunks */
            }
          }
        }

        setLatency(Date.now() - start);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullText },
        ]);
        setStreamText("");
      } else {
        const data = await res.json();
        const content =
          data.choices?.[0]?.message?.content || JSON.stringify(data);
        setLatency(Date.now() - start);
        if (data.usage) {
          setTokenCount({
            prompt: data.usage.prompt_tokens || 0,
            completion: data.usage.completion_tokens || 0,
          });
        }
        setMessages((prev) => [...prev, { role: "assistant", content }]);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `[ERROR] ${e.message || "Request failed"}`,
          },
        ]);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    if (streamText) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: streamText + "\n[STOPPED]" },
      ]);
      setStreamText("");
    }
    setIsGenerating(false);
  };

  const clearChat = () => {
    setMessages([]);
    setStreamText("");
    setTokenCount({ prompt: 0, completion: 0 });
  };

  // ── Images ────────────────────────────────────────────────────────

  const generateImages = async () => {
    if (!imgPrompt.trim()) return;
    setImgLoading(true);
    try {
      const body: any = {
        prompt: imgPrompt.trim(),
        n: imgCount,
        size: imgSize,
        response_format: "url",
      };
      if (imgModel.trim()) body.model = imgModel.trim();

      const res = await fetch("/api/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setImages((prev) => [...(data.data || []), ...prev]);
    } catch (e: any) {
      alert(`Image generation failed: ${e.message}`);
    } finally {
      setImgLoading(false);
    }
  };

  // ── Models ────────────────────────────────────────────────────────

  const fetchModels = useCallback(async () => {
    if (!apiKey) return;
    setModelsLoading(true);
    try {
      const res = await fetch(`/api/models?q=${encodeURIComponent(modelSearch)}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setModels(Array.isArray(data) ? data : []);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [apiKey, modelSearch]);

  useEffect(() => {
    if (tab === "models" && connected) {
      fetchModels();
    }
  }, [tab, connected, fetchModels]);

  // ═══════════════════════════════════════════════════════════════════
  // AUTH SCREEN
  // ═══════════════════════════════════════════════════════════════════

  if (!connected) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,255,204,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full px-4">
          <pre
            className="text-crt-cyan leading-none select-none whitespace-pre transition-opacity duration-700"
            style={{
              fontSize: "7px",
              textShadow:
                "0 0 12px rgba(0,255,204,0.4), 0 0 3px rgba(0,255,204,0.2)",
              opacity: bootPhase >= 1 ? 1 : 0,
            }}
          >
            {LOGO}
          </pre>

          <div
            className="w-full max-w-lg transition-opacity duration-500"
            style={{ opacity: bootPhase >= 2 ? 1 : 0 }}
          >
            <div
              className="border-2 border-crt-cyan/30 p-4 space-y-1"
              style={{ background: "rgba(0,255,204,0.02)" }}
            >
              <p className="text-[9px] text-crt-cyan/60">
                GPU ENGINE .............. STANDBY
              </p>
              <p className="text-[9px] text-crt-cyan/60">
                SSE STREAM .............. READY
              </p>
              <p className="text-[9px] text-crt-cyan/60">
                MODELS REGISTRY ......... LOADED
              </p>
              <p className="text-[9px] text-crt-cyan/60">
                IMAGE PIPELINE .......... ONLINE
              </p>
              <p className="text-[9px] text-crt-purple/80 mt-2">
                ⚠ API KEY REQUIRED FOR ACCESS
              </p>
            </div>
          </div>

          <div
            className="w-full max-w-lg transition-all duration-500"
            style={{
              opacity: bootPhase >= 3 ? 1 : 0,
              transform: bootPhase >= 3 ? "translateY(0)" : "translateY(10px)",
            }}
          >
            <div
              className="border-2 border-crt-purple p-6"
              style={{
                background: "rgba(191,95,255,0.03)",
                boxShadow:
                  "0 0 30px rgba(191,95,255,0.05), inset 0 0 30px rgba(191,95,255,0.02)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-crt-purple text-[14px]">◈</span>
                <h2
                  className="text-[11px] text-crt-purple"
                  style={{
                    textShadow: "0 0 8px rgba(191,95,255,0.4)",
                  }}
                >
                  CHUTES API KEY
                </h2>
              </div>

              <p className="text-[8px] text-crt-cyan/50 mb-4 leading-relaxed">
                Enter your Chutes.ai API key to access serverless GPU inference.
                Chat completions, image generation, and model management.
              </p>

              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="cpk_..."
                  className="w-full px-4 py-3 text-[10px]"
                  onKeyDown={(e) => e.key === "Enter" && connect()}
                />
                <button
                  onClick={connect}
                  disabled={!keyInput.trim()}
                  className="gpu-btn gpu-btn-purple text-[10px] py-3 w-full"
                >
                  CONNECT TO GPU CLUSTER
                </button>
              </div>
            </div>
          </div>

          <p className="text-[7px] text-crt-cyan/20 mt-4">
            BISMILLAH ░ CHUTES v1.0 ░ SERVERLESS GPU INFERENCE
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b-2 border-crt-cyan/20"
        style={{
          background: "linear-gradient(180deg, #0d0d0d 0%, #080808 100%)",
        }}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span
              className="text-crt-cyan text-[14px]"
              style={{ textShadow: "0 0 10px rgba(0,255,204,0.5)" }}
            >
              ◈
            </span>
            <h1
              className="text-[12px] text-crt-cyan"
              style={{
                textShadow: "0 0 8px rgba(0,255,204,0.3)",
                letterSpacing: "3px",
              }}
            >
              CHUTES
            </h1>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1">
            {(["chat", "images", "models"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-[8px] transition-all ${
                  tab === t ? "tab-active" : "tab-inactive"
                }`}
                style={{ letterSpacing: "1.5px" }}
              >
                {t === "chat" && "◆ CHAT"}
                {t === "images" && "◇ IMAGES"}
                {t === "models" && "▣ MODELS"}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-[7px] text-crt-cyan/30 border border-crt-cyan/10 px-2 py-1"
          >
            {model.split("/").pop()}
          </span>
          <button
            onClick={disconnect}
            className="text-[7px] text-crt-red/60 hover:text-crt-red px-2 py-1 border border-crt-red/20 hover:border-crt-red/50 transition-colors"
          >
            ✕ DISCONNECT
          </button>
        </div>
      </header>

      {/* ─── CHAT TAB ──────────────────────────────────────────────── */}
      {tab === "chat" && (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && !streamText && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <pre
                    className="text-crt-cyan/10 leading-tight select-none"
                    style={{ fontSize: "6px" }}
                  >
                    {GPU_ART}
                  </pre>
                  <p
                    className="text-[8px] text-crt-cyan/15"
                    style={{ letterSpacing: "2px" }}
                  >
                    SEND A MESSAGE TO BEGIN INFERENCE
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 ${
                    msg.role === "user"
                      ? "msg-user"
                      : msg.role === "system"
                      ? "msg-system"
                      : "msg-assistant"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[7px]"
                      style={{
                        color:
                          msg.role === "user"
                            ? "#bf5fff"
                            : msg.role === "system"
                            ? "#ffb000"
                            : "#00ffcc",
                        letterSpacing: "1px",
                      }}
                    >
                      {msg.role === "user"
                        ? "◆ YOU"
                        : msg.role === "system"
                        ? "◈ SYSTEM"
                        : "◇ GPU"}
                    </span>
                  </div>
                  <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono text-crt-cyan/80">
                    {msg.content}
                  </pre>
                </div>
              ))}

              {/* Streaming text */}
              {streamText && (
                <div className="msg-assistant px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[7px] text-crt-cyan gpu-pulse"
                      style={{ letterSpacing: "1px" }}
                    >
                      ◇ GPU STREAMING
                    </span>
                  </div>
                  <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono text-crt-cyan/80">
                    {streamText}
                    <span className="cursor-blink" />
                  </pre>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Stats Bar */}
            {(tokenCount.prompt > 0 || latency > 0) && (
              <div className="px-4 py-1.5 border-t border-crt-cyan/10 flex items-center gap-4">
                {tokenCount.prompt > 0 && (
                  <span className="text-[7px] text-crt-cyan/30">
                    TOKENS: {tokenCount.prompt}→{tokenCount.completion} (
                    {tokenCount.prompt + tokenCount.completion})
                  </span>
                )}
                {latency > 0 && (
                  <span className="text-[7px] text-crt-cyan/30">
                    LATENCY: {(latency / 1000).toFixed(1)}s
                  </span>
                )}
                {tokenCount.completion > 0 && latency > 0 && (
                  <span className="text-[7px] text-crt-purple/40">
                    {(tokenCount.completion / (latency / 1000)).toFixed(0)}{" "}
                    tok/s
                  </span>
                )}
              </div>
            )}

            {/* Input Area */}
            <div
              className="p-4 border-t-2 border-crt-cyan/15"
              style={{ background: "rgba(0,255,204,0.01)" }}
            >
              {/* Settings Toggle */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-[7px] text-crt-cyan/30 hover:text-crt-cyan/60 transition-colors flex items-center gap-1"
                >
                  <span>{showSettings ? "▼" : "▶"}</span> CONFIG
                </button>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={streaming}
                      onChange={(e) => setStreaming(e.target.checked)}
                      className="accent-crt-cyan"
                    />
                    <span className="text-[7px] text-crt-cyan/40">STREAM</span>
                  </label>
                  <button
                    onClick={clearChat}
                    className="text-[7px] text-crt-amber/40 hover:text-crt-amber transition-colors"
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div className="mb-3 p-3 border border-crt-cyan/10 space-y-2.5">
                  <div>
                    <label
                      className="text-[7px] text-crt-cyan/40 mb-1 block"
                      style={{ letterSpacing: "1px" }}
                    >
                      MODEL
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 text-[9px]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[7px] text-crt-cyan/40 mb-1 block">
                        TEMP: {temperature.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(e) =>
                          setTemperature(parseFloat(e.target.value))
                        }
                        className="w-full accent-crt-cyan"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[7px] text-crt-cyan/40 mb-1 block">
                        MAX TOKENS
                      </label>
                      <input
                        type="number"
                        value={maxTokens}
                        onChange={(e) =>
                          setMaxTokens(parseInt(e.target.value) || 4096)
                        }
                        className="w-full px-3 py-2 text-[9px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      className="text-[7px] text-crt-cyan/40 mb-1 block"
                      style={{ letterSpacing: "1px" }}
                    >
                      SYSTEM PROMPT
                    </label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Optional system instructions..."
                      className="w-full px-3 py-2 text-[9px] h-16 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Enter prompt... (Cmd+Enter to send)"
                  className="flex-1 px-4 py-3 text-[10px] resize-none h-20"
                  style={{ lineHeight: "1.8" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) sendMessage();
                  }}
                />
                <div className="flex flex-col gap-2">
                  {isGenerating ? (
                    <button
                      onClick={stopGeneration}
                      className="gpu-btn gpu-btn-amber text-[8px] py-3 px-4 h-full"
                    >
                      ■ STOP
                    </button>
                  ) : (
                    <button
                      onClick={sendMessage}
                      disabled={!chatInput.trim()}
                      className="gpu-btn gpu-btn-purple text-[8px] py-3 px-4 h-full"
                    >
                      ⚡
                      <br />
                      SEND
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── IMAGES TAB ────────────────────────────────────────────── */}
      {tab === "images" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div
            className="p-5 border-b-2 border-crt-cyan/15"
            style={{ background: "rgba(191,95,255,0.01)" }}
          >
            <div className="mb-3">
              <label
                className="text-[7px] text-crt-purple/60 mb-1.5 block"
                style={{ letterSpacing: "1px" }}
              >
                IMAGE PROMPT
              </label>
              <textarea
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="w-full h-24 p-4 text-[10px] resize-none"
                style={{ lineHeight: "1.8" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) generateImages();
                }}
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[7px] text-crt-cyan/40 mb-1 block">
                  MODEL (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={imgModel}
                  onChange={(e) => setImgModel(e.target.value)}
                  placeholder="default"
                  className="w-full px-3 py-2 text-[9px]"
                />
              </div>
              <div>
                <label className="text-[7px] text-crt-cyan/40 mb-1 block">
                  SIZE
                </label>
                <select
                  value={imgSize}
                  onChange={(e) => setImgSize(e.target.value)}
                  className="px-3 py-2 text-[9px] bg-crt-dark"
                >
                  <option value="512x512">512x512</option>
                  <option value="1024x1024">1024x1024</option>
                  <option value="1024x1792">1024x1792</option>
                  <option value="1792x1024">1792x1024</option>
                </select>
              </div>
              <div>
                <label className="text-[7px] text-crt-cyan/40 mb-1 block">
                  COUNT
                </label>
                <select
                  value={imgCount}
                  onChange={(e) => setImgCount(parseInt(e.target.value))}
                  className="px-3 py-2 text-[9px] bg-crt-dark"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={generateImages}
                disabled={imgLoading || !imgPrompt.trim()}
                className="gpu-btn gpu-btn-purple text-[9px] py-2 px-6"
              >
                {imgLoading ? (
                  <span className="gpu-pulse">GENERATING...</span>
                ) : (
                  "⚡ GENERATE"
                )}
              </button>
            </div>
          </div>

          {/* Image Grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-[40px] text-crt-purple/10">◇</div>
                <p
                  className="text-[8px] text-crt-cyan/15"
                  style={{ letterSpacing: "2px" }}
                >
                  NO IMAGES GENERATED YET
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="border-2 border-crt-purple/20 overflow-hidden group relative"
                    style={{ background: "rgba(191,95,255,0.02)" }}
                  >
                    {img.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={img.url}
                        alt={`Generated ${i}`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : img.b64_json ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`data:image/png;base64,${img.b64_json}`}
                        alt={`Generated ${i}`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-crt-red/50 text-[8px]">
                        NO DATA
                      </div>
                    )}
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {img.url && (
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gpu-btn text-[7px] px-3 py-1.5"
                        >
                          OPEN
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODELS TAB ────────────────────────────────────────────── */}
      {tab === "models" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div
            className="p-5 border-b-2 border-crt-cyan/15"
            style={{ background: "rgba(0,255,204,0.01)" }}
          >
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label
                  className="text-[7px] text-crt-cyan/40 mb-1.5 block"
                  style={{ letterSpacing: "1px" }}
                >
                  SEARCH MODELS
                </label>
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Filter by name, type..."
                  className="w-full px-3 py-2 text-[9px]"
                  onKeyDown={(e) => e.key === "Enter" && fetchModels()}
                />
              </div>
              <button
                onClick={fetchModels}
                disabled={modelsLoading}
                className="gpu-btn text-[9px] py-2 px-6"
              >
                {modelsLoading ? (
                  <span className="gpu-pulse">SCANNING...</span>
                ) : (
                  "SCAN REGISTRY"
                )}
              </button>
            </div>
          </div>

          {/* Model List */}
          <div className="flex-1 overflow-y-auto">
            {modelsLoading && models.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[9px] text-crt-cyan/40 gpu-pulse">
                  QUERYING GPU CLUSTER...
                </p>
              </div>
            ) : models.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[8px] text-crt-cyan/20">
                  NO MODELS FOUND
                </p>
              </div>
            ) : (
              models.map((m, i) => {
                const name =
                  m.name || m.model || m.id || `model-${i}`;
                const desc =
                  m.description || m.tagline || "";
                const status = m.status || m.state || "";
                const isActive =
                  status === "active" ||
                  status === "running" ||
                  status === "ACTIVE";

                return (
                  <div
                    key={i}
                    className="px-5 py-4 border-b border-crt-cyan/8 hover:bg-crt-cyan/3 transition-colors cursor-pointer group"
                    onClick={() => {
                      setModel(name);
                      setTab("chat");
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] ${
                            isActive ? "text-crt-cyan" : "text-crt-cyan/30"
                          }`}
                        >
                          {isActive ? "●" : "○"}
                        </span>
                        <span
                          className="text-[10px] text-crt-cyan/80 group-hover:text-crt-cyan transition-colors"
                          style={{ letterSpacing: "0.5px" }}
                        >
                          {name}
                        </span>
                      </div>
                      <span className="text-[7px] text-crt-purple/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        CLICK TO USE →
                      </span>
                    </div>
                    {desc && (
                      <p className="text-[8px] text-crt-cyan/30 ml-4 leading-relaxed">
                        {typeof desc === "string"
                          ? desc.slice(0, 120)
                          : JSON.stringify(desc).slice(0, 120)}
                      </p>
                    )}
                    {/* Extra metadata */}
                    <div className="flex items-center gap-3 mt-1.5 ml-4">
                      {m.gpu && (
                        <span className="text-[6px] text-crt-purple/30 border border-crt-purple/10 px-1.5 py-0.5">
                          GPU: {m.gpu}
                        </span>
                      )}
                      {m.nodes && (
                        <span className="text-[6px] text-crt-cyan/20 border border-crt-cyan/10 px-1.5 py-0.5">
                          NODES: {m.nodes}
                        </span>
                      )}
                      {status && (
                        <span
                          className="text-[6px] border px-1.5 py-0.5"
                          style={{
                            color: isActive
                              ? "rgba(0,255,204,0.5)"
                              : "rgba(255,176,0,0.4)",
                            borderColor: isActive
                              ? "rgba(0,255,204,0.15)"
                              : "rgba(255,176,0,0.15)",
                          }}
                        >
                          {String(status).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <footer
        className="flex items-center justify-between px-5 py-1.5 border-t-2 border-crt-cyan/15"
        style={{ background: "#080808" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[7px] text-crt-cyan/25"
            style={{ letterSpacing: "1px" }}
          >
            CHUTES v1.0
          </span>
          <span className="text-crt-cyan/10">░</span>
          <span className="text-[7px] text-crt-cyan/20">BISMILLAH</span>
          <span className="text-crt-cyan/10">░</span>
          <span className="text-[7px] text-crt-cyan/15">
            GPU INFERENCE TERMINAL
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[7px] text-crt-cyan/20">
            MODEL: {model.split("/").pop()}
          </span>
          <span className="text-crt-cyan/10">│</span>
          <span className="text-[7px] text-crt-purple/25">
            api.chutes.ai
          </span>
        </div>
      </footer>
    </div>
  );
}
