var AirIslandsZip = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // shared/zip.mjs
  var zip_exports = {};
  __export(zip_exports, {
    crc32: () => crc32,
    createZip: () => createZip,
    decodeText: () => decodeText,
    isZip: () => isZip,
    readZip: () => readZip,
    toBytes: () => toBytes
  });
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();
  var ZIP_LOCAL_FILE = 67324752;
  var ZIP_CENTRAL_FILE = 33639248;
  var ZIP_END = 101010256;
  var UTF8_FLAG = 2048;
  var crcTable = null;
  function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
      crcTable[i] = value >>> 0;
    }
    return crcTable;
  }
  function crc32(bytes) {
    const table = getCrcTable();
    let crc = 4294967295;
    for (const byte of toBytes(bytes)) crc = table[(crc ^ byte) & 255] ^ crc >>> 8;
    return (crc ^ 4294967295) >>> 0;
  }
  function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (typeof value === "string") return encoder.encode(value);
    throw new TypeError("ZIP entry data must be a string, ArrayBuffer, or Uint8Array.");
  }
  function decodeText(value) {
    return decoder.decode(toBytes(value));
  }
  function isZip(value) {
    const bytes = toBytes(value);
    return bytes.length >= 4 && readU32(bytes, 0) === ZIP_LOCAL_FILE;
  }
  function dosDateTime(date = /* @__PURE__ */ new Date()) {
    const year = Math.max(1980, Math.min(2107, date.getFullYear()));
    const time = (date.getHours() & 31) << 11 | (date.getMinutes() & 63) << 5 | Math.floor(date.getSeconds() / 2) & 31;
    const day = year - 1980 << 9 | (date.getMonth() + 1 & 15) << 5 | date.getDate() & 31;
    return { time, date: day };
  }
  function writeU16(target, offset, value) {
    target[offset] = value & 255;
    target[offset + 1] = value >>> 8 & 255;
  }
  function writeU32(target, offset, value) {
    target[offset] = value & 255;
    target[offset + 1] = value >>> 8 & 255;
    target[offset + 2] = value >>> 16 & 255;
    target[offset + 3] = value >>> 24 & 255;
  }
  function readU16(source, offset) {
    if (offset + 2 > source.length) throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 ZIP: \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043A\u043E\u043D\u0435\u0446 \u0444\u0430\u0439\u043B\u0430.");
    return source[offset] | source[offset + 1] << 8;
  }
  function readU32(source, offset) {
    if (offset + 4 > source.length) throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 ZIP: \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u044B\u0439 \u043A\u043E\u043D\u0435\u0446 \u0444\u0430\u0439\u043B\u0430.");
    return (source[offset] | source[offset + 1] << 8 | source[offset + 2] << 16 | source[offset + 3] << 24) >>> 0;
  }
  function concatenate(parts, totalLength) {
    const output = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }
  function createZip(entries, options = {}) {
    const normalized = entries.map((entry) => {
      const name = String(entry.name ?? "").replaceAll("\\", "/").replace(/^\/+/, "");
      if (!name || name.endsWith("/")) throw new Error(`\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0438\u043C\u044F ZIP-\u0437\u0430\u043F\u0438\u0441\u0438: ${name || "(\u043F\u0443\u0441\u0442\u043E)"}.`);
      const nameBytes = encoder.encode(name);
      if (nameBytes.length > 65535) throw new Error(`\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0434\u043B\u0438\u043D\u043D\u043E\u0435 \u0438\u043C\u044F ZIP-\u0437\u0430\u043F\u0438\u0441\u0438: ${name}.`);
      const data = toBytes(entry.data);
      return { name, nameBytes, data, crc: crc32(data) };
    });
    const stamp = dosDateTime(options.date ?? /* @__PURE__ */ new Date());
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    let localLength = 0;
    let centralLength = 0;
    for (const entry of normalized) {
      const local = new Uint8Array(30 + entry.nameBytes.length + entry.data.length);
      writeU32(local, 0, ZIP_LOCAL_FILE);
      writeU16(local, 4, 20);
      writeU16(local, 6, UTF8_FLAG);
      writeU16(local, 8, 0);
      writeU16(local, 10, stamp.time);
      writeU16(local, 12, stamp.date);
      writeU32(local, 14, entry.crc);
      writeU32(local, 18, entry.data.length);
      writeU32(local, 22, entry.data.length);
      writeU16(local, 26, entry.nameBytes.length);
      writeU16(local, 28, 0);
      local.set(entry.nameBytes, 30);
      local.set(entry.data, 30 + entry.nameBytes.length);
      localParts.push(local);
      const central = new Uint8Array(46 + entry.nameBytes.length);
      writeU32(central, 0, ZIP_CENTRAL_FILE);
      writeU16(central, 4, 20);
      writeU16(central, 6, 20);
      writeU16(central, 8, UTF8_FLAG);
      writeU16(central, 10, 0);
      writeU16(central, 12, stamp.time);
      writeU16(central, 14, stamp.date);
      writeU32(central, 16, entry.crc);
      writeU32(central, 20, entry.data.length);
      writeU32(central, 24, entry.data.length);
      writeU16(central, 28, entry.nameBytes.length);
      writeU16(central, 30, 0);
      writeU16(central, 32, 0);
      writeU16(central, 34, 0);
      writeU16(central, 36, 0);
      writeU32(central, 38, 0);
      writeU32(central, 42, localOffset);
      central.set(entry.nameBytes, 46);
      centralParts.push(central);
      localOffset += local.length;
      localLength += local.length;
      centralLength += central.length;
    }
    const end = new Uint8Array(22);
    writeU32(end, 0, ZIP_END);
    writeU16(end, 4, 0);
    writeU16(end, 6, 0);
    writeU16(end, 8, normalized.length);
    writeU16(end, 10, normalized.length);
    writeU32(end, 12, centralLength);
    writeU32(end, 16, localLength);
    writeU16(end, 20, 0);
    return concatenate([...localParts, ...centralParts, end], localLength + centralLength + end.length);
  }
  function readZip(value) {
    const bytes = toBytes(value);
    if (!isZip(bytes)) throw new Error("\u0424\u0430\u0439\u043B \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F ZIP-\u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u043E\u043C.");
    const entries = /* @__PURE__ */ new Map();
    let offset = 0;
    while (offset + 4 <= bytes.length) {
      const signature = readU32(bytes, offset);
      if (signature === ZIP_CENTRAL_FILE || signature === ZIP_END) break;
      if (signature !== ZIP_LOCAL_FILE) throw new Error(`\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 ZIP: \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0441\u0438\u0433\u043D\u0430\u0442\u0443\u0440\u0430 0x${signature.toString(16)}.`);
      const flags = readU16(bytes, offset + 6);
      const method = readU16(bytes, offset + 8);
      const expectedCrc = readU32(bytes, offset + 14);
      const compressedSize = readU32(bytes, offset + 18);
      const uncompressedSize = readU32(bytes, offset + 22);
      const nameLength = readU16(bytes, offset + 26);
      const extraLength = readU16(bytes, offset + 28);
      if (flags & 8) throw new Error("ZIP \u0441 data descriptor \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F.");
      if (method !== 0) throw new Error("\u0421\u0436\u0430\u0442\u044B\u0439 ZIP \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F. \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430 \u0431\u0435\u0437 \u0441\u0436\u0430\u0442\u0438\u044F.");
      if (compressedSize !== uncompressedSize) throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 ZIP: \u0440\u0430\u0437\u043C\u0435\u0440\u044B \u0437\u0430\u043F\u0438\u0441\u0438 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442.");
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLength + extraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 ZIP: \u0437\u0430\u043F\u0438\u0441\u044C \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u0437\u0430 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0444\u0430\u0439\u043B\u0430.");
      const nameBytes = bytes.subarray(nameStart, nameStart + nameLength);
      const name = decoder.decode(nameBytes);
      const data = bytes.slice(dataStart, dataEnd);
      const actualCrc = crc32(data);
      if (actualCrc !== expectedCrc) throw new Error(`\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0439 ZIP: \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430 ${name} \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442.`);
      entries.set(name, data);
      offset = dataEnd;
    }
    if (!entries.size) throw new Error("ZIP-\u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0444\u0430\u0439\u043B\u043E\u0432.");
    return entries;
  }
  return __toCommonJS(zip_exports);
})();
