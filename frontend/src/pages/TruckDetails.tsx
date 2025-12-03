import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Carousel, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { trucksAPI } from '../services/api';
const TruckDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [truck, setTruck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchTruck = useCallback(async (truckId: string) => {
    try {
      const response = await trucksAPI.getById(truckId);
      setTruck(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load truck details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [navigate]);
  useEffect(() => {
    if (id) {
      fetchTruck(id);
    }
  }, [id, fetchTruck]);
  const handleBookTruck = () => {
    if (!isAuthenticated) {
      toast.info('Please login to book this truck');
      navigate('/login');
      return;
    }
    if (user?.role !== 'customer') {
      toast.error('Only customers can book trucks');
      return;
    }
    navigate(`/book-truck/${id}`);
  };
  if (loading) {
    return (
      <Container className="my-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading truck details...</p>
      </Container>
    );
  }
  if (!truck) {
    return (
      <Container className="my-5">
        <Alert variant="danger">
          <Alert.Heading>Truck Not Found</Alert.Heading>
          <p>The truck you're looking for doesn't exist or has been removed.</p>
          <Button variant="primary" onClick={() => navigate('/browse-trucks')}>
            Browse Other Trucks
          </Button>
        </Alert>
      </Container>
    );
  }
  const trucker = truck.trucker || {};
  const photos = truck.photos && truck.photos.length > 0 ? truck.photos : [
    'https://via.placeholder.com/400x300?text=No+Photo+Available',
  ];
  const isAdmin = user?.role === 'admin';
  return (
    <Container className="my-5">
      <Button variant="outline-secondary" className="mb-4" onClick={() => navigate(-1)}>
        ← Back
      </Button>
      <Row>
        <Col md={8}>
          {}
          <Card className="shadow-sm mb-4">
            <Card.Body className="p-0">
              {photos.length > 1 ? (
                <Carousel>
                  {photos.map((photo: string, index: number) => (
                    <Carousel.Item key={index}>
                      <div style={{ height: '500px', overflow: 'hidden' }}>
                        <img
                          className="d-block w-100"
                          src={photo}
                          alt={`Truck ${index + 1}`}
                          style={{ objectFit: 'cover', height: '100%' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x500?text=No+Image';
                          }}
                        />
                      </div>
                    </Carousel.Item>
                  ))}
                </Carousel>
              ) : (
                <div style={{ height: '500px', overflow: 'hidden' }}>
                  <img
                    src={photos[0]}
                    alt={truck.type}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x500?text=No+Image';
                    }}
                  />
                </div>
              )}
            </Card.Body>
          </Card>
          {}
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <h3 className="mb-4">{truck.type.toUpperCase()} - {truck.registrationNumber}</h3>
              <Row className="mb-4">
                <Col md={6}>
                  <h5 className="mb-3">Vehicle Specifications</h5>
                  <p><strong>Type:</strong> {truck.type.charAt(0).toUpperCase() + truck.type.slice(1)}</p>
                  <p><strong>Registration Number:</strong> {truck.registrationNumber}</p>
                  <p><strong>Capacity:</strong> {truck.capacity?.weight || 'N/A'} tons</p>
                  {truck.capacity?.volume && (
                    <p><strong>Volume:</strong> {truck.capacity.volume} m³</p>
                  )}
                  {truck.dimensions && (
                    <>
                      <p><strong>Dimensions:</strong></p>
                      <ul>
                        <li>Length: {truck.dimensions.length || 'N/A'}m</li>
                        <li>Width: {truck.dimensions.width || 'N/A'}m</li>
                        <li>Height: {truck.dimensions.height || 'N/A'}m</li>
                      </ul>
                    </>
                  )}
                </Col>
                <Col md={6}>
                  <h5 className="mb-3">Pricing</h5>
                  <p><strong>Rate per Kilometer:</strong> KES {truck.rates?.perKm?.toLocaleString() || 'N/A'}</p>
                  {truck.rates?.perHour && (
                    <p><strong>Rate per Hour:</strong> KES {truck.rates.perHour.toLocaleString()}</p>
                  )}
                  <p><strong>Minimum Charge:</strong> KES {truck.rates?.minimumCharge?.toLocaleString() || 'N/A'}</p>
                  <div className="mt-3">
                    <h5 className="mb-3">Rating</h5>
                    <div className="d-flex align-items-center">
                      <span className="rating-stars me-2" style={{ fontSize: '1.5rem' }}>
                        {'★'.repeat(Math.floor(truck.rating?.average || 0))}
                        {'☆'.repeat(5 - Math.floor(truck.rating?.average || 0))}
                      </span>
                      <span>
                        <strong>{truck.rating?.average?.toFixed(1) || '0.0'}</strong>
                        {' '}({truck.rating?.count || 0} reviews)
                      </span>
                    </div>
                  </div>
                </Col>
              </Row>
              {truck.features && truck.features.length > 0 && (
                <div className="mb-4">
                  <h5 className="mb-3">Features</h5>
                  <div className="d-flex flex-wrap gap-2">
                    {truck.features.map((feature: string, index: number) => (
                      <Badge key={index} bg="info" className="p-2">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {truck.location?.address && (
                <div className="mb-4">
                  <h5 className="mb-3">Location</h5>
                  <p><strong>Base Location:</strong> {truck.location.address}</p>
                </div>
              )}
              <div className="mb-4">
                <h5 className="mb-3">Availability</h5>
                {truck.availability?.isAvailable ? (
                  <Badge bg="success" className="p-2">Available Now</Badge>
                ) : (
                  <Badge bg="warning" className="p-2">Currently Unavailable</Badge>
                )}
                {truck.availability?.workingDays && truck.availability.workingDays.length > 0 && (
                  <p className="mt-2 mb-0">
                    <strong>Working Days:</strong> {truck.availability.workingDays.join(', ')}
                  </p>
                )}
              </div>
              {truck.insurance && (
                <div>
                  <h5 className="mb-3">Insurance</h5>
                  {truck.insurance.insured ? (
                    <Badge bg="success" className="p-2">Insured</Badge>
                  ) : (
                    <Badge bg="secondary" className="p-2">Not Insured</Badge>
                  )}
                  {truck.insurance.expiryDate && (
                    <p className="mt-2 mb-0">
                      <strong>Expiry Date:</strong> {new Date(truck.insurance.expiryDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
              {isAdmin && truck.proofOfOwnership && (
                <div className="mt-4">
                  <h5 className="mb-3">Proof of Ownership</h5>
                  <Alert variant="info" className="mb-2">
                    <small>This document is only visible to administrators for verification purposes.</small>
                  </Alert>
                  <div className="text-center">
                    {truck.proofOfOwnership.startsWith('data:image') ? (
                      <img 
                        src={truck.proofOfOwnership} 
                        alt="Proof of Ownership" 
                        style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #dee2e6' }}
                      />
                    ) : (
                      <div className="p-3 border rounded">
                        <p className="mb-2"><strong>Document Uploaded</strong></p>
                        <a 
                          href={truck.proofOfOwnership} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary"
                        >
                          View Document
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          {}
          <Card className="shadow-sm mb-4 sticky-top" style={{ top: '20px' }}>
            <Card.Body>
              <h5 className="mb-4">Driver Information</h5>
              <div className="text-center mb-4">
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 15px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '2.5rem',
                  fontWeight: 'bold'
                }}>
                  {trucker.profile?.avatar ? (
                    <img 
                      src={trucker.profile.avatar} 
                      alt={trucker.name || 'Driver'} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.textContent = trucker.name ? trucker.name.charAt(0).toUpperCase() : 'D';
                        }
                      }}
                    />
                  ) : (
                    trucker.name ? trucker.name.charAt(0).toUpperCase() : 'D'
                  )}
                </div>
                <h5>{trucker.name || 'Driver Name'}</h5>
              </div>
              <div className="mb-3">
                <p><strong>Phone:</strong> {trucker.phone || 'N/A'}</p>
                {trucker.email && (
                  <p><strong>Email:</strong> {trucker.email}</p>
                )}
                {trucker.location?.address && (
                  <p><strong>Location:</strong> {trucker.location.address}</p>
                )}
              </div>
              {trucker.rating && (
                <div className="mb-4">
                  <h6 className="mb-2">Driver Rating</h6>
                  <div className="d-flex align-items-center">
                    <span className="rating-stars me-2">
                      {'★'.repeat(Math.floor(trucker.rating.average || 0))}
                      {'☆'.repeat(5 - Math.floor(trucker.rating.average || 0))}
                    </span>
                    <span>
                      <strong>{trucker.rating.average?.toFixed(1) || '0.0'}</strong>
                      {' '}({trucker.rating.count || 0} reviews)
                    </span>
                  </div>
                </div>
              )}
              {trucker.profile?.licenseNumber && (
                <div className="mb-4">
                  <p><strong>License Number:</strong> {trucker.profile.licenseNumber}</p>
                </div>
              )}
              <hr />
              {}
              <div className="d-grid gap-2">
                {truck.availability?.isAvailable ? (
                  <Button 
                    variant="primary" 
                    size="lg" 
                    onClick={handleBookTruck}
                    disabled={!isAuthenticated || user?.role !== 'customer'}
                  >
                    {!isAuthenticated 
                      ? 'Login to Book' 
                      : user?.role !== 'customer' 
                        ? 'Only Customers Can Book' 
                        : 'Book This Truck'}
                  </Button>
                ) : (
                  <Button variant="secondary" size="lg" disabled>
                    Currently Unavailable
                  </Button>
                )}
                <Button variant="outline-secondary" onClick={() => navigate('/browse-trucks')}>
                  Browse Other Trucks
                </Button>
              </div>
            </Card.Body>
          </Card>
          {}
          <Card className="shadow-sm">
            <Card.Body>
              <h6 className="mb-3">Quick Information</h6>
              <p className="small text-muted mb-2">
                <strong>Status:</strong> {truck.status || 'active'}
              </p>
              <p className="small text-muted mb-0">
                All vehicles are verified and stored in our secure database. 
                Driver information is verified for your safety.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
export default TruckDetails;
