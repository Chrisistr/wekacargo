import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import Header from './components/Header';
import Homepage from './pages/Homepage';
import Register from './pages/Register';
import Login from './pages/Login';
import TruckerDashboard from './pages/TruckerDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookingDetails from './pages/BookingDetails';
import CreateBooking from './pages/CreateBooking';
import TrackingPage from './pages/TrackingPage';
import AdminLogin from './pages/AdminLogin';
import Settings from './pages/Settings';
import TruckDetails from './pages/TruckDetails';
import Expenditure from './pages/Expenditure';
import CustomerHome from './pages/CustomerHome';
import CustomerBookings from './pages/CustomerBookings';
import RaiseIssue from './pages/RaiseIssue';
import TruckerAddVehicle from './pages/TruckerAddVehicle';
import TruckerVehicles from './pages/TruckerVehicles';
import TruckerBookings from './pages/TruckerBookings';
import AdminUserManagement from './pages/AdminUserManagement';
import AdminPaymentManagement from './pages/AdminPaymentManagement';
import AdminTruckRemoval from './pages/AdminTruckRemoval';
import AdminUserAlerts from './pages/AdminUserAlerts';
import AdminReviewsManagement from './pages/AdminReviewsManagement';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store';
import { authAPI } from './services/api';
import { setUser, logout, SESSION_TIMEOUT_MS, INACTIVITY_TIMEOUT_MS } from './store/authSlice';
function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.auth);
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await authAPI.getCurrentUser();
        dispatch(setUser(response.data));
      } catch (error) {
        dispatch(logout());
      }
    };
    if (token && !user) {
      fetchCurrentUser();
    }
  }, [dispatch, token, user]);
  useEffect(() => {
    if (!token) return;
    let inactivityTimer: NodeJS.Timeout;
    let lastActivityTime = Date.now();
    const resetInactivityTimer = () => {
      lastActivityTime = Date.now();
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(async () => {
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
          try {
            await authAPI.logout();
          } catch (error) {
            console.error('Logout API error:', error);
          }
          dispatch(logout());
          toast.info('You have been logged out due to inactivity. Please login again.');
        }
      }, INACTIVITY_TIMEOUT_MS);
    };
    const enforceSessionTimeout = () => {
      const timestamp = localStorage.getItem('loginTimestamp');
      if (!timestamp) return;
      const elapsed = Date.now() - Number(timestamp);
      if (elapsed >= SESSION_TIMEOUT_MS) {
        dispatch(logout());
        toast.info('Session expired. Please login again.');
      }
    };
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });
    const sessionIntervalId = window.setInterval(enforceSessionTimeout, 60 * 1000);
    enforceSessionTimeout();
    resetInactivityTimer();
    return () => {
      window.clearInterval(sessionIntervalId);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
    };
  }, [dispatch, token]);
  return (
    <div className="App">
      <Header />
      <Routes>
        <Route path="/" element={user?.role === 'customer' ? <CustomerHome /> : user?.role === 'trucker' ? <TruckerDashboard /> : user?.role === 'admin' ? <AdminDashboard /> : <Homepage />} />
        <Route path="/dashboard/customer" element={<CustomerHome />} />
        <Route path="/browse-trucks" element={<Homepage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/dashboard/trucker" element={<TruckerDashboard />} />
        <Route path="/dashboard/customer" element={<CustomerDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/expenditure" element={<Expenditure />} />
        <Route path="/home" element={<CustomerHome />} />
        <Route path="/bookings" element={<CustomerBookings />} />
        <Route path="/raise-issue" element={<RaiseIssue />} />
        <Route path="/trucker/add-vehicle" element={<TruckerAddVehicle />} />
        <Route path="/trucker/vehicles" element={<TruckerVehicles />} />
        <Route path="/trucker/bookings" element={<TruckerBookings />} />
        <Route path="/admin/users" element={<AdminUserManagement />} />
        <Route path="/admin/payments" element={<AdminPaymentManagement />} />
        <Route path="/admin/truck-removal" element={<AdminTruckRemoval />} />
        <Route path="/admin/alerts" element={<AdminUserAlerts />} />
        <Route path="/admin/reviews" element={<AdminReviewsManagement />} />
        <Route path="/truck/:id" element={<TruckDetails />} />
        <Route path="/book-truck/:truckId" element={<CreateBooking />} />
        <Route path="/booking/:id" element={<BookingDetails />} />
        <Route path="/tracking/:id" element={<TrackingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}
export default App;
