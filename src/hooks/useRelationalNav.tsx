import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type EntityType = 'patient' | 'invoice' | 'case' | 'plan' | 'workorder' | 'remark';

interface PreviewState {
  isOpen: boolean;
  entityType: EntityType | null;
  entityId: string | null;
}

interface RelationalNavContextType {
  openPreview: (entityType: EntityType, entityId: string) => void;
  closePreview: () => void;
  navigateTo: (entityType: EntityType, entityId: string) => void;
  previewState: PreviewState;
  historyStack: { entityType: EntityType; entityId: string }[];
  goBack: () => void;
}

const RelationalNavContext = createContext<RelationalNavContextType | null>(null);

export function RelationalNavProvider({ children }: { children: ReactNode }) {
  const [previewState, setPreviewState] = useState<PreviewState>({ isOpen: false, entityType: null, entityId: null });
  const [historyStack, setHistoryStack] = useState<{ entityType: EntityType; entityId: string }[]>([]);

  const openPreview = useCallback((entityType: EntityType, entityId: string) => {
    setPreviewState(prev => {
      if (prev.isOpen && prev.entityType && prev.entityId) {
        setHistoryStack(s => [...s, { entityType: prev.entityType!, entityId: prev.entityId! }]);
      }
      return { isOpen: true, entityType, entityId };
    });
  }, []);

  const closePreview = useCallback(() => {
    setPreviewState({ isOpen: false, entityType: null, entityId: null });
    setHistoryStack([]);
  }, []);

  const goBack = useCallback(() => {
    setHistoryStack(s => {
      if (s.length === 0) return s;
      const prev = s[s.length - 1];
      setPreviewState({ isOpen: true, entityType: prev.entityType, entityId: prev.entityId });
      return s.slice(0, -1);
    });
  }, []);

  const navigateTo = useCallback((_entityType: EntityType, _entityId: string) => {
    closePreview();
    // Navigation is handled by the caller via react-router
  }, [closePreview]);

  return (
    <RelationalNavContext.Provider value={{ openPreview, closePreview, navigateTo, previewState, historyStack, goBack }}>
      {children}
    </RelationalNavContext.Provider>
  );
}

export function useRelationalNav() {
  const ctx = useContext(RelationalNavContext);
  if (!ctx) throw new Error('useRelationalNav must be used within RelationalNavProvider');
  return ctx;
}
