import { Injectable, inject } from "@angular/core"
import {
  Observable,
  Subject,
  Subscriber,
  catchError,
  filter,
  from,
  of,
  retry,
  switchMap,
  take,
  tap,
  throwError,
  timeout,
} from "rxjs"
import { browserRenderableExtensions } from "../consts"
import { loadImg } from "../lib/load-img"
import { randomString } from "../lib/random-string"
import { MimeTypeService } from "./mime-type.service"
import { WebWorkerService } from "./web-worker.service"

const allowedLibRawFileExtensions = [
  "cr2",
  "cr3",
  "crw",
  "dng",
  "nef",
  "nrw",
  "orf",
  "pef",
  "raf",
  "raw",
  "rw2",
  "srw",
  "arw",
]

export interface ConversionProgressReport {
  status: "pending" | "processing"
}

export interface ConversionResponse {
  src?: string
  error?: string
  file: File
  timeTaken?: number
  outputName?: string
  outputSize?: number
  outputWidth?: number
  outputHeight?: number
  targetFormat: string
}

export type PartialConversionResponse = {
  file: File
  partialFile: File
  start: number
  targetFormat: string
}

export interface PreviewWorkerMessage {
  id: string
  buffer: Uint8Array
  error?: string
}

@Injectable({
  providedIn: "root",
})
export class ConvertRawPreviewService {
  workerService = inject(WebWorkerService)
  mimeTypeService = inject(MimeTypeService)
  maxWorkerCount = 4
  workers: {
    worker: Worker
    available: boolean
    onMessage$: Observable<PreviewWorkerMessage>
  }[] = []

  private toConvert: {
    file: File
    observer: Subscriber<ConversionResponse | ConversionProgressReport>
    toFormat: string
    quality: number
  }[] = []

  private convert$ = new Subject<void>()

  private convertFiles$ = this.convert$.subscribe(() => {
    this.getAvailableWorker()
      .pipe(
        filter(Boolean),
        take(1),
        switchMap((worker) => {
          const data = this.toConvert.shift()
          if (!data) return of(null)
          worker.available = false
          console.debug("ConvertRawPreviewService converting", data.file, data.toFormat, data.quality)
          data.observer.next({ status: "processing" })
          return this.convertFile$(data.file, worker.worker, worker.onMessage$, data.toFormat).pipe(
            switchMap((response) => {
              if (!response.src?.length) {
                console.debug("ConvertRawPreviewService failed to convert", data.file, data.toFormat, data.quality)
                data.observer.error(response.error)
                data.observer.complete()
                return of(null)
              }
              return from(loadImg(response.src)).pipe(
                catchError((error) => {
                  console.error(error, data.file)
                  return of(null)
                }),
                switchMap((img) => {
                  if (!img) {
                    data.observer.error("Image failed to load")
                    return of(null)
                  }
                  if (Math.max(img.naturalWidth, img.naturalHeight) < 3840) {
                    data.observer.error("Image too small")
                    return of(null)
                  } else {
                    return this.convertPreview(img, data.toFormat, data.quality).pipe(
                      tap(({ src, width, height }) => {
                        data.observer.next({ ...response, src, outputWidth: width, outputHeight: height })
                        data.observer.complete()
                      }),
                      catchError(() => {
                        data.observer.error("Image failed to load")
                        return of(null)
                      })
                    )
                  }
                })
              )
            }),
            tap(() => {
              worker.available = true
              this.convert$.next()
            })
          )
        })
      )
      .subscribe()
  })

  private convertPreview(img: HTMLImageElement, toFormat: string, quality: number) {
    const mimeType = this.mimeTypeService.getWebImageMimeType(toFormat)
    const width = img.naturalWidth
    const height = img.naturalHeight
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)

    return new Observable<{ src: string; width: number; height: number }>((observer) => {
      canvas.toBlob(
        (blob) => {
          try {
            const url = URL.createObjectURL(blob)
            URL.revokeObjectURL(img.src)
            observer.next({ src: url, width, height })
            observer.complete()
          } catch (err) {
            observer.error(err)
          }
        },
        mimeType,
        quality
      )
    })
  }

  getAvailableWorker() {
    const worker = this.workers.find((w) => w.available)
    if (worker) {
      return of(worker)
    }
    if (this.workers.length >= this.maxWorkerCount) return of(null)
    const _worker = <(typeof this.workers)[0]>{}
    this.workers.push(_worker)
    return this.getWorker().pipe(tap((worker) => Object.assign(_worker, worker)))
  }

  getWorker() {
    const { worker, onMessage$ } = this.workerService.getWorker<PreviewWorkerMessage>(
      new Worker(new URL("../libraw.worker", import.meta.url))
    )
    return of({ worker, onMessage$, available: true })
  }

  public preloadWorker() {
    if (this.workers.length) return
    this.getAvailableWorker().subscribe()
  }

  public extractPreview(file: File, toFormat: string, quality: number) {
    return new Observable((observer: Subscriber<ConversionResponse | ConversionProgressReport>) => {
      this.toConvert.push({ file, observer, toFormat, quality })
      this.convert$.next()
    })
  }

  public canExtractPreview(file: File, toFormat: string) {
    const format = file.name.split(".").pop().toLowerCase()
    if (!allowedLibRawFileExtensions.includes(format)) return false
    if (!browserRenderableExtensions.includes(toFormat)) return false
    return true
  }

  private sendAndWaitForResponse(id: string, file: File, worker: Worker, onMessage: Observable<PreviewWorkerMessage>) {
    return of(null).pipe(
      switchMap(() => {
        worker.postMessage({
          id,
          file,
        })
        return onMessage.pipe(
          filter((e) => e.id === id),
          take(1),
          timeout(1000)
        )
      }),
      retry(1)
    )
  }

  private convertFile$(
    file: File,
    worker: Worker,
    onMessage: Observable<PreviewWorkerMessage>,
    toFormat: string
  ): Observable<ConversionResponse> {
    return of(null).pipe(
      switchMap(() =>
        this.sendAndWaitForResponse(randomString(8), file, worker, onMessage).pipe(
          switchMap((result) => {
            if (result.error) return throwError(() => result.error)
            const blob = new Blob([result.buffer])
            const src = URL.createObjectURL(blob)
            return of({
              src,
              file,
              outputName: this.getOutputName(file, toFormat),
              outputSize: blob.size,
              targetFormat: toFormat,
            })
          }),
          catchError((error) => {
            return of({
              file,
              error,
              src: "",
              targetFormat: toFormat,
            })
          })
        )
      )
    )
  }

  private getOutputName(file: File, toFormat: string) {
    const name = file.name.split(".")[0]
    return name + "." + toFormat
  }
}
