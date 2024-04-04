export const fileToBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = () => {
      resolve(reader.result as Uint8Array)
    }
    reader.onerror = () => reject(reader.error)
  })
}
