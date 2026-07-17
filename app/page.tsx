import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BARCODE_FORMATS,
  C_STATE_ENCODING,
  encodeCustomerBarcode,
  explainCustomerInformation,
  explainReedSolomon,
  getCustomerInformationLimit,
  NUMERIC_STATE_PAIRS,
  splitBarcodeFields,
} from "./lib/auspost";

type BarCount = 37 | 52 | 67;
type CustomerEncoding = "N" | "C" | "custom";
type ReedSolomonSymbol = { states: string; decimal: number };

const SAMPLES: Record<BarCount, { dpid: string; customerInfo: string; encoding: CustomerEncoding }> = {
  37: { dpid: "39549554", customerInfo: "", encoding: "N" },
  52: { dpid: "12345678", customerInfo: "8765", encoding: "N" },
  67: { dpid: "12345678", customerInfo: "STATE SZ#6", encoding: "C" },
};

const FORMAT_OPTIONS: BarCount[] = [37, 52, 67];
const ENCODING_OPTIONS: { value: CustomerEncoding; label: string; detail: string }[] = [
  { value: "N", label: "N", detail: "数字" },
  { value: "C", label: "C", detail: "字符" },
  { value: "custom", label: "0–3", detail: "Bar states" },
];

const DPI = 360;
const PX_PER_MM = DPI / 25.4;

const STATE_LEGEND = [
  { value: "0", name: "H", detail: "全高" },
  { value: "1", name: "A", detail: "上伸" },
  { value: "2", name: "D", detail: "下伸" },
  { value: "3", name: "T", detail: "轨道" },
];

const FCC_FORMATS = [
  { code: "00", states: "0000", name: "Null Customer Barcode", length: "37 / 52 / 67" },
  { code: "11", states: "0101", name: "Standard Customer Barcode", length: "37" },
  { code: "45", states: "1112", name: "Reply Paid Barcode", length: "37" },
  { code: "59", states: "1230", name: "Customer Barcode 2", length: "52" },
  { code: "62", states: "2002", name: "Customer Barcode 3", length: "67" },
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

function sanitizeCustomerValue(value: string, encoding: CustomerEncoding, limit: number) {
  if (encoding === "N") return value.replace(/\D/g, "").slice(0, limit);
  if (encoding === "custom") return value.replace(/[^0-3]/g, "").slice(0, limit);
  return [...value]
    .filter((character) => C_STATE_ENCODING[character])
    .join("")
    .slice(0, limit);
}

export default function Home() {
  const [barCount, setBarCount] = useState<BarCount>(37);
  const [dpid, setDpid] = useState(SAMPLES[37].dpid);
  const [customerEncoding, setCustomerEncoding] = useState<CustomerEncoding>("N");
  const [customerInfo, setCustomerInfo] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = BARCODE_FORMATS[barCount];
  const dpidIsValid = /^\d{8}$/.test(dpid);
  const customerLimit = getCustomerInformationLimit(barCount, customerEncoding);
  const customerBreakdown = useMemo(
    () => explainCustomerInformation({
      barCount,
      value: customerInfo,
      encoding: customerEncoding,
    }),
    [barCount, customerEncoding, customerInfo],
  );
  const isValid = dpidIsValid;

  const barStates = useMemo(
    () => (isValid ? encodeCustomerBarcode({
      barCount,
      dpid,
      customerInfo,
      customerEncoding,
    }) : ""),
    [barCount, customerEncoding, customerInfo, dpid, isValid],
  );
  const fields = useMemo(
    () => (barStates ? splitBarcodeFields(barStates) : []),
    [barStates],
  );
  const rsBreakdown = useMemo(
    () => (barStates ? explainReedSolomon(barStates) : null),
    [barStates],
  );
  const rsStart = barCount - 13;
  const rsEnd = barCount - 2;
  const stopStart = barCount - 1;
  const customerEnd = 22 + format.customerBars;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (barStates) {
      drawBarcode(canvasRef.current, barStates);
      return;
    }

    const context = canvasRef.current.getContext("2d");
    if (context) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [barStates]);

  const handleDpidInput = useCallback((value: string) => {
    setDpid(value.replace(/\D/g, "").slice(0, 8));
    setCopied(false);
  }, []);

  const handleFormatChange = useCallback((nextBarCount: BarCount) => {
    const nextLimit = getCustomerInformationLimit(nextBarCount, customerEncoding);
    setBarCount(nextBarCount);
    setCustomerInfo((current) => sanitizeCustomerValue(current, customerEncoding, nextLimit));
    setCopied(false);
  }, [customerEncoding]);

  const handleEncodingChange = useCallback((encoding: CustomerEncoding) => {
    setCustomerEncoding(encoding);
    setCustomerInfo("");
    setCopied(false);
  }, []);

  const handleCustomerInput = useCallback((value: string) => {
    setCustomerInfo(sanitizeCustomerValue(value, customerEncoding, customerLimit));
    setCopied(false);
  }, [customerEncoding, customerLimit]);

  const useSample = useCallback(() => {
    const sample = SAMPLES[barCount];
    setDpid(sample.dpid);
    setCustomerEncoding(sample.encoding);
    setCustomerInfo(sample.customerInfo);
    setCopied(false);
  }, [barCount]);

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !barStates) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `auspost-4state-${barCount}bars-${dpid}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [barCount, barStates, dpid]);

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
            <span>FCC {format.fcc}</span>
            <span>{barCount} BARS</span>
          </p>
          <h1>
            把投递信息
            <br />
            变成 <em>4-State</em> 条码
          </h1>
          <p className="intro">
            选择 37、52 或 67-bar 格式，输入 Australia Post 的 DPID 与可选客户信息，
            实时生成包含 Reed-Solomon 纠错的条码。
          </p>

          <div className="generator-form">
            <div className="input-block format-block">
              <div className="input-heading">
                <span className="input-label">Barcode format</span>
                <span className="format-caption">选择输出长度</span>
              </div>
              <div className="format-picker" role="radiogroup" aria-label="选择条码长度">
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={barCount === option}
                    className={barCount === option ? "format-option is-selected" : "format-option"}
                    onClick={() => handleFormatChange(option)}
                    key={option}
                  >
                    <strong>{option}</strong>
                    <span>bars</span>
                    <small>FCC {BARCODE_FORMATS[option].fcc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="input-block">
              <div className="input-heading">
                <label htmlFor="dpid">Delivery Point Identifier</label>
                <span className={dpidIsValid ? "count valid" : "count"}>{dpid.length}/8</span>
              </div>
              <div className={`number-input ${dpid && !dpidIsValid ? "has-error" : ""}`}>
                <span className="input-prefix">DPID</span>
                <input
                  id="dpid"
                  value={dpid}
                  onChange={(event) => handleDpidInput(event.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="00000000"
                  aria-describedby="dpid-help"
                  aria-invalid={dpid.length > 0 && !dpidIsValid}
                  autoComplete="off"
                />
                <button type="button" className="sample-button" onClick={useSample}>
                  使用示例
                </button>
              </div>
              <p id="dpid-help" className="input-help">
                {dpid.length > 0 && !dpidIsValid
                  ? `还需要 ${8 - dpid.length} 位数字`
                  : "DPID 是地址的 8 位投递点标识，并不是邮政编码。"}
              </p>
            </div>

            {barCount !== 37 && (
              <div className="input-block customer-input-block">
                <div className="input-heading customer-heading">
                  <label htmlFor="customer-info">Customer Information</label>
                  <div className="encoding-picker" role="radiogroup" aria-label="Customer Information 编码方式">
                    {ENCODING_OPTIONS.map((option) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={customerEncoding === option.value}
                        className={customerEncoding === option.value ? "encoding-option is-selected" : "encoding-option"}
                        onClick={() => handleEncodingChange(option.value)}
                        key={option.value}
                      >
                        {option.label}<small>{option.detail}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="number-input customer-input">
                  <span className="input-prefix">CI</span>
                  <input
                    id="customer-info"
                    value={customerInfo}
                    onChange={(event) => handleCustomerInput(event.target.value)}
                    inputMode={customerEncoding === "N" || customerEncoding === "custom" ? "numeric" : "text"}
                    maxLength={customerLimit}
                    placeholder={customerEncoding === "N" ? "可选数字" : customerEncoding === "C" ? "可选字符" : "可选 0–3 states"}
                    aria-describedby="customer-help"
                    autoComplete="off"
                  />
                </div>
                <p id="customer-help" className="input-help customer-help">
                  <span>{customerInfo.length}/{customerLimit} {customerEncoding === "custom" ? "states" : "characters"}</span>
                  <span>编码 {customerBreakdown.encodedStates.length} bars · Filler {customerBreakdown.fillerCount} bars</span>
                </p>
              </div>
            )}
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
              <span id="preview-title">{format.name.toUpperCase()}</span>
              <strong>{isValid ? `${format.fcc} ${dpid}` : "等待 8 位 DPID"}</strong>
            </div>
            <div className="canvas-wrap">
              <canvas ref={canvasRef} aria-label={isValid ? `DPID ${dpid} 的 ${barCount}-bar 4-State 条码` : "条码预览区域"} />
              {!isValid && <span className="canvas-placeholder">输入完整 DPID 后生成</span>}
            </div>
            <div className="preview-foot">
              <span>6 mm quiet zone</span>
              <span>{barCount} bars</span>
              <span>{format.rsName}</span>
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
          <h2>一个 {barCount}-bar code，是怎样组成的？</h2>
          <p>
            FCC {format.fcc} 对应 {format.name}。
            {barCount === 37
              ? "它只承载 DPID，不包含 Customer Information。"
              : `它在 DPID 后提供 ${format.customerBars} 根 Customer Information bar。`}
          </p>
        </div>

        <div className="field-map" aria-label={`${barCount}-bar 条码字段结构`}>
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

        <div className="encoding-sequence" aria-label={`${barCount}-bar 条码的顺序说明`}>
          <article className="sequence-step sequence-start">
            <header className="sequence-step-head">
              <span className="sequence-number">01</span>
              <div>
                <p className="mini-label">START BARS</p>
                <h3>从固定的 13 开始</h3>
              </div>
              <span className="sequence-position">BARS 01–02</span>
            </header>
            <div className="sequence-body sequence-compact">
              <p className="sequence-copy">
                第一根是 Ascender（state 1），第二根是 Tracker（state 3）。这个固定组合标记条码起点，也帮助设备判断条码是否倒置。
              </p>
              <div className="fixed-pair" aria-label="Start bars 为 bar state 1 和 3">
                <span><strong>A</strong><code>1</code></span><i>+</i>
                <span><strong>T</strong><code>3</code></span><b>→ 13</b>
              </div>
            </div>
          </article>

          <article className="sequence-step sequence-fcc">
            <header className="sequence-step-head">
              <span className="sequence-number">02</span>
              <div>
                <p className="mini-label">FORMAT CONTROL CODE</p>
                <h3>FCC 说明条码格式</h3>
              </div>
              <span className="sequence-position">BARS 03–06</span>
            </header>
            <div className="sequence-body">
              <p className="sequence-copy">
                FCC 是两位数字，每个数字编码成两根 bar，因此固定占四根。它告诉分拣设备条码用途、总长度，以及后面是否存在 Customer Information。
              </p>
              <div className="fcc-table" role="table" aria-label="FCC 组合表">
                <div className="fcc-table-head" role="row">
                  <span>FCC</span><span>4 BAR STATES</span><span>FORMAT</span><span>LENGTH</span>
                </div>
                {FCC_FORMATS.map((format) => (
                  <div className={`fcc-row ${format.code === BARCODE_FORMATS[barCount].fcc ? "is-current" : ""}`} role="row" key={format.code}>
                    <strong>{format.code}</strong>
                    <code>{format.states}</code>
                    <span>{format.name}{format.code === BARCODE_FORMATS[barCount].fcc && <small>当前</small>}</span>
                    <span>{format.length} bars</span>
                  </div>
                ))}
              </div>
              <p className="sequence-note">
                资料中明确列出以上五种 FCC 组合；当前页面生成 <strong>FCC 11、59 和 62</strong>。无效 FCC 会导致邮件被拒收。
              </p>
            </div>
          </article>

          <article className="sequence-step sequence-dpid">
            <header className="sequence-step-head">
              <span className="sequence-number">03</span>
              <div>
                <p className="mini-label">DELIVERY POINT IDENTIFIER</p>
                <h3>8 位 DPID 变成 16 根 bar</h3>
              </div>
              <span className="sequence-position">BARS 07–22</span>
            </header>
            <div className="sequence-body">
              <p className="sequence-copy">
                DPID 的每个十进制数字都通过数字表映射成两位 bar state，例如 <code>0 → 00</code>、<code>5 → 12</code>、<code>9 → 30</code>。
              </p>
              <div className="dpid-symbols" aria-label="当前 DPID 的逐位编码">
                {isValid ? dpid.split("").map((digit, index) => (
                  <span className="dpid-symbol" key={`${digit}-${index}`}>
                    <small>D{index + 1}</small><strong>{digit}</strong><i>→</i><code>{NUMERIC_STATE_PAIRS[Number(digit)]}</code>
                  </span>
                )) : <em>输入完整 DPID 后显示逐位编码</em>}
              </div>
            </div>
          </article>

          <article className="sequence-step sequence-filler">
            <header className="sequence-step-head">
              <span className="sequence-number">04</span>
              <div>
                <p className="mini-label">{barCount === 37 ? "FILLER BAR" : "CUSTOMER INFORMATION / FILLER"}</p>
                <h3>{barCount === 37 ? "用 Filler 补齐数据区" : "编码 Customer Information"}</h3>
              </div>
              <span className="sequence-position">
                {barCount === 37 ? "BAR 23" : `BARS 23–${customerEnd}`}
              </span>
            </header>
            {barCount === 37 ? (
              <div className="sequence-body filler-layout">
                <div className="filler-symbol" aria-label="Filler 使用 bar state 3，也就是 Tracker">
                  <span className="filler-track" aria-hidden="true" />
                  <div><strong>T</strong><code>3</code></div>
                </div>
                <div>
                  <p className="sequence-copy">
                    Standard Customer Barcode 固定加入一根 Tracker（state 3），使 FCC + DPID + Filler 正好成为 21 根数据 bar，可供下一步分成 7 组三元符号。
                  </p>
                  <ul>
                    <li><strong>37-bar：</strong>固定使用一根 Filler。</li>
                    <li><strong>52 / 67-bar：</strong>Filler 位于 Customer Information 字段内部。</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="sequence-body customer-layout">
                <div className="customer-summary" aria-label="Customer Information 编码摘要">
                  <span><small>ENCODING</small><strong>{customerEncoding}</strong></span>
                  <i aria-hidden="true">→</i>
                  <span><small>DATA</small><strong>{customerBreakdown.encodedStates.length}</strong></span>
                  <i aria-hidden="true">+</i>
                  <span><small>FILLER</small><strong>{customerBreakdown.fillerCount}</strong></span>
                  <i aria-hidden="true">=</i>
                  <span><small>FIELD</small><strong>{format.customerBars}</strong></span>
                </div>
                <p className="sequence-copy">
                  {customerEncoding === "N" && "N 表把每个数字编码成两根 bar。"}
                  {customerEncoding === "C" && "C 表把每个受支持字符编码成三根 bar。"}
                  {customerEncoding === "custom" && "Custom 模式直接把输入的 0–3 当作 bar states。"}
                  不足 {format.customerBars} 根的部分统一在右侧补 Tracker（state 3）。
                </p>
                <div className="customer-state-lines">
                  <div>
                    <span>ENCODED</span>
                    <code>{customerBreakdown.encodedStates || "—"}</code>
                  </div>
                  <div>
                    <span>WITH FILLER</span>
                    <code>{customerBreakdown.states}</code>
                  </div>
                </div>
                <p className="sequence-note">
                  当前输入占 {customerBreakdown.encodedStates.length} 根，补入 <strong>{customerBreakdown.fillerCount}</strong> 根 Filler；Filler 属于 Customer Information 字段，不是独立字段。
                </p>
              </div>
            )}
          </article>

          <article className="sequence-step sequence-rs">
            <header className="sequence-step-head">
              <span className="sequence-number">05</span>
              <div>
                <p className="mini-label">REED-SOLOMON / GF(64)</p>
                <h3>计算 12 根纠错 bar</h3>
              </div>
              <span className="sequence-position">BARS {rsStart}–{rsEnd}</span>
            </header>
            <div className="sequence-body">
              <p className="sequence-copy">
                Reed-Solomon 使用前面的 FCC、DPID 与{barCount === 37 ? " Filler" : "完整 Customer Information（包括 Filler）"}计算校验数据；Start 和 Stop 不参与计算。
              </p>
              <div className="rs-equation" aria-label="Reed-Solomon 计算概要">
                <span><strong>{format.dataBars}</strong><small>data bars</small></span>
                <i>÷ 3</i>
                <span><strong>{format.dataSymbols}</strong><small>GF(64) data symbols</small></span>
                <i>{format.rsName}</i>
                <span><strong>4</strong><small>check symbols</small></span>
                <i>× 3</i>
                <span><strong>12</strong><small>check bars</small></span>
              </div>
              <div className="rs-steps">
                <div className="rs-step">
                  <span className="rs-step-number">A</span>
                  <div>
                    <h4>三根一组，转换为 GF(64) 符号</h4>
                    <p>每组三位按四进制解释为一个 0–63 的数。</p>
                    <div className="symbol-list">
                      {rsBreakdown ? rsBreakdown.dataSymbols.map((symbol: ReedSolomonSymbol, index: number) => (
                        <span className="symbol-chip" key={`data-${symbol.states}-${index}`}>
                          <code>{symbol.states}</code><small>₄ = {symbol.decimal}</small>
                        </span>
                      )) : <em>等待完整 DPID</em>}
                    </div>
                  </div>
                </div>
                <div className="rs-step">
                  <span className="rs-step-number">B</span>
                  <div>
                    <h4>在有限域中计算四个余数</h4>
                    <p>
                      使用本原多项式 <code>x⁶ + x + 1</code>（0x43）和生成多项式系数
                      <code>[48, 17, 29, 30, 1]</code>；每轮以异或完成有限域加减。
                    </p>
                  </div>
                </div>
                <div className="rs-step rs-output-step">
                  <span className="rs-step-number">C</span>
                  <div>
                    <h4>四个余数变回 12 根 bar</h4>
                    <p>每个校验符号写成三位四进制，并依次放在 Stop bars 之前。</p>
                    <div className="symbol-list check-symbol-list">
                      {rsBreakdown ? rsBreakdown.checkSymbols.map((symbol: ReedSolomonSymbol, index: number) => (
                        <span className="symbol-chip" key={`check-${symbol.states}-${index}`}>
                          <code>{symbol.states}</code><small>₄ = {symbol.decimal}</small>
                        </span>
                      )) : <em>等待完整 DPID</em>}
                      {rsBreakdown && <strong className="check-result">→ {rsBreakdown.checkStates}</strong>}
                    </div>
                  </div>
                </div>
              </div>
              <p className="sequence-note">
                这些校验条让设备在少量污损、漏印或反光干扰下仍能校验条码；它不负责验证 DPID 是否真实存在。
              </p>
            </div>
          </article>

          <article className="sequence-step sequence-stop">
            <header className="sequence-step-head">
              <span className="sequence-number">06</span>
              <div>
                <p className="mini-label">STOP BARS</p>
                <h3>最后用 13 结束</h3>
              </div>
              <span className="sequence-position">BARS {stopStart}–{barCount}</span>
            </header>
            <div className="sequence-body sequence-compact">
              <p className="sequence-copy">
                Stop bars 与 Start bars 相同，也是 Ascender（1）+ Tracker（3）。首尾固定且对称，让扫描设备可靠识别方向和边界。
              </p>
              <div className="fixed-pair" aria-label="Stop bars 为 bar state 1 和 3">
                <span><strong>A</strong><code>1</code></span><i>+</i>
                <span><strong>T</strong><code>3</code></span><b>→ 13</b>
              </div>
            </div>
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
          <div><span>BARCODE LENGTH</span><strong>{format.minimumLength}–{format.maximumLength}</strong><small>mm</small></div>
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
        </div>
        <p>Australia Post 4-State Customer Code · FCC {format.fcc} · {barCount} bars</p>
      </footer>
    </main>
  );
}
