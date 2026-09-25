import React, { createContext, useEffect, useState } from 'react';
import axiosInstance from '../api/axiosConfig';

interface User {
  id: string;
  username: string;
  email: string;
  // Agrega más campos según tu modelo de usuario
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay usuario en localStorage al cargar la app
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);

        // Verificar que el token sigue siendo válido
        verifyToken();
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);

    // Escuchar evento de logout desde axios interceptor
    const handleLogout = () => {
      logout();
    };

    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const verifyToken = async () => {
    try {
      const response = await axiosInstance.get('/api/auth/verify');
      if (response.data.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      // Si la verificación falla, el interceptor se encargará del logout
      console.error('Token verification failed:', error);
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');

    // Llamar al endpoint de logout en el backend para limpiar la cookie
    axiosInstance.post('/api/auth/logout').catch((error) => {
      console.error('Logout API call failed:', error);
    });
  };

  return (
    <AuthContext
      value={{
        user,
        login,
        logout,
        isAuthenticated,
        isLoading,
      }}
    >
      {children}
    </AuthContext>
  );
};

export { AuthContext };
