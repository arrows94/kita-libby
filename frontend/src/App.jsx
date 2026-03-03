import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import Login from './login.jsx';
import ManageBulk from './ManageBulk.jsx';
import { ChipsInput } from './chips.jsx';
import { COLOR_PRESETS } from './constants.js';
import { FilterPanel } from './components/FilterPanel.jsx';
import { BookDetailModal } from './components/BookDetailModal.jsx';
import { AdminForm } from './components/AdminForm.jsx';
import { BookList } from './components/BookList.jsx';
import toast from 'react-hot-toast';
import { confirmToast } from './confirmToast.jsx';

function CategoryManagerPanel({ catMeta, setCatMeta, refreshBooks, token }) {
  const [newCat, setNewCat] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function reloadMeta() {
    try { setCatMeta(await api.getCatMeta?.() || []); } catch {}
  }

  async function createCategory() {
    const name = newCat.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (api.createCategory) {
        await api.createCategory(name, token);
      } else {
        // Kein create-Endpoint vorhanden – bis dahin nur Meta neu laden.
      }
      setNewCat('');
      await reloadMeta();
    } catch(e) {
      toast.error(e?.message || 'Konnte Kategorie nicht anlegen.');
    } finally { setBusy(false); }
  }

  async function deleteCategory(name) {
    const ok = await confirmToast(`Kategorie "${name}" wirklich löschen?`);
    if (!ok) return;
    setBusy(true);
    try {
      if (api.deleteCategory) {
        await api.deleteCategory(name, token);
      } else if (api.renameCategory) {
        toast.error('Kein deleteCategory-Endpoint vorhanden. Bitte per Umbenennen/Merge auf eine Zielkategorie verschieben.');
      }
      await reloadMeta();
      await refreshBooks?.();
    } catch(e) {
      toast.error(e?.message || 'Löschen fehlgeschlagen.');
    } finally { setBusy(false); }
  }

  async function renameOrMerge(from, to) {
    const target = (to || '').trim();
    if (!target || from === target) return;
    const ok = await confirmToast(`"${from}" zu "${target}" umbenennen?
(Hinweis: existiert "${target}" bereits, werden Einträge dorthin verschoben = Merge)`);
    if (!ok) return;
    setBusy(true);
    try {
      await api.renameCategory?.(from, target, token);
      await reloadMeta();
      await refreshBooks?.();
    } catch(e) {
      toast.error(e?.message || 'Umbenennen/Merge fehlgeschlagen.');
    } finally { setBusy(false); }
  }

  async function setColor(name, color) {
    setBusy(true);
    try {
      await api.setCatColor?.(name, color);
      await reloadMeta();
    } catch(e) {
      toast.error(e?.message || 'Farbe konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  }

  return (
    <section className="card" aria-labelledby="catmgr-title">
      <div className="container">
        <h3 id="catmgr-title" style={{marginTop:0}}>Kategorien verwalten</h3>

        <div className="row" style={{gap:8, alignItems:'end', marginBottom:12}}>
          <div style={{flex:1}}>
            <label>Neue Kategorie</label>
            <input className="input" value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="z. B. Bilderbuch" />
          </div>
          <button className="btn" disabled={busy || !newCat.trim()} onClick={createCategory}>Anlegen</button>
        </div>

        <div style={{maxHeight:'45vh', overflow:'auto', borderTop:'1px solid var(--border)', paddingTop:8}}>
          {catMeta?.length === 0 && <div style={{color:'var(--muted)'}}>Keine Kategorien vorhanden.</div>}
          {catMeta?.map(m => (
            <div key={m.name} className="row" style={{gap:8, alignItems:'center', borderBottom:'1px solid var(--border)', padding:'6px 0'}}>
              <span className="badge" style={{background:m.color || '#fff'}}>
                {m.name} <span style={{fontSize:12, color:'var(--muted)'}}>({m.count})</span>
              </span>

              <input
                className="input"
                type="color"
                value={m.color || '#ffffff'}
                onChange={(e)=>setColor(m.name, e.target.value)}
                aria-label={`Farbe für ${m.name}`}
                style={{width:48}}
              />

              <input
                className="input"
                placeholder="Umbenennen/Merge zu…"
                onKeyDown={(e)=>{ if (e.key === 'Enter') renameOrMerge(m.name, e.currentTarget.value); }}
                aria-label={`Kategorie ${m.name} umbenennen/mergen`}
                style={{flex:1, minWidth:180}}
              />

              <button className="btn" disabled={busy} onClick={()=>deleteCategory(m.name)} title="Kategorie löschen">
                Löschen
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


export default function App(){
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs & global
  // Removed tab state, using location.pathname instead
    // --- Dark-Mode State + Persistenz ---
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    try {
      return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
  }

  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 50;

  async function loadMore() {
    if (!hasMore) return;
    try {
      const offset = page * LIMIT;
      const newBooks = await api.getBooks(LIMIT, offset);
      if (newBooks.length < LIMIT) {
        setHasMore(false);
      }
      setBooks(prev => {
        // avoid duplicates
        const existingIds = new Set(prev.map(b => b.id));
        const filtered = newBooks.filter(b => !existingIds.has(b.id));
        return [...prev, ...filtered];
      });
      setPage(p => p + 1);
    } catch (e) {
      console.error(e);
    }
  }

  async function refreshBooks() {
    try {
      // Reload up to the current number of loaded books, or at least LIMIT
      const currentLimit = Math.max(page * LIMIT, LIMIT);
      const newBooks = await api.getBooks(currentLimit, 0);
      setBooks(newBooks);
      if (newBooks.length < currentLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const [token, setToken] = useState(localStorage.getItem('token') || '');

  // Calculate kiosk mode based on route or query param
  const kiosk = location.pathname === '/kiosk' || searchParams.has('kiosk');

  function toggleKiosk() {
    if (kiosk) {
      if (location.pathname === '/kiosk') {
        navigate('/');
      } else {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('kiosk');
        setSearchParams(nextParams);
      }
    } else {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('kiosk', '1');
      setSearchParams(nextParams);
    }
  }

  // Empfehlungen & Kategorien-Manager
  const [seasonal, setSeasonal] = useState({ season: '', items: [] });
  const [catMeta, setCatMeta] = useState([]);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [showRecsSettings, setShowRecsSettings] = useState(false);
  const [recSettings, setRecSettings] = useState(null);

  // Reverse Lookup UI state
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupFor, setLookupFor] = useState(null);
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupBusy, setLookupBusy] = useState(false);

  // Suche/Filter
  const [showFilters, setShowFilters] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState([]); // OR
  const [filterColors, setFilterColors] = useState([]);
  const [top, setTop] = useState([]);

  // Mehrfachauswahl + Sammelaktionen
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkColor1, setBulkColor1] = useState('');
  const [bulkColor2, setBulkColor2] = useState('');
  const [bulkColor3, setBulkColor3] = useState('');
  const [bulkCatsAdd, setBulkCatsAdd] = useState([]);
  const [bulkCatsRemove, setBulkCatsRemove] = useState([]);
  const [bulkCatsSet, setBulkCatsSet] = useState([]);

  // Detail-Modal
  const [selectedBook, setSelectedBook] = useState(null);
  function openBook(b){ setSelectedBook(b); }
  function closeBook(){ setSelectedBook(null); }

  // Admin-Form
  const [id, setId] = useState(null);
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [categories, setCategories] = useState([]);
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [color1, setColor1] = useState('');
  const [color2, setColor2] = useState('');
  const [color3, setColor3] = useState('');
  const [loadingIsbn, setLoadingIsbn] = useState(false);

  // Initial data
  useEffect(() => {
    loadMore();
    api.getTop().then(setTop).catch(()=>setTop([]));
    api.getSeasonal?.().then(setSeasonal).catch(()=>setSeasonal({season:'',items:[]}));
    api.getCatMeta?.().then(setCatMeta).catch(()=>setCatMeta([]));
  }, []);

  // ESC schließt Modal
  useEffect(() => {
    function handleKeyDown(e){ if(e.key === 'Escape') closeBook(); }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Kategorien-Liste
  const allCategories = useMemo(() => {
    const s = new Set();
    books.forEach(b => (b.categories||[]).forEach(c=>c && s.add(c)));
    return [...s].sort((a,b)=>a.localeCompare(b));
  }, [books]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter(b => {
      const hay = [b.title,(b.authors||[]).join(' '),(b.categories||[]).join(' '),b.description].filter(Boolean).join(' ').toLowerCase();
      const matchesQ = q ? hay.includes(q) : true;
      const matchesCat = catFilter.length ? (b.categories||[]).some(c=>catFilter.includes(c)) : true; // OR
      const matchesColors = filterColors.length ? filterColors.every(c => [b.color1,b.color2,b.color3].includes(c)) : true;
      return matchesQ && matchesCat && matchesColors;
    });
  }, [books, query, catFilter, filterColors]);

  // Admin helpers
  function resetForm(){
    setId(null); setIsbn(''); setTitle(''); setAuthors(''); setCategories([]); setDescription(''); setCover(''); setColor1(''); setColor2(''); setColor3('');
  }
  function startEdit(b){
    setId(b.id); setIsbn(b.isbn||''); setTitle(b.title||''); setAuthors((b.authors||[]).join(', '));
    setCategories(b.categories||[]); setDescription(b.description||''); setCover(b.cover||''); setColor1(b.color1||''); setColor2(b.color2||''); setColor3(b.color3||''); navigate('/admin');
    setShowInventory(true);
  }
  async function saveBook(e){
    e?.preventDefault?.();
    const payload = {
      id,
      title: title.trim(),
      authors: authors.split(',').map(s=>s.trim()).filter(Boolean),
      categories: categories.map(s=>s.trim()).filter(Boolean),
      description: description.trim(),
      isbn: isbn.trim(),
      cover: cover.trim(),
      color1: color1 || '',
      color2: color2 || '',
      color3: color3 || '',
    };
    if(!payload.title){ toast.error('Titel darf nicht leer sein.'); return; }
    try {
      if(id){ await api.updateBook(id, payload, token); }
      else { await api.createBook(payload, token); }
      await refreshBooks();
      resetForm();
      navigate('/');
    } catch(e){
      toast.error(e.message || 'Fehler beim Speichern');
    }
  }
  async function delBook(id){
    const ok = await confirmToast('Buch wirklich löschen?');
    if (!ok) return;
    try{
      await api.deleteBook(id, token);
      await refreshBooks();
      setTop(await api.getTop());
    }catch(e){ toast.error(e.message || 'Fehler beim Löschen'); }
  }
  async function lookupISBN(){
    if(!isbn.trim()){ toast.error('Bitte ISBN eingeben.'); return; }
    setLoadingIsbn(true);
    try{
      const info = await api.lookupISBN(isbn.trim());
      if(!title) setTitle(info.title||'');
      if(!authors) setAuthors((info.authors||[]).join(', '));
      if((categories||[]).length===0 && (info.categories||[]).length) setCategories(info.categories.slice(0,3));
      if(!description) setDescription(info.description||'');
      if(!cover) setCover(info.cover||'');
    }catch{ toast.error('Keine Daten gefunden.'); }
    finally { setLoadingIsbn(false); }
  }
  async function countView(id){
    try{ await api.viewBook?.(id); setTop(await api.getTop()); } catch{}
  }

  // Auswahl
  function toggleSelect(id){
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection(){
    setSelectedIds(new Set());
    setBulkColor1(''); setBulkColor2(''); setBulkColor3('');
  }
  async function applyBulkColors(){
    if(selectedIds.size===0){ toast.error('Keine Bücher ausgewählt.'); return; }
    const payload = {};
    if (bulkColor1 === '__CLEAR__') payload.color1 = null; else if (bulkColor1) payload.color1 = bulkColor1;
    if (bulkColor2 === '__CLEAR__') payload.color2 = null; else if (bulkColor2) payload.color2 = bulkColor2;
    if (bulkColor3 === '__CLEAR__') payload.color3 = null; else if (bulkColor3) payload.color3 = bulkColor3;
    if (Object.keys(payload).length===0){
      toast.error('Bitte mindestens Farb-Tag 1–3 setzen oder löschen.');
      return;
    }
    const ids = Array.from(selectedIds);
    try{
      await api.bulkUpdateColors(ids, payload, token);
      await refreshBooks();
      clearSelection();
      toast.success('Farb-Tags aktualisiert.');
    }catch(e){
      toast.error(e.message || 'Sammel-Update fehlgeschlagen');
    }
  }

  // Lookup
  async function openLookup(book){
    setLookupFor(book);
    setLookupOpen(true);
    setLookupBusy(true);
    try{
      const j = await api.lookupByTitle(book.title);
      setLookupResults(j.items || []);
    } catch{ toast.error('Suche fehlgeschlagen'); }
    finally { setLookupBusy(false); }
  }
  async function applyPick(p){
    if(!lookupFor) return;
    try{
      await api.applyMetadata(lookupFor.id, {
        authors: p.authors || [], description: p.description || '', isbn: p.isbn || '', cover: p.cover || ''
      }, token);
      await refreshBooks();
      setTop && setTop(await api.getTop ? await api.getTop() : []);
      setLookupOpen(false);
    } catch{ toast.error('Übernehmen fehlgeschlagen'); }
  }

  return (
    <div>
      <header>
        <div className="container row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <h1 style={{margin: '8px 0'}}>Kita-Bibliothek</h1>
          <div className="row wrap">
            <button className={"btn " + (location.pathname==='/' || location.pathname==='/kiosk'?'primary':'')} onClick={()=>navigate('/')}>Suche</button>
            {token && <button className={"btn " + (location.pathname==='/manage'?'primary':'')} onClick={()=>navigate('/manage')}>Verwalten</button>}
            {token && <button className={"btn " + (location.pathname==='/admin'?'primary':'')} onClick={()=>navigate('/admin')}>Administration</button>}
            <button className="btn" onClick={toggleKiosk}>{kiosk ? "Kiosk aus" : "Kiosk an"}</button>
			<button className="btn" onClick={toggleTheme}>{theme === 'dark' ? 'Hell' : 'Dunkel'}</button>
            <Login token={token} onToken={(t)=>{ setToken(t); localStorage.setItem('token', t||''); }} defaultRole="admin" />
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={
          <>
            {/* Saisonale Empfehlungen */}
          {(!kiosk && seasonal.items && seasonal.items.length > 0) && (
            <div className="container card" style={{ marginTop: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>Saisonale Empfehlungen ({seasonal.season})</h2>
                <button className="btn" onClick={async () => setSeasonal(await api.getSeasonal())}>Aktualisieren</button>
              </div>
              <div className="book-grid" style={{ marginTop: 12 }}>
                {seasonal.items.map((b) => (
                  <article
                    key={b.id}
                    className="card"
                    role="button"
                    tabIndex={0}
                    onClick={()=>{ countView(b.id); openBook(b); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        countView(b.id);
                        openBook(b);
                      }
                    }}
                  >
                    <div className="row">
                      {b.cover ? (
                        <img loading="lazy" src={b.cover} alt="Cover" style={{ width: 80, height: 110, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      ) : (
                        <div style={{ width: 80, height: 110, background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{b.title}</div>
                        <div className="truncate" style={{ fontSize: 13, color: 'var(--muted)' }}>{(b.authors || []).join(', ')}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(b.categories || []).join(' · ')}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Suchleiste & Filter */}
          {kiosk ? (
            <div className='grid' style={{gridTemplateColumns:'1fr'}}>
              <input className='input' value={query} onChange={e=>setQuery(e.target.value)} placeholder='Suche…' />
            </div>
          ) : (
            <div className="container">
              <div className="search-row">
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Suche"
                />
                <button className="btn" onClick={()=>setShowFilters(v=>!v)}>
                  {showFilters ? "Filter verbergen" : "Filter anzeigen"}
                </button>
              </div>

              {showFilters && (
                <FilterPanel
                  catFilter={catFilter}
                  setCatFilter={setCatFilter}
                  allCategories={allCategories}
                  filterColors={filterColors}
                  setFilterColors={setFilterColors}
                />
              )}
            </div>
          )}

          {/* Trefferliste */}
          <BookList
            filtered={filtered}
            kiosk={kiosk}
            countView={countView}
            openBook={openBook}
            selectMode={selectMode}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            token={token}
            startEdit={startEdit}
            delBook={delBook}
            hasMore={hasMore}
            loadMore={loadMore}
          />

          {/* Detail-Modal */}
          <BookDetailModal
            selectedBook={selectedBook}
            closeBook={closeBook}
            openLookup={openLookup}
          />

          {/* Lookup-Modal */}
          {lookupOpen && (
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lookup-title" onClick={()=>setLookupOpen(false)}>
              <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <h3 id="lookup-title" style={{margin:0}}>Metadaten zu „{lookupFor?.title}“</h3>
                  <button className="btn" onClick={()=>setLookupOpen(false)}>Schließen</button>
                </div>
                {lookupBusy ? (
                  <div style={{padding:12}}>Lade Ergebnisse…</div>
                ) : (
                  <div className="book-grid" style={{marginTop:12}}>
                    {lookupResults.map((r, i) => (
                      <article key={i} className="card" role="article">
                        <div className="row">
                          {r.cover ? <img src={r.cover} alt="Cover" style={{width:80,height:110,objectFit:'cover',borderRadius:8,border:'1px solid #e5e7eb'}}/> : <div style={{width:80,height:110,background:'#f1f5f9',border:'1px solid #e5e7eb',borderRadius:8}}/>}
                          <div style={{flex:1,minWidth:0}}>
                            <div className="truncate" style={{fontWeight:600}}>{r.title}</div>
                            <div className="truncate" style={{fontSize:12,color:'var(--muted)'}}>{(r.authors||[]).join(', ')||'—'}</div>
                            {r.isbn && <div style={{fontSize:12,color:'var(--muted)'}}>ISBN: {r.isbn}</div>}
                            <div style={{fontSize:12, color:'var(--muted)', maxHeight:72, overflow:'auto'}}>{r.description || '—'}</div>
                            <div className="row" style={{marginTop:8, justifyContent:'space-between'}}>
                              <span className="pill">{r.source}</span>
                              <button className="btn" onClick={()=>applyPick(r)}>Übernehmen</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                    {lookupResults.length===0 && <div style={{padding:8, color:'var(--muted)'}}>Keine Treffer.</div>}
                  </div>
                )}
              </div>
            </div>
          )}
          </>
        } />

        <Route path="/kiosk" element={
          <>
            {/* Suchleiste & Filter */}
            <div className='grid' style={{gridTemplateColumns:'1fr'}}>
              <input className='input' value={query} onChange={e=>setQuery(e.target.value)} placeholder='Suche…' />
            </div>

            {/* Trefferliste */}
            <BookList
              filtered={filtered}
              kiosk={true}
              countView={countView}
              openBook={openBook}
              selectMode={selectMode}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              token={token}
              startEdit={startEdit}
              delBook={delBook}
              hasMore={hasMore}
              loadMore={loadMore}
            />

            {/* Detail-Modal */}
            <BookDetailModal
              selectedBook={selectedBook}
              closeBook={closeBook}
              openLookup={openLookup}
            />

            {/* Lookup-Modal */}
            {lookupOpen && (
              <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lookup-title" onClick={()=>setLookupOpen(false)}>
                <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <h3 id="lookup-title" style={{margin:0}}>Metadaten zu „{lookupFor?.title}“</h3>
                    <button className="btn" onClick={()=>setLookupOpen(false)}>Schließen</button>
                  </div>
                  {lookupBusy ? (
                    <div style={{padding:12}}>Lade Ergebnisse…</div>
                  ) : (
                    <div className="book-grid" style={{marginTop:12}}>
                      {lookupResults.map((r, i) => (
                        <article key={i} className="card" role="article">
                          <div className="row">
                            {r.cover ? <img src={r.cover} alt="Cover" style={{width:80,height:110,objectFit:'cover',borderRadius:8,border:'1px solid #e5e7eb'}}/> : <div style={{width:80,height:110,background:'#f1f5f9',border:'1px solid #e5e7eb',borderRadius:8}}/>}
                            <div style={{flex:1,minWidth:0}}>
                              <div className="truncate" style={{fontWeight:600}}>{r.title}</div>
                              <div className="truncate" style={{fontSize:12,color:'var(--muted)'}}>{(r.authors||[]).join(', ')||'—'}</div>
                              {r.isbn && <div style={{fontSize:12,color:'var(--muted)'}}>ISBN: {r.isbn}</div>}
                              <div style={{fontSize:12, color:'var(--muted)', maxHeight:72, overflow:'auto'}}>{r.description || '—'}</div>
                              <div className="row" style={{marginTop:8, justifyContent:'space-between'}}>
                                <span className="pill">{r.source}</span>
                                <button className="btn" onClick={()=>applyPick(r)}>Übernehmen</button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                      {lookupResults.length===0 && <div style={{padding:8, color:'var(--muted)'}}>Keine Treffer.</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        } />

        {/* --- TAB: MANAGE --- */}
        <Route path="/manage" element={
<main className="container">
  {!token ? (
    <div className="card">Bitte zuerst einloggen.</div>
  ) : (
    <div className="grid" style={{gridTemplateColumns:'2fr 1fr', gap:12}}>
      <div className="grid" style={{gap:12}}>
        <section className="card" style={{minWidth:0}}>
          <h2 style={{marginTop:0}}>Sammelaktionen</h2>
          <ManageBulk
            books={books}
            token={token}
            refresh={async ()=>{
              try { await refreshBooks(); } catch {}
              if(api.getTop){ try{ setTop(await api.getTop()); } catch(e){} }
              try { setCatMeta(await api.getCatMeta?.() || []); } catch {}
            }}
          />
        </section>

        <section className="card" style={{minWidth:0}}>
          <div className="row" style={{justifyContent: 'space-between'}}>
            <h2 style={{marginTop:0}}>Empfehlungen – Einstellungen</h2>
            <button className="btn" onClick={async()=>{
              if(!showRecsSettings) {
                if(!recSettings){ try{ setRecSettings(await api.getRecSettings()); }catch(e){ toast.error("Konnte Einstellungen nicht laden"); } }
              }
              setShowRecsSettings(s=>!s);
            }}>
              {showRecsSettings ? "Einstellungen schließen" : "Einstellungen öffnen"}
            </button>
          </div>
          {showRecsSettings && (
            <div style={{marginTop: 12}}>
              {!recSettings ? (
                <div style={{color:'var(--muted)'}}>Lade Einstellungen…</div>
              ) : (
                <form className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}} onSubmit={async (e)=>{
                  e.preventDefault();
                  try{
                    const payload = {
                      enabled: e.target.enabled.checked,
                      weightKeyword: parseInt(e.target.weightKeyword.value,10)||0,
                      weightView: parseInt(e.target.weightView.value,10)||0,
                      maxItems: parseInt(e.target.maxItems.value,10)||12,
                      keywords: {
                        winter: e.target.kw_winter.value.split(',').map(s=>s.trim()).filter(Boolean),
                        fruehling: e.target.kw_fruehling.value.split(',').map(s=>s.trim()).filter(Boolean),
                        sommer: e.target.kw_sommer.value.split(',').map(s=>s.trim()).filter(Boolean),
                        herbst: e.target.kw_herbst.value.split(',').map(s=>s.trim()).filter(Boolean),
                      }
                    };
                    const saved = await api.saveRecSettings?.(payload, token);
                    setRecSettings(saved);
                    toast.success('Einstellungen gespeichert.');
                  }catch(err){ toast.error(err.message || 'Speichern fehlgeschlagen'); }
                }}>
                  <div className="row" style={{gridColumn:'1 / -1', alignItems:'center', gap:12}}>
                    <label className="row"><input type="checkbox" name="enabled" defaultChecked={!!recSettings.enabled} /> Empfehlungen aktivieren</label>
                  </div>
                  <div>
                    <label>Punkte pro Keyword</label>
                    <input className="input" type="number" name="weightKeyword" defaultValue={recSettings.weightKeyword||3} min="0" />
                  </div>
                  <div>
                    <label>View-Bonus (Faktor)</label>
                    <input className="input" type="number" name="weightView" defaultValue={recSettings.weightView||1} min="0" />
                  </div>
                  <div>
                    <label>Max. Anzahl Bücher</label>
                    <input className="input" type="number" name="maxItems" defaultValue={recSettings.maxItems||12} min="1" max="50" />
                  </div>
                  <div style={{gridColumn:'1 / -1'}}><hr/></div>
                  <div style={{gridColumn:'1 / -1'}}><strong>Schlüsselwörter (Komma-getrennt)</strong></div>
                  <div>
                    <label>Winter</label>
                    <textarea className="input" rows="2" name="kw_winter" defaultValue={(recSettings.keywords?.winter||[]).join(', ')} />
                  </div>
                  <div>
                    <label>Frühling</label>
                    <textarea className="input" rows="2" name="kw_fruehling" defaultValue={(recSettings.keywords?.fruehling||[]).join(', ')} />
                  </div>
                  <div>
                    <label>Sommer</label>
                    <textarea className="input" rows="2" name="kw_sommer" defaultValue={(recSettings.keywords?.sommer||[]).join(', ')} />
                  </div>
                  <div>
                    <label>Herbst</label>
                    <textarea className="input" rows="2" name="kw_herbst" defaultValue={(recSettings.keywords?.herbst||[]).join(', ')} />
                  </div>
                  <div className="row sticky-actions" style={{gridColumn:'1 / -1', zIndex: 10}}>
                    <button className="btn primary" type="submit">Speichern</button>
                    <button className="btn" type="button" onClick={async()=>{ try{ setRecSettings(await api.getRecSettings?.()); toast.success('Zurückgesetzt auf gespeicherte Werte.'); }catch(e){ } }}>Zurücksetzen</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      </div>

      <CategoryManagerPanel
        catMeta={catMeta}
        setCatMeta={setCatMeta}
        token={token}
        refreshBooks={async ()=>{
          try { await refreshBooks(); } catch {}
        }}
      />
    </div>
  )}
</main>
        } />

        {/* --- TAB: ADMIN --- */}
        <Route path="/admin" element={
        <main className="container">
          {!token ? (
            <div className="card">Bitte zuerst einloggen, um Bücher zu bearbeiten.</div>
          ) : (
            <div className="grid" style={{gridTemplateColumns:'2fr 1fr'}}>
              {/* Formular (links) */}
              <AdminForm
                saveBook={saveBook}
                id={id}
                isbn={isbn} setIsbn={setIsbn}
                lookupISBN={lookupISBN} loadingIsbn={loadingIsbn}
                title={title} setTitle={setTitle}
                authors={authors} setAuthors={setAuthors}
                categories={categories} setCategories={setCategories} allCategories={allCategories}
                cover={cover} setCover={setCover}
                description={description} setDescription={setDescription}
                color1={color1} setColor1={setColor1}
                color2={color2} setColor2={setColor2}
                color3={color3} setColor3={setColor3}
                resetForm={resetForm}
              />

              {/* Rechte Spalte + Toolbar */}
              <aside className="grid" style={{gridTemplateRows:'auto auto auto', gap:12}}>
                <div className="card">
                  <h3>Meist angezeigt</h3>
                  {top.length===0 ? <div style={{color:'var(--muted)'}}>Noch keine Daten.</div> : (
                    <ol style={{margin:'8px 0 0 16px', padding:0}}>
                      {top.map(t => (
                        <li key={t.id} style={{margin:'6px 0'}}>
                          <span style={{fontWeight:600}}>{t.title}</span> <span style={{color:'var(--muted)'}}>({t.views||0})</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="card">
                  <h3>Mehrfachauswahl</h3>
                  <div className="row wrap">
                    <button className="btn" onClick={()=>{ setSelectMode(v=>!v); if(selectMode) clearSelection(); }}>
                      {selectMode ? 'Auswahlmodus beenden' : 'Auswahlmodus starten'}
                    </button>
                    <span style={{color:'var(--muted)'}}>Ausgewählt: {selectedIds.size}</span>
                  </div>

                  {selectMode && (
                    <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                      <div>
                        <label>Farb-Tag 1</label>
                        <select value={bulkColor1} onChange={e=>setBulkColor1(e.target.value)}>
                          <option value="">— nicht ändern —</option>
                          <option value="__CLEAR__">— löschen —</option>
                          {COLOR_PRESETS.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Farb-Tag 2</label>
                        <select value={bulkColor2} onChange={e=>setBulkColor2(e.target.value)}>
                          <option value="">— nicht ändern —</option>
                          <option value="__CLEAR__">— löschen —</option>
                          {COLOR_PRESETS.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
                        </select>
                        <div>
                          <label>Farb-Tag 3</label>
                          <select value={bulkColor3} onChange={e=>setBulkColor3(e.target.value)}>
                            <option value="">— nicht ändern —</option>
                            <option value="__CLEAR__">— löschen —</option>
                            {COLOR_PRESETS.map(c=><option key={c.key} value={c.key}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{gridColumn:'1 / -1'}} className="row">
                        <button className="btn primary" disabled={selectedIds.size===0} onClick={applyBulkColors}>
                          Farb-Tags auf Auswahl anwenden
                        </button>
                        <button className="btn" disabled={selectedIds.size===0} onClick={clearSelection}>Auswahl leeren</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3>Import / Export</h3>
                  <div className="row wrap" style={{flexWrap:'wrap'}}>
                    <button className="btn" onClick={async()=>{
                      try{
                        const blob = await api.exportCSV();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'kita_books.csv'; a.click();
                        URL.revokeObjectURL(url);
                      }catch(e){ toast.error('Export fehlgeschlagen'); }
                    }}>CSV Export</button>

                    {token && (localStorage.getItem('role')==='admin') && (
                      <>
                        <input id="csvFile" type="file" accept=".csv,text/csv" className="hidden" onChange={async e=>{
                          const file = e.target.files?.[0];
                          if(!file) return;
                          const text = await file.text();
                          try{
                            const res = await api.importCSV(text, token);
                            toast.success(`Importiert: ${res.imported}`);
                            await refreshBooks();
                            setTop(await api.getTop());
                          }catch(err){ toast.error('Import fehlgeschlagen: ' + (err.message||'')); }
                        }} />
                        <button className="btn" onClick={()=>document.getElementById('csvFile').click()}>CSV Import</button>
                      </>
                    )}
                  </div>
                  <p style={{fontSize:12,color:'var(--muted)'}}>CSV ist Semikolon-getrennt; Export enthält Kategorien & Views. Import nur für Admins.</p>

                  <div className="card" style={{marginTop:12}}>
                    <h3>Metadaten anreichern</h3>
                    <div className="row wrap">
                      <button className="btn" onClick={async()=>{
                        try{
                          const res = await api.enrichMissing(true, token);
                          toast.success(`Dry-Run: ${res.count} Bücher mit Kandidaten gefunden.`);
                        }catch(e){ toast.error('Enrichment fehlgeschlagen'); }
                      }}>Dry-Run prüfen</button>
                      <button className="btn" onClick={async()=>{
                        const ok = await confirmToast('Automatisch passende Metadaten übernehmen?');
                        if (!ok) return;
                        try{
                          const res = await api.enrichMissing(false, token);
                          toast.success(`Übernommen: ${res.count}`);
                          await refreshBooks();
                          setTop(await api.getTop());
                        }catch(e){ toast.error('Enrichment fehlgeschlagen'); }
                      }}>Automatisch übernehmen</button>
                    </div>
                    <p style={{fontSize:12,color:'var(--muted)'}}>Hinweis: Exakter Titel bevorzugt, sonst erster Treffer.</p>
                  </div>
                </div>
              </aside>

              {/* Bestand unten ausklappbar */}
              <div className="card" style={{gridColumn:'1 / -1'}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <h3 style={{margin:0}}>Bestand ({books.length})</h3>
                  <button
                    className="btn small"
                    type="button"
                    onClick={()=>setShowInventory(v=>!v)}
                    aria-expanded={showInventory}
                    aria-controls="bestand-collapse"
                  >
                    {showInventory ? "Bestand verbergen" : "Bestand anzeigen"}
                  </button>
                </div>

                <div id="bestand-collapse" className={`collapse ${showInventory ? 'open' : ''}`} style={{marginTop:8}}>
                  <div style={{maxHeight:'60vh', overflow:'auto', borderTop:'1px solid #e5e7eb', paddingTop:8}}>
                    {books.map(b=>(
                      <div key={b.id} className="row item" style={{borderBottom:'1px solid #e5e7eb', padding:'6px 0'}}>
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(b.id)}
                            onChange={()=>toggleSelect(b.id)}
                            aria-label={`Buch auswählen: ${b.title}`}
                          />
                        )}
                        <div className="thumb" style={{width:24,height:34,background:'#f1f5f9',border:'1px solid #e5e7eb',borderRadius:4,overflow:'hidden'}}>
                          {b.cover ? <img src={b.cover} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="truncate" style={{fontSize:13,fontWeight:600}}>{b.title}</div>
                          <div className="truncate" style={{fontSize:11,color:'var(--muted)'}}>{(b.authors||[]).join(', ')}</div>
                          <div className="truncate" style={{fontSize:11,color:'var(--muted)'}}>{(b.categories||[]).join(' · ')}</div>
                        </div>
                        {token && <button className="btn small" onClick={()=>startEdit(b)}>Bearbeiten</button>}
                      </div>
                    ))}
                    {books.length===0 && <div style={{color:'var(--muted)', fontSize:13}}>Noch keine Bücher.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
        } />
      </Routes>

      <footer className="container" style={{textAlign:'center',fontSize:12,color:'var(--muted)',padding:'24px 0'}}>
        © {new Date().getFullYear()} Kita-Bibliothek
      </footer>
    </div>
  );
}