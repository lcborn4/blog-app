import { Component, ChangeDetectionStrategy } from '@angular/core';
import packageJson from '../../../package.json';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  version: string = packageJson.version;
  readonly siteHomeUrl = environment.siteHomeUrl;
  readonly siteHomeLabel = environment.siteHomeLabel || environment.siteName;
}
