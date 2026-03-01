import React from 'react';
import toast from 'react-hot-toast';

export function confirmToast(message) {
  return new Promise((resolve) => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} card`} style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid var(--border)'
      }}>
        <p style={{ margin: '0 0 16px 0', fontWeight: '500' }}>{message}</p>
        <div className="row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
          <button
            className="btn"
            onClick={() => {
              toast.dismiss(t.id);
              resolve(false);
            }}
          >
            Abbrechen
          </button>
          <button
            className="btn primary"
            onClick={() => {
              toast.dismiss(t.id);
              resolve(true);
            }}
          >
            OK
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
    });
  });
}
