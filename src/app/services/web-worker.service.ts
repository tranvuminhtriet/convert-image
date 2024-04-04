import { Injectable } from "@angular/core"
import { Observable } from "rxjs"

@Injectable({
  providedIn: "root",
})
export class WebWorkerService {
  getWorker<T>(worker: Worker) {
    const onMessage$ = new Observable<T>((observer) => {
      worker.onmessage = ({ data }) => observer.next(data)
      worker.onerror = ({ message }) => observer.error(message)
    })
    return { worker, onMessage$ }
  }
}
