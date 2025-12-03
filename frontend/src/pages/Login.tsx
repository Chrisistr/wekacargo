import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { login, setUser } from '../store/authSlice';
import { authAPI } from '../services/api';

declare global {
  interface Window {
    google: {
      accounts?: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
      maps?: {
        Map: any;
        Marker: any;
        DirectionsService: any;
        DirectionsRenderer: any;
        TravelMode: any;
        LatLngBounds: any;
        SymbolPath: any;
        event: {
          clearInstanceListeners: (instance: any) => void;
          addListener: (instance: any, event: string, handler: (error: any) => void) => void;
        };
        places?: {
          Autocomplete: any;
        };
      };
    };
  }
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState({
    phone: '',
    role: 'customer' as 'trucker' | 'customer',
    address: ''
  });
  const [completingRegistration, setCompletingRegistration] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    // Check if Google Identity Services script is already loaded
    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      // Script already exists, just initialize
      if (window.google?.accounts?.id && process.env.REACT_APP_GOOGLE_CLIENT_ID) {
        initializeGoogleSignIn();
      }
      return;
    }

    // Load Google Identity Services script (separate from Maps API)
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.id = 'google-identity-services-script';
    
    script.onload = () => {
      if (window.google?.accounts?.id && process.env.REACT_APP_GOOGLE_CLIENT_ID) {
        initializeGoogleSignIn();
      }
    };

    script.onerror = () => {
      console.error('Failed to load Google Identity Services');
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script - it might be used by other components
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeGoogleSignIn = () => {
    if (!window.google?.accounts?.id || !process.env.REACT_APP_GOOGLE_CLIENT_ID) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
      });
      
      // Render Google sign-in button after DOM is ready
      const renderButton = () => {
        const buttonElement = document.getElementById('google-signin-button');
        if (buttonElement && !buttonElement.hasChildNodes()) {
          try {
            window.google.accounts?.id.renderButton(buttonElement, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signin_with',
              locale: 'en'
            });
          } catch (error) {
            console.error('Error rendering Google sign-in button:', error);
          }
        }
      };
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(renderButton, 200);
        });
      } else {
        setTimeout(renderButton, 200);
      }
    } catch (error) {
      console.error('Error initializing Google Sign-In:', error);
    }
  };

  const handleGoogleSignIn = async (response: any) => {
    if (!response.credential) {
      toast.error('Google sign-in failed. Please try again.');
      return;
    }
    
    setLoading(true);
    try {
      const result = await authAPI.googleLogin({ credential: response.credential });
      handleGoogleResponse(result);
    } catch (error: any) {
      setLoading(false);
      toast.error(error.response?.data?.message || 'Google login failed');
      console.error(error);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompletingRegistration(true);
    
    try {
      const completeData: any = {
        phone: registrationData.phone,
        role: registrationData.role,
      };

      if (registrationData.role === 'trucker' && registrationData.address) {
        completeData.location = {
          address: registrationData.address
        };
      }

      const result = await authAPI.completeGoogleRegistration(completeData);
      
      dispatch(setUser(result.data.user));
      toast.success('Registration completed successfully!');
      setShowRegistrationModal(false);
      const dashboardPath = `/dashboard/${result.data.user.role}`;
      navigate(dashboardPath);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to complete registration');
      console.error(error);
    } finally {
      setCompletingRegistration(false);
    }
  };

  const handleGoogleResponse = (result: any) => {
    setLoading(false);
    // Check if user needs to complete registration
    if (result.data.needsRegistration) {
      setGoogleUser(result.data);
      dispatch(login({
        user: result.data.user,
        token: result.data.token
      }));
      setShowRegistrationModal(true);
    } else {
      dispatch(login({
        user: result.data.user,
        token: result.data.token
      }));
      toast.success('Login successful!');
      const dashboardPath = `/dashboard/${result.data.user.role}`;
      navigate(dashboardPath);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login({
        email: formData.email.trim(),
        password: formData.password
      });

      if (!response.data || !response.data.token || !response.data.user) {
        throw new Error('Invalid response from server');
      }

      // Normalize user object
      const user = {
        ...response.data.user,
        id: response.data.user.id || response.data.user._id
      };

      dispatch(login({
        user: user,
        token: response.data.token
      }));

      toast.success('Login successful!');
      
      // Small delay to ensure state is updated
      setTimeout(() => {
        const dashboardPath = `/dashboard/${user.role}`;
        navigate(dashboardPath);
      }, 100);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Login failed. Please check your credentials and try again.';
      toast.error(errorMessage);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="my-5">
      <Row className="justify-content-center">
        <Col md={5}>
          <Card className="shadow">
            <Card.Body>
              <h2 className="text-center mb-4">Login</h2>
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Email or Username</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter email or admin"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </Form.Group>
                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>

              <div className="text-center my-3">
                <div className="position-relative">
                  <hr />
                  <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted">
                    OR
                  </span>
                </div>
              </div>

              {process.env.REACT_APP_GOOGLE_CLIENT_ID ? (
                <div id="google-signin-button" className="mb-3"></div>
              ) : (
                <Button
                  variant="outline-primary"
                  className="w-100 mb-3"
                  disabled
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" className="me-2">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.96-2.184l-2.908-2.258c-.806.54-1.837.86-3.052.86-2.348 0-4.337-1.585-5.047-3.716H.957v2.331C2.438 15.983 5.482 18 9 18z"/>
                    <path fill="#FBBC05" d="M3.953 10.702c-.18-.54-.282-1.117-.282-1.702 0-.585.102-1.162.282-1.702V4.967H.957C.348 6.175 0 7.55 0 9s.348 2.825.957 4.033l2.996-2.331z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.967L3.953 7.3C4.663 5.168 6.652 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google (Not Configured)
                </Button>
              )}

              <p className="text-center mt-3">
                Don't have an account? <Link to="/register">Register here</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Google Registration Modal */}
      <Modal show={showRegistrationModal} onHide={() => {}} centered backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>Complete Your Registration</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCompleteRegistration}>
          <Modal.Body>
            <p className="text-muted mb-4">
              Welcome, {googleUser?.user?.name}! Please provide the following information to complete your registration.
            </p>
            
            <Form.Group className="mb-3">
              <Form.Label>Phone Number *</Form.Label>
              <Form.Control
                type="tel"
                placeholder="e.g. +254712345678"
                value={registrationData.phone}
                onChange={(e) => setRegistrationData({ ...registrationData, phone: e.target.value })}
                required
              />
              <Form.Text className="text-muted">We'll use this for important notifications</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>I want to register as *</Form.Label>
              <Form.Select
                value={registrationData.role}
                onChange={(e) => setRegistrationData({ ...registrationData, role: e.target.value as 'trucker' | 'customer' })}
                required
              >
                <option value="customer">Customer - I want to book trucks</option>
                <option value="trucker">Trucker - I want to list my vehicles</option>
              </Form.Select>
            </Form.Group>

            {registrationData.role === 'trucker' && (
              <Form.Group className="mb-3">
                <Form.Label>Base Location</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g. Nairobi, Kenya"
                  value={registrationData.address}
                  onChange={(e) => setRegistrationData({ ...registrationData, address: e.target.value })}
                />
                <Form.Text className="text-muted">Your primary operating location (optional)</Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="submit"
              variant="primary"
              disabled={completingRegistration}
              className="w-100"
            >
              {completingRegistration ? 'Completing Registration...' : 'Complete Registration'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Login;

