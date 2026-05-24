import { COMPETITION_CATEGORIES, categoryToId } from './entry-render.js';

function detailValue(article, label) {
  const rows = article.querySelectorAll('.entry-details > div');
  for (const row of rows) {
    const dt = row.querySelector('dt');
    if (dt?.textContent.trim() === label) {
      return row.querySelector('dd')?.textContent.trim() || '';
    }
  }

  return '';
}

export function competitionCategoryFromArticle(article) {
  const section = article.closest('.competition-category');
  if (!section) {
    return 'MISC';
  }

  for (const category of COMPETITION_CATEGORIES) {
    if (categoryToId(category) === section.id) {
      return category;
    }
  }

  return section.querySelector('.school-tier-title')?.textContent.trim() || 'MISC';
}

export function competitionPayloadFromArticle(article) {
  const staticEntryId = article.id || '';

  return {
    category: competitionCategoryFromArticle(article),
    name: article.querySelector('h4')?.textContent.trim() || '',
    description: article.querySelector('.entry-description')?.textContent.trim() || '',
    format: detailValue(article, 'Format'),
    contact: detailValue(article, 'Coach / contact'),
    eligibility: detailValue(article, 'Eligibility'),
    period: detailValue(article, 'Season'),
    level: article.querySelector('.entry-level')?.textContent.trim() || '',
    link: article.querySelector('.entry-link')?.getAttribute('href') || '',
    ...(staticEntryId ? { static_entry_id: staticEntryId } : {}),
  };
}

export function clubPayloadFromArticle(article) {
  const staticEntryId = article.id || '';

  return {
    school: article.querySelector('.info-tag')?.textContent.trim() || '',
    name: article.querySelector('h4')?.textContent.trim() || '',
    description: article.querySelector('.entry-description')?.textContent.trim() || '',
    contact: detailValue(article, 'Contact'),
    eligibility: detailValue(article, 'Eligibility'),
    period: detailValue(article, 'Schedule'),
    notes: article.querySelector('.entry-notes')?.textContent.trim() || '',
    link: article.querySelector('.entry-link')?.getAttribute('href') || '',
    ...(staticEntryId ? { static_entry_id: staticEntryId } : {}),
  };
}
