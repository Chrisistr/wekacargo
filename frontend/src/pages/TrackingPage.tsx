import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { bookingsAPI } from '../services/api';
import GoogleMap from '../components/GoogleMap';
const TrackingPage: React.FC = () => {
  const { id } = useParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchBooking = useCallback(async (bookingId: string) => {
    try {
      const response = await bookingsAPI.getById(bookingId);
      setBooking(response.data);
    } catch (error) {
      toast.error('Failed to fetch tracking information');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (id) {
      fetchBooking(id);
    }
  }, [id, fetchBooking]);
  useEffect(() => {
    if (!id || !booking || booking.status !== 'in-transit') {
      return;
    }
    const interval = setInterval(() => {
      if (id) {
        fetchBooking(id);
      }
    }, 30000); 
    return () => clearInterval(interval);
  }, [id, booking, fetchBooking]);
  if (loading) {
    return (
      <Container className="my-5">
        <p>Loading tracking information...</p>
      </Container>
    );
  }
  if (!booking) {
    return (
      <Container className="my-5">
        <p>Booking not found</p>
      </Container>
    );
  }
  return (
    <Container className="my-5">
      <Row>
        <Col md={8} className="mx-auto">
          <Card>
            <Card.Body>
              <h2 className="mb-4">Track Your Delivery</h2>
              <div className="mb-4">
                <h5>Current Status</h5>
                <p className="fs-4 text-capitalize">{booking.status}</p>
              </div>
              <div className="mb-4">
                <h5>Origin</h5>
                <p>{booking.origin.address}</p>
                {booking.origin.pickupTime && (
                  <p className="text-muted">
                    Pickup: {new Date(booking.origin.pickupTime).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <h5>Destination</h5>
                <p>{booking.destination.address}</p>
                {booking.tracking?.estimatedArrival && (
                  <p className="text-info">
                    ETA: {new Date(booking.tracking.estimatedArrival).toLocaleString()}
                  </p>
                )}
              </div>
              {booking.tracking?.currentLocation && (
                <div className="mb-4">
                  <h5>Current Location</h5>
                  <p>
                    {booking.tracking.currentLocation.lat.toFixed(4)}, 
                    {booking.tracking.currentLocation.lng.toFixed(4)}
                  </p>
                  <p className="text-muted">
                    Last updated: {new Date(booking.tracking.lastUpdate).toLocaleString()}
                  </p>
                </div>
              )}
              {}
              <div className="mt-4">
                <GoogleMap
                  origin={booking.origin?.coordinates ? {
                    lat: booking.origin.coordinates.lat,
                    lng: booking.origin.coordinates.lng
                  } : undefined}
                  destination={booking.destination?.coordinates ? {
                    lat: booking.destination.coordinates.lat,
                    lng: booking.destination.coordinates.lng
                  } : undefined}
                  currentLocation={booking.tracking?.currentLocation ? {
                    lat: booking.tracking.currentLocation.lat,
                    lng: booking.tracking.currentLocation.lng
                  } : undefined}
                  height="400px"
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
export default TrackingPage;