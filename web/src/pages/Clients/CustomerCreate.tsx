import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@rental/shared';
import { api, ApiError } from '../../api/client';
import { BackLink } from '../../components/BackLink';
import { ErrorNotice } from '../../components/ErrorNotice';

/**
 * Registering a customer at the desk.
 *
 * Most people walk in rather than arriving through the app, and staff need to
 * capture them properly the first time: full details, and the documents in
 * hand photographed there and then. The account created here is a real one —
 * the same phone number signs in later and sees this rental.
 */

const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: "Driver's licence" },
  { value: 'passport', label: 'Passport' },
  { value: 'other', label: 'Other document' },
];

interface Attachment {
  file: File;
  documentType: string;
}

interface CreatedResponse {
  client: { id: string; full_name: string; phone: string };
  temporary_password?: string;
}

export function CustomerCreate() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    id_type: 'national_id',
    id_number: '',
    address: '',
    date_of_birth: '',
    licence_number: '',
    licence_expiry: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedResponse | null>(null);
  const [uploadWarning, setUploadWarning] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function addFiles(files: FileList | null) {
    if (!files) return;
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ file, documentType: 'national_id' })),
    ]);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? undefined : v])
      );
      const result = await api.post<CreatedResponse>('/clients', payload);

      // The customer exists from here on. A document that fails to upload is
      // worth saying out loud, but it must not read as "registration failed".
      const failed: string[] = [];
      for (const attachment of attachments) {
        const body = new FormData();
        body.append('file', attachment.file);
        body.append('client_id', result.client.id);
        body.append('document_type', attachment.documentType);
        try {
          await api.post('/documents', body);
        } catch {
          failed.push(attachment.file.name);
        }
      }
      if (failed.length) {
        setUploadWarning(
          `${result.client.full_name} was registered, but these files did not upload: ${failed.join(', ')}. Attach them again from their profile.`
        );
      }
      setCreated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register this customer.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <>
        <PageHeader
          back={<BackLink to="/clients">Customers</BackLink>}
          title="Customer registered"
          description={`${created.client.full_name} · ${created.client.phone}`}
        />
        <Card className="max-w-xl">
          {created.temporary_password ? (
            <>
              <CardHeader>
                <CardTitle>Hand over these sign-in details</CardTitle>
              </CardHeader>
              <CardDescription>
                This password is shown once and cannot be read again. Give it to the customer now — they sign in
                with their phone number and can change it afterwards.
              </CardDescription>
              <dl className="mt-4 space-y-3 rounded-lg border border-line bg-surface-sunken/50 px-4 py-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Phone</dt>
                  <dd className="mt-0.5 font-mono text-sm text-fg">{created.client.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Temporary password</dt>
                  <dd className="mt-0.5 font-mono text-base font-semibold text-fg">{created.temporary_password}</dd>
                </div>
              </dl>
            </>
          ) : (
            <CardDescription>
              They sign in with their phone number and the password you set.
            </CardDescription>
          )}

          {uploadWarning && (
            <p className="mt-4 rounded-lg bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning-fg">
              {uploadWarning}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button icon="calendar" onClick={() => navigate(`/bookings/new?client=${created.client.id}`)}>
              Book a car for them
            </Button>
            <Button variant="outline" onClick={() => navigate(`/clients/${created.client.id}`)}>
              Open their profile
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreated(null);
                setUploadWarning('');
                setAttachments([]);
                setForm({
                  full_name: '', phone: '', email: '', id_type: 'national_id', id_number: '',
                  address: '', date_of_birth: '', licence_number: '', licence_expiry: '',
                  emergency_contact_name: '', emergency_contact_phone: '', notes: '',
                });
              }}
            >
              Register another
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/clients">Customers</BackLink>}
        title="Register a customer"
        description="Capture a walk-in customer and their documents. They get an account they can sign in to."
      />

      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <ErrorNotice message={error} />

        <Card>
          <CardHeader>
            <CardTitle>Who they are</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" name="full_name" value={form.full_name} onChange={set('full_name')} required />
            <Input
              label="Phone number"
              name="phone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="0712 345 678"
              hint="They sign in with this number."
              required
            />
            <Input label="Email" name="email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Date of birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            <Input label="Address" name="address" value={form.address} onChange={set('address')} wrapperClassName="sm:col-span-2" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="ID type" name="id_type" value={form.id_type} onChange={set('id_type')}>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driver's licence</option>
              <option value="voter_id">Voter ID</option>
            </Select>
            <Input label="ID number" name="id_number" value={form.id_number} onChange={set('id_number')} />
            <Input label="Driving licence number" name="licence_number" value={form.licence_number} onChange={set('licence_number')} />
            <Input
              label="Licence expiry"
              name="licence_expiry"
              type="date"
              value={form.licence_expiry}
              onChange={set('licence_expiry')}
              hint="An expired licence should not be handed a car."
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Photograph or upload what they hand over at the desk.</CardDescription>
          </CardHeader>

          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            aria-label="Attach documents"
          />
          <Button type="button" variant="outline" icon="upload" onClick={() => fileInput.current?.click()}>
            Attach a document
          </Button>

          {attachments.length > 0 && (
            <ul className="mt-4 space-y-2">
              {attachments.map((attachment, i) => (
                <li
                  key={`${attachment.file.name}-${i}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5"
                >
                  <Icon name="file" size={16} className="shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{attachment.file.name}</span>
                  <Select
                    aria-label={`Document type for ${attachment.file.name}`}
                    value={attachment.documentType}
                    onChange={(e) =>
                      setAttachments((current) =>
                        current.map((a, index) => (index === i ? { ...a, documentType: e.target.value } : a))
                      )
                    }
                    className="min-w-[10rem]"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    icon="x"
                    aria-label={`Remove ${attachment.file.name}`}
                    onClick={() => setAttachments((current) => current.filter((_, index) => index !== i))}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In case of trouble</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Emergency contact name"
              name="emergency_contact_name"
              value={form.emergency_contact_name}
              onChange={set('emergency_contact_name')}
            />
            <Input
              label="Emergency contact phone"
              name="emergency_contact_phone"
              value={form.emergency_contact_phone}
              onChange={set('emergency_contact_phone')}
            />
            <Textarea
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Anything the next person at the desk should know."
              wrapperClassName="sm:col-span-2"
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" icon="check" isLoading={busy}>
            Register customer
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/clients')}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
