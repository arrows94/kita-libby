import React, { useState } from 'react';
import { ChipsInput } from '../chips.jsx';
import { COLOR_PRESETS } from '../constants.js';
import { api } from '../api.js';

export function AdminForm({
  saveBook,
  id,
  isbn, setIsbn,
  lookupISBN, loadingIsbn,
  title, setTitle,
  authors, setAuthors,
  categories, setCategories, allCategories,
  cover, setCover,
  description, setDescription,
  color1, setColor1,
  color2, setColor2,
  color3, setColor3,
  resetForm
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.uploadCover(file, token);
      setCover(res.url);
    } catch (err) {
      alert('Fehler beim Upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="card">
      <h2>{id ? 'Buch bearbeiten' : 'Buch anlegen'}</h2>
      <form className="grid" style={{ gridTemplateColumns: '1fr 1fr' }} onSubmit={saveBook}>
        <div className="row" style={{ gridColumn: '1 / -1', alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <label>ISBN</label>
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9Xx\\- ]*"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="z. B. 978-3-16-148410-0"
            />
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={lookupISBN}
            disabled={loadingIsbn}
          >
            {loadingIsbn ? 'Suche…' : 'ISBN nachschlagen'}
          </button>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label>Titel*</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label>Autor*innen (durch Komma getrennt)</label>
          <input className="input" value={authors} onChange={(e) => setAuthors(e.target.value)} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label>Kategorien</label>
          <ChipsInput values={categories} onChange={setCategories} suggestions={allCategories} />
        </div>

        <div>
          <label>Cover (URL oder Upload)</label>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <input
              className="input"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://… oder /api/covers/…"
            />
            <input
              type="file"
              accept=".jpg,.png,.webp,.jpeg"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ fontSize: '13px' }}
            />
            {uploading && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Lädt hoch…</span>}
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label>Beschreibung</label>
          <textarea
            className="input"
            rows="5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label>Farb-Tag 1</label>
          <select value={color1} onChange={(e) => setColor1(e.target.value)}>
            <option value="">—</option>
            {COLOR_PRESETS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Farb-Tag 2 (darf gleich wie 1 sein)</label>
          <select value={color2} onChange={(e) => setColor2(e.target.value)}>
            <option value="">—</option>
            {COLOR_PRESETS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Farb-Tag 3</label>
          <select value={color3} onChange={(e) => setColor3(e.target.value)}>
            <option value="">—</option>
            {COLOR_PRESETS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row sticky-actions" style={{ gridColumn: '1 / -1' }}>
          <button className="btn primary" type="submit">
            {id ? 'Änderungen speichern' : 'Buch hinzufügen'}
          </button>
          {id && (
            <button className="btn" type="button" onClick={resetForm}>
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
