import { Injectable } from "@angular/core"

@Injectable({
  providedIn: "root",
})
export class MimeTypeService {
  getWebImageMimeType(extension: string) {
    switch (extension) {
      case "jpg":
        return "image/jpeg"
      case "jpeg":
        return "image/jpeg"
      case "png":
        return "image/png"
      case "gif":
        return "image/gif"
      case "webp":
        return "image/webp"
      case "avif":
        return "image/avif"
      default:
        return null
    }
  }
}
