import Raw from "../assets/libraw.js"
import { fileToBuffer } from "./lib/file-to-buffer.js"

onmessage = async (e: MessageEvent<{ file: File; id: string }>) => {
  const file = e.data.file
  const id = e.data.id
  const [buffer, raw] = await Promise.all([fileToBuffer(file), Raw()])
  const array = new Uint8Array(buffer)
  const dataSize = array.length
  const data = raw._malloc(dataSize)
  const bufferArray = new Uint8ClampedArray(raw.HEAPU8.buffer, data, dataSize)

  for (let i = 0; i < dataSize; i++) {
    bufferArray[i] = array[i]
  }
  const { buffer: previewBuffer } = raw.preview(data, dataSize) as { buffer: Uint8ClampedArray }
  raw._free(data)
  postMessage({ buffer: previewBuffer, id })
}
