import { createSlice, PayloadAction } from '@reduxjs/toolkit';
interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'trucker' | 'customer' | 'admin';
  location?: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  profile?: {
    avatar?: string;
    bio?: string;
    licenseNumber?: string;
    vehicleCount?: number;
  };
  rating?: {
    average: number;
    count: number;
  };
  mpesaDetails?: {
    phoneNumber?: string;
  };
  _id?: string;
}
const normalizeUser = (user: any): User | null => {
  if (!user) return null;
  const normalized = {
    ...user,
    id: user.id || user._id
  };
  return normalized.id ? normalized : null;
};
export const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; 
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; 
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
}
const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('token');
const storedLoginTimestamp = localStorage.getItem('loginTimestamp');
const sessionIsFresh =
  !!storedToken &&
  !!storedLoginTimestamp &&
  Date.now() - parseInt(storedLoginTimestamp, 10) < SESSION_TIMEOUT_MS;
if (!sessionIsFresh) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('loginTimestamp');
}
const initialState: AuthState = {
  user: sessionIsFresh && storedUser ? normalizeUser(JSON.parse(storedUser)) : null,
  isAuthenticated: sessionIsFresh && !!storedToken,
  token: sessionIsFresh ? storedToken : null,
};
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action: PayloadAction<{ user: User; token: string }>) => {
      const normalizedUser = normalizeUser(action.payload.user);
      state.user = normalizedUser;
      state.token = action.payload.token;
      state.isAuthenticated = !!normalizedUser;
      localStorage.setItem('token', action.payload.token);
      if (normalizedUser) {
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        localStorage.setItem('loginTimestamp', Date.now().toString());
      }
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      const normalizedUser = normalizeUser(action.payload);
      state.user = normalizedUser;
      state.isAuthenticated = !!state.token && !!normalizedUser;
      if (normalizedUser) {
        localStorage.setItem('user', JSON.stringify(normalizedUser));
      } else {
        localStorage.removeItem('user');
        localStorage.removeItem('loginTimestamp');
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('loginTimestamp');
    },
  },
});
export const { login, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
