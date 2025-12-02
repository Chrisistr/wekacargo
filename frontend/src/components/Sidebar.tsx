import React from 'react';
import { Nav } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import { authAPI } from '../services/api';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    try {
      if (user) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      dispatch(logout());
      navigate('/');
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="sidebar sidebar-visible">
      <div className="sidebar-header">
        <div className="d-flex align-items-center mb-3">
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              overflow: 'hidden',
              marginRight: '15px',
              boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '1.5rem',
              fontWeight: 'bold'
            }}
          >
            {user?.profile?.avatar ? (
              <img
                src={user.profile.avatar}
                alt={user?.name || 'User'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.textContent = user?.name?.charAt(0).toUpperCase() || 'U';
                  }
                }}
              />
            ) : (
              user?.name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div>
            <h6 className="mb-0 fw-bold">{user?.name}</h6>
            <p className="mb-0 small text-muted">
              {user?.role === 'trucker' ? 'Trucker' : user?.role === 'admin' ? 'Admin' : 'Customer'}
            </p>
          </div>
        </div>
      </div>
      <Nav className="flex-column sidebar-nav">
        {user?.role === 'customer' ? (
          <>
            <Nav.Link
              className={isActive('/bookings') ? 'active' : ''}
              onClick={() => handleNavigation('/bookings')}
            >
              Bookings
            </Nav.Link>
            <Nav.Link
              className={isActive('/expenditure') ? 'active' : ''}
              onClick={() => handleNavigation('/expenditure')}
            >
              Expenditure
            </Nav.Link>
            <Nav.Link
              className={isActive('/raise-issue') ? 'active' : ''}
              onClick={() => handleNavigation('/raise-issue')}
            >
              Raise an Issue
            </Nav.Link>
            <Nav.Link
              className={isActive('/settings') ? 'active' : ''}
              onClick={() => handleNavigation('/settings')}
            >
              Settings
            </Nav.Link>
            <Nav.Link
              onClick={() => handleNavigation('/browse-trucks')}
            >
              Book a New Truck
            </Nav.Link>
          </>
        ) : user?.role === 'trucker' ? (
          <>
            <Nav.Link
              className={isActive('/dashboard/trucker') ? 'active' : ''}
              onClick={() => handleNavigation('/dashboard/trucker')}
            >
              Dashboard
            </Nav.Link>
            <Nav.Link
              className={isActive('/trucker/add-vehicle') ? 'active' : ''}
              onClick={() => handleNavigation('/trucker/add-vehicle')}
            >
              Add New Vehicle
            </Nav.Link>
            <Nav.Link
              className={isActive('/trucker/vehicles') ? 'active' : ''}
              onClick={() => handleNavigation('/trucker/vehicles')}
            >
              My Vehicles
            </Nav.Link>
            <Nav.Link
              className={isActive('/trucker/bookings') ? 'active' : ''}
              onClick={() => handleNavigation('/trucker/bookings')}
            >
              My Bookings
            </Nav.Link>
            <Nav.Link
              className={isActive('/settings') ? 'active' : ''}
              onClick={() => handleNavigation('/settings')}
            >
              Settings
            </Nav.Link>
            <Nav.Link
              className={isActive('/raise-issue') ? 'active' : ''}
              onClick={() => handleNavigation('/raise-issue')}
            >
              Raise an Issue
            </Nav.Link>
          </>
        ) : user?.role === 'admin' ? (
          <>
            <Nav.Link
              className={isActive('/dashboard/admin') ? 'active' : ''}
              onClick={() => handleNavigation('/dashboard/admin')}
            >
              Dashboard
            </Nav.Link>
            <Nav.Link
              className={isActive('/admin/users') ? 'active' : ''}
              onClick={() => handleNavigation('/admin/users')}
            >
              User Management
            </Nav.Link>
            <Nav.Link
              className={isActive('/admin/payments') ? 'active' : ''}
              onClick={() => handleNavigation('/admin/payments')}
            >
              Payment Management
            </Nav.Link>
            <Nav.Link
              className={isActive('/admin/truck-removal') ? 'active' : ''}
              onClick={() => handleNavigation('/admin/truck-removal')}
            >
              Truck Removal
            </Nav.Link>
            <Nav.Link
              className={isActive('/admin/alerts') ? 'active' : ''}
              onClick={() => handleNavigation('/admin/alerts')}
            >
              User Alerts
            </Nav.Link>
            <Nav.Link
              className={isActive('/admin/reviews') ? 'active' : ''}
              onClick={() => handleNavigation('/admin/reviews')}
            >
              Reviews Management
            </Nav.Link>
            <Nav.Link
              className={isActive('/settings') ? 'active' : ''}
              onClick={() => handleNavigation('/settings')}
            >
              Settings
            </Nav.Link>
          </>
        ) : null}
        <Nav.Link
          onClick={handleLogout}
          className="sidebar-logout"
        >
          Logout
        </Nav.Link>
      </Nav>
    </div>
  );
};

export default Sidebar;

