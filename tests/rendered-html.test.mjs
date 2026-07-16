import assert from "node:assert/strict";
import test from "node:test";
import { encodeStandardCustomerBarcode, splitBarcodeFields } from "../app/lib/auspost.js";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("encodes the verified Australia Post FCC 11 sample", () => {
  const encoded = encodeStandardCustomerBarcode("39549554");
  assert.equal(encoded, "1301011030121130121211331210131132213");
  assert.equal(encoded.length, 37);

  const fields = splitBarcodeFields(encoded);
  assert.deepEqual(fields.map((field) => field.value.length), [2, 4, 16, 1, 12, 2]);
});

test("rejects incomplete or non-numeric DPIDs", () => {
  assert.throws(() => encodeStandardCustomerBarcode("1234567"));
  assert.throws(() => encodeStandardCustomerBarcode("1234567A"));
});

test("server-renders the finished generator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Australia Post 4-State 条码生成器<\/title>/i);
  assert.match(html, /Delivery Point Identifier/);
  assert.match(html, /保存为 PNG/);
  assert.match(html, /Reed-Solomon/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});
