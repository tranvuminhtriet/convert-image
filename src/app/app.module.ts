import { NgModule } from "@angular/core"
import { BrowserModule } from "@angular/platform-browser"
import { RouterOutlet } from "@angular/router"
import { AppComponent } from "./app.component"
import { ConvertComponent } from "./tools/convert.component"

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, RouterOutlet, ConvertComponent],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
