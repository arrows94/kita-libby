import React from 'react'

/**
 * ChipsInput
 * - Free text entry that creates chips on Enter
 * - Shows filtered suggestions in an accessible listbox
 * - Keyboard: ArrowUp/Down to navigate, Enter to select, Backspace to delete last chip when empty
 */
export function ChipsInput({ values, onChange, suggestions = [] }){
  const [text, setText] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [highlight, setHighlight] = React.useState(-1)
  const inputRef = React.useRef(null)
  const listId = React.useId()

  const add = (v) => {
    v = (v || '').trim()
    if(!v) return
    if(!values.includes(v)) onChange([ ...values, v ])
    setText('')
    setHighlight(-1)
  }
  const remove = (v) => onChange(values.filter(x => x !== v))

  const filtered = React.useMemo(() => {
    const q = text.trim().toLowerCase()
    let opts = suggestions.filter(s => !values.includes(s))
    if(q) opts = opts.filter(s => s.toLowerCase().includes(q))
    return opts
  }, [text, suggestions, values])

  const onKeyDown = (e) => {
    if(e.key === 'Enter'){
      e.preventDefault()
      if(open && filtered.length && highlight >= 0){
        add(filtered[highlight])
      }else{
        add(text)
      }
    }else if(e.key === 'Backspace' && !text && values.length){
      remove(values[values.length - 1])
    }else if(e.key === 'ArrowDown'){
      e.preventDefault()
      setOpen(true)
      setHighlight(h => Math.min((h < 0 ? -1 : h) + 1, filtered.length - 1))
    }else if(e.key === 'ArrowUp'){
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    }else if(e.key === 'Escape'){
      setOpen(false); setHighlight(-1)
    }
  }

  // Close the listbox a moment after blur to allow click
  const blurTimeout = React.useRef(null)
  const onBlur = () => {
    blurTimeout.current = setTimeout(()=>{ setOpen(false); setHighlight(-1) }, 100)
  }
  const onFocus = () => { if(filtered.length) setOpen(true) }
  React.useEffect(() => () => clearTimeout(blurTimeout.current), [])

  return (
    <div className="chips-wrapper">
      <div
        className="chips"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-owns={listId}
        onClick={()=> inputRef.current?.focus()}
      >
        {values.map(v => (
          <span key={v} className="chip">
            {v}
            <button className="chip-x" title="Entfernen" onClick={()=>remove(v)} aria-label={`${v} entfernen`}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="input chip-input"
          value={text}
          onChange={e=>{ setText(e.target.value); setOpen(true) }}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Eingeben…"
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul id={listId} role="listbox" className="combo-list" onMouseDown={e=>e.preventDefault()}>
          {filtered.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              className={"combo-item" + (i === highlight ? " active" : "")}
              onMouseEnter={()=>setHighlight(i)}
              onClick={()=> add(s)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      </div>
  )
}
