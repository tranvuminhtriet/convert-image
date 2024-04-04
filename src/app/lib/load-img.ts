export const loadImg = (src: string, anonymous = true): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    if (anonymous) img.crossOrigin = "anonymous"
    img.onerror = (err: Event) => {
      console.log(err)
      reject("error in loadImg")
    }
    img.src = src
  })
}

export const loadImgThroughPicflowServer = (baseUrl: string, src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.crossOrigin = "anonymous"
    img.onerror = (err: Event) => {
      console.log(err)
      reject("error in loadImg")
    }
    img.src = `${baseUrl}/internal-api/image?url=${encodeURIComponent(src)}`
  })
}
