const MAX_IMAGE_DIMENSION = 4096
const MAX_IMAGE_PIXELS = 8_000_000

function isPng(bytes: Uint8Array) {
  return bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    while (offset < bytes.length && bytes[offset] === 0xff) offset++
    if (offset >= bytes.length) return null
    const marker = bytes[offset++]
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) return null
    const segmentLength = view.getUint16(offset)
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker)
    if (isStartOfFrame) {
      if (segmentLength < 7) return null
      return {
        width: view.getUint16(offset + 5),
        height: view.getUint16(offset + 3),
      }
    }
    offset += segmentLength
  }
  return null
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30
    || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF'
    || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunk = String.fromCharCode(...bytes.slice(12, 16))
  if (chunk === 'VP8X') {
    return {
      width: 1 + view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16),
      height: 1 + view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16),
    }
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    }
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + ((bytes[22] & 0x3f) << 8) + bytes[21],
      height: 1 + ((bytes[24] & 0x0f) << 10) + (bytes[23] << 2) + ((bytes[22] & 0xc0) >> 6),
    }
  }
  return null
}

export function inspectImage(bytes: Uint8Array) {
  if (isPng(bytes)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { mediaType: 'image/png', width: view.getUint32(16), height: view.getUint32(20) }
  }
  const jpeg = jpegDimensions(bytes)
  if (jpeg) return { mediaType: 'image/jpeg', ...jpeg }
  const webp = webpDimensions(bytes)
  if (webp) return { mediaType: 'image/webp', ...webp }
  return null
}

export function isWithinImageLimits(width: number, height: number) {
  return Number.isSafeInteger(width)
    && Number.isSafeInteger(height)
    && width > 0
    && height > 0
    && width <= MAX_IMAGE_DIMENSION
    && height <= MAX_IMAGE_DIMENSION
    && width * height <= MAX_IMAGE_PIXELS
}
