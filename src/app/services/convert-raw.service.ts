import { Injectable, inject } from "@angular/core"
import { catchError, of, switchMap } from "rxjs"
import { ConvertRawMagickService } from "./convert-raw-magick.service"
import { ConversionResponse, ConvertRawPreviewService } from "./convert-raw-preview.service"

@Injectable({
  providedIn: "root",
})
export class ConvertRawService {
  private convertRawPreviewService = inject(ConvertRawPreviewService)
  private convertRawMagickService = inject(ConvertRawMagickService)

  public convertFile(file: File, targetFormat: string, quality: number, rawAcceleration = true) {
    if (rawAcceleration && this.convertRawPreviewService.canExtractPreview(file, targetFormat)) {
      return this.convertWithPreview(file, targetFormat, quality)
    }
    return this.convertWithMagick(file, targetFormat, quality, rawAcceleration)
  }

  public preloadWorkers() {
    this.convertRawMagickService.preloadWorker()
    this.convertRawPreviewService.preloadWorker()
  }

  private convertWithPreview(file: File, targetFormat: string, quality: number) {
    return this.convertRawPreviewService.extractPreview(file, targetFormat, quality).pipe(
      catchError((error) => {
        console.error(error, file)
        return of({ error })
      }),
      switchMap((result) => {
        if ("status" in result) return of(result)
        if (result && "src" in result) return of(result)
        console.warn("Preview failed, trying magick", result)
        return this.convertRawMagickService.convertFile(file, targetFormat, quality)
      })
    )
  }

  private convertWithMagick(file: File, targetFormat: string, quality: number, rawAcceleration = true) {
    return this.convertRawMagickService.convertFile(file, targetFormat, quality).pipe(
      catchError((error) => {
        console.error(error, file)
        return of(null)
      }),
      switchMap((result: any) => {
        if ("status" in result) return of(result)
        if (result && "src" in result) return of(result)
        if (result && "partialFile" in result) return of(result)
        const previewCanBeExtracted =
          !rawAcceleration && this.convertRawPreviewService.canExtractPreview(file, targetFormat)
        if (!previewCanBeExtracted) {
          console.warn("Preview cannot be extracted, giving up")
          return of(<ConversionResponse>{
            file,
            error: "error" in result ? result.error : "Unknown error",
          })
        }
        return this.convertRawPreviewService.extractPreview(file, targetFormat, quality)
      })
    )
  }
}
