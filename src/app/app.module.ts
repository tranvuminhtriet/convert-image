import { NgModule } from "@angular/core"
import { BrowserModule } from "@angular/platform-browser"
import { RouterOutlet } from "@angular/router"
import { AppComponent } from "./app.component"
import { ConvertComponent } from "./tools/convert.component"

@NgModule({
  declarations: [AppComponent, ConvertComponent],
  imports: [BrowserModule, RouterOutlet],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
