import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

interface Booking {
  _id: string;
  origin: { address: string };
  destination: { address: string };
  cargoDetails: any;
  pricing: { estimatedAmount: number };
  status: string;
  createdAt: string;
}

const CustomerBookings: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
                <p className="text-muted mb-0">
                  View and manage all your bookings
                </p>
              </div>
              <div className="d-flex gap-2">
                <span className="badge bg-info align-self-center">{bookings.length} total</span>
                <Button variant="primary" onClick={() => navigate('/browse-trucks')}>
                  Book a New Truck
                </Button>
              </div>
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
              <p className="mb-3 text-muted">You have no bookings yet.</p>
              <Button variant="primary" onClick={() => navigate('/browse-trucks')}>
                Browse Available Trucks
              </Button>
            </Card.Body>
          </Card>
        ) : (
          bookings.map((booking) => (
            <Card key={booking._id} className="mb-3 card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
              <Card.Body>
                <Row className="align-items-center">
                  <Col md={8}>
                    <div className="d-flex align-items-center mb-2">
                      <h5 className="mb-0 me-2">
                        {booking.origin.address} → {booking.destination.address}
                      </h5>
                      {getStatusBadge(booking.status)}
                    </div>
                    <p className="text-muted mb-2 small">
                      <strong>Booking Date:</strong> {new Date(booking.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    {booking.cargoDetails && (
                      <p className="text-muted mb-1 small">
                        <strong>Cargo:</strong> {booking.cargoDetails.type} • {booking.cargoDetails.weight} tons
                      </p>
                    )}
                    <p className="mb-0">
                      <strong style={{ color: '#667eea', fontSize: '1.1rem' }}>
                        KES {booking.pricing.estimatedAmount.toLocaleString()}
                      </strong>
                    </p>
                  </Col>
                  <Col
                    md={4}
                    className="text-md-end mt-3 mt-md-0 d-flex align-items-center justify-content-md-end justify-content-start gap-2"
                  >
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => navigate(`/booking/${booking._id}`)}
                    >
                      View Details
                    </Button>
                    {booking.status === 'in-transit' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/tracking/${booking._id}`)}
                      >
                        Track
                      </Button>
                    )}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ))
        )}
        </Container>
      </div>
    </div>
  );
};

export default CustomerBookings;

