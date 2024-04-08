const readAllEntries = async (directoryReader: FileSystemDirectoryReader, entries = []): Promise<FileSystemEntry[]> => {
  return new Promise((resolve) => {
    directoryReader.readEntries((_entries) => {
      entries = entries.concat(_entries)
      if (!_entries.length) resolve(entries)
      resolve(readAllEntries(directoryReader, entries))
    })
  })
}

const getFile = async (item: FileSystemEntry): Promise<File> => {
  return new Promise((resolve) => {
    item["file"]((file: File) => resolve(file))
  })
}

const getWebLink = async (item: DataTransferItem): Promise<string> => {
  return new Promise((resolve) => {
    item.getAsString((url) => resolve(url))
  })
}

export const getFilesFromEvent = async (event: DragEvent): Promise<File[]> => {
  if (event.dataTransfer?.items) {
    const addDirectory = async (item: FileSystemEntry) => {
      if (!item) return
      if (item.isDirectory) {
        const directoryReader = item["createReader"]()
        const entries = await readAllEntries(directoryReader)
        await Promise.all(entries.map(async (entry) => await addDirectory(entry)))
      } else {
        const file = await getFile(item)
        if (!file.name.startsWith(".")) files.push(file)
      }
    }

    const files: File[] = []
    const items = Array.from(event.dataTransfer.items)

    if (items[0] instanceof DataTransferItem && items[0].kind === "string") {
      // Drag and drop from the web
      const url = await getWebLink(items[0])
      console.log(url)
      throw "from_web_not_allowed"
    } else {
      await Promise.all(items.map(async (item) => await addDirectory(item.webkitGetAsEntry())))
    }
    return files
  } else {
    const files = <FileList>(event.target["files"] || event.dataTransfer.files)
    return Array.from(files)
  }
}
