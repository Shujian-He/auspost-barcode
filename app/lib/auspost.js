// Australia Post 4-State Customer Code encoder.
// The output digits are bar states: 0=H, 1=A, 2=D, 3=T.

export const NUMERIC_STATE_PAIRS = [
  "00",
  "01",
  "02",
  "10",
  "11",
  "12",
  "20",
  "21",
  "22",
  "30",
];

const C_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 #";
const C_STATE_VALUES = [
  "000", "001", "002", "010", "011", "012", "020", "021", "022",
  "100", "101", "102", "110", "111", "112", "120", "121", "122",
  "200", "201", "202", "210", "211", "212", "220", "221",
  "023", "030", "031", "032", "033", "103", "113", "123", "130",
  "131", "132", "133", "203", "213", "223", "230", "231", "232",
  "233", "303", "313", "323", "330", "331", "332", "333",
  "222", "300", "301", "302", "310", "311", "312", "320", "321",
  "322", "003", "013",
];

export const C_STATE_ENCODING = Object.freeze(
  Object.fromEntries([...C_CHARACTERS].map((character, index) => [character, C_STATE_VALUES[index]])),
);

export const BARCODE_FORMATS = Object.freeze({
  37: Object.freeze({
    barCount: 37,
    fcc: "11",
    name: "Standard Customer Barcode",
    customerBars: 0,
    dataBars: 21,
    dataSymbols: 7,
    rsName: "RS(11,7)",
    minimumLength: "37.0",
    maximumLength: "42.2",
  }),
  52: Object.freeze({
    barCount: 52,
    fcc: "59",
    name: "Customer Barcode 2",
    customerBars: 16,
    dataBars: 36,
    dataSymbols: 12,
    rsName: "RS(16,12)",
    minimumLength: "52.2",
    maximumLength: "59.5",
  }),
  67: Object.freeze({
    barCount: 67,
    fcc: "62",
    name: "Customer Barcode 3",
    customerBars: 31,
    dataBars: 51,
    dataSymbols: 17,
    rsName: "RS(21,17)",
    minimumLength: "67.5",
    maximumLength: "76.8",
  }),
});

const RS_COEFFICIENTS = [48, 17, 29, 30, 1];

function buildReedSolomonTable() {
  const table = Array.from({ length: 64 }, () => Array(64).fill(0));
  table[1] = Array.from({ length: 64 }, (_, value) => value);

  let previous = 1;
  for (let power = 0; power < 64; power += 1) {
    let next = previous << 1;
    if (next & 64) next ^= 67;

    for (let value = 0; value < 64; value += 1) {
      let product = table[previous][value] << 1;
      if (product & 64) product ^= 67;
      table[next][value] = product;
    }
    previous = next;
  }

  return table;
}

const REED_SOLOMON_TABLE = buildReedSolomonTable();

function numericPair(digit) {
  return NUMERIC_STATE_PAIRS[Number(digit)];
}

export function getBarcodeFormat(barCount) {
  const format = BARCODE_FORMATS[Number(barCount)];
  if (!format) throw new Error("Barcode length must be 37, 52, or 67 bars");
  return format;
}

function normalizeCustomerEncoding(encoding) {
  if (encoding === "custom") return "custom";
  const normalized = String(encoding).toUpperCase();
  if (normalized !== "N" && normalized !== "C") {
    throw new Error("Customer encoding must be N, C, or custom");
  }
  return normalized;
}

export function getCustomerInformationLimit(barCount, encoding) {
  const format = getBarcodeFormat(barCount);
  if (!format.customerBars) return 0;

  const normalized = normalizeCustomerEncoding(encoding);
  if (normalized === "N") return Math.floor(format.customerBars / 2);
  if (normalized === "C") return Math.floor(format.customerBars / 3);
  return format.customerBars;
}

export function explainCustomerInformation({
  barCount,
  value = "",
  encoding = "N",
}) {
  const format = getBarcodeFormat(barCount);
  const normalized = normalizeCustomerEncoding(encoding);

  if (!format.customerBars) {
    return {
      encoding: normalized,
      capacity: 1,
      limit: 0,
      encodedStates: "",
      fillerCount: 1,
      states: "3",
    };
  }

  const limit = getCustomerInformationLimit(format.barCount, normalized);
  let encodedStates = "";

  if (normalized === "N") {
    if (!/^\d*$/.test(value) || value.length > limit) {
      throw new Error(`N-encoded customer information accepts up to ${limit} digits`);
    }
    encodedStates = [...value].map(numericPair).join("");
  } else if (normalized === "C") {
    const characters = [...value];
    if (characters.length > limit || characters.some((character) => !C_STATE_ENCODING[character])) {
      throw new Error(`C-encoded customer information accepts up to ${limit} supported characters`);
    }
    encodedStates = characters.map((character) => C_STATE_ENCODING[character]).join("");
  } else {
    if (!/^[0-3]*$/.test(value) || value.length > limit) {
      throw new Error(`Custom customer information accepts up to ${limit} bar states`);
    }
    encodedStates = value;
  }

  const fillerCount = format.customerBars - encodedStates.length;
  return {
    encoding: normalized,
    capacity: format.customerBars,
    limit,
    encodedStates,
    fillerCount,
    states: encodedStates + "3".repeat(fillerCount),
  };
}

function reedSolomonCheckDigits(dataStates) {
  const symbols = dataStates.match(/.{3}/g)?.map((triple) => Number.parseInt(triple, 4));

  if (
    !symbols
    || symbols.some((symbol) => Number.isNaN(symbol))
    || ![7, 12, 17].includes(symbols.length)
    || symbols.length * 3 !== dataStates.length
  ) {
    throw new Error("Expected 7, 12, or 17 Reed-Solomon data symbols");
  }

  const codes = Array(symbols.length + 4).fill(0);
  symbols.forEach((symbol, index) => {
    codes[codes.length - 1 - index] = symbol;
  });

  for (let index = codes.length - 5; index >= 0; index -= 1) {
    for (let offset = 0; offset < 5; offset += 1) {
      codes[index + offset] ^=
        REED_SOLOMON_TABLE[RS_COEFFICIENTS[offset]][codes[index + 4]];
    }
  }

  return [codes[3], codes[2], codes[1], codes[0]]
    .map((code) => code.toString(4).padStart(3, "0"))
    .join("");
}

/**
 * Encodes a supported Australia Post Customer Barcode.
 * @param {{barCount: 37|52|67, dpid: string, customerInfo?: string, customerEncoding?: "N"|"C"|"custom"}} options
 * @returns {string}
 */
export function encodeCustomerBarcode({
  barCount = 37,
  dpid,
  customerInfo = "",
  customerEncoding = "N",
}) {
  const format = getBarcodeFormat(barCount);
  if (!/^\d{8}$/.test(dpid)) {
    throw new Error("DPID must contain exactly eight digits");
  }

  const start = "13";
  const formatControlCode = [...format.fcc].map(numericPair).join("");
  const sortingCode = [...dpid].map(numericPair).join("");
  const customer = explainCustomerInformation({
    barCount: format.barCount,
    value: customerInfo,
    encoding: customerEncoding,
  });
  const protectedData = formatControlCode + sortingCode + customer.states;
  const errorCorrection = reedSolomonCheckDigits(protectedData);
  const stop = "13";

  return start + protectedData + errorCorrection + stop;
}

/**
 * Backwards-compatible FCC 11 encoder.
 * @param {string} dpid
 * @returns {string}
 */
export function encodeStandardCustomerBarcode(dpid) {
  return encodeCustomerBarcode({ barCount: 37, dpid });
}

export function splitBarcodeFields(barStates) {
  if (!/^[0-3]+$/.test(barStates)) {
    throw new Error("Barcode must contain only bar states 0 through 3");
  }

  const format = getBarcodeFormat(barStates.length);
  const customerEnd = format.customerBars ? 22 + format.customerBars : 23;
  const fields = [
    { key: "start", label: "Start", value: barStates.slice(0, 2) },
    { key: "fcc", label: `FCC ${format.fcc}`, value: barStates.slice(2, 6) },
    { key: "dpid", label: "DPID", value: barStates.slice(6, 22) },
  ];

  if (format.customerBars) {
    fields.push({
      key: "customer",
      label: "Customer info",
      value: barStates.slice(22, customerEnd),
    });
  } else {
    fields.push({ key: "filler", label: "Filler", value: barStates.slice(22, 23) });
  }

  fields.push(
    { key: "rs", label: "Reed-Solomon", value: barStates.slice(customerEnd, customerEnd + 12) },
    { key: "stop", label: "Stop", value: barStates.slice(-2) },
  );

  return fields;
}

/**
 * Exposes Reed-Solomon inputs and outputs for all supported barcode lengths.
 * Each group of three base-4 bar states is one GF(64) symbol.
 * @param {string} barStates
 */
export function explainReedSolomon(barStates) {
  const format = getBarcodeFormat(barStates.length);
  if (!/^[0-3]+$/.test(barStates)) {
    throw new Error(`Expected a ${format.barCount}-character bar-state sequence`);
  }

  const toSymbols = (states) =>
    states.match(/.{3}/g)?.map((group) => ({
      states: group,
      decimal: Number.parseInt(group, 4),
    })) ?? [];

  const dataStates = barStates.slice(2, 2 + format.dataBars);
  const checkStates = barStates.slice(2 + format.dataBars, -2);

  return {
    dataStates,
    dataSymbols: toSymbols(dataStates),
    checkStates,
    checkSymbols: toSymbols(checkStates),
  };
}

export function explainStandardReedSolomon(barStates) {
  if (barStates.length !== 37) {
    throw new Error("Expected a 37-character bar-state sequence");
  }
  return explainReedSolomon(barStates);
}
