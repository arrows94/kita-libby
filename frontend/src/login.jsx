import React, { useState } from 'react'
import { api } from './api.js'
import toast from 'react-hot-toast'
export default function Login({ token, onToken, defaultRole='admin' }){
  const [pw, setPw] = useState('');
  const [role, setRole] = useState(localStorage.getItem('role') || defaultRole);
  async function login(){
    try{
      const res = await api.login(pw, role);
      onToken(res.token);
      localStorage.setItem('role', role);
      setPw('');
      toast.success('Login erfolgreich (' + role + ').');
    }catch(e){
      toast.error((e.message) || 'Login fehlgeschlagen.');
    }
  }
  function logout(){
    onToken('');
    localStorage.removeItem('role');
    toast.success('Abgemeldet.');
  }
  return (
    <div className="row">
      {token ? (
        <>
          <span style={{fontSize:12,color:'var(--muted)'}}>eingeloggt als {localStorage.getItem('role')||'?'}</span>
          <button className="btn" onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <select value={role} onChange={e=>setRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
          </select>
          <input className="input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Passwort" style={{width:160}} />
          <button className="btn" onClick={login}>Login</button>
        </>
      )}
    </div>
  )
}
