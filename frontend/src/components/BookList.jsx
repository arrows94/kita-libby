import React from 'react';
import { COLOR_PRESETS } from '../constants.js';

export function BookList({
  filtered,
  kiosk,
  countView,
  openBook,
  selectMode,
  selectedIds,
  toggleSelect,
  token,
  startEdit,
  delBook,
  hasMore,
  loadMore
}) {
  return (
    <div className="container">
      <div
        className="book-grid"
        style={{
          marginTop: 12,
          gridTemplateColumns: kiosk ? 'repeat(auto-fill,minmax(220px,1fr))' : undefined
        }}
      >
        {filtered.map((b) => (
          <article
            key={b.id}
            className="card"
            role="button"
            tabIndex={0}
            onClick={() => {
              countView(b.id);
              openBook(b);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                countView(b.id);
                openBook(b);
              }
            }}
          >
            <div className="row">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(b.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(b.id);
                  }}
                  style={{ marginRight: 6 }}
                  aria-label={`Buch auswählen: ${b.title}`}
                />
              )}
              {b.cover ? (
                <img
                  loading="lazy"
                  src={b.cover}
                  sizes="(max-width: 768px) 40vw, 120px"
                  alt={`Cover von ${b.title}`}
                  style={{
                    width: 80,
                    height: 110,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 110,
                    background: '#f1f5f9',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#9ca3af',
                    fontSize: 12
                  }}
                >
                  Kein Cover
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600 }} title={b.title}>
                  {b.title}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 13, color: 'var(--muted)' }}
                  title={(b.authors || []).join(', ')}
                >
                  {(b.authors || []).join(', ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {(b.categories || []).join(' · ')}
                </div>
                <div
                  className="row"
                  style={{ marginTop: 6, flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}
                >
                  {[b.color1, b.color2, b.color3].filter(Boolean).map((ck, i) => {
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
            <p style={{ marginTop: 8, fontSize: 14, color: '#334155' }}>
              {(b.description || '').slice(0, 180)}
              {(b.description || '').length > 180 ? '…' : ''}
            </p>
            <div
              className="row wrap"
              style={{
                marginTop: 8,
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--muted)'
              }}
            >
              <span>ISBN: {b.isbn || '–'}</span>
              {!kiosk && token && (
                <div className="row wrap">
                  <button
                    className="btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(b);
                    }}
                  >
                    Bearbeiten
                  </button>
                  {localStorage.getItem('role') === 'admin' && (
                    <button
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        delBook(b.id);
                      }}
                      style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                    >
                      Löschen
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 32 }}>
          Keine Treffer.
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button className="btn primary" onClick={loadMore}>
            Mehr laden
          </button>
        </div>
      )}
    </div>
  );
}
