import { Component, ChangeDetectionStrategy } from '@angular/core';
import packageJson from '../../../package.json';

@Component({
    selector: 'app-footer',
    imports: [],
    templateUrl: './footer.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './footer.component.css'
})
export class FooterComponent {
  version: string = packageJson.version;
}
