export interface AssignmentSelection {
  primaryUserId: string | null;
  secondaryUserIds: string[];
}

export function mergeUserIds(...sources: Array<string | string[] | null | undefined>): string[] {
  const merged = new Set<string>();

  sources.forEach((source) => {
    if (!source) return;
    if (Array.isArray(source)) {
      source.forEach((value) => {
        if (typeof value === 'string' && value.trim()) merged.add(value);
      });
      return;
    }
    if (typeof source === 'string' && source.trim()) {
      merged.add(source);
    }
  });

  return Array.from(merged);
}

export function normalizeAssignmentSelection(primaryUserId: string | null, secondaryUserIds: string[]): AssignmentSelection {
  return {
    primaryUserId,
    secondaryUserIds: mergeUserIds(secondaryUserIds).filter((userId) => userId !== primaryUserId),
  };
}

export function parseAssignmentSelection(dynamicData?: Record<string, any> | null): AssignmentSelection {
  if (!dynamicData) {
    return { primaryUserId: null, secondaryUserIds: [] };
  }

  const primaryUserId = typeof dynamicData.primary_user_id === 'string' && dynamicData.primary_user_id.trim()
    ? dynamicData.primary_user_id
    : null;

  const secondaryUserIds = Array.isArray(dynamicData.secondary_user_ids)
    ? dynamicData.secondary_user_ids.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  return normalizeAssignmentSelection(primaryUserId, secondaryUserIds);
}