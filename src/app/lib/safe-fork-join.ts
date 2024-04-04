import { forkJoin, Observable, of } from "rxjs"

export const forkJoinSafe = <T>(array: Observable<T>[]): Observable<T[]> => {
  if (!array.length) return of([])
  return forkJoin<T[]>(array)
}
