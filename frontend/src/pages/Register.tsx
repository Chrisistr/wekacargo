import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Tabs, Tab, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
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

const Register: React.FC = () => {
  const [activeTab, setActiveTab] = useState('customer');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    vehicleType: '',
    capacity: '',
    perKm: '',
    address: ''
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
      window.google.accounts?.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
      });
      
      // Render Google sign-in buttons for both tabs
      const renderButtons = () => {
        const customerButton = document.getElementById('google-signin-button-customer');
        const truckerButton = document.getElementById('google-signin-button-trucker');
        
        if (customerButton && !customerButton.hasChildNodes()) {
          try {
            window.google.accounts?.id.renderButton(customerButton, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signup_with',
              locale: 'en'
            });
          } catch (error) {
            console.error('Error rendering customer Google button:', error);
          }
        }
        
        if (truckerButton && !truckerButton.hasChildNodes()) {
          try {
            window.google.accounts?.id.renderButton(truckerButton, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signup_with',
              locale: 'en'
            });
          } catch (error) {
            console.error('Error rendering trucker Google button:', error);
          }
        }
      };
      
      // Render buttons after DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(renderButtons, 200);
        });
      } else {
        setTimeout(renderButtons, 200);
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
      
      // Check if user needs to complete registration
      if (result.data.needsRegistration) {
        setGoogleUser(result.data);
        setRegistrationData({
          phone: '',
          role: activeTab as 'trucker' | 'customer',
          address: ''
        });
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
        toast.success('Registration successful!');
        const dashboardPath = `/dashboard/${result.data.user.role}`;
        navigate(dashboardPath);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Google sign-in failed');
      console.error(error);
    } finally {
      setLoading(false);
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

  // Re-render Google buttons when tab changes
  useEffect(() => {
    if (window.google && process.env.REACT_APP_GOOGLE_CLIENT_ID) {
      const renderButtons = () => {
        const customerButton = document.getElementById('google-signin-button-customer');
        const truckerButton = document.getElementById('google-signin-button-trucker');
        
        if (customerButton && !customerButton.hasChildNodes()) {
          try {
            window.google.accounts?.id.renderButton(customerButton, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signup_with',
              locale: 'en'
            });
          } catch (error) {
            console.error('Error rendering customer Google button:', error);
          }
        }
        
        if (truckerButton && !truckerButton.hasChildNodes()) {
          try {
            window.google.accounts?.id.renderButton(truckerButton, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signup_with',
              locale: 'en'
            });
          } catch (error) {
            console.error('Error rendering trucker Google button:', error);
          }
        }
      };
      
      // Small delay to ensure DOM is updated
      setTimeout(renderButtons, 100);
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const registrationData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: activeTab
      };

      if (activeTab === 'trucker') {
        registrationData.location = {
          address: formData.address
        };
      }

      const response = await authAPI.register(registrationData);
      
      dispatch(login({
        user: response.data.user,
        token: response.data.token
      }));

      toast.success('Registration successful!');
      navigate(`/dashboard/${response.data.user.role}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="my-5">
      <Row className="justify-content-center">
        <Col md={6}>
          <Card className="shadow">
            <Card.Body>
              <h2 className="text-center mb-4">Create Account</h2>
              
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k || 'customer')}
                className="mb-4"
              >
                <Tab eventKey="customer" title="I'm a Customer">
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Full Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                        minLength={6}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Confirm Password</Form.Label>
                      <Form.Control
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Button 
                      variant="primary" 
                      type="submit" 
                      className="w-100"
                      disabled={loading}
                    >
                      {loading ? 'Registering...' : 'Register'}
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

                  <div id="google-signin-button-customer" className="mb-3"></div>
                  
                  {!process.env.REACT_APP_GOOGLE_CLIENT_ID && (
                    <p className="text-muted small text-center">
                      Google sign-in is not configured
                    </p>
                  )}
                </Tab>

                <Tab eventKey="trucker" title="I'm a Trucker">
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Full Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Phone Number</Form.Label>
                      <Form.Control
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Location Address</Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                        minLength={6}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Confirm Password</Form.Label>
                      <Form.Control
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                      />
                    </Form.Group>
                    <Button 
                      variant="primary" 
                      type="submit" 
                      className="w-100"
                      disabled={loading}
                    >
                      {loading ? 'Registering...' : 'Register'}
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

                  <div id="google-signin-button-trucker" className="mb-3"></div>
                  
                  {!process.env.REACT_APP_GOOGLE_CLIENT_ID && (
                    <p className="text-muted small text-center">
                      Google sign-in is not configured
                    </p>
                  )}
                </Tab>
              </Tabs>
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

export default Register;

