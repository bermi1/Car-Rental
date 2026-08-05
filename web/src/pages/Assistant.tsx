import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, EmptyState, Icon, PageHeader, Textarea, initials } from '@rental/shared';
import { api, ApiError } from '../api/client';
import { useI18n, useT } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { ErrorNotice } from '../components/ErrorNotice';

interface Exchange {
  question: string;
  answer: string;
}

const SUGGESTIONS_EN = [
  'How many vehicles are out on rental right now?',
  'Which payments are still waiting to be confirmed?',
  'How much have we charged in damage penalties?',
  'Which vehicles are close to needing a service?',
];

const SUGGESTIONS_SW = [
  'Ni magari mangapi yapo safarini sasa hivi?',
  'Ni malipo gani bado yanasubiri uthibitisho?',
  'Tumetoza kiasi gani cha faini za uharibifu?',
  'Ni magari gani yanakaribia kuhitaji matengenezo?',
];

export function Assistant() {
  const t = useT();
  const { language } = useI18n();
  const { user, company } = useAuth();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<{ enabled: boolean }>('/ai/status')
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setError('');
    setQuestion('');
    try {
      const res = await api.post<{ answer: string }>('/ai/ask', { question: q, language });
      setHistory((h) => [...h, { question: q, answer: res.answer }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not answer that question.');
    } finally {
      setBusy(false);
    }
  }

  if (enabled === false) {
    return (
      <>
        <PageHeader title={t('assistant.title')} description={t('assistant.description')} />
        <Card>
          <EmptyState icon="alert" title={t('assistant.disabled')} description={t('assistant.disabledHint')} />
        </Card>
      </>
    );
  }

  const suggestions = language === 'sw' ? SUGGESTIONS_SW : SUGGESTIONS_EN;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('assistant.title')}
        description={`${t('assistant.description')}${company ? ` — ${company.name}` : ''}`}
      />

      {history.length === 0 && !busy && (
        <Card className="mb-4">
          <p className="mb-3 text-[13px] font-medium text-fg">{t('assistant.suggestions')}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-lg border border-line bg-surface-sunken/60 px-3 py-2 text-left text-[13px] text-fg-muted transition-colors hover:border-accent hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {history.map((x, i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-end">
              <div className="flex max-w-[85%] items-start gap-2.5">
                <p className="rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-accent-fg">
                  {x.question}
                </p>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-fg-muted">
                  {initials(user?.name)}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-softFg">
                <Icon name="search" size={14} />
              </span>
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-fg">
                {x.answer}
              </p>
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-softFg">
              <Icon name="search" size={14} />
            </span>
            <span className="text-[13px] text-fg-muted">{t('assistant.thinking')}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ErrorNotice message={error} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="sticky bottom-4 mt-4"
      >
        <Card className="flex items-end gap-2 p-3">
          <Textarea
            rows={1}
            placeholder={t('assistant.placeholder')}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a newline — the convention people
              // already expect from every other chat box.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            wrapperClassName="flex-1"
            className="resize-none border-0 bg-transparent focus:ring-0"
          />
          <Button type="submit" icon="chevronRight" isLoading={busy} disabled={!question.trim()}>
            {t('assistant.ask')}
          </Button>
        </Card>
      </form>

      <p className="mt-3 text-center text-xs text-fg-subtle">
        Answers come from your own live figures. Check anything you'd act on.
      </p>
    </div>
  );
}
