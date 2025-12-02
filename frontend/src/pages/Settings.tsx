import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Tab, Tabs, Badge, Alert } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setUser } from '../store/authSlice';
import { toast } from 'react-toastify';
import { usersAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const Settings: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userId = user?.id || (user as any)?._id || '';

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'password' : 'profile');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.location?.address || '',
    bio: user?.profile?.bio || '',
    avatar: user?.profile?.avatar || '',
    licenseNumber: user?.profile?.licenseNumber || '',
    mpesaPhone: user?.mpesaDetails?.phoneNumber || '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        address: user.location?.address || '',
        bio: user.profile?.bio || '',
        avatar: user.profile?.avatar || '',
        licenseNumber: user.profile?.licenseNumber || '',
        mpesaPhone: user.mpesaDetails?.phoneNumber || '',
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    try {
      const updateData: any = {
        name: profileForm.name,
        phone: profileForm.phone,
        location: {
          address: profileForm.address,
        },
        profile: {
          bio: profileForm.bio,
          avatar: profileForm.avatar,
        },
      };

      if (user?.role === 'trucker') {
        updateData.profile.licenseNumber = profileForm.licenseNumber;
      }

      if (profileForm.mpesaPhone) {
        updateData.mpesaDetails = {
          phoneNumber: profileForm.mpesaPhone,
        };
      }

      const response = await usersAPI.update(userId, updateData);
      
      // Update Redux store
      const normalizedUser = {
        ...response.data,
        id: response.data._id || response.data.id,
      };
      dispatch(setUser(normalizedUser));
      
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await usersAPI.changePassword(userId, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      toast.success('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Container className="my-5">
        <Alert variant="warning">Please log in to access settings.</Alert>
      </Container>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      {(user?.role === 'customer' || user?.role === 'trucker') && <Sidebar />}
      <div style={{ marginLeft: (user?.role === 'customer' || user?.role === 'trucker') ? '250px' : '0', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
        <Row className="mb-4">
          <Col>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h2 className="mb-1 fw-bold">Settings</h2>
                <p className="text-muted mb-0">Manage your account and preferences</p>
              </div>
              <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                ← Back
              </Button>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={3}>
            <Card style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body className="p-0">
                <div className="text-center p-4 border-bottom">
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 15px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>
                    {profileForm.avatar ? (
                      <img src={profileForm.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <h5 className="mb-1">{user.name}</h5>
                  <Badge bg={user.role === 'trucker' ? 'primary' : user.role === 'customer' ? 'success' : 'warning'}>
                    {user.role?.toUpperCase()}
                  </Badge>
                  <p className="text-muted small mt-2 mb-0">{user.email}</p>
                </div>
                <div className="p-2">
                  {user.role !== 'admin' && (
                    <Button
                      variant={activeTab === 'profile' ? 'primary' : 'outline-primary'}
                      className="w-100 mb-2 text-start"
                      onClick={() => setActiveTab('profile')}
                    >
                      Profile Information
                    </Button>
                  )}
                  <Button
                    variant={activeTab === 'password' ? 'primary' : 'outline-primary'}
                    className="w-100 mb-2 text-start"
                    onClick={() => setActiveTab('password')}
                  >
                    Change Password
                  </Button>
                  {user.role === 'trucker' && (
                    <Button
                      variant={activeTab === 'trucker' ? 'primary' : 'outline-primary'}
                      className="w-100 mb-2 text-start"
                      onClick={() => setActiveTab('trucker')}
                    >
                      Trucker Details
                    </Button>
                  )}
                  {(user.role === 'customer' || user.role === 'trucker') && (
                    <Button
                      variant={activeTab === 'payment' ? 'primary' : 'outline-primary'}
                      className="w-100 mb-2 text-start"
                      onClick={() => setActiveTab('payment')}
                    >
                      Payment Settings
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={9}>
            <Card style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || (user.role === 'admin' ? 'password' : 'profile'))} className="mb-4">
                  {/* Profile Tab - Not for admin */}
                  {user.role !== 'admin' && (
                    <Tab eventKey="profile" title="Profile">
                    <Form onSubmit={handleProfileUpdate}>
                      <h5 className="mb-4">Profile Information</h5>
                      
                      <Row className="mb-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Full Name *</Form.Label>
                            <Form.Control
                              type="text"
                              value={profileForm.name}
                              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                              required
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Phone Number *</Form.Label>
                            <Form.Control
                              type="tel"
                              value={profileForm.phone}
                              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                              required
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control type="email" value={user.email || ''} disabled />
                        <Form.Text className="text-muted">Email cannot be changed</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Address</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="e.g. Nairobi, Kenya"
                          value={profileForm.address}
                          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Bio</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          placeholder="Tell us about yourself..."
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Profile Picture</Form.Label>
                        <div className="mb-3">
                          {profileForm.avatar && (
                            <div className="mb-2">
                              <img 
                                src={profileForm.avatar} 
                                alt="Profile" 
                                style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #dee2e6' }}
                              />
                            </div>
                          )}
                          <div className="d-flex gap-2 flex-wrap">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = async (e: any) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    try {
                                      const formData = new FormData();
                                      formData.append('avatar', file);
                                      const response = await usersAPI.uploadAvatar(userId, formData);
                                      setProfileForm({ ...profileForm, avatar: response.data.avatar });
                                      toast.success('Profile picture updated!');
                                    } catch (error: any) {
                                      toast.error(error.response?.data?.message || 'Failed to upload image');
                                    }
                                  }
                                };
                                input.click();
                              }}
                            >
                              Choose from Gallery
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  // Request camera permission and open camera
                                  const stream = await navigator.mediaDevices.getUserMedia({ 
                                    video: { facingMode: 'user' },
                                    audio: false 
                                  });
                                  
                                  // Create a video element to show camera preview
                                  const video = document.createElement('video');
                                  video.srcObject = stream;
                                  video.autoplay = true;
                                  video.style.position = 'fixed';
                                  video.style.top = '50%';
                                  video.style.left = '50%';
                                  video.style.transform = 'translate(-50%, -50%)';
                                  video.style.zIndex = '10000';
                                  video.style.width = '90vw';
                                  video.style.maxWidth = '500px';
                                  video.style.borderRadius = '10px';
                                  video.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
                                  
                                  // Create capture button
                                  const captureBtn = document.createElement('button');
                                  captureBtn.textContent = 'Capture Photo';
                                  captureBtn.style.position = 'fixed';
                                  captureBtn.style.bottom = '20px';
                                  captureBtn.style.left = '50%';
                                  captureBtn.style.transform = 'translateX(-50%)';
                                  captureBtn.style.zIndex = '10001';
                                  captureBtn.style.padding = '15px 30px';
                                  captureBtn.style.fontSize = '16px';
                                  captureBtn.style.borderRadius = '50px';
                                  captureBtn.style.border = 'none';
                                  captureBtn.style.background = '#007bff';
                                  captureBtn.style.color = 'white';
                                  captureBtn.style.cursor = 'pointer';
                                  captureBtn.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
                                  
                                  // Create cancel button
                                  const cancelBtn = document.createElement('button');
                                  cancelBtn.textContent = '✕ Cancel';
                                  cancelBtn.style.position = 'fixed';
                                  cancelBtn.style.top = '20px';
                                  cancelBtn.style.right = '20px';
                                  cancelBtn.style.zIndex = '10001';
                                  cancelBtn.style.padding = '10px 20px';
                                  cancelBtn.style.fontSize = '14px';
                                  cancelBtn.style.borderRadius = '25px';
                                  cancelBtn.style.border = 'none';
                                  cancelBtn.style.background = '#dc3545';
                                  cancelBtn.style.color = 'white';
                                  cancelBtn.style.cursor = 'pointer';
                                  
                                  // Create overlay
                                  const overlay = document.createElement('div');
                                  overlay.style.position = 'fixed';
                                  overlay.style.top = '0';
                                  overlay.style.left = '0';
                                  overlay.style.width = '100%';
                                  overlay.style.height = '100%';
                                  overlay.style.background = 'rgba(0,0,0,0.8)';
                                  overlay.style.zIndex = '9999';
                                  
                                  // Create canvas for capturing
                                  const canvas = document.createElement('canvas');
                                  const ctx = canvas.getContext('2d');
                                  
                                  const cleanup = () => {
                                    stream.getTracks().forEach(track => track.stop());
                                    document.body.removeChild(video);
                                    document.body.removeChild(captureBtn);
                                    document.body.removeChild(cancelBtn);
                                    document.body.removeChild(overlay);
                                  };
                                  
                                  captureBtn.onclick = () => {
                                    canvas.width = video.videoWidth;
                                    canvas.height = video.videoHeight;
                                    ctx?.drawImage(video, 0, 0);
                                    
                                    canvas.toBlob(async (blob) => {
                                      if (blob) {
                                        cleanup();
                                        try {
                                          const formData = new FormData();
                                          formData.append('avatar', blob, 'photo.jpg');
                                          const response = await usersAPI.uploadAvatar(userId, formData);
                                          setProfileForm({ ...profileForm, avatar: response.data.avatar });
                                          toast.success('Profile picture updated!');
                                        } catch (error: any) {
                                          toast.error(error.response?.data?.message || 'Failed to upload image');
                                        }
                                      }
                                    }, 'image/jpeg', 0.9);
                                  };
                                  
                                  cancelBtn.onclick = () => {
                                    cleanup();
                                  };
                                  
                                  document.body.appendChild(overlay);
                                  document.body.appendChild(video);
                                  document.body.appendChild(captureBtn);
                                  document.body.appendChild(cancelBtn);
                                } catch (error: any) {
                                  // Fallback to file input with camera capture
                                  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                                    toast.error('Camera permission denied. Please allow camera access or use gallery option.');
                                  } else {
                                    // Fallback to file input with capture attribute
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.capture = 'user';
                                    input.onchange = async (e: any) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        try {
                                          const formData = new FormData();
                                          formData.append('avatar', file);
                                          const response = await usersAPI.uploadAvatar(userId, formData);
                                          setProfileForm({ ...profileForm, avatar: response.data.avatar });
                                          toast.success('Profile picture updated!');
                                        } catch (error: any) {
                                          toast.error(error.response?.data?.message || 'Failed to upload image');
                                        }
                                      }
                                    };
                                    input.click();
                                  }
                                }
                              }}
                            >
                              Take Photo
                            </Button>
                          </div>
                        </div>
                        <Form.Control
                          type="url"
                          placeholder="Or enter a URL to your profile picture"
                          value={profileForm.avatar}
                          onChange={(e) => setProfileForm({ ...profileForm, avatar: e.target.value })}
                        />
                        <Form.Text className="text-muted">Upload from gallery, take a photo, or enter a URL</Form.Text>
                      </Form.Group>

                      <div className="d-flex justify-content-end">
                        <Button type="submit" variant="primary" disabled={loading}>
                          {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </Form>
                  </Tab>
                  )}

                  {/* Password Tab */}
                  <Tab eventKey="password" title="Password">
                    <Form onSubmit={handlePasswordChange}>
                      <h5 className="mb-4">Change Password</h5>
                      <Alert variant="info" className="mb-4">
                        <strong>Security Tip:</strong> Use a strong password with at least 6 characters, including letters and numbers.
                      </Alert>

                      <Form.Group className="mb-3">
                        <Form.Label>Current Password *</Form.Label>
                        <Form.Control
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>New Password *</Form.Label>
                        <Form.Control
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          required
                          minLength={6}
                        />
                        <Form.Text className="text-muted">Must be at least 6 characters</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Confirm New Password *</Form.Label>
                        <Form.Control
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          required
                          minLength={6}
                        />
                      </Form.Group>

                      <div className="d-flex justify-content-end">
                        <Button type="submit" variant="primary" disabled={loading}>
                          {loading ? 'Changing...' : 'Change Password'}
                        </Button>
                      </div>
                    </Form>
                  </Tab>

                  {/* Trucker Details Tab */}
                  {user.role === 'trucker' && (
                    <Tab eventKey="trucker" title="Trucker">
                      <Form onSubmit={handleProfileUpdate}>
                        <h5 className="mb-4">Trucker Information</h5>
                        <Alert variant="info" className="mb-4">
                          This information helps customers verify your credentials and trust your services.
                        </Alert>

                        <Form.Group className="mb-3">
                          <Form.Label>License Number</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="e.g. DL-12345"
                            value={profileForm.licenseNumber}
                            onChange={(e) => setProfileForm({ ...profileForm, licenseNumber: e.target.value })}
                          />
                          <Form.Text className="text-muted">Your driving license number (optional but recommended)</Form.Text>
                        </Form.Group>

                        <div className="d-flex justify-content-end">
                          <Button type="submit" variant="primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </Form>
                    </Tab>
                  )}

                  {/* Payment Settings Tab - Only for customers and truckers */}
                  {(user.role === 'customer' || user.role === 'trucker') && (
                    <Tab eventKey="payment" title="Payment">
                      <Form onSubmit={handleProfileUpdate}>
                        <h5 className="mb-4">Payment Settings</h5>
                        <Alert variant="info" className="mb-4">
                          {user?.role === 'customer' 
                            ? 'Configure your M-Pesa phone number to receive refunds and payments directly when bookings are cancelled or refunded.'
                            : 'Configure your M-Pesa phone number to receive payments directly from customers.'}
                        </Alert>

                        <Form.Group className="mb-3">
                          <Form.Label>M-Pesa Phone Number</Form.Label>
                          <Form.Control
                            type="tel"
                            placeholder="e.g. 254712345678"
                            value={profileForm.mpesaPhone}
                            onChange={(e) => setProfileForm({ ...profileForm, mpesaPhone: e.target.value })}
                          />
                          <Form.Text className="text-muted">
                            {user?.role === 'customer'
                              ? 'Enter your M-Pesa registered phone number to receive refunds and payments (format: 254712345678)'
                              : 'Enter your M-Pesa registered phone number to receive payments from customers (format: 254712345678)'}
                          </Form.Text>
                        </Form.Group>

                        <div className="d-flex justify-content-end">
                          <Button type="submit" variant="primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </Form>
                    </Tab>
                  )}
                </Tabs>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        </Container>
      </div>
    </div>
  );
};

export default Settings;

