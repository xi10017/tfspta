const SUPERSEDED_CLASS = 'static-superseded';
const LIVE_INJECTED_CLASS = 'live-injected';

export function normalizeEntryName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isSupersededStaticEntry(article) {
  return article?.classList.contains(SUPERSEDED_CLASS) || article?.hidden;
}

export function resetStaticEntryVisibility(root, articleSelector) {
  if (!root) {
    return;
  }

  root.querySelectorAll(`${articleSelector}:not(.${LIVE_INJECTED_CLASS})`).forEach((article) => {
    article.hidden = false;
    article.classList.remove(SUPERSEDED_CLASS);
  });
}

export function findStaticEntry(root, articleSelector, { staticEntryId, name, category, school, getCategoryFromArticle } = {}) {
  if (!root) {
    return null;
  }

  if (staticEntryId) {
    const byId = document.getElementById(staticEntryId);
    if (
      byId &&
      root.contains(byId) &&
      byId.matches(articleSelector) &&
      !byId.classList.contains(LIVE_INJECTED_CLASS) &&
      !isSupersededStaticEntry(byId)
    ) {
      return byId;
    }
  }

  const normalized = normalizeEntryName(name);
  if (!normalized) {
    return null;
  }

  for (const article of root.querySelectorAll(articleSelector)) {
    if (
      article.classList.contains(LIVE_INJECTED_CLASS) ||
      isSupersededStaticEntry(article)
    ) {
      continue;
    }

    const articleName = normalizeEntryName(article.querySelector('h4')?.textContent);
    if (articleName !== normalized) {
      continue;
    }

    if (category && getCategoryFromArticle && getCategoryFromArticle(article) !== category) {
      continue;
    }

    if (school !== undefined) {
      const articleSchool = article.querySelector('.info-tag')?.textContent.trim() || '';
      if (articleSchool !== (school || '')) {
        continue;
      }
    }

    return article;
  }

  return null;
}

export function hideStaticEntry(article) {
  if (!article) {
    return;
  }

  article.hidden = true;
  article.classList.add(SUPERSEDED_CLASS);
}

export function injectLiveEntry(listEl, html, { anchor } = {}) {
  const temp = document.createElement('div');
  temp.innerHTML = html.trim();
  const node = temp.firstElementChild;
  if (!node) {
    return null;
  }

  node.classList.add(LIVE_INJECTED_CLASS);

  if (anchor?.parentElement) {
    anchor.replaceWith(node);
  } else if (listEl) {
    listEl.appendChild(node);
  } else {
    return null;
  }

  return node;
}

export function competitionIdentityKey(item) {
  if (item.static_entry_id) {
    return `static:${item.static_entry_id}`;
  }
  return `${item.category || 'MISC'}|${normalizeEntryName(item.name)}`;
}

export function clubIdentityKey(item) {
  if (item.static_entry_id) {
    return `static:${item.static_entry_id}`;
  }
  return `${item.school || ''}|${normalizeEntryName(item.name)}`;
}

function dedupePublishedItems(items, getKey) {
  const byKey = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (!key) {
      continue;
    }
    const existing = byKey.get(key);
    if (!existing || new Date(item.published_at) > new Date(existing.published_at)) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort(
    (left, right) => new Date(right.published_at) - new Date(left.published_at),
  );
}

export function dedupePublishedCompetitions(items) {
  return dedupePublishedItems(items, competitionIdentityKey);
}

export function dedupePublishedClubs(items) {
  return dedupePublishedItems(items, clubIdentityKey);
}

export function suppressStaticEntriesForPublished(root, articleSelector, published, options = {}) {
  if (!root) {
    return;
  }

  for (const item of published) {
    const anchor = findStaticEntry(root, articleSelector, {
      staticEntryId: item.static_entry_id,
      name: item.name,
      category: item.category,
      school: item.school,
      getCategoryFromArticle: options.getCategoryFromArticle,
    });
    if (anchor) {
      hideStaticEntry(anchor);
    }
  }
}

function isMissingColumnError(error) {
  const message = String(error?.message || '');
  return message.includes('static_entry_id') && message.includes('does not exist');
}

export async function findPublishedRowForReplacement(supabase, contentType, { staticEntryId, name, category, school }) {
  if (!supabase) {
    return null;
  }

  const table =
    contentType === 'competition'
      ? 'published_competitions'
      : contentType === 'club'
        ? 'published_clubs'
        : null;
  if (!table) {
    return null;
  }

  if (staticEntryId) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('static_entry_id', staticEntryId)
      .maybeSingle();

    if (error && !isMissingColumnError(error)) {
      throw error;
    }
    if (data?.id) {
      return data;
    }
  }

  if (contentType === 'competition' && name) {
    const { data: rows, error } = await supabase
      .from(table)
      .select('id, name')
      .eq('category', category || 'MISC');

    if (error) {
      throw error;
    }

    const normalized = normalizeEntryName(name);
    const match = (rows || []).find((row) => normalizeEntryName(row.name) === normalized);
    if (match?.id) {
      return match;
    }
  }

  if (contentType === 'club' && name) {
    let query = supabase.from(table).select('id, name, school');
    if (school) {
      query = query.eq('school', school);
    }
    const { data: rows, error } = await query;
    if (error) {
      throw error;
    }

    const normalized = normalizeEntryName(name);
    const match = (rows || []).find((row) => normalizeEntryName(row.name) === normalized);
    if (match?.id) {
      return match;
    }
  }

  return null;
}

export async function findPublishedRowByStaticEntryId(supabase, contentType, staticEntryId, payload = {}) {
  return findPublishedRowForReplacement(supabase, contentType, {
    staticEntryId,
    name: payload.name,
    category: payload.category,
    school: payload.school,
  });
}
