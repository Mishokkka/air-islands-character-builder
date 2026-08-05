const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;
const UTF8_FLAG = 0x0800;

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    crcTable[i] = value >>> 0;
  }
  return crcTable;
}

export function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of toBytes(bytes)) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") return encoder.encode(value);
  throw new TypeError("ZIP entry data must be a string, ArrayBuffer, or Uint8Array.");
}

export function decodeText(value) {
  return decoder.decode(toBytes(value));
}

export function isZip(value) {
  const bytes = toBytes(value);
  return bytes.length >= 4 && readU32(bytes, 0) === ZIP_LOCAL_FILE;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = ((year - 1980) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, date: day };
}

function writeU16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function readU16(source, offset) {
  if (offset + 2 > source.length) throw new Error("Повреждённый ZIP: неожиданный конец файла.");
  return source[offset] | (source[offset + 1] << 8);
}

function readU32(source, offset) {
  if (offset + 4 > source.length) throw new Error("Повреждённый ZIP: неожиданный конец файла.");
  return (source[offset] | (source[offset + 1] << 8) | (source[offset + 2] << 16) | (source[offset + 3] << 24)) >>> 0;
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

export function createZip(entries, options = {}) {
  const normalized = entries.map(entry => {
    const name = String(entry.name ?? "").replaceAll("\\", "/").replace(/^\/+/, "");
    if (!name || name.endsWith("/")) throw new Error(`Недопустимое имя ZIP-записи: ${name || "(пусто)"}.`);
    const nameBytes = encoder.encode(name);
    if (nameBytes.length > 0xffff) throw new Error(`Слишком длинное имя ZIP-записи: ${name}.`);
    const data = toBytes(entry.data);
    return { name, nameBytes, data, crc: crc32(data) };
  });

  const stamp = dosDateTime(options.date ?? new Date());
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

export function readZip(value) {
  const bytes = toBytes(value);
  if (!isZip(bytes)) throw new Error("Файл не является ZIP-контейнером.");
  const entries = new Map();
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const signature = readU32(bytes, offset);
    if (signature === ZIP_CENTRAL_FILE || signature === ZIP_END) break;
    if (signature !== ZIP_LOCAL_FILE) throw new Error(`Повреждённый ZIP: неизвестная сигнатура 0x${signature.toString(16)}.`);

    const flags = readU16(bytes, offset + 6);
    const method = readU16(bytes, offset + 8);
    const expectedCrc = readU32(bytes, offset + 14);
    const compressedSize = readU32(bytes, offset + 18);
    const uncompressedSize = readU32(bytes, offset + 22);
    const nameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    if (flags & 0x0008) throw new Error("ZIP с data descriptor не поддерживается.");
    if (method !== 0) throw new Error("Сжатый ZIP не поддерживается. Требуется контейнер конструктора без сжатия.");
    if (compressedSize !== uncompressedSize) throw new Error("Повреждённый ZIP: размеры записи не совпадают.");

    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error("Повреждённый ZIP: запись выходит за границы файла.");
    const nameBytes = bytes.subarray(nameStart, nameStart + nameLength);
    const name = decoder.decode(nameBytes);
    const data = bytes.slice(dataStart, dataEnd);
    const actualCrc = crc32(data);
    if (actualCrc !== expectedCrc) throw new Error(`Повреждённый ZIP: контрольная сумма ${name} не совпадает.`);
    entries.set(name, data);
    offset = dataEnd;
  }

  if (!entries.size) throw new Error("ZIP-контейнер не содержит файлов.");
  return entries;
}
