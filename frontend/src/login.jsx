import React, { useState } from 'react'
import { api } from './api.js'
export default function Login({ token, onToken, defaultRole='admin' }){
  const [pw, setPw] = useState('');
  const [role, setRole] = useState(localStorage.getItem('role') || defaultRole);
  const [showModal, setShowModal] = useState(false);

  async function login(){
    try{
      const res = await api.login(pw, role);
      onToken(res.token);
      localStorage.setItem('role', role);
      setPw('');
      setShowModal(false);
      alert('Login erfolgreich (' + role + ').');
    }catch(e){
      alert((e.message) || 'Login fehlgeschlagen.');
    }
  }
  function logout(){
    onToken('');
    localStorage.removeItem('role');
    alert('Abgemeldet.');
  }
  return (
    <div className="row">
      {token ? (
        <>
          <span style={{fontSize:12,color:'var(--muted)'}}>({localStorage.getItem('role')||'?'})</span>
          <button className="btn" onClick={logout} title="Logout">Logout</button>
        </>
      ) : (
        <>
          <button className="btn" onClick={() => setShowModal(true)}>Login</button>

          {showModal && (
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={() => setShowModal(false)}>
              <div className="modal-content" style={{maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
                <div className="row" style={{justifyContent: 'space-between', marginBottom: 16}}>
                  <h3 id="login-title" style={{margin:0}}>Login</h3>
                  <button className="btn" onClick={() => setShowModal(false)}>Schließen</button>
                </div>

                <div className="grid">
                  <div>
                    <label>Rolle</label>
                    <select value={role} onChange={e=>setRole(e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                    </select>
                  </div>
                  <div>
                    <label>Passwort</label>
                    <input className="input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Passwort" onKeyDown={(e) => {if (e.key === 'Enter') login()}} autoFocus/>
                  </div>
                  <button className="btn primary" onClick={login} style={{marginTop: 8}}>Anmelden</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
