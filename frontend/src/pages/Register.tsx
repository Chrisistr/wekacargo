import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Tabs, Tab, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { login, setUser } from '../store/authSlice';
import { authAPI } from '../services/api';
import {
  setGoogleCredentialHandler,
  clearGoogleCredentialHandler,
  ensureGoogleIdentityInitialized,
  clearGoogleButtonHost,
} from '../utils/googleIdentity';
declare global {
  interface Window {
    google: {
      accounts?: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          cancel?: () => void;
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
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleCallbackRef = useRef<(response: any) => void>(() => {});

  const handleGoogleSignIn = async (response: any) => {
    console.log('Google sign-in response received');
    if (!response || !response.credential) {
      console.error('Invalid Google sign-in response:', response);
      toast.error('Google sign-in failed. Please try again.');
      return;
    }
    setLoading(true);
    try {
      console.log('Sending Google credential to backend...');
      const result = await authAPI.googleLogin({ credential: response.credential });
      console.log('Google login successful:', result.data);
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

  googleCallbackRef.current = handleGoogleSignIn;

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) return;

    setGoogleCredentialHandler((r: unknown) => {
      void googleCallbackRef.current(r as any);
    });

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    let mountAttempts = 0;
    const mountButton = () => {
      if (cancelled) return;
      const gsi = window.google?.accounts?.id;
      if (!gsi) return;
      const host = googleButtonRef.current;
      if (!host) {
        mountAttempts += 1;
        if (mountAttempts < 80) {
          timers.push(setTimeout(mountButton, 50));
        }
        return;
      }
      try {
        const slot = document.createElement('div');
        host.replaceChildren(slot);
        ensureGoogleIdentityInitialized(clientId);
        gsi.renderButton(slot, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signup_with',
          locale: 'en',
        });
      } catch (e) {
        console.error('Google Sign-In render error:', e);
      }
    };

    let gsiWaitAttempts = 0;
    const waitForGsiThenMount = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        timers.push(setTimeout(mountButton, 200));
        return;
      }
      gsiWaitAttempts += 1;
      if (gsiWaitAttempts > 200) {
        toast.error(
          'Google Sign-In did not load. Allow scripts from accounts.google.com, turn off ad blockers for this site, or check your network.'
        );
        return;
      }
      timers.push(setTimeout(waitForGsiThenMount, 50));
    };
    waitForGsiThenMount();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearGoogleCredentialHandler();
      clearGoogleButtonHost(googleButtonRef.current);
      try {
        (window.google?.accounts?.id as { cancel?: () => void } | undefined)?.cancel?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

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
                <Tab eventKey="customer" title="I'm a Customer" unmountOnExit={false}>
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
                </Tab>
                <Tab eventKey="trucker" title="I'm a Trucker" unmountOnExit={false}>
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
                </Tab>
              </Tabs>
              {process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim() ? (
                <>
                  <div className="text-center my-3">
                    <div className="position-relative">
                      <hr />
                      <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted">
                        OR
                      </span>
                    </div>
                  </div>
                  <div ref={googleButtonRef} className="mb-2" />
                </>
              ) : (
                <>
                  <div className="text-center my-3">
                    <div className="position-relative">
                      <hr />
                      <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted">
                        OR
                      </span>
                    </div>
                  </div>
                  <Button variant="outline-secondary" className="w-100 mb-2" disabled>
                    Sign up with Google
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      {}
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