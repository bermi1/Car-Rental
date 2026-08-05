import React, { useEffect, useState } from 'react';
import { Button, Card, EmptyState, Spinner } from '@rental/shared';
import { api, assetUrl } from '../../api/client';

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

  function load() {
    api.get<QueueDocument[]>('/documents/queue').then(setDocs);
  }
  useEffect(load, []);

  async function verify(id: string, verified: boolean) {
    setBusyId(id);
    try {
      const rejection_reason = verified ? undefined : prompt('Reason for rejection (optional)') || undefined;
      await api.put(`/documents/${id}/verify`, { verified, rejection_reason });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Document Verification</h1>
        <p className="mt-1 text-sm text-neutral-500">Review and verify client identification documents.</p>
      </div>

      {!docs ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <EmptyState title="Queue is empty" description="All submitted documents have been reviewed." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{d.client_name}</p>
                  <p className="text-xs text-neutral-400">{d.client_email}</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium capitalize text-neutral-600">
                  {d.document_type.replace('_', ' ')}
                </span>
              </div>
              <a href={assetUrl(d.file_path)} target="_blank" rel="noreferrer" className="mb-4 block">
                <img src={assetUrl(d.file_path)} alt="Document" className="h-40 w-full rounded-lg object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </a>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => verify(d.id, true)} isLoading={busyId === d.id}>
                  Verify
                </Button>
                <Button size="sm" variant="danger" onClick={() => verify(d.id, false)} isLoading={busyId === d.id}>
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
