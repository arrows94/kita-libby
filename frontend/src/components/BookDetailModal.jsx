import React from 'react';
import { COLOR_PRESETS } from '../constants.js';

export function BookDetailModal({ selectedBook, closeBook, openLookup }) {
  if (!selectedBook) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="book-title" onClick={closeBook}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 id="book-title" style={{ margin: 0 }}>{selectedBook.title}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => openLookup(selectedBook)}>
              Metadaten finden
            </button>
            <button className="btn" onClick={closeBook} aria-label="Schließen">
              Schließen
            </button>
          </div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start', gap: 16, marginTop: 12 }}>
          {selectedBook.cover ? (
            <img
              src={selectedBook.cover}
              alt="Cover"
              style={{
                width: 160,
                height: 220,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid #e5e7eb'
              }}
            />
          ) : (
            <div
              style={{
                width: 160,
                height: 220,
                background: '#f1f5f9',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                color: '#9ca3af'
              }}
            >
              Kein Cover
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
              {(selectedBook.authors || []).join(', ') || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0' }}>
              ISBN: {selectedBook.isbn || '—'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
              {(selectedBook.categories || []).map((c, i) => (
                <span key={i} className="chip">
                  {c}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[selectedBook.color1, selectedBook.color2, selectedBook.color3]
                .filter(Boolean)
                .map((ck, i) => {
                  const c = COLOR_PRESETS.find((x) => x.key === ck);
                  return (
                    <span
                      key={i}
                      className="badge"
                      style={{
                        background: c?.hex || '#fff',
                        color: ck === 'white' ? '#111' : '#fff',
                        borderColor: c?.border || 'transparent'
                      }}
                    >
                      <span
                        className="tag-dot"
                        style={{
                          background: c?.hex || '#fff',
                          border: ck === 'white' ? '1px solid #d1d5db' : 'none'
                        }}
                      />
                      {c?.name || ck}
                    </span>
                  );
                })}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {selectedBook.description || 'Keine Beschreibung vorhanden.'}
        </div>
      </div>
    </div>
  );
}
