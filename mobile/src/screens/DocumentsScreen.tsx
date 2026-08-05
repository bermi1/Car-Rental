import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Spinner, StatusBadge } from '../components/ui';
import { colors, fontSize, spacing } from '../theme/tokens';
import { api, fileUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DocumentRecord } from '../types';

const DOCUMENT_TYPES: { key: string; label: string }[] = [
  { key: 'id_document', label: 'National ID / Passport' },
  { key: 'driving_license', label: "Driving License" },
];

export function DocumentsScreen() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const load = useCallback(() => {
    if (user) api.get<DocumentRecord[]>(`/documents/client/${user.id}`).then(setDocuments);
  }, [user]);

  useFocusEffect(load);

  async function handleUpload(documentType: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;

    setUploadingType(documentType);
    try {
      const asset = result.assets[0];
      const form = new FormData();
      form.append('document_type', documentType);
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName || `${documentType}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      } as any);
      await api.post('/documents', form);
      load();
    } finally {
      setUploadingType(null);
    }
  }

  const latestFor = (type: string) =>
    documents?.filter((d) => d.document_type === type).sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Documents</Text>
      <Text style={styles.subtitle}>Upload your ID and driving license — required before any booking can be confirmed.</Text>

      {!documents ? (
        <Spinner />
      ) : (
        DOCUMENT_TYPES.map((docType) => {
          const doc = latestFor(docType.key);
          return (
            <Card key={docType.key} style={{ marginTop: spacing.lg }}>
              <View style={styles.rowBetween}>
                <Text style={styles.docLabel}>{docType.label}</Text>
                {doc && <StatusBadge status={doc.verified ? 'confirmed' : 'pending_documents'} />}
              </View>
              {doc ? (
                <>
                  <Image source={{ uri: fileUrl(doc.file_path) }} style={styles.preview} />
                  {doc.rejection_reason && <Text style={styles.rejection}>Rejected: {doc.rejection_reason}</Text>}
                </>
              ) : (
                <Text style={styles.notUploaded}>Not uploaded yet</Text>
              )}
              <Button
                title={doc ? 'Re-upload' : 'Upload'}
                variant="secondary"
                onPress={() => handleUpload(docType.key)}
                isLoading={uploadingType === docType.key}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
  preview: { width: '100%', height: 140, borderRadius: 10, marginTop: spacing.sm },
  notUploaded: { fontSize: fontSize.sm, color: colors.neutral[400], marginTop: spacing.sm },
  rejection: { fontSize: fontSize.xs, color: colors.status.cancelled.fg, marginTop: spacing.xs },
});
