import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppConfigService } from './app-config.service';

const CONFIG_URL = new URL('config.json', document.baseURI).toString();

describe('AppConfigService', () => {
  let service: AppConfigService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AppConfigService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('Loads the API base URL from the runtime configuration', async () => {
    const loading = service.load();

    const request = httpTesting.expectOne(CONFIG_URL);

    expect(request.request.method).toBe('GET');
    request.flush({ apiBaseUrl: 'https://api.example.com/' });
    await loading;

    expect(service.apiBaseUrl).toBe('https://api.example.com');
  });

  it('Rejects configuration without an API base URL', async () => {
    const loading = service.load();

    httpTesting.expectOne(CONFIG_URL).flush({});
    await expect(loading).rejects.toThrow('"apiBaseUrl" must be a non-empty string');
  });

  it('Rejects a blank API base URL', async () => {
    const loading = service.load();

    httpTesting.expectOne(CONFIG_URL).flush({ apiBaseUrl: '   ' });
    await expect(loading).rejects.toThrow('"apiBaseUrl" must be a non-empty string');
  });

  it('Reports a failed configuration request', async () => {
    const loading = service.load();

    httpTesting.expectOne(CONFIG_URL).error(new ProgressEvent('error'));
    await expect(loading).rejects.toThrow('Unable to load runtime configuration from');
  });

  it('Fails when the API base URL is read before loading', () => {
    expect(() => service.apiBaseUrl).toThrow('Runtime configuration is not loaded.');
  });
});
