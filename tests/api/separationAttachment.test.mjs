// Optional attachment on a separation request (POST /admin/separation/my,
// multipart field "attachment"). QA company only; every request created here
// is withdrawn again at the end.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, api } from "./helpers.mjs";
import { qaCompany } from "./fixtures.mjs";

let qa;
const created = []; // { token, id }
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

// 1×1 transparent PNG and a minimal PDF.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const submitMultipart = async (token, file, { field = "attachment", extra = {} } = {}) => {
  const fd = new FormData();
  fd.append("reason", "personal");
  fd.append("resignationDate", today());
  fd.append("comments", "QA attachment test");
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  if (file) fd.append(field, new Blob([file.data], { type: file.type }), file.name);
  const res = await fetch(`${BASE}/admin/separation/my`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  return { status: res.status, body: await res.json() };
};

const freshEmployee = async (label) => qa.newUser("employee", label);
const track = (u, r) => { if (r.body?.data?.id) created.push({ token: u.token, id: r.body.data.id }); };

before(async () => {
  qa = await qaCompany();
});

after(async () => {
  for (const c of created) {
    await api("POST", `/admin/separation/my/${c.id}/withdraw`, c.token, { reason: "QA test cleanup" }).catch(() => {});
  }
});

test("SA-01 Image attachment is uploaded and saved with the request", async () => {
  const u = await freshEmployee("sep-att-img");
  const r = await submitMultipart(u.token, { data: PNG, type: "image/png", name: "resignation-letter.png" });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 300));
  track(u, r);
  assert.ok(r.body.data.attachmentUrl, "attachmentUrl returned");
  assert.equal(r.body.data.attachmentName, "resignation-letter.png");
  assert.equal(r.body.data.attachmentType, "image/png");

  const mine = await api("GET", "/admin/separation/my", u.token);
  const cur = mine.body.data.current ?? mine.body.data.requests?.[0] ?? mine.body.data.history?.[0];
  assert.equal(cur?.attachmentUrl, r.body.data.attachmentUrl, JSON.stringify(mine.body.data).slice(0, 300));

  const file = await fetch(r.body.data.attachmentUrl);
  assert.equal(file.status, 200, "stored file is reachable");
});

test("SA-02 PDF attachment works too", async () => {
  const u = await freshEmployee("sep-att-pdf");
  const r = await submitMultipart(u.token, { data: PDF, type: "application/pdf", name: "letter.pdf" });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 300));
  track(u, r);
  assert.equal(r.body.data.attachmentType, "application/pdf");
});

test("SA-03 Other file types are refused and no request is created", async () => {
  const u = await freshEmployee("sep-att-txt");
  const r = await submitMultipart(u.token, { data: Buffer.from("hello"), type: "text/plain", name: "note.txt" });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /JPG, PNG, WEBP images or PDF/);
  const mine = await api("GET", "/admin/separation/my", u.token);
  assert.ok(!mine.body.data.current, "no request was created");
});

test("SA-04 Files over 5 MB are refused", async () => {
  const u = await freshEmployee("sep-att-big");
  const r = await submitMultipart(u.token, { data: Buffer.alloc(5 * 1024 * 1024 + 10), type: "image/png", name: "big.png" });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /under 5MB/);
});

test("SA-05 Wrong field name is refused with a clear message", async () => {
  const u = await freshEmployee("sep-att-field");
  const r = await submitMultipart(u.token, { data: PNG, type: "image/png", name: "x.png" }, { field: "file" });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /attachment/);
});

test("SA-06 Multipart without a file works (attachment stays optional)", async () => {
  const u = await freshEmployee("sep-att-nofile");
  const r = await submitMultipart(u.token, null);
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 300));
  track(u, r);
  assert.equal(r.body.data.attachmentUrl, null);
});

test("SA-07 The old JSON submit is unchanged", async () => {
  const u = await freshEmployee("sep-att-json");
  const r = await api("POST", "/admin/separation/my", u.token, { reason: "personal", resignationDate: today(), comments: "json" });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 300));
  track(u, r);
  assert.equal(r.body.data.attachmentUrl, null);
});

test("SA-08 Validation still runs: a bad reason is refused even with a valid file", async () => {
  const u = await freshEmployee("sep-att-badreason");
  const fd = new FormData();
  fd.append("reason", "not-a-reason");
  fd.append("resignationDate", today());
  fd.append("attachment", new Blob([PNG], { type: "image/png" }), "x.png");
  const res = await fetch(`${BASE}/admin/separation/my`, { method: "POST", headers: { Authorization: `Bearer ${u.token}` }, body: fd });
  assert.equal(res.status, 400);
});

test("SA-09 The admin reviewing the request sees the attachment", async () => {
  const withFile = created[0];
  assert.ok(withFile, "SA-01 created a request");
  const r = await api("GET", `/admin/separation/requests/${withFile.id}`, qa.admin);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const req = r.body.data.request ?? r.body.data;
  assert.ok(req.attachmentUrl, "admin sees attachmentUrl");
  assert.equal(req.attachmentName, "resignation-letter.png");
});
