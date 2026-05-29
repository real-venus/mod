// agent_base.js — JavaScript counterpart of agent_base.py
//
// Each agent module written in JS exports a class extending AgentContract,
// declares the same constants (NAME, BINARY, DEFAULT_MODEL, ENV_KEY), and
// optional view/tx methods. The same dispatcher in dev/src/api/main.py
// detects `contract.js` and shells out to `node contract.js <cmd> <json>`.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync, spawnSync } = require("child_process");

// Decorator-equivalent annotations applied via static metadata maps.
// In JS we declare a static `abi` map instead of decorators.
class AgentContract {
  // Subclasses override these (same names as the Python base):
  static NAME = "";
  static ICON = "";
  static COLOR = "#888888";
  static BINARY = "";
  static DEFAULT_MODEL = "";
  static ENV_KEY = "";
  static DESCRIPTION = "agent (override DESCRIPTION)";

  // Subclasses declare ABI as { name: { kind: "view"|"tx", ownerOnly: bool, doc: string } }
  static ABI = {
    info:    { kind: "view", ownerOnly: false, doc: "Return agent info" },
    health:  { kind: "view", ownerOnly: false, doc: "Probe agent backend" },
    submit:  { kind: "tx",   ownerOnly: false, doc: "Queue a prompt as a job" },
    jobs:    { kind: "view", ownerOnly: false, doc: "List recent jobs" },
  };

  constructor() {
    this._path = this._discoverPath();
    this._cfg = this._loadConfig();
    this._owner = (this._cfg.owner || "").toLowerCase();
    this.state = this._loadState();
  }

  static codeHash() {
    // Same scheme as Python AgentContract: sha3 over this file's bytes.
    const file = this._sourceFile || __filename;
    const buf = fs.readFileSync(file);
    return "0x" + crypto.createHash("sha3-256").update(buf).digest("hex");
  }

  static abi() {
    const out = [];
    for (const [name, meta] of Object.entries(this.ABI || {})) {
      out.push({ name, kind: meta.kind, owner_only: !!meta.ownerOnly, inputs: meta.inputs || [], doc: meta.doc });
    }
    return out.sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name));
  }

  static manifest() {
    return {
      name: this.NAME,
      lang: "javascript",
      icon: this.ICON,
      color: this.COLOR,
      binary: this.BINARY,
      default_model: this.DEFAULT_MODEL,
      env_key: this.ENV_KEY,
      description: this.DESCRIPTION,
      code_hash: this.codeHash(),
      abi: this.abi(),
    };
  }

  _discoverPath() {
    const here = path.resolve(__dirname);
    let cur = here;
    for (let i = 0; i < 6; i++) {
      const cand = path.join(path.dirname(cur), this.constructor.NAME, "config.json");
      if (fs.existsSync(cand)) return path.dirname(cand);
      cur = path.dirname(cur);
    }
    return path.join(here, "..", "..", this.constructor.NAME);
  }

  _loadConfig() {
    const cp = path.join(this._path, "config.json");
    return fs.existsSync(cp) ? JSON.parse(fs.readFileSync(cp, "utf-8")) : {};
  }

  _statePath() {
    const dir = path.join(process.env.HOME, ".mod", this.constructor.NAME);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "state.json");
  }

  _loadState() {
    const p = this._statePath();
    if (!fs.existsSync(p)) return { created_at: Math.floor(Date.now() / 1000), jobs_submitted: 0, events: 0 };
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return {}; }
  }

  _saveState() {
    fs.writeFileSync(this._statePath(), JSON.stringify(this.state, null, 2));
  }

  emit(name, fields = {}) {
    const evt = { event: name, ts: Math.floor(Date.now() / 1000), fields };
    this.state.events = (this.state.events || 0) + 1;
    const logPath = path.join(process.env.HOME, ".mod", this.constructor.NAME, "events.jsonl");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(evt) + "\n");
  }

  info() {
    return {
      name: this.constructor.NAME,
      icon: this.constructor.ICON,
      color: this.constructor.COLOR,
      binary: this.constructor.BINARY,
      description: this.constructor.DESCRIPTION,
      owner: this._owner,
      port: this._cfg.port,
      default_model: this.constructor.DEFAULT_MODEL,
      env_key: this.constructor.ENV_KEY,
      code_hash: this.constructor.codeHash(),
      lang: "javascript",
    };
  }

  health() {
    const port = this._cfg.port;
    if (!port) return { service: this.constructor.NAME, status: "no port configured" };
    try {
      const out = execSync(`curl -sf http://127.0.0.1:${port}/health`, { timeout: 1000 }).toString();
      return JSON.parse(out);
    } catch (e) {
      return { service: this.constructor.NAME, status: "down" };
    }
  }

  cliPath() {
    if (!this.constructor.BINARY) return null;
    try {
      return execSync(`which ${this.constructor.BINARY}`).toString().trim() || null;
    } catch { return null; }
  }

  // Subclass hook — same role as Python build_args
  buildArgs(prompt, model, workDir) {
    const args = [];
    if (this.constructor.DEFAULT_MODEL) args.push("--model", model || this.constructor.DEFAULT_MODEL);
    args.push(prompt);
    return args;
  }

  jobs() {
    const port = this._cfg.port;
    if (!port) return [];
    try {
      const out = execSync(`curl -sf http://127.0.0.1:${port}/jobs`, { timeout: 5000 }).toString();
      return JSON.parse(out);
    } catch { return []; }
  }

  submit({ prompt, model, work_dir, key } = {}) {
    const port = this._cfg.port;
    if (!port) throw new Error(`${this.constructor.NAME}: no port`);
    const body = JSON.stringify({ prompt, model: model || this.constructor.DEFAULT_MODEL, work_dir: work_dir || process.cwd() });
    let res;
    try {
      const r = execSync(
        `curl -sf -X POST http://127.0.0.1:${port}/jobs -H 'Content-Type: application/json' ${key ? `-H 'Authorization: Bearer ${key}'` : ""} -d ${JSON.stringify(body)}`,
        { timeout: 30000 }
      ).toString();
      res = JSON.parse(r);
    } catch (e) {
      this.emit("submit_failed", { error: e.message });
      this._saveState();
      return { error: e.message };
    }
    this.state.jobs_submitted = (this.state.jobs_submitted || 0) + 1;
    this.emit("job_submitted", { job_id: res.id, prompt: (prompt || "").slice(0, 50), model });
    this._saveState();
    return res;
  }
}

// ── CLI dispatch — used by the Python dispatcher in dev/src/api/main.py
// Invoke as:  node contract.js manifest
//             node contract.js abi
//             node contract.js call <method> <jsonArgs>
function runCli(SubMod) {
  SubMod._sourceFile = require.main.filename;
  const [, , cmd, ...rest] = process.argv;
  try {
    if (cmd === "manifest") {
      console.log(JSON.stringify(SubMod.manifest()));
      return;
    }
    if (cmd === "abi") {
      console.log(JSON.stringify(SubMod.abi()));
      return;
    }
    if (cmd === "call") {
      const [methodName, argsJson] = rest;
      const args = argsJson ? JSON.parse(argsJson) : {};
      const inst = new SubMod();
      const fn = inst[methodName];
      if (typeof fn !== "function") throw new Error(`no method ${methodName}`);
      const result = fn.call(inst, args);
      console.log(JSON.stringify(result));
      return;
    }
    console.error(`usage: node ${path.basename(process.argv[1])} {manifest|abi|call <method> <jsonArgs>}`);
    process.exit(2);
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

module.exports = { AgentContract, runCli };
