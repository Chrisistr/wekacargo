import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { bookingsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

interface Booking {
  _id: string;
  customer: { name: string; phone: string; profile?: { avatar?: string } };
  origin: { address: string };
  destination: { address: string };
  cargoDetails: any;
  pricing: { estimatedAmount: number };
  status: string;
  createdAt: string;
}

const TruckerBookings: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const response = await bookingsAPI.getMyBookings();
      setBookings(response.data);
    } catch (error) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchBookings();
  }, [user, fetchBookings]);

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'warning',
      confirmed: 'info',
      'in-transit': 'primary',
      completed: 'success',
      cancelled: 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await bookingsAPI.update(bookingId, { status: newStatus });
      toast.success('Booking status updated');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold">My Bookings</h2>
                  <p className="text-muted mb-0">View and manage all your bookings</p>
                </div>
                <Badge bg="info" style={{ fontSize: '1rem', padding: '8px 15px' }}>
                  {bookings.length} total
                </Badge>
              </div>
            </Col>
          </Row>

          {loading ? (
            <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 text-muted">Loading bookings...</p>
              </Card.Body>
            </Card>
          ) : bookings.length === 0 ? (
            <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <p className="text-muted">No bookings yet. Your bookings will appear here once customers book your trucks.</p>
              </Card.Body>
            </Card>
          ) : (
            <Row className="g-3">
              {bookings.map((booking) => (
                <Col key={booking._id} md={6}>
                  <Card className="card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', height: '100%' }}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center">
                          <div style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            marginRight: '12px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {(booking.customer as any)?.profile?.avatar ? (
                              <img 
                                src={(booking.customer as any).profile.avatar} 
                                alt={booking.customer.name || 'Customer'} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.textContent = booking.customer.name?.charAt(0).toUpperCase() || 'C';
                                  }
                                }}
                              />
                            ) : (
                              booking.customer.name?.charAt(0).toUpperCase() || 'C'
                            )}
                          </div>
                          <div>
                            <h6 className="mb-1">{booking.customer.name}</h6>
                            <p className="text-muted small mb-0">{booking.customer.phone}</p>
                          </div>
                        </div>
                        {getStatusBadge(booking.status)}
                      </div>
                      
                      <div className="mb-3">
                        <p className="mb-1">
                          <strong>Route:</strong> {booking.origin.address} → {booking.destination.address}
                        </p>
                        {booking.cargoDetails && (
                          <p className="mb-1 small text-muted">
                            <strong>Cargo:</strong> {booking.cargoDetails.type} • {booking.cargoDetails.weight} tons
                          </p>
                        )}
                        <p className="mb-0">
                          <strong style={{ color: '#667eea', fontSize: '1.1rem' }}>
                            KES {booking.pricing.estimatedAmount.toLocaleString()}
                          </strong>
                        </p>
                      </div>

                      <div className="d-flex gap-2 flex-wrap">
                        {booking.status === 'pending' && (
                          <Button 
                            size="sm" 
                            variant="success"
                            onClick={() => updateBookingStatus(booking._id, 'confirmed')}
                          >
                            Accept Booking
                          </Button>
                        )}
                        {booking.status === 'confirmed' && (
                          <Button 
                            size="sm" 
                            variant="primary"
                            onClick={() => updateBookingStatus(booking._id, 'in-transit')}
                          >
                            Start Transit
                          </Button>
                        )}
                        {booking.status === 'in-transit' && (
                          <Button 
                            size="sm" 
                            variant="success"
                            onClick={() => updateBookingStatus(booking._id, 'completed')}
                          >
                            Mark Complete
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline-primary"
                          onClick={() => navigate(`/booking/${booking._id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Container>
      </div>
    </div>
  );
};

export default TruckerBookings;



