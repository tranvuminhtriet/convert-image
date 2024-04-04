import { Injectable, inject } from "@angular/core"
import { Observable, Subject, Subscriber, catchError, map, of, switchMap, take, throwError } from "rxjs"
import { ConversionProgressReport, ConversionResponse, PartialConversionResponse } from "./convert-raw-preview.service"
import { WebWorkerService } from "./web-worker.service"

@Injectable({
  providedIn: "root",
})
export class ConvertRawMagickService {
  private workerService = inject(WebWorkerService)
  maxWorkerCount = 4
  workers: {
    worker: Worker
    available: boolean
    onMessage$: Observable<{ out: Uint8Array; width: number; height: number }>
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
      .pipe(take(1))
      .subscribe((worker: any) => {
        if (!worker) return
        const data = this.toConvert.shift()
        if (!data) return
        worker.available = false
        data.observer.next({ status: "processing" })
        this.convertFile$(data, worker.worker, worker.onMessage$).subscribe((d) => {
          worker.available = true
          data.observer.next(d)
          data.observer.complete()
          this.convert$.next()
        })
      })
  })

  public convertFile(file: File, toFormat: string, quality: number) {
    return new Observable((observer: Subscriber<ConversionResponse | ConversionProgressReport>) => {
      this.toConvert.push({ file, observer, toFormat, quality })
      this.convert$.next()
    })
  }

  getAvailableWorker() {
    const worker = this.workers.find((w) => w.available)
    if (worker) return of(worker)
    if (this.workers.length > this.maxWorkerCount) return of(null)
    const _worker = this.getWorker()
    this.workers.push(_worker)
    return of(_worker)
  }

  getWorker() {
    const { worker, onMessage$ } = this.workerService.getWorker<{ out: Uint8Array; width: number; height: number }>(
      new Worker(new URL("../magick.worker", import.meta.url))
    )
    return { worker, onMessage$, available: true }
  }

  public preloadWorker() {
    if (this.workers.length) return
    const _worker = this.getWorker()
    this.workers.push(_worker)
  }

  private getToFormat(toFormat: string) {
    if (toFormat === "svg") return "png"
    return toFormat
  }

  private convertFile$ = (
    data: (typeof this.toConvert)[0],
    worker: Worker,
    onMessage: Observable<{ out: Uint8Array; width: number; height: number }>
  ): Observable<ConversionResponse | PartialConversionResponse> => {
    const toFormat = this.getToFormat(data.toFormat)
    return of(null).pipe(
      switchMap(() => {
        console.debug("ConvertRawMagickService converting", data.file, toFormat, data.quality)
        worker.postMessage({
          file: data.file,
          toFormat: toFormat,
          quality: data.quality,
        })
        return onMessage.pipe(
          switchMap((result) => {
            if (!result?.out?.length) return throwError(() => "Failed to convert Raw file")
            console.debug("ConvertRawMagickService converted", Date.now())

            const blob = new Blob([result.out])
            const src = URL.createObjectURL(blob)
            return of({ src, size: blob.size, width: result.width, height: result.height, blob })
          }),
          take(1)
        )
      }),
      map(({ src, size, width, height, blob }) => {
        if (toFormat !== data.toFormat) {
          return <PartialConversionResponse>{
            file: data.file,
            partialFile: new File([blob], this.getOutputName(data.file, toFormat)),
            targetFormat: data.toFormat,
          }
        }
        return {
          src: src,
          file: data.file,
          outputName: this.getOutputName(data.file, data.toFormat),
          outputSize: size,
          outputWidth: width,
          outputHeight: height,
          targetFormat: data.toFormat,
        }
      }),
      catchError((error) => {
        return of({
          file: data.file,
          error,
          src: "",
          targetFormat: data.toFormat,
        })
      })
    )
  }

  private getOutputName(file: File, toFormat: string) {
    const name = file.name.split(".")[0]
    return name + "." + toFormat
  }
}
