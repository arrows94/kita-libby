import React from 'react';
import { COLOR_PRESETS } from '../constants.js';

export function FilterPanel({
  catFilter,
  setCatFilter,
  allCategories,
  filterColors,
  setFilterColors
}) {
  return (
    <div className="filter-panel">
      <div className="filter-grid">
        {/* Kategorien */}
        <section>
          <div className="filter-head">
            <strong>Kategorien</strong>
            <div className="filter-actions">
              {catFilter.length > 0 && (
                <button className="btn" onClick={() => setCatFilter([])}>
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>

          {catFilter.length > 0 && (
            <div className="filter-active">
              {catFilter.map((c) => (
                <span key={c} className="chip">
                  {c}
                  <button
                    aria-label={`Kategorie ${c} entfernen`}
                    onClick={() => setCatFilter(catFilter.filter((x) => x !== c))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="filter-cats" role="listbox" aria-label="Kategorien wählen">
            {allCategories.map(
              (c) =>
                !catFilter.includes(c) && (
                  <button
                    type="button"
                    key={c}
                    className="badge"
                    role="option"
                    onClick={() => setCatFilter([...catFilter, c])}
                  >
                    {c}
                  </button>
                )
            )}
            {allCategories.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Noch keine Kategorien im Bestand.
              </div>
            )}
          </div>
        </section>

        {/* Farben */}
        <section>
          <div className="filter-head">
            <strong>Farben</strong>
            <div className="filter-actions">
              {filterColors.length > 0 && (
                <button className="btn" onClick={() => setFilterColors([])}>
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>
          <div className="filter-colors" role="group" aria-label="Farben filtern">
            {COLOR_PRESETS.map((c) => {
              const active = filterColors.includes(c.key);
              return (
                <button
                  type="button"
                  key={c.key}
                  className="badge"
                  aria-pressed={active}
                  onClick={() =>
                    setFilterColors((p) =>
                      active ? p.filter((x) => x !== c.key) : [...p, c.key]
                    )
                  }
                  title={c.name}
                  style={{
                    background: active ? c.hex || '#fff' : '#fff',
                    color: active ? (c.key === 'white' ? '#111' : '#fff') : 'inherit',
                    borderColor: c.border || 'transparent',
                  }}
                >
                  <span
                    className="tag-dot"
                    style={{
                      background: c.hex || '#fff',
                      border: c.key === 'white' ? '1px solid #d1d5db' : 'none',
                    }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
