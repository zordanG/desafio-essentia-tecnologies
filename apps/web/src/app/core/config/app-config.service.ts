import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiBaseUrl: string;
}

const CONFIG_FILE_NAME = 'config.json';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private configuration: AppConfig | null = null;

  get apiBaseUrl(): string {
    if (!this.configuration) {
      throw new Error('Runtime configuration is not loaded.');
    }

    return this.configuration.apiBaseUrl;
  }

  async load(): Promise<void> {
    const configUrl = new URL(CONFIG_FILE_NAME, this.document.baseURI).toString();
    let response: unknown;

    try {
      response = await firstValueFrom(this.http.get<unknown>(configUrl));
    } catch (error) {
      throw new Error(`Unable to load runtime configuration from ${configUrl}.`, { cause: error });
    }

    if (!isAppConfig(response)) {
      throw new Error('Invalid runtime configuration: "apiBaseUrl" must be a non-empty string.');
    }

    this.configuration = {
      apiBaseUrl: response.apiBaseUrl.trim().replace(/\/+$/, ''),
    };
  }
}

function isAppConfig(value: unknown): value is AppConfig {
  if (typeof value !== 'object' || value === null || !('apiBaseUrl' in value)) {
    return false;
  }

  const { apiBaseUrl } = value as { apiBaseUrl: unknown };

  return typeof apiBaseUrl === 'string' && apiBaseUrl.trim().length > 0;
}
