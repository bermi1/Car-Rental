import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button, Icon, type IconName } from '@rental/shared';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { useTheme } from '../context/ThemeContext';
import { Splash } from '../components/Splash';
import { Logo } from '../components/Logo';

interface Feature {
  icon: IconName;
  title: string;
  body: string;
}

const FEATURES_EN: Feature[] = [
  {
    icon: 'car',
    title: 'One fleet, one record',
    body: 'Every vehicle, booking, client and payment in one place — no more spreadsheets passed around on WhatsApp.',
  },
  {
    icon: 'clipboard',
    title: 'Handover you can prove',
    body: 'A walkaround video and photos at pickup and return, stored against the booking. Damage claims stop being an argument.',
  },
  {
    icon: 'activity',
    title: 'Know where your cars are',
    body: "While a rental is active, the client's phone reports its position — with their permission, and only for that rental.",
  },
  {
    icon: 'wallet',
    title: 'Payments with a paper trail',
    body: 'Clients pay by mobile money or bank transfer and upload the receipt. Your staff confirm it. Nothing is taken on trust.',
  },
  {
    icon: 'alert',
    title: 'Damages priced consistently',
    body: 'Describe what came back wrong and get an itemised assessment against your own penalty rates, ready to review.',
  },
  {
    icon: 'search',
    title: 'Ask instead of filtering',
    body: '"How many cars are out right now?" Ask in English or Kiswahili and get an answer from your own live figures.',
  },
];

const FEATURES_SW: Feature[] = [
  {
    icon: 'car',
    title: 'Magari yote, kumbukumbu moja',
    body: 'Kila gari, ukodishaji, mteja na malipo mahali pamoja — hakuna tena majedwali yanayozunguka kwenye WhatsApp.',
  },
  {
    icon: 'clipboard',
    title: 'Ukabidhi wenye ushahidi',
    body: 'Video na picha wakati wa kukabidhi na kurudisha, zimehifadhiwa. Madai ya uharibifu hayabishaniwi tena.',
  },
  {
    icon: 'activity',
    title: 'Jua magari yako yalipo',
    body: 'Wakati ukodishaji unaendelea, simu ya mteja huripoti eneo — kwa ruhusa yake, na kwa ukodishaji huo tu.',
  },
  {
    icon: 'wallet',
    title: 'Malipo yenye kumbukumbu',
    body: 'Wateja hulipa kwa simu au benki na kupakia risiti. Wafanyakazi wako huthibitisha. Hakuna kinachoaminika bila ushahidi.',
  },
  {
    icon: 'alert',
    title: 'Faini zinazolingana',
    body: 'Eleza kilichoharibika na upate orodha ya faini kulingana na viwango vyako, tayari kwa kupitiwa.',
  },
  {
    icon: 'search',
    title: 'Uliza badala ya kuchuja',
    body: '"Ni magari mangapi yapo safarini?" Uliza kwa Kiswahili au Kiingereza na upate jibu kutoka takwimu zako halisi.',
  },
];

function Brand() {
  return <Logo size={38} />;
}

export function Landing() {
  const { user, loading, homePath } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { theme, toggle } = useTheme();

  // Don't flash the marketing page at someone who is already signed in.
  if (loading) return <Splash />;
  if (user) return <Navigate to={homePath} replace />;

  const features = language === 'sw' ? FEATURES_SW : FEATURES_EN;
  const sw = language === 'sw';

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-surface-sunken p-0.5">
              {(['en', 'sw'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  aria-label={code === 'en' ? 'English' : 'Kiswahili'}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition-all ${
                    language === code ? 'bg-surface text-fg shadow-xs' : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
            <Link to="/login" className="hidden sm:block">
              <Button size="sm">{t('login.submit')}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[820px] max-w-[140vw] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {sw ? 'Kwa kampuni za kukodisha magari Tanzania' : 'Built for Tanzanian car rental companies'}
          </span>

          <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-[-0.025em] text-fg sm:text-5xl">
            {sw ? (
              <>
                Endesha biashara yako ya magari
                <br className="hidden sm:block" /> bila majedwali
              </>
            ) : (
              <>
                Run your rental business
                <br className="hidden sm:block" /> without the spreadsheets
              </>
            )}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
            {sw
              ? 'Magari, ukodishaji, nyaraka, malipo na faini — vyote mahali pamoja, kwa Kiswahili au Kiingereza, kwenye simu au kompyuta.'
              : 'Fleet, bookings, documents, payments and penalties — in one place, in English or Kiswahili, on your phone or your desk.'}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto" iconRight="chevronRight">
                {sw ? 'Ingia kwenye mfumo' : 'Sign in to the console'}
              </Button>
            </Link>
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {sw ? 'Fungua akaunti ya mteja' : 'Create a customer account'}
              </Button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                {sw ? 'Ona inavyofanya kazi' : 'See how it works'}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-softFg">
                <Icon name={f.icon} size={18} />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-fg">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-line bg-surface-sunken/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="text-center text-2xl font-semibold tracking-[-0.02em] text-fg">
            {sw ? 'Kwa kila mtu kwenye biashara' : 'One system, three kinds of user'}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                icon: 'shield' as IconName,
                role: sw ? 'Mmiliki wa mfumo' : 'Platform owner',
                body: sw
                  ? 'Sajili kampuni nyingi, badilisha kati yao, na uone kila moja ikiwa peke yake.'
                  : 'Register multiple companies, switch between them, and see each one in isolation.',
              },
              {
                icon: 'dashboard' as IconName,
                role: sw ? 'Msimamizi wa kampuni' : 'Company admin',
                body: sw
                  ? 'Magari, bei, wafanyakazi, ripoti na mipangilio ya kampuni yako pekee.'
                  : 'Your own fleet, pricing, staff, reports and settings — and nobody else’s.',
              },
              {
                icon: 'clipboard' as IconName,
                role: sw ? 'Mfanyakazi' : 'Staff on the desk',
                body: sw
                  ? 'Kukabidhi na kurudisha, kuthibitisha nyaraka na malipo, kurekodi uharibifu.'
                  : 'Handovers and returns, verifying documents and payments, recording damage.',
              },
            ].map((r) => (
              <div key={r.role} className="rounded-xl border border-line bg-surface p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-fg-muted">
                  <Icon name={r.icon} size={18} />
                </span>
                <h3 className="mt-3.5 text-sm font-semibold text-fg">{r.role}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Brand />
          <p className="text-xs text-fg-subtle">
            © {new Date().getFullYear()} Bermi Rentals System ·{' '}
            {sw ? 'Dar es Salaam, Tanzania' : 'Dar es Salaam, Tanzania'}
          </p>
          <Link to="/login">
            <Button size="sm" variant="outline">
              {t('login.submit')}
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
