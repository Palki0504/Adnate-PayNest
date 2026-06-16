import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../services/api';

// ─── Async Thunks ─────────────────────────────────────────────────────────────
export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      const { token, user, requiresApproval, message } = response.data;
      if (requiresApproval) {
        return { requiresApproval: true, message: message || 'Registration submitted. Awaiting admin approval.' };
      }
      localStorage.setItem('paynest_token', token);
      localStorage.setItem('paynest_user', JSON.stringify(user));
      return { token, user };
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors?.length) {
        const detail = data.errors.map((e) => e.message).join(' ');
        return rejectWithValue(detail || data.message);
      }
      const message = data?.message || 'Registration failed. Please try again.';
      return rejectWithValue(message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      if (user?.isTempPassword) {
        // First-login activation sessions must not survive a refresh/dev restart.
        localStorage.removeItem('paynest_token');
        localStorage.removeItem('paynest_user');
        sessionStorage.setItem('paynest_temp_token', token);
      } else {
        sessionStorage.removeItem('paynest_temp_token');
        localStorage.setItem('paynest_token', token);
        localStorage.setItem('paynest_user', JSON.stringify(user));
      }
      return { token, user };
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors?.length) {
        return rejectWithValue(data.errors.map((e) => e.message).join(' '));
      }
      const message = data?.message || 'Login failed. Please check your credentials.';
      return rejectWithValue(message);
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.getMe();
      return response.data.user;
    } catch (error) {
      localStorage.removeItem('paynest_token');
      localStorage.removeItem('paynest_user');
      sessionStorage.removeItem('paynest_temp_token');
      return rejectWithValue('Session expired. Please login again.');
    }
  }
);

export const activateUserAccount = createAsyncThunk(
  'auth/activate',
  async (passwordData, { rejectWithValue }) => {
    try {
      const response = await authAPI.activateAccount(passwordData);
      return { message: response.data.message };
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors?.length) {
        return rejectWithValue(data.errors.map((e) => e.message).join(' '));
      }
      const message = data?.message || 'Activation failed. Please try again.';
      return rejectWithValue(message);
    }
  }
);

// ─── Load initial state from localStorage ────────────────────────────────────
let storedToken = localStorage.getItem('paynest_token');
let storedUser = localStorage.getItem('paynest_user');
sessionStorage.removeItem('paynest_temp_token');

if (storedUser) {
  try {
    if (JSON.parse(storedUser)?.isTempPassword) {
      localStorage.removeItem('paynest_token');
      localStorage.removeItem('paynest_user');
      sessionStorage.removeItem('paynest_temp_token');
      sessionStorage.removeItem('paynest_temp_token');
      storedToken = null;
      storedUser = null;
    }
  } catch {
    localStorage.removeItem('paynest_token');
    localStorage.removeItem('paynest_user');
    storedToken = null;
    storedUser = null;
  }
}

const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken || null,
  isAuthenticated: !!storedToken,
  loading: false,
  error: null,
  successMessage: null,
};

// ─── Auth Slice ───────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.successMessage = null;
      localStorage.removeItem('paynest_token');
      localStorage.removeItem('paynest_user');
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.successMessage = null;
    },
    patchUser: (state, action) => {
      if (!state.user) return;
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('paynest_user', JSON.stringify(state.user));
    },
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.requiresApproval) {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
          state.successMessage = action.payload.message;
        } else {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
          state.successMessage = 'Account created successfully! Welcome to Adnate PayNest.';
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.successMessage = 'Login successful!';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Me
    builder
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      });

    // Activate Account
    builder
      .addCase(activateUserAccount.pending, (state) => {
        state.error = null;
        state.successMessage = null;
      })
      .addCase(activateUserAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.successMessage = action.payload.message;
        localStorage.removeItem('paynest_token');
        localStorage.removeItem('paynest_user');
        sessionStorage.removeItem('paynest_temp_token');
      })
      .addCase(activateUserAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, clearError, clearSuccess, patchUser } = authSlice.actions;
export default authSlice.reducer;
