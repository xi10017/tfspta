import { normalizeEntryName } from './static-entry-supersede.js';
import { getTargetFieldForType } from './submission-workflow.js';

export function findPublishedIdForPending(published, submission, contentType) {
  const targetField = getTargetFieldForType(contentType);
  const explicitTarget = targetField ? submission[targetField] : null;
  if (explicitTarget) {
    return explicitTarget;
  }

  const payload = submission.payload || {};
  const normalized = normalizeEntryName(payload.name);
  if (!normalized) {
    return null;
  }

  for (const item of published) {
    if (contentType === 'competition') {
      if (normalizeEntryName(item.name) === normalized) {
        return item.id;
      }
      continue;
    }

    if (contentType === 'club' && normalizeEntryName(item.name) === normalized) {
      return item.id;
    }
  }

  return null;
}

export function repartitionPendingForLive(pending, published, contentType) {
  const changeByTarget = new Map();
  const pendingCreates = [];

  for (const submission of pending) {
    const targetId = findPublishedIdForPending(published, submission, contentType);
    if (targetId) {
      if (!changeByTarget.has(targetId)) {
        changeByTarget.set(targetId, submission);
      }
      continue;
    }
    pendingCreates.push(submission);
  }

  return { changeByTarget, pendingCreates };
}
