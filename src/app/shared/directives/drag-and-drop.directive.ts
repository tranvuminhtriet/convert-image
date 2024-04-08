import { Directive, EventEmitter, HostListener, Input, Output } from "@angular/core"
import { getFilesFromEvent } from "../../lib/get-files-from-event"

@Directive({
  selector: "[appDragDrop]",
  standalone: true,
})
export class DragDropDirective {
  @Input() disable = false

  @Output() onFileDropped = new EventEmitter<File[]>()
  @Output() onHover = new EventEmitter<void>()
  @Output() onUnhover = new EventEmitter<void>()

  //Dragover listener
  @HostListener("dragover", ["$event"]) onDragOver(evt: Event) {
    if (this.disable) return

    evt.preventDefault()
    evt.stopPropagation()
    this.onHover.emit()
  }

  //Dragleave listener
  @HostListener("dragleave", ["$event"]) public onDragLeave(evt: Event) {
    if (this.disable) return

    evt.preventDefault()
    evt.stopPropagation()
  }

  //Drop listener
  @HostListener("drop", ["$event"]) public async ondrop(evt: DragEvent) {
    if (this.disable) return
    evt.preventDefault()
    evt.stopPropagation()
    this.onUnhover.emit()
    try {
      const files = await getFilesFromEvent(evt)
      this.onFileDropped.emit(files)
    } catch (err) {
      if (err === "from_web_not_allowed") {
        console.log("Drag and drop from the web is not yet supported.", "error")
      } else {
        throw err
      }
    }
  }
}
