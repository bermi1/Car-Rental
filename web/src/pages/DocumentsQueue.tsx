import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
  humanize,
  formatRelative,
} from '@rental/shared';
import { api, ApiError, assetUrl } from '../api/client';
import { ErrorNotice } from '../components/ErrorNotice';

interface QueueDocument {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  document_type: string;
  file_path: string;
  uploaded_at: string;
}

export function DocumentsQueue() {
  const [docs, setDocs] = useState<QueueDocument[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<QueueDocument | null>(null);
  const [reason, setReason] = useState('');

  function load() {
    api.get<QueueDocument[]>('/documents/queue').then(setDocs);
  }
  useEffect(load, []);

  async function verify(doc: QueueDocument) {
    setBusyId(doc.id);
    setError('');
    try {
      await api.put(`/documents/${doc.id}/verify`, { verified: true });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the document.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setError('');
    try {
      await api.put(`/documents/${rejecting.id}/verify`, {
        verified: false,
        rejection_reason: reason.trim() || undefined,
      });
      setRejecting(null);
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject the document.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Document Verification"
        description="Review identification documents submitted by clients."
      />

      <ErrorNotice message={error} />

      {!docs ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState
            icon="check"
            title="Queue is empty"
            description="Every submitted document has been reviewed."
          />
        </Card>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => (
            <Card key={d.id} flush className="overflow-hidden">
              <a
                href={assetUrl(d.file_path)}
                target="_blank"
                rel="noreferrer"
                className="group relative block aspect-[4/3] bg-surface-sunken"
              >
                <img
                  src={assetUrl(d.file_path)}
                  alt={`${humanize(d.document_type)} for ${d.client_name}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-fg">
                    <Icon name="external" size={13} />
                    Open full size
                  </span>
                </span>
              </a>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/clients/${d.client_id}`}
                      className="block truncate text-[13px] font-medium text-fg hover:text-accent"
                    >
                      {d.client_name}
                    </Link>
                    <p className="truncate text-xs text-fg-subtle">{d.client_email}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                    {humanize(d.document_type)}
                  </span>
                </div>

                <p className="mt-2 text-xs text-fg-subtle">Uploaded {formatRelative(d.uploaded_at)}</p>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon="check" isLoading={busyId === d.id} onClick={() => verify(d)}>
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="x"
                    disabled={busyId === d.id}
                    onClick={() => {
                      setRejecting(d);
                      setReason('');
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject document"
        description={rejecting ? `${humanize(rejecting.document_type)} — ${rejecting.client_name}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={Boolean(busyId)} onClick={confirmReject}>
              Reject document
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          placeholder="Blurry photo, expired document, name mismatch…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <p className="mt-2 text-xs text-fg-subtle">
          The client can re-upload after seeing the reason, so be specific.
        </p>
      </Modal>
    </>
  );
}
