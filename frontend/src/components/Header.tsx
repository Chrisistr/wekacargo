import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, NavDropdown, Button } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import { authAPI } from '../services/api';
import './Header.css';
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      if (isAuthenticated) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
    dispatch(logout());
    navigate('/');
    }
  };
  const getDashboardLink = () => {
    if (!user) return null;
    switch (user.role) {
      case 'trucker':
        return '/dashboard/trucker';
      case 'customer':
        return '/dashboard/customer';
      case 'admin':
        return '/dashboard/admin';
      default:
        return null;
    }
  };
  return (
    <Navbar bg="light" expand="lg" className="shadow-sm">
      <div className="container">
        <Navbar.Brand 
          onClick={() => {
            navigate('/', { replace: true });
            setTimeout(() => window.scrollTo(0, 0), 100);
          }}
          style={{ cursor: 'pointer' }}
        >
          <strong>WekaCargo</strong>
        </Navbar.Brand>
        <Navbar.Toggle 
          aria-controls="basic-navbar-nav"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            {isAuthenticated ? (
              <>
                {(user?.role === 'customer' || user?.role === 'trucker' || user?.role === 'admin') ? (
                  null
                ) : (
                  <NavDropdown title={user?.name || 'User'} id="user-dropdown">
                    <NavDropdown.Item as={Link} to={getDashboardLink() || '#'}>
                      Dashboard
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/settings">
                      Settings
                    </NavDropdown.Item>
                    <NavDropdown.Divider />
                    <NavDropdown.Item onClick={handleLogout}>
                      Logout
                    </NavDropdown.Item>
                  </NavDropdown>
                )}
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/register">
                  <Button variant="outline-primary" className="me-2">
                    Sign Up
                  </Button>
                </Nav.Link>
                <Nav.Link as={Link} to="/login">
                  <Button variant="primary">
                    Login
                  </Button>
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </div>
    </Navbar>
  );
};
export default Header;
