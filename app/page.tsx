"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  encodeStandardCustomerBarcode,
  splitBarcodeFields,
} from "./lib/auspost";

const SAMPLE_DPID = "39549554";
const DPI = 360;
const PX_PER_MM = DPI / 25.4;

const STATE_LEGEND = [
  { value: "0", name: "H", detail: "全高" },
  { value: "1", name: "A", detail: "上伸" },
  { value: "2", name: "D", detail: "下伸" },
  { value: "3", name: "T", detail: "轨道" },
];

function drawBarcode(canvas: HTMLCanvasElement, states: string) {
  const barWidth = Math.round(0.5 * PX_PER_MM);
  const gap = Math.round(0.55 * PX_PER_MM);
  const quietX = Math.round(6 * PX_PER_MM);
  const quietY = Math.round(2 * PX_PER_MM);
  const ascender = Math.round(2.2 * PX_PER_MM);
  const tracker = Math.round(0.65 * PX_PER_MM);
  const descender = Math.round(2.2 * PX_PER_MM);
  const barcodeHeight = ascender + tracker + descender;

  canvas.width =
    quietX * 2 + states.length * barWidth + (states.length - 1) * gap;
  canvas.height = quietY * 2 + barcodeHeight;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#102338";

  for (const [index, state] of [...states].entries()) {
    const x = quietX + index * (barWidth + gap);
    let y = quietY;
    let height = barcodeHeight;

    if (state === "1") height = ascender + tracker;
    if (state === "2") {
      y += ascender;
      height = tracker + descender;
    }
    if (state === "3") {
      y += ascender;
      height = tracker;
    }

    context.fillRect(x, y, barWidth, height);
  }
}

function MiniBar({ state }: { state: string }) {
  return <span className={`mini-bar mini-bar-${state}`} aria-hidden="true" />;
}

export default function Home() {
  const [dpid, setDpid] = useState(SAMPLE_DPID);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isValid = /^\d{8}$/.test(dpid);

  const barStates = useMemo(
    () => (isValid ? encodeStandardCustomerBarcode(dpid) : ""),
    [dpid, isValid],
  );
  const fields = useMemo(
    () => (barStates ? splitBarcodeFields(barStates) : []),
    [barStates],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    if (barStates) {
      drawBarcode(canvasRef.current, barStates);
      return;
    }

    const context = canvasRef.current.getContext("2d");
    if (context) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [barStates]);

  const handleInput = useCallback((value: string) => {
    setDpid(value.replace(/\D/g, "").slice(0, 8));
    setCopied(false);
  }, []);

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !barStates) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `auspost-4state-${dpid}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [barStates, dpid]);

  const copyStates = useCallback(async () => {
    if (!barStates) return;
    await navigator.clipboard.writeText(barStates);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [barStates]);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="返回页面顶部">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>POST / FOUR</strong>
            <small>4-STATE CODE STUDIO</small>
          </span>
        </a>
        <a className="header-link" href="#guide">
          生成原理 <span aria-hidden="true">↘</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span>AUSTRALIA POST</span>
            <span>FCC 11</span>
            <span>37 BARS</span>
          </p>
          <h1>
            把 8 位 DPID
            <br />
            变成 <em>4-State</em> 条码
          </h1>
          <p className="intro">
            输入 Australia Post 的 Delivery Point Identifier，实时生成标准客户条码。
            条码包含方向识别、格式控制和 Reed-Solomon 纠错。
          </p>

          <div className="input-block">
            <div className="input-heading">
              <label htmlFor="dpid">Delivery Point Identifier</label>
              <span className={isValid ? "count valid" : "count"}>{dpid.length}/8</span>
            </div>
            <div className={`number-input ${dpid && !isValid ? "has-error" : ""}`}>
              <span className="input-prefix">DPID</span>
              <input
                id="dpid"
                value={dpid}
                onChange={(event) => handleInput(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="00000000"
                aria-describedby="dpid-help"
                aria-invalid={dpid.length > 0 && !isValid}
                autoComplete="off"
              />
              <button type="button" className="sample-button" onClick={() => handleInput(SAMPLE_DPID)}>
                使用示例
              </button>
            </div>
            <p id="dpid-help" className="input-help">
              {dpid.length > 0 && !isValid
                ? `还需要 ${8 - dpid.length} 位数字`
                : "DPID 是地址的 8 位投递点标识，并不是邮政编码。"}
            </p>
          </div>
        </div>

        <section className="generator-card" aria-labelledby="preview-title">
          <div className="card-kicker">
            <span className="live-dot" />
            LIVE OUTPUT
            <span>360 DPI CANVAS</span>
          </div>
          <div className="preview-frame">
            <div className="preview-meta">
              <span id="preview-title">STANDARD CUSTOMER BARCODE</span>
              <strong>{isValid ? `11 ${dpid}` : "等待 8 位 DPID"}</strong>
            </div>
            <div className="canvas-wrap">
              <canvas ref={canvasRef} aria-label={isValid ? `DPID ${dpid} 的 4-State 条码` : "条码预览区域"} />
              {!isValid && <span className="canvas-placeholder">输入完整 DPID 后生成</span>}
            </div>
            <div className="preview-foot">
              <span>6 mm quiet zone</span>
              <span>37 bars</span>
              <span>RS error correction</span>
            </div>
          </div>

          <div className="action-row">
            <button className="primary-action" type="button" onClick={downloadPng} disabled={!isValid}>
              保存为 PNG <span aria-hidden="true">↓</span>
            </button>
            <button className="secondary-action" type="button" onClick={copyStates} disabled={!isValid}>
              {copied ? "已复制" : "复制 bar states"}
            </button>
          </div>
          <p className="card-note">PNG 仅包含黑色条码与符合规范的白色静区，便于排版使用。</p>
        </section>
      </section>

      <section className="state-strip" aria-label="四种 bar state">
        <div className="strip-title">
          <span>THE FOUR STATES</span>
          <p>每根 bar 都有相同的中间 tracker，并按状态向上或向下延伸。</p>
        </div>
        {STATE_LEGEND.map((state) => (
          <div className="state-item" key={state.value}>
            <div className="state-visual">
              <MiniBar state={state.value} />
              <span className="center-rule" />
            </div>
            <div>
              <strong>{state.name}</strong>
              <span>{state.detail}</span>
            </div>
            <code>{state.value}</code>
          </div>
        ))}
      </section>

      <section className="guide" id="guide">
        <div className="section-heading">
          <p className="eyebrow"><span>ENCODING MAP</span></p>
          <h2>一个 37-bar code，是怎样组成的？</h2>
          <p>FCC 11 是最常用的 Standard Customer Barcode，只承载 DPID，不包含客户自定义信息。</p>
        </div>

        <div className="field-map" aria-label="条码字段结构">
          {fields.length > 0 ? (
            fields.map((field, index) => (
              <div className={`field field-${field.key}`} key={field.key}>
                <div className="field-label">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{field.label}</strong>
                </div>
                <code>{field.value}</code>
                <small>{field.value.length} bar{field.value.length > 1 ? "s" : ""}</small>
              </div>
            ))
          ) : (
            <p className="field-empty">输入完整 DPID 后，这里会显示每个字段对应的 bar states。</p>
          )}
        </div>

        <div className="explanation-grid">
          <article className="explanation-card featured">
            <span className="card-number">01</span>
            <p className="mini-label">NUMERIC ENCODING</p>
            <h3>每个数字变成两根 bar</h3>
            <p>
              FCC 与 8 位 DPID 都通过数字表编码，例如 <code>0 → 00</code>、
              <code>5 → 12</code>、<code>9 → 30</code>。因此 DPID 固定占 16 根 bar。
            </p>
          </article>
          <article className="explanation-card dark">
            <span className="card-number">02</span>
            <p className="mini-label">ERROR CORRECTION</p>
            <h3>12 根 bar 用于纠错</h3>
            <p>编码数据按三根一组转换为 GF(64) 符号，再计算四个 Reed-Solomon 校验符号。</p>
          </article>
          <article className="explanation-card">
            <span className="card-number">03</span>
            <p className="mini-label">ORIENTATION</p>
            <h3>固定的 13 开始与结束</h3>
            <p>首尾都使用 bar state <code>13</code>，即 Ascender + Tracker，让设备判断方向。</p>
          </article>
        </div>
      </section>

      <section className="spec-section">
        <div className="spec-copy">
          <p className="eyebrow"><span>PRINT CHECK</span></p>
          <h2>打印前，请保留这些物理条件。</h2>
          <p>
            网页生成的是编码正确的高分辨率图像；最终邮件仍需满足 Australia Post 对尺寸、对比度、位置和纸张的要求。
          </p>
          <div className="notice">
            <strong>重要</strong>
            <p>本工具不会确认某个 DPID 是否真实存在。有效 DPID 应由通过 AMAS 认证的地址匹配软件从 Postal Address File 获取。</p>
          </div>
        </div>
        <div className="spec-grid">
          <div><span>BARCODE LENGTH</span><strong>37.0–42.2</strong><small>mm</small></div>
          <div><span>BAR WIDTH</span><strong>0.4–0.6</strong><small>mm</small></div>
          <div><span>BAR GAP</span><strong>0.4–0.7</strong><small>mm</small></div>
          <div><span>QUIET ZONE</span><strong>6 / 2</strong><small>mm 横 / 纵</small></div>
          <div><span>BAR DENSITY</span><strong>22–25</strong><small>bars / inch</small></div>
          <div><span>SKEW</span><strong>±5°</strong><small>maximum</small></div>
        </div>
      </section>

      <footer>
        <div>
          <span className="footer-mark">P/F</span>
          <p>基于工作区内 4 份资料整理与实现。</p>
        </div>
        <p>Australia Post 4-State Customer Code · Standard FCC 11</p>
      </footer>
    </main>
  );
}
