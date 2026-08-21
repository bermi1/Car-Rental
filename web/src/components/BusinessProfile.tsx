import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, CardHeader, CardTitle, Icon, Input, Textarea } from '@rental/shared';
import { api, ApiError, assetUrl } from '../api/client';

/**
 * The business's own identity — the name, wording and logo that appear on the
 * public catalogue, on the link a customer opens, and at the head of every
 * contract. One place to set it, rather than a different answer in each.
 */

interface Profile {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_phone: string | null;
  region: string | null;
  logo_path: string | null;
}

export function BusinessProfile() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get<Profile>('/settings/profile').then((p) => {
      setProfile(p);
      setForm({
        name: p.name ?? '',
        tagline: p.tagline ?? '',
        about: p.about ?? '',
        contact_email: p.contact_email ?? '',
        contact_phone: p.contact_phone ?? '',
        whatsapp_phone: p.whatsapp_phone ?? '',
        region: p.region ?? '',
      });
    });
  }
  useEffect(load, []);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.put<Profile>('/settings/profile', form);
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(files: FileList | null) {
    if (!files?.[0]) return;
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('logo', files[0]);
      const updated = await api.post<{ logo_path: string }>('/settings/logo', body);
      setProfile((p) => (p ? { ...p, logo_path: updated.logo_path } : p));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload the logo.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Your business</CardTitle>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            What customers see on your catalogue, your rental links and your contracts.
          </p>
        </div>
      </CardHeader>

      {error && <p className="mb-4 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-fg">{error}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        {profile.logo_path ? (
          <img
            src={assetUrl(profile.logo_path)}
            alt={`${profile.name} logo`}
            className="h-16 w-16 rounded-xl border border-line object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line bg-surface-sunken">
            <Icon name="car" size={22} className="text-fg-subtle" />
          </div>
        )}
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Business logo"
            onChange={(e) => uploadLogo(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            icon="upload"
            isLoading={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {profile.logo_path ? 'Replace logo' : 'Upload logo'}
          </Button>
          <p className="mt-1.5 text-xs text-fg-subtle">A square image reads best. PNG or JPG, up to 15 MB.</p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Business name" value={form.name} onChange={set('name')} required />
          <Input label="Region" value={form.region} onChange={set('region')} placeholder="Dar es Salaam" />
          <Input
            label="Tagline"
            value={form.tagline}
            onChange={set('tagline')}
            placeholder="Rent a car, simply"
            hint="The headline on your public page."
            wrapperClassName="sm:col-span-2"
          />
          <Textarea
            label="About"
            value={form.about}
            onChange={set('about')}
            rows={4}
            placeholder="A paragraph about who you are and what you rent."
            wrapperClassName="sm:col-span-2"
          />
          <Input label="Contact phone" value={form.contact_phone} onChange={set('contact_phone')} />
          <Input
            label="WhatsApp number"
            value={form.whatsapp_phone}
            onChange={set('whatsapp_phone')}
            hint="Where booking enquiries land."
          />
          <Input
            label="Contact email"
            type="email"
            value={form.contact_email}
            onChange={set('contact_email')}
            wrapperClassName="sm:col-span-2"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" isLoading={saving}>
            Save business details
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
