import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button, Card, CardHeader, CardTitle, Icon } from '@rental/shared';

/**
 * The owner's shop-window link, and the QR code for it.
 *
 * Print the QR, put it on the counter or the car window, and a client's phone
 * lands straight on this company's catalogue — no app, no account, and no way
 * to end up looking at somebody else's fleet.
 */
export function CatalogueShare({ slug, companyName }: { slug: string; companyName: string }) {
  const [dataUrl, setDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/c/${slug}`;

  useEffect(() => {
    // Rendered locally into a data: URI — nothing about the company is sent to
    // a third-party QR service.
    QRCode.toDataURL(url, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1220', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${slug}-catalogue-qr.png`;
    a.click();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your public catalogue</CardTitle>
      </CardHeader>

      <p className="text-[13px] leading-relaxed text-fg-muted">
        Share this link or print the code. Clients scan it and book from your cars — they see your
        prices and condition notes, and never anyone else's fleet.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code linking to the ${companyName} catalogue`}
            className="h-40 w-40 shrink-0 self-center rounded-xl border border-line bg-white p-2 sm:self-start"
          />
        ) : (
          <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-sunken">
            <Icon name="external" size={22} className="text-fg-subtle" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Link</p>
          <p className="mt-1 break-all rounded-lg bg-surface-sunken px-3 py-2 font-mono text-[13px] text-fg">
            {url}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={copied ? 'check' : 'clipboard'} onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button size="sm" variant="outline" icon="download" onClick={download} disabled={!dataUrl}>
              Download QR
            </Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" iconRight="external">
                Open
              </Button>
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
