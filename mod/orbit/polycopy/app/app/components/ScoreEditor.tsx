"use client";

import { useState, useRef, useCallback } from "react";

interface Props {
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
}

export default function ScoreEditor({ value, onChange, error }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lineCount, setLineCount] = useState(value.split("\n").length);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const code = e.target.value;
      onChange(code);
      setLineCount(code.split("\n").length);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab support
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = value.substring(0, start) + "  " + value.substring(end);
        onChange(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange]
  );

  return (
    <div className="panel-glow bg-ibm-panel">
      <div className="px-4 py-2 border-b border-ibm-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ibm-green" />
          <h3 className="text-[11px] text-ibm-gray-light tracking-widest">SCORE FUNCTION</h3>
        </div>
        <span className="text-[9px] text-ibm-gray font-mono">{lineCount} lines</span>
      </div>

      <div className="flex">
        {/* Line numbers */}
        <div className="px-2 py-3 text-right select-none border-r border-ibm-border/20 min-w-[40px]">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="text-[10px] text-ibm-gray font-mono leading-[1.6]">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="flex-1 bg-transparent px-3 py-3 text-[11px] text-ibm-green font-mono leading-[1.6] resize-none focus:outline-none min-h-[280px] placeholder:text-ibm-gray"
          placeholder="// Write your score function here..."
        />
      </div>

      {error && (
        <div className="px-4 py-2 border-t border-ibm-red/30 bg-ibm-red/5">
          <span className="text-[10px] text-ibm-red font-mono">{error}</span>
        </div>
      )}

      <div className="px-4 py-2 border-t border-ibm-border/20 text-[9px] text-ibm-gray">
        <span className="text-ibm-gray-light">SIGNATURE:</span>{" "}
        <span className="text-ibm-amber font-mono">
          score(trades: Trade[], wallet: string) → number (0-100)
        </span>
        <span className="text-ibm-gray ml-2">|</span>
        <span className="ml-2">
          trades[].pnl, .tokenIn, .tokenOut, .amountIn, .amountOut, .timestamp, .chainId
        </span>
      </div>
    </div>
  );
}
