import React, { useEffect, useState } from 'react';
import { Button, Card, CardHeader, CardTitle, Icon, Input, Textarea } from '@rental/shared';
import { api, ApiError } from '../api/client';

/**
 * The terms every contract is built from.
 *
 * Saving never edits the wording in place — it files a new version and leaves
 * the old one standing, because a contract already signed must keep pointing
 * at the words that were actually agreed.
 */

interface Terms {
  id: string;
  version: number;
  title: string;
  body: string;
  created_at: string;
}

export function TermsEditor() {
  const [terms, setTerms] = useState<Terms | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Terms>('/contracts/terms/current')
      .then((t) => {
        setTerms(t);
        setTitle(t.title);
        setBody(t.body);
      })
      .catch(() => setError('Could not load your terms.'));
  }, []);

  const dirty = !!terms && (title !== terms.title || body !== terms.body);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const next = await api.put<Terms>('/contracts/terms', { title, body });
      setTerms(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your terms.');
    } finally {
      setSaving(false);
    }
  }

  if (!terms) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Rental terms and conditions</CardTitle>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            These clauses go into every contract. Customers read them in full before they can sign.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-fg-muted">
          Version {terms.version}
        </span>
      </CardHeader>

      {error && <p className="mb-4 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-fg">{error}</p>}

      <form onSubmit={save} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
        />
        <Textarea
          label="Terms"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          rows={18}
          className="font-mono text-xs"
          hint="Saving files a new version. Contracts already signed keep the wording they were signed under."
        />
        <div className="flex items-center gap-3">
          <Button type="submit" isLoading={saving} disabled={!dirty}>
            Save as version {terms.version + 1}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-success-fg">
              <Icon name="check" size={15} />
              Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
