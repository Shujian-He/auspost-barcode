import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  encodeCustomerBarcode,
  encodeStandardCustomerBarcode,
  explainCustomerInformation,
  explainReedSolomon,
  explainStandardReedSolomon,
  splitBarcodeFields,
} from "../app/lib/auspost.js";

async function render(props = {}) {
  const server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  try {
    const { default: Page } = await server.ssrLoadModule("/app/page.tsx");
    return renderToStaticMarkup(createElement(Page, props));
  } finally {
    await server.close();
  }
}

test("encodes the verified Australia Post FCC 11 sample", () => {
  const encoded = encodeStandardCustomerBarcode("39549554");
  assert.equal(encoded, "1301011030121130121211331210131132213");
  assert.equal(encoded.length, 37);

  const fields = splitBarcodeFields(encoded);
  assert.deepEqual(fields.map((field) => field.value.length), [2, 4, 16, 1, 12, 2]);

  const reedSolomon = explainStandardReedSolomon(encoded);
  assert.deepEqual(reedSolomon.dataSymbols.map((symbol) => symbol.decimal), [4, 20, 49, 37, 49, 38, 23]);
  assert.equal(reedSolomon.checkStates, "312101311322");
  assert.deepEqual(reedSolomon.checkSymbols.map((symbol) => symbol.decimal), [54, 17, 53, 58]);
});

test("rejects incomplete or non-numeric DPIDs", () => {
  assert.throws(() => encodeStandardCustomerBarcode("1234567"));
  assert.throws(() => encodeStandardCustomerBarcode("1234567A"));
});

test("encodes verified 52-bar FCC 59 samples", () => {
  const numeric = encodeCustomerBarcode({
    barCount: 52,
    dpid: "12345678",
    customerInfo: "8765",
    customerEncoding: "N",
  });
  assert.equal(numeric, "1312300102101112202122222120123333333332022323313213");

  const character = encodeCustomerBarcode({
    barCount: 52,
    dpid: "56439111",
    customerInfo: "ABA 9",
    customerEncoding: "C",
  });
  assert.equal(character, "1312301220111030010101000001000003322331012100033113");
  assert.deepEqual(splitBarcodeFields(character).map((field) => field.value.length), [2, 4, 16, 16, 12, 2]);
  assert.equal(explainReedSolomon(character).checkStates, "310121000331");
});

test("encodes verified 67-bar FCC 62 samples", () => {
  const character = encodeCustomerBarcode({
    barCount: 67,
    dpid: "12345678",
    customerInfo: "STATE SZ#6",
    customerEncoding: "C",
  });
  assert.equal(character, "1320020102101112202122200201000201011003200221013312320112303223313");

  const numeric = encodeCustomerBarcode({
    barCount: 67,
    dpid: "10913627",
    customerInfo: "123456789009876",
    customerEncoding: "N",
  });
  assert.equal(numeric, "1320020100300110200221010210111220212230000030222120302010000300113");

  const custom = encodeCustomerBarcode({
    barCount: 67,
    dpid: "19563573",
    customerInfo: "01300112020131020301",
    customerEncoding: "custom",
  });
  assert.equal(custom, "1320020130122010122110013001120201310203013333333333320330202000313");
  assert.deepEqual(splitBarcodeFields(custom).map((field) => field.value.length), [2, 4, 16, 31, 12, 2]);
  assert.equal(explainReedSolomon(custom).checkStates, "203302020003");
});

test("pads customer information and validates each encoding", () => {
  assert.deepEqual(
    explainCustomerInformation({ barCount: 52, value: "8765", encoding: "N" }),
    {
      encoding: "N",
      capacity: 16,
      limit: 8,
      encodedStates: "22212012",
      fillerCount: 8,
      states: "2221201233333333",
    },
  );

  assert.throws(() => encodeCustomerBarcode({ barCount: 52, dpid: "12345678", customerInfo: "123456789", customerEncoding: "N" }));
  assert.throws(() => encodeCustomerBarcode({ barCount: 52, dpid: "12345678", customerInfo: "BAD@", customerEncoding: "C" }));
  assert.throws(() => encodeCustomerBarcode({ barCount: 67, dpid: "12345678", customerInfo: "01234", customerEncoding: "custom" }));
});

test("builds a GitHub Pages entry page", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Australia Post 4-State Barcode Generator<\/title>/i);
  assert.match(html, /<html lang="en">/i);
  assert.match(
    html,
    /<meta\s+name="description"\s+content="Generate 37, 52, and 67-bar Australia Post 4-State Customer Barcodes and save them as PNG files."\s*\/>/i,
  );
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /<script[^>]+type="module"[^>]+src="\/auspost-barcode\/assets\/[^\"]+\.js"/i);
  assert.match(html, /<link[^>]+href="\/auspost-barcode\/assets\/[^\"]+\.css"/i);
  assert.doesNotMatch(html, /vinext|cloudflare|wrangler|codex-preview/i);
});

test("renders the finished generator", async () => {
  const html = await render();
  assert.match(html, /Delivery Point Identifier/);
  assert.match(html, /Choose a 37, 52, or 67-bar format/);
  assert.match(html, /FCC[\s\S]*59/);
  assert.match(html, /FCC[\s\S]*62/);
  assert.match(html, /Save as PNG/);
  assert.match(html, /Reed-Solomon/);
  assert.match(html, /RS\(11,7\)/);
  assert.match(html, /Start with the fixed 13/);
  assert.match(html, /The FCC identifies the format/);
  assert.match(html, /Convert the 8-digit DPID into 16 bars/);
  assert.match(html, /Fill the data area with a Filler/);
  assert.match(html, /Calculate 12 error-correction bars/);
  assert.match(html, /Finish with 13/);
  assert.match(html, /class="is-active" aria-pressed="true" lang="en">EN/);
  assert.ok(html.indexOf('lang="en"') < html.indexOf('lang="zh-CN"'));
  assert.doesNotMatch(html, /How it works|生成原理|class="header-link"/);
  assert.equal((html.match(/class="brand-mark"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /POST \/ FOUR|4-STATE CODE STUDIO|footer-mark|>P\/F</);
  assert.doesNotMatch(html, /NUMERIC ENCODING/);
  assert.doesNotMatch(html, /不是 Filter/);
  assert.doesNotMatch(html, /基于工作区内 4 份资料/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("renders the complete Chinese translation", async () => {
  const html = await render({ initialLanguage: "zh" });
  assert.match(html, /把投递信息/);
  assert.match(html, /选择 37、52 或 67-bar 格式/);
  assert.match(html, /保存为 PNG/);
  assert.match(html, /从固定的 13 开始/);
  assert.match(html, /FCC 说明条码格式/);
  assert.match(html, /8 位 DPID 变成 16 根 bar/);
  assert.match(html, /计算 12 根纠错 bar/);
  assert.match(html, /最后用 13 结束/);
  assert.match(html, /打印前，请保留这些物理条件/);
  assert.match(html, /class="is-active" aria-pressed="true" lang="zh-CN">中文/);
  assert.doesNotMatch(html, /Turn delivery data|How it works|Save as PNG|Preserve these physical requirements/);
});
