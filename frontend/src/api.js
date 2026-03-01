const base = '/api';

export const api = {
  async login(password, role='admin'){
    const r = await fetch(`${base}/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ password, role })
    });
    if(!r.ok){
      const t = await r.text();
      throw new Error(t || 'login failed');
    }
    return r.json();
  },
  async getBooks(){
    const r = await fetch(`${base}/books`);
    if(!r.ok) throw new Error('fetch failed');
    return r.json();
  },
  async viewBook(id){
    const r = await fetch(`${base}/books/${id}/view`, { method:'POST' });
    return r.ok;
  },
  async getTop(limit=10){
    const r = await fetch(`${base}/stats/top?limit=${limit}`);
    if(!r.ok) return [];
    return r.json();
  },
  async createBook(book, token){
    const r = await fetch(`${base}/books`, {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
      body: JSON.stringify(book),
    });
    if(!r.ok) throw new Error('create failed');
    return r.json();
  },
  async updateBook(id, book, token){
    const r = await fetch(`${base}/books/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
      body: JSON.stringify(book),
    });
    if(!r.ok) throw new Error('update failed');
    return r.json();
  },
  async deleteBook(id, token){
    const r = await fetch(`${base}/books/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if(!r.ok) throw new Error('delete failed');
    return r.json();
  },
  async lookupISBN(isbn){
    const r = await fetch(`${base}/isbn/${encodeURIComponent(isbn)}`);
    if(!r.ok) throw new Error('not found');
    return r.json();
  },
  async exportCSV(){
    const r = await fetch(`${base}/export/csv`);
    if(!r.ok) throw new Error('export failed');
    return r.blob();
  },
  async importCSV(text, token){
    const r = await fetch(`${base}/import/csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv', 'Authorization': `Bearer ${token}` },
      body: text,
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t || 'import failed'); }
    return r.json();
  },
  // Saisonale Empfehlungen
  async getSeasonal(season){
    const q = season ? `?season=${encodeURIComponent(season)}` : '';
    const r = await fetch(`${base}/recommendations/seasonal${q}`);
    if(!r.ok) return { season:'', items:[] };
    return r.json();
  },
  // Kategorien-Meta
  async getCatMeta(){
    const r = await fetch(`${base}/categories/meta`);
    if(!r.ok) return [];
    return r.json();
  },
  async setCatColor(name, color){
    const r = await fetch(`${base}/categories/color`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization': `Bearer ${localStorage.getItem('token')||''}`},
      body: JSON.stringify({ name, color })
    });
    if(!r.ok) throw new Error('color failed');
    return r.json();
  },
  async renameCategory(from, to, token){
    const r = await fetch(`${base}/categories/rename`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization': `Bearer ${token}`},
      body: JSON.stringify({ from, to })
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t||'rename failed'); }
    return r.json();
  },
  // Empfehlungen-Settings
  async getRecSettings(){
    const r = await fetch(`${base}/settings/recommendations`);
    if(!r.ok) throw new Error('settings fetch failed');
    return r.json();
  },
  async saveRecSettings(payload, token){
    const r = await fetch(`${base}/settings/recommendations`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization': `Bearer ${token}`},
      body: JSON.stringify(payload)
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t||'settings save failed'); }
    return r.json();
  }
}

/** Bulk-Update: Farben setzen/leeren */
api.bulkUpdateColors = async function(ids, payload, token){
  const r = await fetch('/api/books/bulk/colors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ ids, ...payload })
  });
  if(!r.ok) throw new Error('Bulk-Update fehlgeschlagen');
  return r.json();
};

/** Reverse Lookup: per Titel suchen */
api.lookupByTitle = async function(q){
  const r = await fetch(`/api/search/title?q=${encodeURIComponent(q)}`);
  if(!r.ok) throw new Error('lookup failed');
  return r.json();
};

/** Metadaten auf Buch anwenden */
api.applyMetadata = async function(id, data, token){
  const r = await fetch(`/api/books/${encodeURIComponent(id)}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify(data)
  });
  if(!r.ok) throw new Error('update failed');
  return r.json();
};

/** Bulk-Enrichment fehlender Metadaten */
api.enrichMissing = async function(dry=true, token){
  const r = await fetch(`/api/enrich/missing?dry=${dry?1:0}`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
  if(!r.ok) throw new Error('enrich failed');
  return r.json();
};


/** Bulk-Update: Kategorien */
api.bulkCategories = async function(ids, payload, token){
  const r = await fetch('/api/books/bulk/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ ids, ...payload })
  });
  if(!r.ok){
    const t = await r.text();
    throw new Error(t || 'Bulk-Update Kategorien fehlgeschlagen');
  }
  return r.json();
};
