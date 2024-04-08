import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core"
import { DragDropDirective } from "../../directives/drag-and-drop.directive"

@Component({
  selector: "app-drop",
  templateUrl: "./drop.component.html",
  styleUrls: ["./drop.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DragDropDirective],
})
export class DropComponent {
  @Output() onFileDrop = new EventEmitter<File[]>()
  @Input() disable: boolean
  dragHover = false

  fileDrop(files: File[]) {
    this.onFileDrop.emit(files)
  }
}
