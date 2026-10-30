import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  isOffline?: boolean;
}

export function ErrorBanner({ message, onRetry, isOffline = false }: ErrorBannerProps) {
  return (
    <View style={[styles.container, isOffline && styles.offlineContainer]}>
      <Ionicons
        name={isOffline ? 'cloud-offline-outline' : 'alert-circle-outline'}
        size={22}
        color={isOffline ? '#E65100' : '#C62828'}
      />
      <View style={styles.content}>
        <Text style={[styles.message, isOffline && styles.offlineMessage]}>{message}</Text>
      </View>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineContainer: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFE0B2',
  },
  content: {
    flex: 1,
    marginHorizontal: 10,
  },
  message: {
    fontSize: 13,
    color: '#B71C1C',
    fontWeight: '500',
  },
  offlineMessage: {
    color: '#E65100',
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
});
