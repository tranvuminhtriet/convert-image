/// <reference lib="webworker" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const global = undefined

import { IMagickImage, ImageMagick, MagickFormat, initializeImageMagick } from "@imagemagick/magick-wasm"
import { Observable, catchError, forkJoin, from, of, shareReplay, switchMap, tap, throwError } from "rxjs"
import { fileToBuffer } from "./lib/file-to-buffer"

const initialize = () => {
  return from(fetch("/assets/magick.wasm").then((resp) => resp.arrayBuffer())).pipe(
    switchMap((buffer) => from(initializeImageMagick(new Uint8Array(buffer)))),
    shareReplay()
  )
}

const getFormat = (filename: string) => {
  const extension = filename.split(".").pop().toLowerCase()
  return Object.values(MagickFormat).find((format: string) => format.toLowerCase() === extension)
}

const afterRead = (image: IMagickImage, toFormat: MagickFormat | undefined, quality: number) => {
  return new Observable<{ out: Uint8Array; width: number; height: number }>((observer) => {
    try {
      image.quality = quality * 100
      if (toFormat === MagickFormat.Ico) {
        if (image.width > 256 || image.height > 256) {
          image.resize(256, 256)
        }
      }
      image.autoOrient()
      if (toFormat === undefined) {
        image.write(toFormat, (out) => {
          observer.next({ out, width: image.width, height: image.height })
          observer.complete()
          image.dispose()
        })
      } else {
        image.write(toFormat, (out) => {
          observer.next({ out, width: image.width, height: image.height })
          observer.complete()
          image.dispose()
        })
      }
    } catch (err) {
      image.dispose()
      observer.error(err)
      observer.complete()
    }
  })
}

const convert = (
  buffer: ArrayBuffer,
  fromFormat: MagickFormat | undefined,
  toFormat: MagickFormat | undefined,
  quality: number
) => {
  return new Observable<{ out: Uint8Array; width: number; height: number }>((observer) => {
    ImageMagick.read(new Uint8Array(buffer), fromFormat, (image) => {
      afterRead(image, toFormat, quality)
        .pipe(
          tap((resp) => {
            observer.next(resp)
            observer.complete()
          }),
          catchError((err) => {
            observer.error(err)
            observer.complete()
            return of(null)
          })
        )
        .subscribe()
    })
  }).pipe(
    catchError((error) => {
      if (toFormat === undefined) return throwError(() => error)
      console.warn("ConvertMagickService error, trying again with auto format")
      return new Observable<{ out: Uint8Array; width: number; height: number }>((observer) => {
        ImageMagick.read(new Uint8Array(buffer), (image) => {
          afterRead(image, undefined, quality)
            .pipe(
              catchError((error) => {
                console.error(error)
                return of(null)
              })
            )
            .subscribe((resp) => {
              observer.next(resp)
              observer.complete()
            })
        })
      })
    })
  )
}

addEventListener("message", ({ data }) => {
  const { file, toFormat, quality } = data as { file: File; toFormat: string; quality: number }
  const fromFormatType = getFormat(file.name)
  const toFormatType = getFormat(toFormat)

  forkJoin([from(fileToBuffer(file)), initialize()]).subscribe(([buffer]) => {
    convert(buffer, fromFormatType, toFormatType, quality)
      .pipe(
        catchError((err) => {
          console.error(err)
          return of(null)
        })
      )
      .subscribe((out) => {
        postMessage(out)
      })
  })
})
