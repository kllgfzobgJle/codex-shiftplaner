'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import type { User } from '@/lib/types';
import {
  saveUser,
  authenticateUser,
  setCurrentUser,
  getCurrentUser,
  findUserByUsername,
} from '@/lib/dataManager';

interface AuthContextType {
  user: User | null;
  register: (username: string, password: string) => { success: boolean; message?: string };
  login: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const current = getCurrentUser();
    setUser(current);
  }, []);

  const register = (username: string, password: string) => {
    if (findUserByUsername(username)) {
      return { success: false, message: 'Benutzername bereits vergeben' };
    }
    const newUser = saveUser({ username, password });
    setCurrentUser(newUser.id);
    setUser(newUser);
    return { success: true };
  };

  const login = (username: string, password: string) => {
    const existing = authenticateUser(username, password);
    if (!existing) return { success: false, message: 'Ungültige Anmeldedaten' };
    setCurrentUser(existing.id);
    setUser(existing);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
