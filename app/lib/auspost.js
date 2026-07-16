// Australia Post 4-State Customer Code encoder for the 37-bar FCC 11 format.
// The output digits are bar states: 0=H, 1=A, 2=D, 3=T.

const NUMERIC_ENCODING = [
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
  return NUMERIC_ENCODING[Number(digit)];
}

function reedSolomonCheckDigits(dataStates) {
  const symbols = dataStates.match(/.{3}/g)?.map((triple) =>
    Number.parseInt(triple, 4),
  );

  if (!symbols || symbols.length !== 7) {
    throw new Error("Expected seven Reed-Solomon data symbols");
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
 * Encodes an eight-digit DPID as a 37-bar Standard Customer Barcode (FCC 11).
 * @param {string} dpid
 * @returns {string}
 */
export function encodeStandardCustomerBarcode(dpid) {
  if (!/^\d{8}$/.test(dpid)) {
    throw new Error("DPID must contain exactly eight digits");
  }

  const start = "13";
  const formatControlCode = "11".split("").map(numericPair).join("");
  const sortingCode = dpid.split("").map(numericPair).join("");
  const filler = "3";
  const protectedData = formatControlCode + sortingCode + filler;
  const errorCorrection = reedSolomonCheckDigits(protectedData);
  const stop = "13";

  return start + protectedData + errorCorrection + stop;
}

/**
 * Returns the six fields used to explain a generated FCC 11 barcode.
 * @param {string} barStates
 */
export function splitBarcodeFields(barStates) {
  if (!/^[0-3]{37}$/.test(barStates)) {
    throw new Error("Expected a 37-character bar-state sequence");
  }

  return [
    { key: "start", label: "Start", value: barStates.slice(0, 2) },
    { key: "fcc", label: "FCC 11", value: barStates.slice(2, 6) },
    { key: "dpid", label: "DPID", value: barStates.slice(6, 22) },
    { key: "filler", label: "Filler", value: barStates.slice(22, 23) },
    { key: "rs", label: "Reed-Solomon", value: barStates.slice(23, 35) },
    { key: "stop", label: "Stop", value: barStates.slice(35, 37) },
  ];
}
