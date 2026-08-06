import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api/client';

/**
 * English and Kiswahili for the client app.
 *
 * Same shape as the console's catalogue: English is the source of truth and
 * the Kiswahili record is typed against it, so a missing translation is a
 * compile error rather than an English string leaking into a Swahili screen.
 */

const en = {
  'tab.home': 'Home',
  'tab.browse': 'Browse',
  'tab.bookings': 'Bookings',
  'tab.documents': 'Documents',
  'tab.contracts': 'Contracts',
  'tab.profile': 'Profile',

  'common.loading': 'Loading',
  'common.save': 'Save Changes',
  'common.cancel': 'Cancel',
  'common.upload': 'Upload',
  'common.reupload': 'Re-upload',
  'common.view': 'View',
  'common.days': 'days',
  'common.day': 'day',
  'common.close': 'Close',
  'common.notUploaded': 'Not uploaded yet',
  'common.somethingWrong': 'Something went wrong. Please try again.',

  'documents.title': 'Documents',
  'documents.subtitle':
    'Upload your ID and driving license — required before any booking can be confirmed.',
  'documents.idDocument': 'National ID / Passport',
  'documents.drivingLicense': 'Driving License',
  'documents.rejected': 'Rejected',
  'documents.verified': 'Verified',
  'documents.awaiting': 'Awaiting review',

  'booking.actionNeeded': 'Action needed',
  'booking.uploadPrompt':
    'Upload your ID and driving license from the Documents tab to move this booking forward.',
  'booking.contract': 'Contract',
  'booking.contractEmpty': 'Not generated yet',
  'booking.contractEmptyHint': 'Your rental contract will appear here once staff generates it.',
  'booking.handover': 'Handover Record',
  'booking.handoverEmpty': 'No handover record yet',
  'booking.handoverEmptyHint':
    'The photos and walkaround video taken at pickup and return appear here.',
  'booking.checkIn': 'Pickup',
  'booking.checkOut': 'Return',
  'booking.fuel': 'Fuel',
  'booking.mileage': 'Mileage',
  'booking.watchVideo': 'Watch walkaround video',
  'booking.cancel': 'Cancel Booking',
  'booking.crossRegion': 'Cross-region rental',

  'balance.title': 'Payment',
  'balance.quoted': 'Rental total',
  'balance.penalties': 'Penalties',
  'balance.paid': 'Confirmed paid',
  'balance.outstanding': 'Still to pay',
  'balance.settled': 'Fully paid — thank you.',

  'payments.title': 'Payments',
  'payments.record': "I've paid — upload receipt",
  'payments.empty': 'No payments recorded yet',
  'payments.amount': 'Amount paid',
  'payments.method': 'How you paid',
  'payments.reference': 'Reference / transaction ID',
  'payments.referenceHint': 'The confirmation code from your M-Pesa, Tigo Pesa or bank SMS',
  'payments.receipt': 'Receipt',
  'payments.attachReceipt': 'Attach receipt photo',
  'payments.receiptAttached': 'Receipt attached',
  'payments.submit': 'Submit for confirmation',
  'payments.submitted': 'Sent. Staff will confirm it shortly.',
  'payments.awaiting': 'Awaiting confirmation',
  'payments.confirmed': 'Confirmed',
  'payments.rejectedStatus': 'Rejected',
  'payments.needAmount': 'Enter the amount you paid.',
  'payments.mobileMoney': 'Mobile money',
  'payments.bankTransfer': 'Bank transfer',
  'payments.cash': 'Cash',
  'payments.noGateway':
    'There is no card payment in the app. Pay by mobile money, bank or cash, then upload the receipt here.',

  'location.title': 'Location Sharing',
  'location.body':
    'While this rental is active you can share the car’s position with the company, so they can reach you if you need help.',
  'location.enable': 'Share my location',
  'location.enabled': 'Sharing while this rental is active',
  'location.disabled': 'Not sharing',
  'location.denied': 'Location permission was declined. Enable it in your phone settings to share.',
  'location.lastSent': 'Last position sent',
  'location.onlyActive': 'Sharing stops automatically when the rental ends.',

  'profile.title': 'Profile',
  'profile.fullName': 'Full Name',
  'profile.phone': 'Phone',
  'profile.updated': 'Profile updated.',
  'profile.myDocuments': 'My Documents',
  'profile.myDevices': 'My Devices',
  'profile.logout': 'Log Out',
  'profile.language': 'Language',
};

export type TranslationKey = keyof typeof en;
type Catalogue = Record<TranslationKey, string>;

const sw: Catalogue = {
  'tab.home': 'Mwanzo',
  'tab.browse': 'Magari',
  'tab.bookings': 'Ukodishaji',
  'tab.documents': 'Nyaraka',
  'tab.contracts': 'Mikataba',
  'tab.profile': 'Wasifu',

  'common.loading': 'Inapakia',
  'common.save': 'Hifadhi Mabadiliko',
  'common.cancel': 'Ghairi',
  'common.upload': 'Pakia',
  'common.reupload': 'Pakia upya',
  'common.view': 'Angalia',
  'common.days': 'siku',
  'common.day': 'siku',
  'common.close': 'Funga',
  'common.notUploaded': 'Haijapakiwa bado',
  'common.somethingWrong': 'Kuna hitilafu. Tafadhali jaribu tena.',

  'documents.title': 'Nyaraka',
  'documents.subtitle':
    'Pakia kitambulisho chako na leseni ya udereva — vinahitajika kabla ukodishaji haujathibitishwa.',
  'documents.idDocument': 'Kitambulisho / Paspoti',
  'documents.drivingLicense': 'Leseni ya Udereva',
  'documents.rejected': 'Imekataliwa',
  'documents.verified': 'Imethibitishwa',
  'documents.awaiting': 'Inasubiri ukaguzi',

  'booking.actionNeeded': 'Hatua inahitajika',
  'booking.uploadPrompt':
    'Pakia kitambulisho chako na leseni kwenye kichupo cha Nyaraka ili ukodishaji uendelee.',
  'booking.contract': 'Mkataba',
  'booking.contractEmpty': 'Haujatengenezwa bado',
  'booking.contractEmptyHint': 'Mkataba wako utaonekana hapa mfanyakazi akiutengeneza.',
  'booking.handover': 'Kumbukumbu ya Ukabidhi',
  'booking.handoverEmpty': 'Hakuna kumbukumbu bado',
  'booking.handoverEmptyHint': 'Picha na video ya gari wakati wa kukabidhi na kurudisha zitaonekana hapa.',
  'booking.checkIn': 'Kuchukua',
  'booking.checkOut': 'Kurudisha',
  'booking.fuel': 'Mafuta',
  'booking.mileage': 'Kilomita',
  'booking.watchVideo': 'Tazama video ya gari',
  'booking.cancel': 'Ghairi Ukodishaji',
  'booking.crossRegion': 'Ukodishaji wa mikoa tofauti',

  'balance.title': 'Malipo',
  'balance.quoted': 'Jumla ya ukodishaji',
  'balance.penalties': 'Faini',
  'balance.paid': 'Yaliyothibitishwa',
  'balance.outstanding': 'Bado unadaiwa',
  'balance.settled': 'Umelipa yote — asante.',

  'payments.title': 'Malipo',
  'payments.record': 'Nimelipa — pakia risiti',
  'payments.empty': 'Hakuna malipo yaliyorekodiwa',
  'payments.amount': 'Kiasi ulicholipa',
  'payments.method': 'Ulilipaje',
  'payments.reference': 'Namba ya muamala',
  'payments.referenceHint': 'Namba ya uthibitisho kutoka SMS ya M-Pesa, Tigo Pesa au benki',
  'payments.receipt': 'Risiti',
  'payments.attachReceipt': 'Ambatisha picha ya risiti',
  'payments.receiptAttached': 'Risiti imeambatishwa',
  'payments.submit': 'Tuma kwa uthibitisho',
  'payments.submitted': 'Imetumwa. Wafanyakazi watathibitisha hivi karibuni.',
  'payments.awaiting': 'Inasubiri uthibitisho',
  'payments.confirmed': 'Imethibitishwa',
  'payments.rejectedStatus': 'Imekataliwa',
  'payments.needAmount': 'Weka kiasi ulicholipa.',
  'payments.mobileMoney': 'Simu (M-Pesa, Tigo Pesa)',
  'payments.bankTransfer': 'Benki',
  'payments.cash': 'Fedha taslimu',
  'payments.noGateway':
    'Hakuna malipo ya kadi kwenye programu. Lipa kwa simu, benki au taslimu, kisha pakia risiti hapa.',

  'location.title': 'Kushiriki Eneo',
  'location.body':
    'Wakati ukodishaji unaendelea unaweza kushiriki eneo la gari na kampuni, ili waweze kukufikia ukihitaji msaada.',
  'location.enable': 'Shiriki eneo langu',
  'location.enabled': 'Unashiriki wakati ukodishaji unaendelea',
  'location.disabled': 'Haushiriki',
  'location.denied': 'Ruhusa ya eneo imekataliwa. Iwashe kwenye mipangilio ya simu yako.',
  'location.lastSent': 'Eneo la mwisho lililotumwa',
  'location.onlyActive': 'Kushiriki kunasimama chenyewe ukodishaji ukiisha.',

  'profile.title': 'Wasifu',
  'profile.fullName': 'Jina Kamili',
  'profile.phone': 'Simu',
  'profile.updated': 'Wasifu umesasishwa.',
  'profile.myDocuments': 'Nyaraka Zangu',
  'profile.myDevices': 'Vifaa Vyangu',
  'profile.logout': 'Toka',
  'profile.language': 'Lugha',
};

export type Language = 'en' | 'sw';

const CATALOGUES: Record<Language, Catalogue> = { en, sw };
const STORAGE_KEY = 'rental_client_language';

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'sw') setLanguageState(stored);
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
    // Best effort — the choice is already applied locally, and a signed-out
    // user has nothing to save it against.
    api.put('/auth/me/language', { language: next }).catch(() => {});
  }, []);

  const t = useCallback((key: TranslationKey) => CATALOGUES[language][key], [language]);

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT() {
  return useI18n().t;
}
