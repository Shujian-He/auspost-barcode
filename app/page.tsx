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
type Language = "zh" | "en";

const SAMPLES: Record<BarCount, { dpid: string; customerInfo: string; encoding: CustomerEncoding }> = {
  37: { dpid: "20040908", customerInfo: "", encoding: "N" },
  52: { dpid: "20040908", customerInfo: "0947", encoding: "N" },
  67: { dpid: "20040908", customerInfo: "ANON##CHAN", encoding: "C" },
};

const FORMAT_OPTIONS: BarCount[] = [37, 52, 67];
const ENCODING_OPTIONS: { value: CustomerEncoding; label: string }[] = [
  { value: "N", label: "N" },
  { value: "C", label: "C" },
  { value: "custom", label: "0–3" },
];

const DPI = 360;
const PX_PER_MM = DPI / 25.4;

const STATE_LEGEND = [
  { value: "0", name: "H" },
  { value: "1", name: "A" },
  { value: "2", name: "D" },
  { value: "3", name: "T" },
];

const FCC_FORMATS = [
  { code: "00", states: "0000", name: "Null Customer Barcode", length: "37 / 52 / 67" },
  { code: "11", states: "0101", name: "Standard Customer Barcode", length: "37" },
  { code: "45", states: "1112", name: "Reply Paid Barcode", length: "37" },
  { code: "59", states: "1230", name: "Customer Barcode 2", length: "52" },
  { code: "62", states: "2002", name: "Customer Barcode 3", length: "67" },
];

const COPY = {
  zh: {
    pageTitle: "Australia Post 4-State 条码生成器",
    pageDescription: "生成 Australia Post 37、52 与 67-bar 4-State Customer Barcode，并保存为 PNG。",
    backToTop: "返回页面顶部",
    languageSwitcher: "切换页面语言",
    chinese: "中文",
    english: "EN",
    heroLineOne: "把投递信息",
    heroLineTwo: "变成",
    barcode: "条码",
    intro: "选择 37、52 或 67-bar 格式，输入 Australia Post 的 DPID 与可选客户信息，实时生成包含 Reed-Solomon 纠错的条码。",
    formatCaption: "选择输出长度",
    formatAria: "选择条码长度",
    encodingDetails: { N: "数字", C: "字符", custom: "Bar states" },
    useSample: "使用示例",
    dpidMissing: (count: number) => `还需要 ${count} 位数字`,
    dpidHelp: "DPID 是地址的 8 位投递点标识，并不是邮政编码。",
    encodingAria: "Customer Information 编码方式",
    numericPlaceholder: "可选数字",
    characterPlaceholder: "可选字符",
    statesPlaceholder: "可选 0–3 states",
    statesUnit: "states",
    charactersUnit: "characters",
    encodedSummary: (encoded: number, filler: number) => `编码 ${encoded} bars · Filler ${filler} bars`,
    previewWait: "等待 8 位 DPID",
    barcodeCanvas: (dpid: string, bars: number) => `DPID ${dpid} 的 ${bars}-bar 4-State 条码`,
    previewArea: "条码预览区域",
    previewPlaceholder: "输入完整 DPID 后生成",
    savePng: "保存为 PNG",
    copied: "已复制",
    copyStates: "复制 bar states",
    pngNote: "PNG 仅包含黑色条码与符合规范的白色静区，便于排版使用。",
    fourStatesAria: "四种 bar state",
    fourStatesIntro: "每根 bar 都有相同的中间 tracker，并按状态向上或向下延伸。",
    stateDetails: ["全高", "上伸", "下伸", "轨道"],
    guideTitle: (bars: number) => `一个 ${bars}-bar code，是怎样组成的？`,
    guideFormat37: "它只承载 DPID，不包含 Customer Information。",
    guideFormatExtended: (bars: number) => `它在 DPID 后提供 ${bars} 根 Customer Information bar。`,
    fieldMapAria: (bars: number) => `${bars}-bar 条码字段结构`,
    fieldEmpty: "输入完整 DPID 后，这里会显示每个字段对应的 bar states。",
    sequenceAria: (bars: number) => `${bars}-bar 条码的顺序说明`,
    startTitle: "从固定的 13 开始",
    startCopy: "第一根是 Ascender（state 1），第二根是 Tracker（state 3）。这个固定组合标记条码起点，也帮助设备判断条码是否倒置。",
    startAria: "Start bars 为 bar state 1 和 3",
    fccTitle: "FCC 说明条码格式",
    fccCopy: "FCC 是两位数字，每个数字编码成两根 bar，因此固定占四根。它告诉分拣设备条码用途、总长度，以及后面是否存在 Customer Information。",
    fccTableAria: "FCC 组合表",
    current: "当前",
    fccNote: "资料中明确列出以上五种 FCC 组合；当前页面生成 FCC 11、59 和 62。无效 FCC 会导致邮件被拒收。",
    dpidTitle: "8 位 DPID 变成 16 根 bar",
    dpidCopy: "DPID 的每个十进制数字都通过数字表映射成两位 bar state，例如",
    dpidSymbolsAria: "当前 DPID 的逐位编码",
    dpidSymbolsEmpty: "输入完整 DPID 后显示逐位编码",
    fillerTitle: "用 Filler 补齐数据区",
    customerTitle: "编码 Customer Information",
    fillerAria: "Filler 使用 bar state 3，也就是 Tracker",
    fillerCopy: "Standard Customer Barcode 固定加入一根 Tracker（state 3），使 FCC + DPID + Filler 正好成为 21 根数据 bar，可供下一步分成 7 组三元符号。",
    filler37: "固定使用一根 Filler。",
    fillerExtended: "Filler 位于 Customer Information 字段内部。",
    customerSummaryAria: "Customer Information 编码摘要",
    customerEncodingCopy: {
      N: "N 表把每个数字编码成两根 bar。",
      C: "C 表把每个受支持字符编码成三根 bar。",
      custom: "Custom 模式直接把输入的 0–3 当作 bar states。",
    },
    customerFillerCopy: (bars: number) => `不足 ${bars} 根的部分统一在右侧补 Tracker（state 3）。`,
    customerNote: (encoded: number, filler: number) => `当前输入占 ${encoded} 根，补入 ${filler} 根 Filler；Filler 属于 Customer Information 字段，不是独立字段。`,
    rsTitle: "计算 12 根纠错 bar",
    rsCopy: (standard: boolean) => `Reed-Solomon 使用前面的 FCC、DPID 与${standard ? " Filler" : "完整 Customer Information（包括 Filler）"}计算校验数据；Start 和 Stop 不参与计算。`,
    rsSummaryAria: "Reed-Solomon 计算概要",
    rsGroupTitle: "三根一组，转换为 GF(64) 符号",
    rsGroupCopy: "每组三位按四进制解释为一个 0–63 的数。",
    waitingDpid: "等待完整 DPID",
    rsRemainderTitle: "在有限域中计算四个余数",
    rsRemainderCopyBefore: "使用本原多项式",
    rsRemainderCopyAfter: "（0x43）和生成多项式系数",
    rsRemainderCopyEnd: "；每轮以异或完成有限域加减。",
    rsOutputTitle: "四个余数变回 12 根 bar",
    rsOutputCopy: "每个校验符号写成三位四进制，并依次放在 Stop bars 之前。",
    rsNote: "这些校验条让设备在少量污损、漏印或反光干扰下仍能校验条码；它不负责验证 DPID 是否真实存在。",
    stopTitle: "最后用 13 结束",
    stopCopy: "Stop bars 与 Start bars 相同，也是 Ascender（1）+ Tracker（3）。首尾固定且对称，让扫描设备可靠识别方向和边界。",
    stopAria: "Stop bars 为 bar state 1 和 3",
    printTitle: "打印前，请保留这些物理条件。",
    printCopy: "网页生成的是编码正确的高分辨率图像；最终邮件仍需满足 Australia Post 对尺寸、对比度、位置和纸张的要求。",
    important: "重要",
    notice: "本工具不会确认某个 DPID 是否真实存在。有效 DPID 应由通过 AMAS 认证的地址匹配软件从 Postal Address File 获取。",
    horizontalVertical: "mm 横 / 纵",
  },
  en: {
    pageTitle: "Australia Post 4-State Barcode Generator",
    pageDescription: "Generate 37, 52, and 67-bar Australia Post 4-State Customer Barcodes and save them as PNG files.",
    backToTop: "Back to top",
    languageSwitcher: "Switch page language",
    chinese: "中文",
    english: "EN",
    heroLineOne: "Turn delivery data",
    heroLineTwo: "into a",
    barcode: "barcode",
    intro: "Choose a 37, 52, or 67-bar format, enter an Australia Post DPID and optional customer information, and generate a barcode with Reed-Solomon error correction in real time.",
    formatCaption: "Choose output length",
    formatAria: "Choose barcode length",
    encodingDetails: { N: "Numeric", C: "Character", custom: "Bar states" },
    useSample: "Use sample",
    dpidMissing: (count: number) => `${count} more digit${count === 1 ? "" : "s"} required`,
    dpidHelp: "A DPID is an address's 8-digit delivery point identifier, not a postcode.",
    encodingAria: "Customer Information encoding",
    numericPlaceholder: "Optional digits",
    characterPlaceholder: "Optional characters",
    statesPlaceholder: "Optional 0–3 states",
    statesUnit: "states",
    charactersUnit: "characters",
    encodedSummary: (encoded: number, filler: number) => `Encoded ${encoded} bars · Filler ${filler} bars`,
    previewWait: "Waiting for an 8-digit DPID",
    barcodeCanvas: (dpid: string, bars: number) => `${bars}-bar 4-State barcode for DPID ${dpid}`,
    previewArea: "Barcode preview area",
    previewPlaceholder: "Enter a complete DPID to generate",
    savePng: "Save as PNG",
    copied: "Copied",
    copyStates: "Copy bar states",
    pngNote: "The PNG contains only the black barcode and a standards-compliant white quiet zone, ready for use in layouts.",
    fourStatesAria: "The four bar states",
    fourStatesIntro: "Every bar shares the same central tracker and extends upward or downward according to its state.",
    stateDetails: ["Full height", "Ascender", "Descender", "Tracker"],
    guideTitle: (bars: number) => `How is a ${bars}-bar code assembled?`,
    guideFormat37: "It carries only the DPID and contains no Customer Information.",
    guideFormatExtended: (bars: number) => `It provides ${bars} Customer Information bars after the DPID.`,
    fieldMapAria: (bars: number) => `${bars}-bar barcode field structure`,
    fieldEmpty: "Enter a complete DPID to see the bar states for each field.",
    sequenceAria: (bars: number) => `Sequence of the ${bars}-bar barcode`,
    startTitle: "Start with the fixed 13",
    startCopy: "The first bar is an Ascender (state 1) and the second is a Tracker (state 3). This fixed pair marks the start and helps equipment detect an upside-down barcode.",
    startAria: "Start bars are bar states 1 and 3",
    fccTitle: "The FCC identifies the format",
    fccCopy: "The FCC is a two-digit number. Each digit becomes two bars, so it always occupies four bars. It tells sorting equipment the barcode's purpose, total length, and whether Customer Information follows.",
    fccTableAria: "FCC combinations",
    current: "Current",
    fccNote: "The reference material defines the five FCC combinations above. This page generates FCC 11, 59, and 62. Mail with an invalid FCC may be rejected.",
    dpidTitle: "Convert the 8-digit DPID into 16 bars",
    dpidCopy: "Each decimal DPID digit maps to a two-digit bar state pair, for example",
    dpidSymbolsAria: "Encoding of each current DPID digit",
    dpidSymbolsEmpty: "Enter a complete DPID to see each digit encoded",
    fillerTitle: "Fill the data area with a Filler",
    customerTitle: "Encode Customer Information",
    fillerAria: "The Filler uses bar state 3, the Tracker",
    fillerCopy: "A Standard Customer Barcode always adds one Tracker (state 3), bringing FCC + DPID + Filler to exactly 21 data bars, ready to split into seven three-bar symbols.",
    filler37: "Always uses one Filler bar.",
    fillerExtended: "The Filler sits inside the Customer Information field.",
    customerSummaryAria: "Customer Information encoding summary",
    customerEncodingCopy: {
      N: "The N table encodes each digit as two bars.",
      C: "The C table encodes each supported character as three bars.",
      custom: "Custom mode treats the entered 0–3 values directly as bar states.",
    },
    customerFillerCopy: (bars: number) => `Any space remaining in the ${bars}-bar field is padded on the right with Trackers (state 3).`,
    customerNote: (encoded: number, filler: number) => `The current input uses ${encoded} bars and adds ${filler} Filler bars. The Filler belongs to the Customer Information field; it is not a separate field.`,
    rsTitle: "Calculate 12 error-correction bars",
    rsCopy: (standard: boolean) => `Reed-Solomon uses the preceding FCC, DPID, and ${standard ? "Filler" : "complete Customer Information (including Filler)"} to calculate check data. The Start and Stop bars are excluded.`,
    rsSummaryAria: "Reed-Solomon calculation summary",
    rsGroupTitle: "Group bars in threes and convert them to GF(64) symbols",
    rsGroupCopy: "Each three-digit group is interpreted as a base-4 number from 0 to 63.",
    waitingDpid: "Waiting for a complete DPID",
    rsRemainderTitle: "Calculate four remainders in the finite field",
    rsRemainderCopyBefore: "Use the primitive polynomial",
    rsRemainderCopyAfter: "(0x43) and generator polynomial coefficients",
    rsRemainderCopyEnd: "; each round uses XOR for finite-field addition and subtraction.",
    rsOutputTitle: "Convert the four remainders back into 12 bars",
    rsOutputCopy: "Write each check symbol as three base-4 digits and place them in order before the Stop bars.",
    rsNote: "These check bars let equipment validate the barcode despite minor smudges, missing print, or reflective interference. They do not verify whether the DPID actually exists.",
    stopTitle: "Finish with 13",
    stopCopy: "The Stop bars match the Start bars: Ascender (1) + Tracker (3). Fixed, symmetrical ends help scanning equipment reliably identify direction and boundaries.",
    stopAria: "Stop bars are bar states 1 and 3",
    printTitle: "Preserve these physical requirements when printing.",
    printCopy: "The page generates a correctly encoded, high-resolution image. The final mailpiece must still meet Australia Post requirements for dimensions, contrast, position, and paper.",
    important: "Important",
    notice: "This tool does not confirm whether a DPID actually exists. A valid DPID should be obtained from the Postal Address File using AMAS-certified address-matching software.",
    horizontalVertical: "mm horiz. / vert.",
  },
} as const;

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("post-four-language") === "zh" ? "zh" : "en";
}

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

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
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

export default function Home({ initialLanguage = getInitialLanguage() }: { initialLanguage?: Language } = {}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [barCount, setBarCount] = useState<BarCount>(37);
  const [dpid, setDpid] = useState(SAMPLES[37].dpid);
  const [customerEncoding, setCustomerEncoding] = useState<CustomerEncoding>("N");
  const [customerInfo, setCustomerInfo] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copy = COPY[language];
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
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = copy.pageTitle;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", copy.pageDescription);
    window.localStorage.setItem("post-four-language", language);
  }, [copy.pageDescription, copy.pageTitle, language]);

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
        <a className="brand" href="#top" aria-label={copy.backToTop}>
          <BrandMark />
        </a>
        <div className="header-actions">
          <div className="language-switcher" role="group" aria-label={copy.languageSwitcher}>
            <button
              type="button"
              className={language === "en" ? "is-active" : ""}
              aria-pressed={language === "en"}
              lang="en"
              onClick={() => setLanguage("en")}
            >
              {copy.english}
            </button>
            <button
              type="button"
              className={language === "zh" ? "is-active" : ""}
              aria-pressed={language === "zh"}
              lang="zh-CN"
              onClick={() => setLanguage("zh")}
            >
              {copy.chinese}
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span>AUSTRALIA POST</span>
            <span>FCC {format.fcc}</span>
            <span>{barCount} BARS</span>
          </p>
          <h1>
            {copy.heroLineOne}
            <br />
            {copy.heroLineTwo} <em>4-State</em> {copy.barcode}
          </h1>
          <p className="intro">{copy.intro}</p>

          <div className="generator-form">
            <div className="input-block format-block">
              <div className="input-heading">
                <span className="input-label">Barcode format</span>
                <span className="format-caption">{copy.formatCaption}</span>
              </div>
              <div className="format-picker" role="radiogroup" aria-label={copy.formatAria}>
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
                <button
                  type="button"
                  className="sample-button"
                  data-short-label={language === "zh" ? "例" : "Try"}
                  onClick={useSample}
                >
                  {copy.useSample}
                </button>
              </div>
              <p id="dpid-help" className="input-help">
                {dpid.length > 0 && !dpidIsValid
                  ? copy.dpidMissing(8 - dpid.length)
                  : copy.dpidHelp}
              </p>
            </div>

            {barCount !== 37 && (
              <div className="input-block customer-input-block">
                <div className="input-heading customer-heading">
                  <label htmlFor="customer-info">Customer Information</label>
                  <div className="encoding-picker" role="radiogroup" aria-label={copy.encodingAria}>
                    {ENCODING_OPTIONS.map((option) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={customerEncoding === option.value}
                        className={customerEncoding === option.value ? "encoding-option is-selected" : "encoding-option"}
                        onClick={() => handleEncodingChange(option.value)}
                        key={option.value}
                      >
                        {option.label}<small>{copy.encodingDetails[option.value]}</small>
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
                    placeholder={customerEncoding === "N" ? copy.numericPlaceholder : customerEncoding === "C" ? copy.characterPlaceholder : copy.statesPlaceholder}
                    aria-describedby="customer-help"
                    autoComplete="off"
                  />
                </div>
                <p id="customer-help" className="input-help customer-help">
                  <span>{customerInfo.length}/{customerLimit} {customerEncoding === "custom" ? copy.statesUnit : copy.charactersUnit}</span>
                  <span>{copy.encodedSummary(customerBreakdown.encodedStates.length, customerBreakdown.fillerCount)}</span>
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
              <strong>{isValid ? `${format.fcc} ${dpid}` : copy.previewWait}</strong>
            </div>
            <div className="canvas-wrap">
              <canvas ref={canvasRef} aria-label={isValid ? copy.barcodeCanvas(dpid, barCount) : copy.previewArea} />
              {!isValid && <span className="canvas-placeholder">{copy.previewPlaceholder}</span>}
            </div>
            <div className="preview-foot">
              <span>6 mm quiet zone</span>
              <span>{barCount} bars</span>
              <span>{format.rsName}</span>
            </div>
          </div>

          <div className="action-row">
            <button className="primary-action" type="button" onClick={downloadPng} disabled={!isValid}>
              {copy.savePng} <span aria-hidden="true">↓</span>
            </button>
            <button className="secondary-action" type="button" onClick={copyStates} disabled={!isValid}>
              {copied ? copy.copied : copy.copyStates}
            </button>
          </div>
          <p className="card-note">{copy.pngNote}</p>
        </section>
      </section>

      <section className="state-strip" aria-label={copy.fourStatesAria}>
        <div className="strip-title">
          <span>THE FOUR STATES</span>
          <p>{copy.fourStatesIntro}</p>
        </div>
        {STATE_LEGEND.map((state, index) => (
          <div className="state-item" key={state.value}>
            <div className="state-visual">
              <MiniBar state={state.value} />
              <span className="center-rule" />
            </div>
            <div>
              <strong>{state.name}</strong>
              <span>{copy.stateDetails[index]}</span>
            </div>
            <code>{state.value}</code>
          </div>
        ))}
      </section>

      <section className="guide" id="guide">
        <div className="section-heading">
          <p className="eyebrow"><span>ENCODING MAP</span></p>
          <h2>{copy.guideTitle(barCount)}</h2>
          <p>
            FCC {format.fcc} — {format.name}.{" "}
            {barCount === 37
              ? copy.guideFormat37
              : copy.guideFormatExtended(format.customerBars)}
          </p>
        </div>

        <div className="field-map" aria-label={copy.fieldMapAria(barCount)}>
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
            <p className="field-empty">{copy.fieldEmpty}</p>
          )}
        </div>

        <div className="encoding-sequence" aria-label={copy.sequenceAria(barCount)}>
          <article className="sequence-step sequence-start">
            <header className="sequence-step-head">
              <span className="sequence-number">01</span>
              <div>
                <p className="mini-label">START BARS</p>
                <h3>{copy.startTitle}</h3>
              </div>
              <span className="sequence-position">BARS 01–02</span>
            </header>
            <div className="sequence-body sequence-compact">
              <p className="sequence-copy">{copy.startCopy}</p>
              <div className="fixed-pair" aria-label={copy.startAria}>
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
                <h3>{copy.fccTitle}</h3>
              </div>
              <span className="sequence-position">BARS 03–06</span>
            </header>
            <div className="sequence-body">
              <p className="sequence-copy">{copy.fccCopy}</p>
              <div className="fcc-table" role="table" aria-label={copy.fccTableAria}>
                <div className="fcc-table-head" role="row">
                  <span>FCC</span><span>4 BAR STATES</span><span>FORMAT</span><span>LENGTH</span>
                </div>
                {FCC_FORMATS.map((format) => (
                  <div className={`fcc-row ${format.code === BARCODE_FORMATS[barCount].fcc ? "is-current" : ""}`} role="row" key={format.code}>
                    <strong>{format.code}</strong>
                    <code>{format.states}</code>
                    <span>{format.name}{format.code === BARCODE_FORMATS[barCount].fcc && <small>{copy.current}</small>}</span>
                    <span>{format.length} bars</span>
                  </div>
                ))}
              </div>
              <p className="sequence-note">{copy.fccNote}</p>
            </div>
          </article>

          <article className="sequence-step sequence-dpid">
            <header className="sequence-step-head">
              <span className="sequence-number">03</span>
              <div>
                <p className="mini-label">DELIVERY POINT IDENTIFIER</p>
                <h3>{copy.dpidTitle}</h3>
              </div>
              <span className="sequence-position">BARS 07–22</span>
            </header>
            <div className="sequence-body">
              <p className="sequence-copy">
                {copy.dpidCopy} <code>0 → 00</code>, <code>5 → 12</code>, <code>9 → 30</code>.
              </p>
              <div className="dpid-symbols" aria-label={copy.dpidSymbolsAria}>
                {isValid ? dpid.split("").map((digit, index) => (
                  <span className="dpid-symbol" key={`${digit}-${index}`}>
                    <small>D{index + 1}</small><strong>{digit}</strong><i>→</i><code>{NUMERIC_STATE_PAIRS[Number(digit)]}</code>
                  </span>
                )) : <em>{copy.dpidSymbolsEmpty}</em>}
              </div>
            </div>
          </article>

          <article className="sequence-step sequence-filler">
            <header className="sequence-step-head">
              <span className="sequence-number">04</span>
              <div>
                <p className="mini-label">{barCount === 37 ? "FILLER BAR" : "CUSTOMER INFORMATION / FILLER"}</p>
                <h3>{barCount === 37 ? copy.fillerTitle : copy.customerTitle}</h3>
              </div>
              <span className="sequence-position">
                {barCount === 37 ? "BAR 23" : `BARS 23–${customerEnd}`}
              </span>
            </header>
            {barCount === 37 ? (
              <div className="sequence-body filler-layout">
                <div className="filler-symbol" aria-label={copy.fillerAria}>
                  <span className="filler-track" aria-hidden="true" />
                  <div><strong>T</strong><code>3</code></div>
                </div>
                <div>
                  <p className="sequence-copy">{copy.fillerCopy}</p>
                  <ul>
                    <li><strong>37-bar: </strong>{copy.filler37}</li>
                    <li><strong>52 / 67-bar: </strong>{copy.fillerExtended}</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="sequence-body customer-layout">
                <div className="customer-summary" aria-label={copy.customerSummaryAria}>
                  <span><small>ENCODING</small><strong>{customerEncoding}</strong></span>
                  <i aria-hidden="true">→</i>
                  <span><small>DATA</small><strong>{customerBreakdown.encodedStates.length}</strong></span>
                  <i aria-hidden="true">+</i>
                  <span><small>FILLER</small><strong>{customerBreakdown.fillerCount}</strong></span>
                  <i aria-hidden="true">=</i>
                  <span><small>FIELD</small><strong>{format.customerBars}</strong></span>
                </div>
                <p className="sequence-copy">
                  {copy.customerEncodingCopy[customerEncoding]}{" "}
                  {copy.customerFillerCopy(format.customerBars)}
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
                <p className="sequence-note">{copy.customerNote(customerBreakdown.encodedStates.length, customerBreakdown.fillerCount)}</p>
              </div>
            )}
          </article>

          <article className="sequence-step sequence-rs">
            <header className="sequence-step-head">
              <span className="sequence-number">05</span>
              <div>
                <p className="mini-label">REED-SOLOMON / GF(64)</p>
                <h3>{copy.rsTitle}</h3>
              </div>
              <span className="sequence-position">BARS {rsStart}–{rsEnd}</span>
            </header>
            <div className="sequence-body">
              <p className="sequence-copy">{copy.rsCopy(barCount === 37)}</p>
              <div className="rs-equation" aria-label={copy.rsSummaryAria}>
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
                    <h4>{copy.rsGroupTitle}</h4>
                    <p>{copy.rsGroupCopy}</p>
                    <div className="symbol-list">
                      {rsBreakdown ? rsBreakdown.dataSymbols.map((symbol: ReedSolomonSymbol, index: number) => (
                        <span className="symbol-chip" key={`data-${symbol.states}-${index}`}>
                          <code>{symbol.states}</code><small>₄ = {symbol.decimal}</small>
                        </span>
                      )) : <em>{copy.waitingDpid}</em>}
                    </div>
                  </div>
                </div>
                <div className="rs-step">
                  <span className="rs-step-number">B</span>
                  <div>
                    <h4>{copy.rsRemainderTitle}</h4>
                    <p>
                      {copy.rsRemainderCopyBefore} <code>x⁶ + x + 1</code> {copy.rsRemainderCopyAfter}{" "}
                      <code>[48, 17, 29, 30, 1]</code>{copy.rsRemainderCopyEnd}
                    </p>
                  </div>
                </div>
                <div className="rs-step rs-output-step">
                  <span className="rs-step-number">C</span>
                  <div>
                    <h4>{copy.rsOutputTitle}</h4>
                    <p>{copy.rsOutputCopy}</p>
                    <div className="symbol-list check-symbol-list">
                      {rsBreakdown ? rsBreakdown.checkSymbols.map((symbol: ReedSolomonSymbol, index: number) => (
                        <span className="symbol-chip" key={`check-${symbol.states}-${index}`}>
                          <code>{symbol.states}</code><small>₄ = {symbol.decimal}</small>
                        </span>
                      )) : <em>{copy.waitingDpid}</em>}
                      {rsBreakdown && <strong className="check-result">→ {rsBreakdown.checkStates}</strong>}
                    </div>
                  </div>
                </div>
              </div>
              <p className="sequence-note">{copy.rsNote}</p>
            </div>
          </article>

          <article className="sequence-step sequence-stop">
            <header className="sequence-step-head">
              <span className="sequence-number">06</span>
              <div>
                <p className="mini-label">STOP BARS</p>
                <h3>{copy.stopTitle}</h3>
              </div>
              <span className="sequence-position">BARS {stopStart}–{barCount}</span>
            </header>
            <div className="sequence-body sequence-compact">
              <p className="sequence-copy">{copy.stopCopy}</p>
              <div className="fixed-pair" aria-label={copy.stopAria}>
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
          <h2>{copy.printTitle}</h2>
          <p>{copy.printCopy}</p>
          <div className="notice">
            <strong>{copy.important}</strong>
            <p>{copy.notice}</p>
          </div>
        </div>
        <div className="spec-grid">
          <div><span>BARCODE LENGTH</span><strong>{format.minimumLength}–{format.maximumLength}</strong><small>mm</small></div>
          <div><span>BAR WIDTH</span><strong>0.4–0.6</strong><small>mm</small></div>
          <div><span>BAR GAP</span><strong>0.4–0.7</strong><small>mm</small></div>
          <div><span>QUIET ZONE</span><strong>6 / 2</strong><small>{copy.horizontalVertical}</small></div>
          <div><span>BAR DENSITY</span><strong>22–25</strong><small>bars / inch</small></div>
          <div><span>SKEW</span><strong>±5°</strong><small>maximum</small></div>
        </div>
      </section>

      <footer>
        <a className="footer-brand" href="#top" aria-label={copy.backToTop}>
          <BrandMark />
        </a>
        <p>Australia Post 4-State Customer Code · FCC {format.fcc} · {barCount} bars</p>
      </footer>
    </main>
  );
}
