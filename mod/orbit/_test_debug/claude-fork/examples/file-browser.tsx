"use client";

/**
 * File Browser Example
 *
 * This example demonstrates how to use the file browsing components:
 * - FileTree: Color-coded file tree with expand/collapse
 * - CodeViewer: Syntax highlighted code viewer
 * - FileSearch: Quick file name search (Cmd+P)
 * - ContentSearch: Search file contents (Cmd+Shift+F)
 */

import { useState, useEffect } from "react";
import FileTree from "../app/src/components/FileTree";
import CodeViewer from "../app/src/components/CodeViewer";
import FileSearch from "../app/src/components/FileSearch";
import ContentSearch from "../app/src/components/ContentSearch";

export default function FileBrowserExample() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [workDir, setWorkDir] = useState("~/mod/mod/orbit/claude");
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const [contentSearchOpen, setContentSearchOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+P or Ctrl+P for file search
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setFileSearchOpen(true);
      }
      // Cmd+Shift+F or Ctrl+Shift+F for content search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setContentSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFileSelect = (path: string, line?: number) => {
    setSelectedFile(path);
    // TODO: If line is provided, scroll to that line
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0a",
        color: "#fff",
        fontFamily: "monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #333",
          backgroundColor: "#0f0f0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "18px", color: "#33ff33" }}>
            📁 MOD File Browser
          </h1>
          <span style={{ color: "#666", fontSize: "12px" }}>
            {workDir}
          </span>
        </div>
        <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#888" }}>
          <kbd style={{
            padding: "4px 8px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px"
          }}>
            ⌘P
          </kbd>
          <span>File Search</span>
          <kbd style={{
            padding: "4px 8px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px"
          }}>
            ⌘⇧F
          </kbd>
          <span>Content Search</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Sidebar - File Tree */}
        <div
          style={{
            width: "300px",
            borderRight: "1px solid #333",
            backgroundColor: "#0a0a0a",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <FileTree
            workDir={workDir}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
          />
        </div>

        {/* Right - Code Viewer */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CodeViewer filePath={selectedFile} workDir={workDir} />
        </div>
      </div>

      {/* Search Modals */}
      <FileSearch
        workDir={workDir}
        onFileSelect={handleFileSelect}
        isOpen={fileSearchOpen}
        onClose={() => setFileSearchOpen(false)}
      />
      <ContentSearch
        workDir={workDir}
        onFileSelect={handleFileSelect}
        isOpen={contentSearchOpen}
        onClose={() => setContentSearchOpen(false)}
      />
    </div>
  );
}
