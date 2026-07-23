export const SENDGRID_TRANSPORT_LIMITS = Object.freeze({
  timeoutMs: 10_000,
  maxRequestBytes: 512 * 1024,
  maxResponseBytes: 64 * 1024,
  maxRedirects: 0,
});

export interface ConfigurableSendGridMailService {
  setTimeout(timeout: number): void;
  client: {
    setDefaultRequest(key: string, value: unknown): unknown;
  };
}

export function configureSendGridTransport(
  mailService: ConfigurableSendGridMailService,
): void {
  mailService.setTimeout(SENDGRID_TRANSPORT_LIMITS.timeoutMs);
  mailService.client.setDefaultRequest(
    "maxBodyLength",
    SENDGRID_TRANSPORT_LIMITS.maxRequestBytes,
  );
  mailService.client.setDefaultRequest(
    "maxContentLength",
    SENDGRID_TRANSPORT_LIMITS.maxResponseBytes,
  );
  mailService.client.setDefaultRequest(
    "maxRedirects",
    SENDGRID_TRANSPORT_LIMITS.maxRedirects,
  );
}
