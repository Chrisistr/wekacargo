import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert, Modal, Form } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { bookingsAPI, paymentsAPI, ratingsAPI } from '../services/api';
import GoogleMap from '../components/GoogleMap';

const BookingDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    origin: { address: '', contact: '', pickupTime: '' },
    destination: { address: '', contact: '', dropoffTime: '' },
    cargoDetails: { type: '', weight: '', volume: '', description: '', pictures: [] as string[], isDelicate: false },
    specialInstructions: ''
  });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({
    lat: '',
    lng: '',
    estimatedArrival: ''
  });
  const [reviewForm, setReviewForm] = useState({
    rating: 0,
    review: ''
  });

  const fetchBooking = useCallback(async (bookingId: string) => {
    try {
      const response = await bookingsAPI.getById(bookingId);
      setBooking(response.data);
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to fetch booking details';
      toast.error(errorMessage);
      
      // Set booking to null so the "not found" message shows
      setBooking(null);
      
      if (error.response?.status === 401) {
        // Not authenticated
        navigate('/login');
      } else if (error.response?.status === 403) {
        // Not authorized - show message but don't navigate away
        console.log('User not authorized to view this booking');
      } else if (error.response?.status === 404) {
        // Booking not found
        console.log('Booking not found');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const checkReviewStatus = useCallback(async () => {
    if (!booking || !user) return;
    try {
      const response = await ratingsAPI.checkReview(booking._id);
      setHasReviewed(response.data.hasReviewed);
      // Show review modal if booking is completed and user hasn't reviewed yet
      if (booking.status === 'completed' && !response.data.hasReviewed) {
        // Show modal after a short delay to let user see the completion status
        setTimeout(() => {
          setShowReviewModal(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking review status:', error);
    }
  }, [booking, user]);

  useEffect(() => {
    if (id) {
      fetchBooking(id);
    }
  }, [id, fetchBooking]);

  useEffect(() => {
    if (booking && user && booking.status === 'completed' && user.role === 'customer') {
      checkReviewStatus();
    }
  }, [booking, user, checkReviewStatus]);


  const handlePayment = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 9) {
      toast.error('Please enter a valid phone number (e.g., 0712345678 or 254712345678)');
      return;
    }
    
    setProcessingPayment(true);
    try {
      if (!booking) return;
      
      // Format phone number (ensure it starts with 254 for Kenya)
      let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }
      
      const response = await paymentsAPI.initiate({
        bookingId: booking._id,
        phoneNumber: formattedPhone
      });

      // Show success message with customer message from M-Pesa if available
      const successMessage = response.data.customerMessage || 
                            response.data.message || 
                            'Payment initiated. Please check your phone for the M-Pesa prompt.';
      
      toast.success(successMessage, {
        autoClose: 5000
      });
      
      // Don't close modal immediately - let user see success message
      // They can close it manually or it will close when booking status updates
      setPhoneNumber('');
      fetchBooking(booking._id);
      
      // Close modal after a short delay to show success
      setTimeout(() => {
        setShowPaymentModal(false);
      }, 2000);
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Show detailed error message
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errorMessage ||
                          error.response?.data?.CustomerMessage ||
                          error.message || 
                          'Payment failed. Please check your M-Pesa credentials and try again.';
      
      toast.error(errorMessage, {
        autoClose: 7000
      });
      
      // Log additional details for debugging
      if (error.response?.data?.details) {
        console.error('M-Pesa Error Details:', error.response.data.details);
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await bookingsAPI.update(booking._id, { status: newStatus });
      toast.success(`Booking status updated to ${newStatus}`);
      fetchBooking(booking._id);
      // If status is completed and user is customer, check for review
      if (newStatus === 'completed' && user?.role === 'customer') {
        setTimeout(() => {
          checkReviewStatus();
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleLocationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationForm.lat || !locationForm.lng) {
      toast.error('Please enter latitude and longitude');
      return;
    }

    setUpdatingLocation(true);
    try {
      const updateData: any = {
        lat: parseFloat(locationForm.lat),
        lng: parseFloat(locationForm.lng)
      };

      if (locationForm.estimatedArrival) {
        updateData.estimatedArrival = locationForm.estimatedArrival;
      }

      await bookingsAPI.updateTracking(booking._id, updateData);
      toast.success('Location updated successfully! Customer has been notified.');
      setShowLocationModal(false);
      setLocationForm({ lat: '', lng: '', estimatedArrival: '' });
      fetchBooking(booking._id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update location');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || reviewForm.rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmittingReview(true);
    try {
      await ratingsAPI.submit({
        bookingId: booking._id,
        rating: reviewForm.rating,
        review: reviewForm.review.trim() || undefined
      });
      toast.success('Thank you for your review!');
      setShowReviewModal(false);
      setHasReviewed(true);
      setReviewForm({ rating: 0, review: '' });
      fetchBooking(booking._id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setUpdatingStatus(true);
    try {
      await bookingsAPI.update(booking._id, { 
        status: 'cancelled',
        cancellationReason: cancelReason
      });
      toast.success('Booking cancelled');
      setShowCancelModal(false);
      setCancelReason('');
      fetchBooking(booking._id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openEditModal = () => {
    if (booking) {
      setEditForm({
        origin: {
          address: booking.origin.address || '',
          contact: booking.origin.contact || '',
          pickupTime: booking.origin.pickupTime ? new Date(booking.origin.pickupTime).toISOString().slice(0, 16) : ''
        },
        destination: {
          address: booking.destination.address || '',
          contact: booking.destination.contact || '',
          dropoffTime: booking.destination.dropoffTime ? new Date(booking.destination.dropoffTime).toISOString().slice(0, 16) : ''
        },
        cargoDetails: {
          type: booking.cargoDetails?.type || '',
          weight: booking.cargoDetails?.weight?.toString() || '',
          volume: booking.cargoDetails?.volume?.toString() || '',
          description: booking.cargoDetails?.description || '',
          pictures: booking.cargoDetails?.pictures || [],
          isDelicate: booking.cargoDetails?.isDelicate || false
        },
        specialInstructions: booking.specialInstructions || ''
      });
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    setEditing(true);
    try {
      const editData: any = {};

      if (editForm.origin.address) editData.origin = { address: editForm.origin.address };
      if (editForm.origin.contact) editData.origin = { ...editData.origin, contact: editForm.origin.contact };
      if (editForm.origin.pickupTime) editData.origin = { ...editData.origin, pickupTime: editForm.origin.pickupTime };

      if (editForm.destination.address) editData.destination = { address: editForm.destination.address };
      if (editForm.destination.contact) editData.destination = { ...editData.destination, contact: editForm.destination.contact };
      if (editForm.destination.dropoffTime) editData.destination = { ...editData.destination, dropoffTime: editForm.destination.dropoffTime };

      if (editForm.cargoDetails.type || editForm.cargoDetails.weight) {
        editData.cargoDetails = {};
        if (editForm.cargoDetails.type) editData.cargoDetails.type = editForm.cargoDetails.type;
        if (editForm.cargoDetails.weight) editData.cargoDetails.weight = parseFloat(editForm.cargoDetails.weight);
        if (editForm.cargoDetails.volume) editData.cargoDetails.volume = parseFloat(editForm.cargoDetails.volume);
        if (editForm.cargoDetails.description) editData.cargoDetails.description = editForm.cargoDetails.description;
        if (editForm.cargoDetails.pictures && editForm.cargoDetails.pictures.length > 0) {
          editData.cargoDetails.pictures = editForm.cargoDetails.pictures;
        }
      }

      if (editForm.specialInstructions !== undefined) {
        editData.specialInstructions = editForm.specialInstructions;
      }

      await bookingsAPI.edit(booking._id, editData);
      toast.success('Booking updated successfully! The trucker has been notified.');
      setShowEditModal(false);
      fetchBooking(booking._id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update booking');
    } finally {
      setEditing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { bg: 'warning', text: 'Pending' },
      confirmed: { bg: 'info', text: 'Confirmed' },
      'in-transit': { bg: 'primary', text: 'In Transit' },
      completed: { bg: 'success', text: 'Completed' },
      cancelled: { bg: 'danger', text: 'Cancelled' }
    };
    const variant = variants[status] || { bg: 'secondary', text: status };
    return <Badge bg={variant.bg}>{variant.text}</Badge>;
  };

  const getStatusTimeline = () => {
    const statuses = ['pending', 'confirmed', 'in-transit', 'completed'];
    const currentIndex = statuses.indexOf(booking.status);
    
    return statuses.map((status, index) => {
      const isActive = index <= currentIndex;
      const isCurrent = index === currentIndex;
      
      return (
        <div key={status} className="d-flex align-items-center mb-3">
          <div 
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: '40px',
              height: '40px',
              background: isActive ? '#667eea' : '#e0e0e0',
              color: isActive ? 'white' : '#999',
              fontWeight: 'bold',
              marginRight: '15px'
            }}
          >
            {index + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: isCurrent ? 'bold' : 'normal', color: isActive ? '#333' : '#999' }}>
              {status === 'pending' ? 'Booking Pending' :
               status === 'confirmed' ? 'Confirmed by Trucker' :
               status === 'in-transit' ? 'In Transit' :
               'Completed'}
            </div>
            {isCurrent && booking.status === status && (
              <small className="text-muted">Current status</small>
            )}
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <Container className="my-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  if (!booking && !loading) {
    return (
      <Container className="my-5">
        <Alert variant="danger">
          <Alert.Heading>Booking not found</Alert.Heading>
          <p>The booking you're looking for doesn't exist or you don't have permission to view it.</p>
          <div className="d-flex gap-2 mt-3">
            <Button variant="primary" onClick={() => navigate('/')}>
              Go to Homepage
            </Button>
            {(user?.role === 'customer' || user?.role === 'trucker') && (
              <Button variant="outline-primary" onClick={() => navigate(`/dashboard/${user.role}`)}>
                Go to Dashboard
              </Button>
            )}
          </div>
        </Alert>
      </Container>
    );
  }

  if (!booking) {
    return null; // Still loading
  }

  const isCustomer = user?.role === 'customer';
  const isTrucker = user?.role === 'trucker';
  const canUpdateStatus = isTrucker && ['pending', 'confirmed', 'in-transit'].includes(booking.status);
  const canCancel = (isCustomer && booking.status === 'pending') || 
                    (isTrucker && ['pending', 'confirmed'].includes(booking.status));
  const canEdit = isCustomer && booking.status === 'pending';

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Container className="py-5">
        <Row>
          <Col md={8}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h2 className="mb-0">Booking Details</h2>
                  <div className="d-flex gap-2 align-items-center">
                    {getStatusBadge(booking.status)}
                    {canEdit && (
                      <Button variant="outline-primary" size="sm" onClick={openEditModal}>
                        Edit Booking
                      </Button>
                    )}
                  </div>
                </div>

                <Row className="mb-4">
                  <Col md={6}>
                    <Card className="mb-3" style={{ background: '#f8f9fa', border: 'none' }}>
                      <Card.Body>
                        <h6 className="text-muted mb-2">ORIGIN</h6>
                        <p className="mb-1"><strong>{booking.origin.address}</strong></p>
                        {booking.origin.contact && (
                          <p className="mb-0 small text-muted">Contact: {booking.origin.contact}</p>
                        )}
                        {booking.origin.pickupTime && (
                          <p className="mb-0 small text-muted">
                            Pickup: {new Date(booking.origin.pickupTime).toLocaleString()}
                          </p>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={6}>
                    <Card className="mb-3" style={{ background: '#f8f9fa', border: 'none' }}>
                      <Card.Body>
                        <h6 className="text-muted mb-2">DESTINATION</h6>
                        <p className="mb-1"><strong>{booking.destination.address}</strong></p>
                        
                        {/* Route Map */}
                        {booking.origin?.coordinates && booking.destination?.coordinates && (
                          <div className="mt-4">
                            <h6 className="mb-2">Route Map</h6>
                            <GoogleMap
                              origin={booking.origin.coordinates}
                              destination={booking.destination.coordinates}
                              currentLocation={booking.tracking?.currentLocation}
                              height="400px"
                            />
                          </div>
                        )}
                        {booking.destination.contact && (
                          <p className="mb-0 small text-muted">Contact: {booking.destination.contact}</p>
                        )}
                        {booking.destination.dropoffTime && (
                          <p className="mb-0 small text-muted">
                            Delivery: {new Date(booking.destination.dropoffTime).toLocaleString()}
                          </p>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {booking.cargoDetails && (
                  <div className="mb-4">
                    <h5 className="mb-3">Cargo Information</h5>
                    <Row>
                      <Col md={4}>
                        <p><strong>Type:</strong> {booking.cargoDetails.type || 'N/A'}</p>
                      </Col>
                      <Col md={4}>
                        <p><strong>Weight:</strong> {booking.cargoDetails.weight} tons</p>
                      </Col>
                      {booking.cargoDetails.volume && (
                        <Col md={4}>
                          <p><strong>Volume:</strong> {booking.cargoDetails.volume} m³</p>
                        </Col>
                      )}
                    </Row>
                    {booking.cargoDetails.isDelicate && (
                      <Alert variant="warning" className="mt-2 mb-2">
                        <strong>Delicate Cargo:</strong> This cargo requires extra care and special handling
                      </Alert>
                    )}
                    {booking.cargoDetails.description && (
                      <p><strong>Description:</strong> {booking.cargoDetails.description}</p>
                    )}
                    {booking.cargoDetails.pictures && booking.cargoDetails.pictures.length > 0 && (
                      <div className="mt-3">
                        <p><strong>Cargo Pictures:</strong></p>
                        <div className="d-flex flex-wrap gap-2">
                          {booking.cargoDetails.pictures.map((pic: string, idx: number) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <img 
                                src={pic} 
                                alt={`Cargo item ${idx + 1}`}
                                style={{ 
                                  width: '150px', 
                                  height: '150px', 
                                  objectFit: 'cover', 
                                  borderRadius: '8px',
                                  border: '1px solid #dee2e6',
                                  cursor: 'pointer'
                                }}
                                onClick={() => {
                                  // Open image in new window for full view
                                  window.open(pic, '_blank');
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <small className="text-muted d-block mt-2">
                          Click on any image to view in full size
                        </small>
                      </div>
                    )}
                  </div>
                )}

                {booking.specialInstructions && (
                  <Alert variant="info" className="mb-4">
                    <strong>Special Instructions:</strong> {booking.specialInstructions}
                  </Alert>
                )}

                {booking.status === 'completed' && isCustomer && !hasReviewed && (
                  <Alert variant="success" className="mb-4">
                    <Alert.Heading>Delivery Completed!</Alert.Heading>
                    <p>Your delivery has been completed successfully. Please take a moment to rate and review your experience.</p>
                    <Button variant="primary" onClick={() => setShowReviewModal(true)}>
                      Rate & Review
                    </Button>
                  </Alert>
                )}

                {booking.status === 'completed' && isCustomer && hasReviewed && (
                  <Alert variant="success" className="mb-4">
                    <strong>Thank you for your review!</strong> Your feedback helps us improve our service.
                  </Alert>
                )}

                <div className="mb-4">
                  <h5 className="mb-3">Pricing</h5>
                  <Row>
                    <Col md={4}>
                      <p><strong>Distance:</strong> {booking.pricing.distance.toFixed(1)} km</p>
                    </Col>
                    <Col md={4}>
                      <p><strong>Rate:</strong> KES {booking.pricing.rate}/km</p>
                    </Col>
                    <Col md={4}>
                      <p><strong>Estimated Amount:</strong> KES {booking.pricing.estimatedAmount.toLocaleString()}</p>
                    </Col>
                  </Row>
                </div>

                {canUpdateStatus && (
                  <div className="mb-4 p-3" style={{ background: '#e7f3ff', borderRadius: '10px' }}>
                    <h5 className="mb-3">Update Booking Status</h5>
                    <div className="d-flex gap-2 flex-wrap">
                      {booking.status === 'pending' && (
                        <Button 
                          variant="success" 
                          onClick={() => handleStatusUpdate('confirmed')}
                          disabled={updatingStatus}
                        >
                          Confirm Booking
                        </Button>
                      )}
                      {booking.status === 'confirmed' && (
                        <Button 
                          variant="primary" 
                          onClick={() => handleStatusUpdate('in-transit')}
                          disabled={updatingStatus}
                        >
                          Start Transit
                        </Button>
                      )}
                      {booking.status === 'in-transit' && (
                        <>
                          <Button 
                            variant="info" 
                            onClick={() => {
                              // Get current location from browser if available
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  (position) => {
                                    setLocationForm({
                                      lat: position.coords.latitude.toFixed(6),
                                      lng: position.coords.longitude.toFixed(6),
                                      estimatedArrival: ''
                                    });
                                    setShowLocationModal(true);
                                  },
                                  (error) => {
                                    toast.error('Could not get your location. Please enter manually.');
                                    setShowLocationModal(true);
                                  }
                                );
                              } else {
                                setShowLocationModal(true);
                              }
                            }}
                            disabled={updatingLocation}
                          >
                            Update Location
                          </Button>
                          <Button 
                            variant="success" 
                            onClick={() => handleStatusUpdate('completed')}
                            disabled={updatingStatus}
                          >
                            Mark as Completed
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Information Section */}
                <Card className="mb-4">
                  <Card.Body>
                    <h5 className="mb-3">Payment Information</h5>
                    <Row>
                      <Col md={6}>
                        <p><strong>Payment Method:</strong></p>
                        <Badge bg={booking.payment?.method === 'cash' ? 'warning' : 'success'} className="mb-2">
                          {booking.payment?.method === 'cash' ? 'Cash on Delivery' : 'M-Pesa'}
                        </Badge>
                      </Col>
                      <Col md={6}>
                        <p><strong>Amount:</strong></p>
                        <h5 className="text-primary">KES {booking.pricing.estimatedAmount.toLocaleString()}</h5>
                      </Col>
                    </Row>
                    <p className="mb-0 mt-2">
                      <strong>Status:</strong> <Badge bg={booking.payment.status === 'paid' ? 'success' : 'warning'}>
                        {booking.payment.status === 'paid' ? 'Paid' : 'Pending'}
                      </Badge>
                    </p>
                  </Card.Body>
                </Card>

                {/* Payment Action Section */}
                {isCustomer && booking.payment.status !== 'paid' && booking.payment.status !== 'completed' && (booking.status === 'confirmed' || booking.status === 'completed') && (
                  <Card className="mb-4" style={{ 
                    background: booking.payment?.method === 'cash' ? '#fff3cd' : '#fff3cd', 
                    border: '1px solid #ffc107' 
                  }}>
                    <Card.Body>
                      <h5 className="mb-3">Complete Payment</h5>
                      
                      {booking.payment?.method === 'cash' ? (
                        <Alert variant="warning" className="mb-0">
                          <strong>Cash Payment Reminder:</strong> Please have the exact amount (KES {booking.pricing.estimatedAmount.toLocaleString()}) ready when the delivery arrives. 
                          The trucker will collect payment upon delivery completion.
                        </Alert>
                      ) : (
                        <>
                          <p className="mb-3">
                            Amount: <strong>KES {booking.pricing.estimatedAmount.toLocaleString()}</strong>
                          </p>
                          {booking.payment?.status === 'processing' && (
                            <Alert variant="info" className="mb-3">
                              <small>Payment is being processed. If you need to try again with a different number, click the button below.</small>
                            </Alert>
                          )}
                          {booking.payment?.status === 'failed' && (
                            <Alert variant="danger" className="mb-3">
                              <small>Previous payment attempt failed. Please try again.</small>
                            </Alert>
                          )}
                          {booking.payment?.status === 'pending' && (
                            <p className="mb-3 text-muted">
                              Complete your payment via M-Pesa to proceed with the delivery.
                            </p>
                          )}
                          <Button variant="primary" className="w-100" onClick={() => {
                            setPhoneNumber(user?.phone || '');
                            setShowPaymentModal(true);
                          }}>
                            Pay with M-Pesa
                          </Button>
                        </>
                      )}
                    </Card.Body>
                  </Card>
                )}

                {/* Cash Payment Reminder (shown throughout booking) */}
                {isCustomer && booking.payment?.method === 'cash' && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                  <Alert variant="info" className="mb-4">
                    <strong>Cash Payment Reminder:</strong> Please ensure you have KES {booking.pricing.estimatedAmount.toLocaleString()} ready in cash when the trucker arrives for delivery.
                  </Alert>
                )}

                {canCancel && (
                  <Button 
                    variant="outline-danger" 
                    onClick={() => setShowCancelModal(true)}
                    className="mt-3"
                  >
                    Cancel Booking
                  </Button>
                )}

                {booking.status === 'in-transit' && (
                  <Button 
                    variant="info" 
                    className="mt-3 ms-2"
                    onClick={() => navigate(`/tracking/${booking._id}`)}
                  >
                    Track Delivery
                  </Button>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <h5 className="mb-3">Status Timeline</h5>
                {getStatusTimeline()}
              </Card.Body>
            </Card>

            <Card className="shadow-sm mb-4">
              <Card.Body>
                <h5 className="mb-3">
                  {isCustomer ? 'Trucker Information' : 'Customer Information'}
                </h5>
                <div className="text-center mb-3">
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    margin: '0 auto 15px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '2rem',
                    fontWeight: 'bold'
                  }}>
                    {isCustomer ? (
                      booking.trucker?.profile?.avatar ? (
                        <img 
                          src={booking.trucker.profile.avatar} 
                          alt={booking.trucker?.name || 'Trucker'} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.textContent = booking.trucker?.name?.charAt(0).toUpperCase() || 'T';
                            }
                          }}
                        />
                      ) : (
                        booking.trucker?.name?.charAt(0).toUpperCase() || 'T'
                      )
                    ) : (
                      booking.customer?.profile?.avatar ? (
                        <img 
                          src={booking.customer.profile.avatar} 
                          alt={booking.customer?.name || 'Customer'} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.textContent = booking.customer?.name?.charAt(0).toUpperCase() || 'C';
                            }
                          }}
                        />
                      ) : (
                        booking.customer?.name?.charAt(0).toUpperCase() || 'C'
                      )
                    )}
                  </div>
                  <h6 className="mb-0">{isCustomer ? booking.trucker?.name : booking.customer?.name}</h6>
                </div>
                <p><strong>Phone:</strong> {isCustomer ? booking.trucker?.phone : booking.customer?.phone}</p>
                {isCustomer && booking.trucker?.rating && (
                  <p>
                    <strong>Rating:</strong>{' '}
                    <span className="rating-stars-filled">
                      {'★'.repeat(Math.floor(booking.trucker.rating.average || 0))}
                    </span>
                    <span className="rating-stars-empty">
                      {'☆'.repeat(5 - Math.floor(booking.trucker.rating.average || 0))}
                    </span>
                    {' '}
                    {booking.trucker.rating.average?.toFixed(1) || 0}
                  </p>
                )}
              </Card.Body>
            </Card>

            {booking.truck && (
              <Card className="shadow-sm">
                <Card.Body>
                  <h5 className="mb-3">Truck Details</h5>
                  <p><strong>Type:</strong> {booking.truck.type}</p>
                  <p><strong>Registration:</strong> {booking.truck.registrationNumber}</p>
                  <p><strong>Capacity:</strong> {booking.truck.capacity.weight} tons</p>
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>

        <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Cancel Booking</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Reason for Cancellation *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  placeholder="Please provide a reason for cancelling this booking..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Close
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={updatingStatus}>
              {updatingStatus ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Edit Booking Modal */}
        <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
          <Form onSubmit={handleEditSubmit}>
            <Modal.Header closeButton>
              <Modal.Title>Edit Booking</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Alert variant="info" className="mb-3">
                You can only edit bookings that are pending. Once the trucker confirms, changes require communication.
              </Alert>

              <h6 className="mb-3">Origin Details</h6>
              <Form.Group className="mb-3">
                <Form.Label>Pickup Address</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.origin.address}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev,
                    origin: { ...prev.origin, address: e.target.value }
                  }))}
                  required
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control
                      type="text"
                      value={editForm.origin.contact}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        origin: { ...prev.origin, contact: e.target.value }
                      }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Pickup Time</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={editForm.origin.pickupTime}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        origin: { ...prev.origin, pickupTime: e.target.value }
                      }))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <hr />

              <h6 className="mb-3">Destination Details</h6>
              <Form.Group className="mb-3">
                <Form.Label>Delivery Address</Form.Label>
                <Form.Control
                  type="text"
                  value={editForm.destination.address}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev,
                    destination: { ...prev.destination, address: e.target.value }
                  }))}
                  required
                />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Contact Person</Form.Label>
                    <Form.Control
                      type="text"
                      value={editForm.destination.contact}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        destination: { ...prev.destination, contact: e.target.value }
                      }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Delivery Time</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={editForm.destination.dropoffTime}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        destination: { ...prev.destination, dropoffTime: e.target.value }
                      }))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <hr />

              <h6 className="mb-3">Cargo Details</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Cargo Type</Form.Label>
                    <Form.Select
                      value={editForm.cargoDetails.type}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        cargoDetails: { ...prev.cargoDetails, type: e.target.value }
                      }))}
                      required
                    >
                      <option value="">Select cargo type</option>
                      <option value="general">General Cargo</option>
                      <option value="furniture">Furniture</option>
                      <option value="construction">Construction Materials</option>
                      <option value="agricultural">Agricultural Products</option>
                      <option value="electronics">Electronics</option>
                      <option value="food">Food & Beverages</option>
                      <option value="other">Other</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Weight (tons)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.1"
                      value={editForm.cargoDetails.weight}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        cargoDetails: { ...prev.cargoDetails, weight: e.target.value }
                      }))}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editForm.cargoDetails.description}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev,
                    cargoDetails: { ...prev.cargoDetails, description: e.target.value }
                  }))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Cargo Pictures</Form.Label>
                <Form.Text className="text-muted d-block mb-2">
                  Upload pictures of the items to be delivered.
                </Form.Text>
                <Form.Control
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (!files || files.length === 0) return;
                    
                    const toBase64 = (file: File) =>
                      new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = (error) => reject(error);
                      });

                    try {
                      const converted = await Promise.all(Array.from(files).map((file) => toBase64(file)));
                      setEditForm(prev => ({
                        ...prev,
                        cargoDetails: { 
                          ...prev.cargoDetails, 
                          pictures: [...(prev.cargoDetails.pictures || []), ...converted]
                        }
                      }));
                      toast.success(`${converted.length} picture(s) uploaded`);
                    } catch (error) {
                      toast.error('Failed to upload pictures');
                    }
                  }}
                />
                {editForm.cargoDetails.pictures && editForm.cargoDetails.pictures.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {editForm.cargoDetails.pictures.map((pic, idx) => (
                      <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                        <img 
                          src={pic} 
                          alt={`Cargo ${idx + 1}`}
                          style={{ 
                            width: '100px', 
                            height: '100px', 
                            objectFit: 'cover', 
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                          }}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            padding: 0,
                            fontSize: '12px'
                          }}
                          onClick={() => {
                            setEditForm(prev => ({
                              ...prev,
                              cargoDetails: {
                                ...prev.cargoDetails,
                                pictures: prev.cargoDetails.pictures.filter((_, i) => i !== idx)
                              }
                            }));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>

              <hr />

              <Form.Group className="mb-3">
                <Form.Label>Special Instructions</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editForm.specialInstructions}
                  onChange={(e) => setEditForm(prev => ({
                    ...prev,
                    specialInstructions: e.target.value
                  }))}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={editing}>
                {editing ? 'Saving...' : 'Save Changes'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Review Modal */}
        <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Rate Your Delivery Experience</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleReviewSubmit}>
            <Modal.Body>
              <Alert variant="info" className="mb-4">
                <strong>How was your delivery experience?</strong>
                <p className="mb-0 mt-2">Your feedback helps us improve our service and helps other customers make informed decisions.</p>
              </Alert>

              <Form.Group className="mb-4">
                <Form.Label>
                  <strong>Overall Rating *</strong>
                </Form.Label>
                <div className="d-flex gap-2 align-items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      type="button"
                      variant={reviewForm.rating >= star ? 'warning' : 'outline-secondary'}
                      onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                      style={{
                        fontSize: '2rem',
                        padding: '0.5rem 1rem',
                        border: 'none',
                        background: reviewForm.rating >= star ? 'none' : 'transparent',
                        color: reviewForm.rating >= star ? '#ffc107' : '#6c757d'
                      }}
                    >
                      ★
                    </Button>
                  ))}
                  {reviewForm.rating > 0 && (
                    <span className="ms-3">
                      {reviewForm.rating === 5 && 'Excellent!'}
                      {reviewForm.rating === 4 && 'Great!'}
                      {reviewForm.rating === 3 && 'Good'}
                      {reviewForm.rating === 2 && 'Fair'}
                      {reviewForm.rating === 1 && 'Poor'}
                    </span>
                  )}
                </div>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Write a Review (Optional)</strong>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  placeholder="Share your experience with the driver and delivery service..."
                  value={reviewForm.review}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, review: e.target.value }))}
                  maxLength={500}
                />
                <Form.Text className="text-muted">
                  {reviewForm.review.length}/500 characters
                </Form.Text>
              </Form.Group>

              {booking?.trucker && (
                <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                  <p className="mb-1"><strong>You're reviewing:</strong></p>
                  <p className="mb-0">{booking.trucker.name || 'Trucker'}</p>
                  {booking.truck && (
                    <p className="mb-0 small text-muted">{booking.truck.type} - {booking.truck.registrationNumber}</p>
                  )}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
                Maybe Later
              </Button>
              <Button variant="primary" type="submit" disabled={reviewForm.rating === 0 || submittingReview}>
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Location Update Modal (for truckers) */}
        <Modal show={showLocationModal} onHide={() => {
          if (!updatingLocation) {
            setShowLocationModal(false);
          }
        }}>
          <Modal.Header closeButton>
            <Modal.Title>Update Delivery Location</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleLocationUpdate}>
            <Modal.Body>
              <Alert variant="info" className="mb-3">
                <small>
                  Update your current location so the customer can track the delivery in real-time.
                  You can use your phone's GPS or enter coordinates manually.
                </small>
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>Latitude *</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  placeholder="e.g., -1.2921"
                  value={locationForm.lat}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, lat: e.target.value }))}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Longitude *</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  placeholder="e.g., 36.8219"
                  value={locationForm.lng}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, lng: e.target.value }))}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Estimated Arrival (Optional)</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={locationForm.estimatedArrival}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, estimatedArrival: e.target.value }))}
                />
                <Form.Text className="text-muted">
                  When do you expect to arrive at the destination?
                </Form.Text>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button 
                variant="secondary" 
                onClick={() => setShowLocationModal(false)} 
                disabled={updatingLocation}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={updatingLocation || !locationForm.lat || !locationForm.lng}
              >
                {updatingLocation ? 'Updating...' : 'Update Location'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Payment Modal */}
        <Modal show={showPaymentModal} onHide={() => {
          if (!processingPayment) {
            setShowPaymentModal(false);
          }
        }}>
          <Modal.Header closeButton>
            <Modal.Title>Pay with M-Pesa</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {booking && (
              <>
                {(booking.payment?.status === 'processing' || booking.payment?.status === 'failed') && (
                  <Alert variant={booking.payment?.status === 'failed' ? 'danger' : 'info'} className="mb-3">
                    <small>
                      {booking.payment?.status === 'processing' 
                        ? 'Payment is being processed. You can try again with a different phone number if needed.'
                        : 'Previous payment attempt failed. Please check your phone number and try again.'}
                    </small>
                  </Alert>
                )}
                <div className="mb-3">
                  <p className="mb-1"><strong>Amount to Pay:</strong></p>
                  <h4 className="text-primary">KES {booking.pricing.estimatedAmount.toLocaleString()}</h4>
                </div>
                <Form.Group className="mb-3">
                  <Form.Label>M-Pesa Phone Number</Form.Label>
                  <Form.Control
                    type="tel"
                    placeholder="0712345678 or 254712345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={processingPayment}
                    autoFocus
                  />
                  <Form.Text className="text-muted">
                    Enter your M-Pesa registered phone number (e.g., 0712345678 or 254712345678)
                    <br />
                    <strong>For testing (sandbox):</strong> Use 254708374149
                  </Form.Text>
                </Form.Group>
                <Alert variant="info" className="mb-0">
                  <small>
                    You will receive an M-Pesa prompt on your phone. Enter your PIN to complete the payment.
                  </small>
                </Alert>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button 
              variant="secondary" 
              onClick={() => setShowPaymentModal(false)} 
              disabled={processingPayment}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handlePayment} 
              disabled={processingPayment || !phoneNumber}
            >
              {processingPayment ? 'Processing...' : 'Pay Now'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default BookingDetails;
