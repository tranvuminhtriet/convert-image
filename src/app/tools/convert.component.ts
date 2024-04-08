import { CommonModule } from "@angular/common"
import { Component, NgZone, inject } from "@angular/core"
import { map, of, switchMap, tap } from "rxjs"
import { forkJoinSafe } from "../lib/safe-fork-join"
import { ConversionResponse } from "../services/convert-raw-preview.service"
import { ConvertRawService } from "../services/convert-raw.service"
import { DropComponent } from "../shared/components/drop/drop.component"
import { DragDropDirective } from "../shared/directives/drag-and-drop.directive"

export type FileConversion = {
  file: File
  result?: ConversionResponse
  status: "idle" | "pending" | "processing" | "done" | "error"
  fromFormat: string
  toFormat: string
  partialFile?: File
  partialStart?: number
}

@Component({
  selector: "app-convert",
  templateUrl: "./convert.component.html",
  styleUrls: ["./convert.component.scss"],
  standalone: true,
  imports: [CommonModule, DragDropDirective, DropComponent],
})
export class ConvertComponent {
  private convertRawService = inject(ConvertRawService)
  private zone = inject(NgZone)
  conversionCache: FileConversion[] = []

  convertedImageSrcs: string[]

  loading = false

  rawAcceleration = true

  onSelectFilesFromTarget(target: EventTarget) {
    const files = Array.from((target as HTMLInputElement).files)

    return this.onSelectFiles(files)
  }

  onSelectFiles(files: File[]) {
    this.conversionCache = []
    // Mac dinh toFormat = jpg
    this.conversionCache.push(
      ...files.map((file) => ({
        file,
        status: "idle" as const,
        toFormat: "JPG",
        fromFormat: file.name.split(".").pop().toUpperCase(),
      }))
    )
  }

  private convertConversion(conversion: FileConversion) {
    // 0 -> 100%: Tang giam chat luong hinh anh
    const quality = 1 // Mac dinh 100%

    // Chi support CR3 -> JPG
    if (conversion.fromFormat.toUpperCase() != "CR3") return
    if (conversion.toFormat.toUpperCase() != "JPG") return

    conversion.status = "pending"
    let startTime: number = conversion.partialStart || undefined

    return this.zone.runOutsideAngular(() => {
      return of(null).pipe(
        switchMap(() => {
          return this.convertRawService.convertFile(conversion.file, conversion.toFormat, quality, this.rawAcceleration)
        }),
        switchMap((result) => {
          if ("partialFile" in result) {
            const originalFile = conversion.file
            conversion.file = result.partialFile
            conversion.partialStart = result.start
            return this.convertConversion(conversion).pipe(
              map((result: any) => {
                if ("status" in result) return result
                conversion.file = originalFile
                return {
                  ...result,
                  file: originalFile,
                }
              })
            )
          }
          return of(result)
        }),
        tap((result: any) => {
          this.zone.runGuarded(() => {
            if ("status" in result) {
              conversion.status = "processing"
              if (!startTime) startTime = Date.now()
            }
            if ("file" in result) {
              conversion.status = result.error ? "error" : "done"
              conversion.result = result
              conversion.result.timeTaken = Date.now() - startTime
            }
          })
        })
      )
    })
  }

  convertAll() {
    this.loading = true
    forkJoinSafe(
      this.conversionCache.map((conversion) => {
        return this.convertConversion(conversion)
      })
    ).subscribe((results: ConversionResponse[]) => {
      this.convertedImageSrcs = results.map((img) => img.src)
      this.loading = false
    })
  }
}
