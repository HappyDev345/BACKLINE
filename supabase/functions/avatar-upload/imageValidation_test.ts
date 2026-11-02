import { Image } from 'npm:imagescript@3.13.1'
import { inspectImage, isWithinImageLimits } from './imageValidation.ts'

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}.`)
}

Deno.test('inspects PNG signatures and dimensions', () => {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, 640)
  view.setUint32(20, 480)

  const result = inspectImage(bytes)
  assertEqual(result?.mediaType, 'image/png')
  assertEqual(result?.width, 640)
  assertEqual(result?.height, 480)
})

Deno.test('inspects JPEG frame dimensions', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08, 0x01, 0x2c, 0x02, 0x58])
  const result = inspectImage(bytes)
  assertEqual(result?.mediaType, 'image/jpeg')
  assertEqual(result?.width, 600)
  assertEqual(result?.height, 300)
})

Deno.test('inspects WebP extended dimensions', () => {
  const bytes = new Uint8Array(30)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  bytes.set(new TextEncoder().encode('WEBP'), 8)
  bytes.set(new TextEncoder().encode('VP8X'), 12)
  bytes[24] = 99
  bytes[27] = 199

  const result = inspectImage(bytes)
  assertEqual(result?.mediaType, 'image/webp')
  assertEqual(result?.width, 100)
  assertEqual(result?.height, 200)
})

Deno.test('rejects unknown signatures and unsafe dimensions', () => {
  assertEqual(inspectImage(new Uint8Array([1, 2, 3])), null)
  assertEqual(isWithinImageLimits(4000, 2000), true)
  assertEqual(isWithinImageLimits(4096, 4096), false)
  assertEqual(isWithinImageLimits(4097, 1), false)
  assertEqual(isWithinImageLimits(1.5, 1), false)
})

Deno.test('decodes supported formats and normalizes them to PNG', async () => {
  const source = new Image(2, 2)
  const fixtures = [
    { mediaType: 'image/png', bytes: await source.encode() },
    { mediaType: 'image/jpeg', bytes: await source.encodeJPEG() },
    { mediaType: 'image/webp', bytes: await source.encodeWebP() },
  ]

  for (const fixture of fixtures) {
    const inspected = inspectImage(fixture.bytes)
    assertEqual(inspected?.mediaType, fixture.mediaType)
    const decoded = await Image.decode(fixture.bytes)
    assertEqual(decoded.width, 2)
    assertEqual(decoded.height, 2)
    const normalized = await decoded.encode()
    assertEqual(normalized[0], 0x89)
    assertEqual(normalized[1], 0x50)
    assertEqual(normalized[2], 0x4e)
    assertEqual(normalized[3], 0x47)
  }
})
