import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from './ui';
import { colors, fontSize, radius, spacing } from '../theme/tokens';
import { api, ApiError } from '../api/client';
import { useT } from '../i18n';
import type { PaymentMethod } from '../types';

const METHODS: { key: PaymentMethod; labelKey: 'payments.mobileMoney' | 'payments.bankTransfer' | 'payments.cash' }[] = [
  { key: 'mobile_money', labelKey: 'payments.mobileMoney' },
  { key: 'bank_transfer', labelKey: 'payments.bankTransfer' },
  { key: 'cash', labelKey: 'payments.cash' },
];

/**
 * Records a payment the client already made elsewhere.
 *
 * There is no gateway in this build: the client pays by mobile money, bank or
 * cash, then attaches the receipt here. It lands as awaiting_confirmation and
 * only counts once staff confirm it.
 */
export function PaymentSheet({
  open,
  onClose,
  bookingId,
  currency,
  suggestedAmount,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  currency: string;
  suggestedAmount: number;
  onRecorded: () => void;
}) {
  const t = useT();
  const [amount, setAmount] = useState(suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '');
  const [method, setMethod] = useState<PaymentMethod>('mobile_money');
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function pickReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    setReceipt(result.assets[0]);
  }

  async function submit() {
    if (!amount || Number(amount) <= 0) {
      setError(t('payments.needAmount'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('booking_id', bookingId);
      form.append('amount', amount);
      form.append('currency', currency);
      form.append('method', method);
      if (reference.trim()) form.append('reference', reference.trim());
      if (receipt) {
        form.append('receipt', {
          uri: receipt.uri,
          name: receipt.fileName || 'receipt.jpg',
          type: receipt.mimeType || 'image/jpeg',
        } as any);
      }
      await api.post('/payments', form);
      onRecorded();
      onClose();
      setReceipt(null);
      setReference('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}>
            <Text style={styles.title}>{t('payments.record')}</Text>
            <Text style={styles.hint}>{t('payments.noGateway')}</Text>

            <Input
              label={`${t('payments.amount')} (${currency})`}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              style={{ marginTop: spacing.md }}
            />

            <Text style={styles.label}>{t('payments.method')}</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => {
                const active = method === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMethod(m.key)}
                    style={[styles.methodChip, active && styles.methodChipActive]}
                  >
                    <Text style={[styles.methodText, active && styles.methodTextActive]}>{t(m.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Input
              label={t('payments.reference')}
              placeholder={t('payments.referenceHint')}
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              style={{ marginTop: spacing.md }}
            />

            <Button
              title={receipt ? t('payments.receiptAttached') : t('payments.attachReceipt')}
              variant="secondary"
              onPress={pickReceipt}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title={t('payments.submit')}
              onPress={submit}
              isLoading={saving}
              style={{ marginTop: spacing.md }}
            />
            <Button title={t('common.cancel')} variant="ghost" onPress={onClose} style={{ marginTop: spacing.xs }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,18,34,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
    marginTop: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.neutral[900] },
  hint: { fontSize: fontSize.xs, color: colors.neutral[500], marginTop: spacing.xs, lineHeight: 18 },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.neutral[700], marginBottom: spacing.xs },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  methodChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.white,
  },
  methodChipActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  methodText: { fontSize: fontSize.sm, color: colors.neutral[600] },
  methodTextActive: { color: colors.primary[700], fontWeight: '600' },
  error: { color: colors.status.cancelled.fg, fontSize: fontSize.sm, marginTop: spacing.sm },
});
