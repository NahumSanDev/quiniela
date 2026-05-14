'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Group {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  isOwner: boolean;
  members: { id: string; user: { id: string; name: string | null; image: string | null; points: number } }[];
}

export default function GroupsPage() {
  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      fetchGroups();
    } else {
      window.location.href = '/auth/signin';
    }
  }, []);

  async function fetchGroups() {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newGroupName })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Grupo creado! Codigo: ${data.code}`);
        setNewGroupName('');
        setShowCreate(false);
        fetchGroups();
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Error al crear grupo');
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: joinCode })
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      if (res.ok) {
        setJoinCode('');
        setShowJoin(false);
        fetchGroups();
      }
    } catch (error) {
      setMessage('Error al unirse al grupo');
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm('¿Eliminar este grupo?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('Grupo eliminado');
        fetchGroups();
      }
    } catch (error) {
      setMessage('Error al eliminar');
    }
  }

  async function leaveGroup(id: string) {
    if (!confirm('¿Salir de este grupo?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/groups/${id}/leave`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage('Saliste del grupo');
        fetchGroups();
      }
    } catch (error) {
      setMessage('Error al salir');
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setMessage('Codigo copiado!');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <a href="/" className="text-emerald-400 hover:text-emerald-300 text-sm mb-2 block">← Volver</a>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
            Grupos Privados
          </h1>
        </motion.header>

        {message && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            {message}
            <button onClick={() => setMessage('')} className="float-right">x</button>
          </motion.div>
        )}

        <div className="flex gap-4 mb-6">
          <button onClick={() => { setShowCreate(true); setShowJoin(false); }} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">
            Crear Grupo
          </button>
          <button onClick={() => { setShowJoin(true); setShowCreate(false); }} className="flex-1 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20">
            Unirse con Codigo
          </button>
        </div>

        {showCreate && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Crear Nuevo Grupo</h3>
            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nombre del grupo" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white mb-4 outline-none focus:border-emerald-500" />
            <div className="flex gap-3">
              <button onClick={createGroup} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">Crear</button>
              <button onClick={() => setShowCreate(false)} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Cancelar</button>
            </div>
          </motion.div>
        )}

        {showJoin && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-6 bg-white/5 border border-white/10 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Unirse a un Grupo</h3>
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Codigo de 6 caracteres" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white mb-4 outline-none focus:border-emerald-500 text-center text-2xl tracking-widest font-bold" maxLength={6} />
            <div className="flex gap-3">
              <button onClick={joinGroup} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-400">Unirse</button>
              <button onClick={() => setShowJoin(false)} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Cancelar</button>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-center text-white/40 py-10">No estas en ningun grupo. Crea uno o unete con un codigo.</p>
          ) : (
            groups.map((group) => (
              <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-white/40 text-sm">Codigo:</span>
                      <button onClick={() => copyCode(group.code)} className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg font-mono font-bold hover:bg-amber-500/30">
                        {group.code}
                      </button>
                    </div>
                  </div>
                  {group.isOwner && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm">Creador</span>}
                </div>

                <div className="mb-4">
                  <h4 className="text-white/60 text-sm mb-2">Miembros ({group.members?.length || 0})</h4>
                  <div className="space-y-2">
                    {group.members?.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm">
                          {m.user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-white">{m.user.name || 'Sin nombre'}</span>
                        <span className="text-emerald-400 ml-auto">{m.user.points} pts</span>
                      </div>
                    ))}
                    {(group.members?.length || 0) > 5 && (
                      <p className="text-white/40 text-sm">+{(group.members?.length || 0) - 5} mas</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {group.isOwner ? (
                    <button onClick={() => deleteGroup(group.id)} className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 text-sm">
                      Eliminar Grupo
                    </button>
                  ) : (
                    <button onClick={() => leaveGroup(group.id)} className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 text-sm">
                      Salir del Grupo
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}