import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore, readShares, writeShares, genId } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readStore();
  const accounts = Object.values(data.accounts).map((acct: any) => ({
    id: acct.id,
    email: acct.email,
    label: acct.label || "",
    recovery: acct.recovery || "",
    notes: acct.notes || "",
    tags: acct.tags || [],
    created: acct.created,
  }));
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "add") {
    return handleAdd(body);
  } else if (action === "remove") {
    return handleRemove(body);
  } else if (action === "update") {
    return handleUpdate(body);
  } else if (action === "get") {
    return handleGet(body);
  } else if (action === "share") {
    return handleShare(body);
  } else if (action === "import") {
    return handleImport(body);
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

function handleAdd(body: any) {
  const { email, password, recovery, label, notes, tags } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  const data = readStore();
  const id = genId();
  data.accounts[id] = {
    id,
    email,
    password,
    recovery: recovery || null,
    label: label || email.split("@")[0],
    notes: notes || null,
    tags: tags || [],
    created: Date.now() / 1000,
    updated: Date.now() / 1000,
  };
  writeStore(data);
  return NextResponse.json({ status: "added", id, email, label: data.accounts[id].label });
}

function handleRemove(body: any) {
  const { id, email } = body;
  const data = readStore();
  const key = findAccount(data, id, email);
  if (!key) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const removed = data.accounts[key];
  delete data.accounts[key];
  writeStore(data);
  return NextResponse.json({ status: "removed", email: removed.email, id: key });
}

function handleUpdate(body: any) {
  const { id, email, ...fields } = body;
  const data = readStore();
  const key = findAccount(data, id, email);
  if (!key) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const updatable = ["password", "recovery", "label", "notes", "tags", "email"];
  const updated: string[] = [];
  for (const f of updatable) {
    if (fields[f] !== undefined) {
      data.accounts[key][f] = fields[f];
      updated.push(f);
    }
  }
  data.accounts[key].updated = Date.now() / 1000;
  writeStore(data);
  return NextResponse.json({ status: "updated", id: key, fields: updated });
}

function handleGet(body: any) {
  const { id, email } = body;
  const data = readStore();
  const key = findAccount(data, id, email);
  if (!key) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const acct = data.accounts[key];
  return NextResponse.json({
    id: acct.id,
    email: acct.email,
    password: acct.password,
    recovery: acct.recovery,
    label: acct.label,
    notes: acct.notes,
    tags: acct.tags || [],
    created: acct.created,
    updated: acct.updated,
  });
}

function handleShare(body: any) {
  const { id, email, expires = 3600 } = body;
  const data = readStore();
  const key = findAccount(data, id, email);
  if (!key) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const acct = data.accounts[key];

  const token = genId() + genId() + genId() + genId();
  const shares = readShares();
  shares[token] = {
    account: {
      email: acct.email,
      password: acct.password,
      recovery: acct.recovery,
      label: acct.label,
      notes: acct.notes,
    },
    created: Date.now() / 1000,
    expires: Date.now() / 1000 + expires,
  };
  writeShares(shares);
  return NextResponse.json({ status: "shared", token, email: acct.email, expires_in: `${expires}s` });
}

function handleImport(body: any) {
  const { token } = body;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const shares = readShares();
  const share = shares[token];
  if (!share) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  if (Date.now() / 1000 > share.expires) {
    delete shares[token];
    writeShares(shares);
    return NextResponse.json({ error: "Token has expired" }, { status: 410 });
  }

  const data = readStore();
  const id = genId();
  const acct = share.account;
  data.accounts[id] = {
    id,
    email: acct.email,
    password: acct.password,
    recovery: acct.recovery,
    label: acct.label,
    notes: acct.notes,
    tags: [],
    created: Date.now() / 1000,
    updated: Date.now() / 1000,
  };
  writeStore(data);
  delete shares[token];
  writeShares(shares);
  return NextResponse.json({ status: "imported", id, email: acct.email });
}

function findAccount(data: any, id?: string, email?: string): string | null {
  for (const [key, acct] of Object.entries(data.accounts) as any) {
    if ((id && key === id) || (email && acct.email === email)) return key;
  }
  return null;
}
