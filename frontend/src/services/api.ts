import axios, { AxiosInstance, AxiosError } from 'axios';
import { store } from '../store';
import { logout } from '../store/authSlice';
import { toast } from 'react-toastify';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Normalize user objects in responses
    if (response.data && response.data.user) {
      response.data.user = {
        ...response.data.user,
        id: response.data.user.id || response.data.user._id
      };
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      
      // Handle 401 Unauthorized - logout user (but not on login endpoints)
      if (status === 401) {
        const url = error.config?.url || '';
        // Don't logout on login/register endpoints - let them handle the error
        if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/admin/login')) {
          store.dispatch(logout());
          toast.error('Session expired. Please login again.');
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      }
      
      // Handle 403 Forbidden
      if (status === 403) {
        // Don't show toast for login errors - they handle their own messages
        const url = error.config?.url || '';
        if (!url.includes('/auth/login') && !url.includes('/auth/admin/login')) {
          toast.error('Access forbidden');
        }
      }
      
      // Handle 500 Server Error
      if (status === 500) {
        toast.error('Server error. Please try again later.');
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    }
    
    return Promise.reject(error);
  }
);

// API service functions
export const authAPI = {
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: 'trucker' | 'customer';
    location?: { address: string; coordinates?: { lat: number; lng: number } };
  }) => api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  adminLogin: (data: { email: string; password: string }) =>
    api.post('/auth/admin/login', data),

  getCurrentUser: () => api.get('/auth/me'),
  
  logout: () => api.post('/auth/logout'),
  
  googleLogin: (data: { credential: string }) =>
    api.post('/auth/google', data),
  
  completeGoogleRegistration: (data: {
    phone: string;
    role: 'trucker' | 'customer';
    location?: { address: string; coordinates?: { lat: number; lng: number } };
  }) => api.post('/auth/google/complete', data),
};

export const trucksAPI = {
  getAll: (params?: {
    type?: string;
    minCapacity?: number;
    maxCapacity?: number;
    lat?: number;
    lng?: number;
    maxDistance?: number;
    minRating?: number;
    isAvailable?: boolean;
  }) => api.get('/trucks', { params }),
  
  getById: (id: string) => api.get(`/trucks/${id}`),
  
  create: (data: any) => api.post('/trucks', data),
  
  update: (id: string, data: any) => api.put(`/trucks/${id}`, data),
  
  delete: (id: string) => api.delete(`/trucks/${id}`),
  
  requestRemoval: (id: string, data: { reason: string }) =>
    api.post(`/trucks/${id}/removal-request`, data),
};

export const bookingsAPI = {
  getMyBookings: () => api.get('/bookings/my-bookings'),
  
  getById: (id: string) => api.get(`/bookings/${id}`),
  
  create: (data: {
    truckId: string;
    origin: { address: string; coordinates: { lat: number; lng: number } };
    destination: { address: string; coordinates: { lat: number; lng: number } };
    cargoDetails: { type: string; weight: number; description?: string };
    paymentMethod?: 'cash' | 'mpesa';
  }) => api.post('/bookings', data),
  
  update: (id: string, data: { status: string; cancellationReason?: string }) =>
    api.put(`/bookings/${id}`, data),
  
  edit: (id: string, data: {
    origin?: { address?: string; coordinates?: { lat: number; lng: number }; contact?: string; pickupTime?: string };
    destination?: { address?: string; coordinates?: { lat: number; lng: number }; contact?: string; dropoffTime?: string };
    cargoDetails?: { type?: string; weight?: number; volume?: number; description?: string };
    specialInstructions?: string;
  }) => api.patch(`/bookings/${id}`, data),
  
  geocode: (address: string) => api.post('/bookings/geocode', { address }),
};

export const paymentsAPI = {
  initiate: (data: { bookingId: string; phoneNumber: string }) =>
    api.post('/payments/initiate', data),
  
  release: (paymentId: string) => api.post(`/payments/release/${paymentId}`),
};

export const ratingsAPI = {
  getUserRatings: (userId: string) => api.get(`/ratings/user/${userId}`),
  
  submit: (data: {
    bookingId: string;
    rating: number;
    review?: string;
    categories?: {
      punctuality?: number;
      communication?: number;
      service?: number;
      vehicleCondition?: number;
    };
  }) => api.post('/ratings', data),
  
  checkReview: (bookingId: string) => api.get(`/ratings/booking/${bookingId}/check`),
  
  getAll: (params?: { status?: string; search?: string }) => 
    api.get('/ratings/all', { params }),
  
  delete: (ratingId: string) => api.delete(`/ratings/${ratingId}`),
};

export const adminAPI = {
  getUsers: (params?: { search?: string; role?: string }) => 
    api.get('/admin/users', { params }),
  
  getUserDetails: (id: string) => api.get(`/admin/users/${id}`),
  
  updateUser: (id: string, data: { status?: string; verification?: any }) =>
    api.put(`/admin/users/${id}`, data),
  
  getAnalytics: () => api.get('/admin/analytics'),
  
  getRemovalRequests: (params?: { status?: string }) =>
    api.get('/admin/removal-requests', { params }),
  
  updateRemovalRequest: (
    id: string,
    data: { adminNote?: string }
  ) => api.put(`/admin/removal-requests/${id}`, data),
  
  getAlerts: (params?: { status?: string }) =>
    api.get('/admin/alerts', { params }),
  
  updateAlert: (id: string, data: { status: 'open' | 'in_progress' | 'resolved' }) =>
    api.put(`/admin/alerts/${id}`, data),
  
  // Payment Management
  getPayments: (params?: { status?: string; escrowStatus?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/admin/payments', { params }),
  
  getPaymentDetails: (id: string) => api.get(`/admin/payments/${id}`),
  
  getEscrowSummary: () => api.get('/admin/payments/escrow-summary'),
  
  approveRefund: (id: string, data: { refundReason?: string; adminNote?: string }) =>
    api.post(`/admin/payments/${id}/approve-refund`, data),
  
  sendNotification: (data: { 
    userId?: string; 
    userIds?: string[]; 
    title: string; 
    message: string; 
    type?: string; 
    relatedBooking?: string;
  }) => api.post('/notifications/admin/send', data),
};

export const alertsAPI = {
  create: (data: { subject: string; message: string }) =>
    api.post('/alerts', data),
  
  getMy: () => api.get('/alerts/my'),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  sendMessage: (data: { truckerId: string; bookingId?: string; message: string }) =>
    api.post('/notifications/send-message', data),
  adminSend: (data: { 
    userId?: string; 
    userIds?: string[]; 
    title: string; 
    message: string; 
    type?: string; 
    relatedBooking?: string;
  }) => api.post('/notifications/admin/send', data),
};

export const usersAPI = {
  getById: (id: string) => api.get(`/users/${id}`),
  
  update: (id: string, data: {
    name?: string;
    phone?: string;
    location?: any;
    profile?: any;
    mpesaDetails?: any;
  }) => api.put(`/users/${id}`, data),
  
  uploadAvatar: (id: string, formData: FormData) =>
    api.post(`/users/${id}/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  changePassword: (id: string, data: {
    currentPassword: string;
    newPassword: string;
  }) => api.post(`/users/${id}/change-password`, data),
};

export default api;


