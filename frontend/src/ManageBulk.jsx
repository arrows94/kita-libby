import React from 'react';
import { ChipsInput } from './chips.jsx';
import { api } from './api.js';
import toast from 'react-hot-toast';

export default function ManageBulk({ books, token, refresh }) {
  const [query, setQuery] = React.useState('');
  const [selectMode, setSelectMode] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [sourceTags, setSourceTags] = React.useState([]);
  const [targetTags, setTargetTags] = React.useState([]);
  const [mode, setMode] = React.useState('replace'); // replace | add | remove | set

  // Alle Kategorien (für Autocomplete)
  const allCategories = React.useMemo(() => {
    const s = new Set();
    books.forEach(b => (b.categories || []).forEach(c => c && s.add(c)));
    return [...s].sort((a,b)=>a.localeCompare(b));
  }, [books]);

  // Suche
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter(b => {
      const hay = [b.title, (b.authors||[]).join(' '), (b.categories||[]).join(' '), b.description].filter(Boolean).join(' ').toLowerCase();
      return q ? hay.includes(q) : true;
    });
  }, [books, query]);

  // Betroffene Menge
  const affected = React.useMemo(() => {
    if (selectMode) {
      return filtered.filter(b => selectedIds.has(b.id));
    }
    if (sourceTags.length === 0) return [];
    return filtered.filter(b => (b.categories||[]).some(c => sourceTags.includes(c)));
  }, [filtered, selectMode, selectedIds, sourceTags]);

  // Auswahl-Helpers
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map(b => b.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const seedFromAffected = () => {
    // Wechselt aus dem Tag-Regelmodus in den Auswahlmodus und markiert die aktuell betroffenen Bücher
    setSelectMode(true);
    setSelectedIds(new Set(affected.map(b => b.id)));
  };

  // Anwenden
  async function apply(){
    if(!affected.length){ toast.error('Keine Bücher ausgewählt.'); return; }
    const ids = affected.map(b => b.id);
    try {
      if (mode === 'set') {
        await api.bulkCategories(ids, { set: targetTags }, token);
      } else if (mode === 'add') {
        await api.bulkCategories(ids, { add: targetTags }, token);
      } else if (mode === 'remove') {
        const toRemove = (sourceTags.length ? sourceTags : targetTags);
        if(!toRemove.length){ toast.error('Bitte Quelle(n) oder Ziel(e) zum Entfernen wählen.'); return; }
        await api.bulkCategories(ids, { remove: toRemove }, token);
      } else { // replace / merge
        if(!sourceTags.length || !targetTags.length){ toast.error('Für „Ersetzen/ Zusammenführen“ bitte Quelle(n) und Ziel(e) setzen.'); return; }
        await api.bulkCategories(ids, { remove: sourceTags, add: targetTags }, token);
      }
      await refresh();
      toast.success(`Fertig: ${ids.length} Bücher aktualisiert.`);
    } catch (e) {
      console.error(e);
      toast.error('Umsortieren fehlgeschlagen.');
    }
  }

  return (
    <div className="card" style={{padding:16}}>
      <h3 style={{marginBottom:12}}>Umsortieren</h3>

      {/* 1) Auswahl / Scope */}
      <div className="row" style={{gap:12, alignItems:'center', flexWrap:'wrap'}}>
        <input className="input" placeholder="Suche in Titeln/Autor*innen/Tags…" value={query} onChange={e=>setQuery(e.target.value)} />
        <label className="row" style={{gap:8}}>
          <input type="radio" name="scope" checked={selectMode} onChange={()=>setSelectMode(true)} />
          <span>Nur ausgewählte Bücher</span>
        </label>
        <label className="row" style={{gap:8}}>
          <input type="radio" name="scope" checked={!selectMode} onChange={()=>setSelectMode(false)} />
          <span>Alle Bücher mit Quelle(n)</span>
        </label>
        {selectMode && (
          <div className="row" style={{gap:8, marginLeft:'auto'}}>
            <button className="btn" onClick={selectAllFiltered}>Alle (gefilterten) auswählen</button>
            <button className="btn" onClick={clearSelection}>Auswahl leeren</button>
          </div>
        )}
      </div>

      {!selectMode && (
        <div className="row" style={{gap:8, marginTop:8, flexWrap:'wrap'}}>
          <span style={{fontSize:12, color:'var(--muted)'}}>
            Betroffene Bücher = alle gefilterten Bücher, die mindestens einen der Quelle(n) enthalten.
          </span>
          <button className="btn" onClick={seedFromAffected}>
            Feinkorrektur: Auswahl bearbeiten
          </button>
        </div>
      )}

      {/* 2) Aktion */}
      <div className="row" style={{gap:16, marginTop:16, flexWrap:'wrap'}}>
        <label className="row" style={{gap:8}}>
          <input type="radio" name="mode" checked={mode==='replace'} onChange={()=>setMode('replace')} />
          <span>Ersetzen / Zusammenführen</span>
        </label>
        <label className="row" style={{gap:8}}>
          <input type="radio" name="mode" checked={mode==='add'} onChange={()=>setMode('add')} />
          <span>Hinzufügen</span>
        </label>
        <label className="row" style={{gap:8}}>
          <input type="radio" name="mode" checked={mode==='remove'} onChange={()=>setMode('remove')} />
          <span>Entfernen</span>
        </label>
        <label className="row" style={{gap:8}}>
          <input type="radio" name="mode" checked={mode==='set'} onChange={()=>setMode('set')} />
          <span>Setzen (überschreibt)</span>
        </label>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
        <div>
          <label>Quelle(n)</label>
          <ChipsInput values={sourceTags} onChange={setSourceTags} suggestions={allCategories} />
          <div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>
            Bei „Ersetzen/Entfernen“ relevant. Für „Hinzufügen/Setzen“ optional.
          </div>
        </div>
        <div>
          <label>Ziel(e)</label>
          <ChipsInput values={targetTags} onChange={setTargetTags} suggestions={allCategories} />
          <div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>
            Bei „Ersetzen/Hinzufügen/Setzen“ relevant. Bei „Entfernen“ optional.
          </div>
        </div>
      </div>

      {/* 3) Gefilterte Bücher + Checkboxen */}
      <div className="card" style={{marginTop:16}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <strong>Gefilterte Bücher ({filtered.length})</strong>
          <span style={{fontSize:12, color:'var(--muted)'}}>
            {selectMode ? <>Ausgewählt: {selectedIds.size}</> : <>Betroffen: {affected.length}</>}
          </span>
        </div>

        <div style={{maxHeight:'50vh', overflow:'auto', marginTop:8}}>
          {filtered.map(b => {
            const checked = selectMode ? selectedIds.has(b.id) : affected.some(x => x.id === b.id);
            return (
              <label
                key={b.id}
                className="row item"
                style={{gap:10, padding:'6px 4px', borderBottom:'1px solid var(--border)', cursor:'pointer'}}
                title={b.title}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!selectMode}                 // nur im Auswahlmodus editierbar
                  onChange={(e)=>{ e.stopPropagation(); toggleSelect(b.id); }}
                  aria-label={`Buch ${checked?'abwählen':'auswählen'}: ${b.title}`}
                />
                <div style={{width:28, height:40, background:'#f1f5f9', border:'1px solid #e5e7eb', borderRadius:4, overflow:'hidden'}}>
                  {b.cover ? <img src={b.cover} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="truncate" style={{fontSize:13, fontWeight:600}}>{b.title}</div>
                  <div className="truncate" style={{fontSize:12, color:'var(--muted)'}}>{(b.authors||[]).join(', ')}</div>
                  <div className="truncate" style={{fontSize:11, color:'var(--muted)'}}>{(b.categories||[]).join(' · ')}</div>
                </div>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <div style={{color:'var(--muted)', fontSize:13, padding:'8px 4px'}}>Keine Treffer.</div>
          )}
        </div>
      </div>

      {/* 4) Anwenden */}
      <div className="row sticky-actions" style={{marginTop:16}}>
        <div style={{fontSize:12, color:'var(--muted)'}}>
          Betroffen: <b>{affected.length}</b> Bücher
          {sourceTags.length ? <> · Quelle(n): {sourceTags.join(', ')}</> : null}
        </div>
        <div style={{flex:1}} />
        <button
          className="btn primary"
          onClick={apply}
          disabled={
            (mode==='replace' && (!sourceTags.length || !targetTags.length)) ||
            (mode==='add' && !targetTags.length) ||
            (mode==='remove' && !sourceTags.length && !targetTags.length) ||
            (mode==='set' && !targetTags.length) ||
            affected.length===0
          }
        >
          Anwenden
        </button>
      </div>
    </div>
  );
}
