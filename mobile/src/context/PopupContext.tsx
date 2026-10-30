import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { useTheme } from './ThemeContext';

export type PopupType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface PopupOptions {
  title: string;
  message: string;
  type?: PopupType;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface PopupContextType {
  showPopup: (options: PopupOptions) => void;
  showConfirm: (
    options: Omit<PopupOptions, 'type'> & { onConfirm: () => void | Promise<void> }
  ) => void;
  hidePopup: () => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export function PopupProvider({ children }: { children: ReactNode }) {
  const { colors, isDark } = useTheme();
  const [popup, setPopup] = useState<PopupOptions | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hidePopup = useCallback(() => {
    setIsOpen(false);
    setIsSubmitting(false);
    if (popup?.onCancel) {
      popup.onCancel();
    }
    setTimeout(() => {
      setPopup(null);
    }, 200);
  }, [popup]);

  const showPopup = useCallback((options: PopupOptions) => {
    setPopup({
      type: 'info',
      confirmText: 'Aceptar',
      ...options,
    });
    setIsOpen(true);
  }, []);

  const showConfirm = useCallback(
    (options: Omit<PopupOptions, 'type'> & { onConfirm: () => void | Promise<void> }) => {
      setPopup({
        type: 'confirm',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        ...options,
      });
      setIsOpen(true);
    },
    []
  );

  const handleConfirm = async () => {
    if (!popup?.onConfirm) {
      hidePopup();
      return;
    }

    const currentConfirm = popup;
    const confirmHandler = popup.onConfirm;
    try {
      setIsSubmitting(true);
      await confirmHandler();
      setPopup((latest) => {
        if (latest === currentConfirm) {
          setIsOpen(false);
          setTimeout(() => {
            setPopup((curr) => (curr === currentConfirm ? null : curr));
          }, 200);
        }
        return latest;
      });
    } catch {
      setPopup((latest) => {
        if (latest === currentConfirm) {
          setIsOpen(false);
          setTimeout(() => {
            setPopup((curr) => (curr === currentConfirm ? null : curr));
          }, 200);
        }
        return latest;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIconConfig = () => {
    const type = popup?.type || 'info';
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: '#4ADE80', bg: isDark ? '#13351C' : '#E8F5E9' };
      case 'error':
        return { name: 'alert-circle' as const, color: '#F87171', bg: isDark ? '#3B1515' : '#FFEBEE' };
      case 'warning':
        return { name: 'warning' as const, color: '#FBBF24', bg: isDark ? '#3B2D0A' : '#FFF3E0' };
      case 'confirm':
        return popup?.isDestructive
          ? { name: 'help-circle' as const, color: '#F87171', bg: isDark ? '#3B1515' : '#FFEBEE' }
          : { name: 'help-circle' as const, color: colors.primary, bg: colors.surfaceSecondary };
      case 'info':
      default:
        return { name: 'information-circle' as const, color: '#60A5FA', bg: isDark ? '#1E293B' : '#E3F2FD' };
    }
  };

  const isConfirmType = popup?.type === 'confirm' || !!popup?.cancelText;
  const iconConfig = getIconConfig();

  return (
    <PopupContext.Provider value={{ showPopup, showConfirm, hidePopup }}>
      {children}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={hidePopup}
      >
        <TouchableWithoutFeedback onPress={isConfirmType ? undefined : hidePopup}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.popupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                  <Ionicons name={iconConfig.name} size={30} color={iconConfig.color} />
                </View>

                <Text style={[styles.title, { color: colors.text }]}>{popup?.title}</Text>
                <Text style={[styles.message, { color: colors.textSecondary }]}>{popup?.message}</Text>

                <View style={styles.buttonContainer}>
                  {isConfirmType ? (
                    <>
                      <Button
                        title={popup?.cancelText || 'Cancelar'}
                        variant="outline"
                        size="medium"
                        onPress={hidePopup}
                        disabled={isSubmitting}
                        style={styles.cancelButton}
                      />
                      <Button
                        title={popup?.confirmText || 'Confirmar'}
                        variant={popup?.isDestructive ? 'danger' : 'primary'}
                        size="medium"
                        isLoading={isSubmitting}
                        onPress={handleConfirm}
                        style={styles.confirmButton}
                      />
                    </>
                  ) : (
                    <Button
                      title={popup?.confirmText || 'Entendido'}
                      variant={popup?.type === 'error' ? 'danger' : 'primary'}
                      size="medium"
                      onPress={handleConfirm}
                      style={styles.singleButton}
                    />
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup debe ser utilizado dentro de un PopupProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  popupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEBE9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2A1810',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5D4037',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
  singleButton: {
    width: '100%',
  },
});
