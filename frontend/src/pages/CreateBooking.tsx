import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { trucksAPI, bookingsAPI } from '../services/api';
import AddressPicker from '../components/AddressPicker';
import GoogleMap from '../components/GoogleMap';
const CreateBooking: React.FC = () => {
  const { truckId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [truck, setTruck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    origin: {
      address: '',
      coordinates: { lat: 0, lng: 0 },
      contact: '',
      pickupTime: ''
    },
    destination: {
      address: '',
      coordinates: { lat: 0, lng: 0 },
      contact: '',
      dropoffTime: ''
    },
    cargoDetails: {
      type: '',
      weight: '',
      volume: '',
      description: '',
      pictures: [] as string[],
      isDelicate: false
    },
    specialInstructions: '',
    paymentMethod: 'mpesa' as 'cash' | 'mpesa'
  });
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [distance, setDistance] = useState(0);
  const geocodeTimeoutsRef = useRef<{ origin?: NodeJS.Timeout; destination?: NodeJS.Timeout }>({});
  
  const fetchTruck = useCallback(async () => {
    if (!truckId) return;
    try {
      const response = await trucksAPI.getById(truckId);
      setTruck(response.data);
    } catch (error: any) {
      console.error('Error fetching truck:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to load truck details';
      toast.error(errorMessage);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [truckId, navigate]);

  useEffect(() => {
    if (!user) {
      toast.error('Please login to create a booking');
      navigate('/login');
      return;
    }
    if (user.role !== 'customer') {
      toast.error('Only customers can create bookings');
      navigate('/');
      return;
    }
    if (truckId) {
      fetchTruck();
    }
  }, [truckId, user, navigate, fetchTruck]);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (geocodeTimeoutsRef.current.origin) clearTimeout(geocodeTimeoutsRef.current.origin);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (geocodeTimeoutsRef.current.destination) clearTimeout(geocodeTimeoutsRef.current.destination);
    };
  }, []);
  
  const calculateDistance = (coords1: { lat: number; lng: number }, coords2: { lat: number; lng: number }) => {
    const R = 6371; 
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  const handleAddressChange = async (field: 'origin' | 'destination', address: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: { ...prev[field], address }
    }));
    if (geocodeTimeoutsRef.current[field]) {
      clearTimeout(geocodeTimeoutsRef.current[field]);
    }
    const timeout = setTimeout(async () => {
      if (address.length > 5) {
        try {
          const response = await bookingsAPI.geocode(address);
          const { lat, lng } = response.data;
          const coords = { lat, lng };
          setFormData(prev => ({
            ...prev,
            [field]: { 
              ...prev[field], 
              coordinates: coords
            }
          }));
          const otherAddress = field === 'origin' ? formData.destination.address : formData.origin.address;
          if (otherAddress && otherAddress.length > 5) {
            const otherCoords = field === 'origin' ? formData.destination.coordinates : formData.origin.coordinates;
            if (otherCoords && otherCoords.lat !== 0 && otherCoords.lng !== 0) {
              const dist = calculateDistance(
                field === 'origin' ? coords : otherCoords,
                field === 'origin' ? otherCoords : coords
              );
              setDistance(dist);
              const price = truck ? Math.max(truck.rates.perKm * dist, truck.rates.minimumCharge) : 0;
              setEstimatedPrice(price);
            }
          }
        } catch (error: any) {
          console.log('Geocoding not available, using fallback coordinates for:', address);
          const baseCoords = { lat: -1.2921, lng: 36.8219 };
          const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const coords = { 
            lat: baseCoords.lat + (hash % 200) / 1000 - 0.1, 
            lng: baseCoords.lng + (hash % 200) / 1000 - 0.1 
          };
          coords.lat = Math.max(-4.7, Math.min(5.5, coords.lat));
          coords.lng = Math.max(33.9, Math.min(41.9, coords.lng));
          setFormData(prev => ({
            ...prev,
            [field]: { ...prev[field], coordinates: coords }
          }));
        }
      }
    }, 800); 
    geocodeTimeoutsRef.current[field] = timeout;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.origin.address || !formData.destination.address) {
      toast.error('Please provide both origin and destination addresses');
      return;
    }
    if (!formData.cargoDetails.type || !formData.cargoDetails.weight) {
      toast.error('Please provide cargo type and weight');
      return;
    }
    const cargoWeight = parseFloat(formData.cargoDetails.weight);
    if (isNaN(cargoWeight) || cargoWeight <= 0) {
      toast.error('Please enter a valid cargo weight');
      return;
    }
    if (cargoWeight > (truck?.capacity?.weight || 0)) {
      toast.error(`Cargo weight exceeds truck capacity (${truck?.capacity?.weight} tons)`);
      return;
    }
    if (!formData.origin.coordinates || (formData.origin.coordinates.lat === 0 && formData.origin.coordinates.lng === 0)) {
      const hash = formData.origin.address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      formData.origin.coordinates = {
        lat: -1.2921 + (hash % 200) / 1000 - 0.1,
        lng: 36.8219 + (hash % 200) / 1000 - 0.1
      };
    }
    if (!formData.destination.coordinates || (formData.destination.coordinates.lat === 0 && formData.destination.coordinates.lng === 0)) {
      const hash = formData.destination.address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      formData.destination.coordinates = {
        lat: -1.2921 + (hash % 200) / 1000 - 0.1,
        lng: 36.8219 + (hash % 200) / 1000 - 0.1
      };
    }
    setSubmitting(true);
    try {
      const bookingData = {
        truckId: truckId!,
        origin: {
          address: formData.origin.address.trim(),
          coordinates: formData.origin.coordinates,
          contact: formData.origin.contact?.trim() || undefined,
          pickupTime: formData.origin.pickupTime ? new Date(formData.origin.pickupTime).toISOString() : undefined
        },
        destination: {
          address: formData.destination.address.trim(),
          coordinates: formData.destination.coordinates,
          contact: formData.destination.contact?.trim() || undefined,
          dropoffTime: formData.destination.dropoffTime ? new Date(formData.destination.dropoffTime).toISOString() : undefined
        },
        cargoDetails: {
          type: formData.cargoDetails.type,
          weight: cargoWeight,
          volume: formData.cargoDetails.volume ? parseFloat(formData.cargoDetails.volume) : undefined,
          description: formData.cargoDetails.description?.trim() || undefined,
          pictures: formData.cargoDetails.pictures || [],
          isDelicate: formData.cargoDetails.isDelicate || false
        },
        specialInstructions: formData.specialInstructions?.trim() || undefined,
        paymentMethod: formData.paymentMethod
      };
      console.log('Creating booking with data:', bookingData);
      const response = await bookingsAPI.create(bookingData);
      if (response.data.warning && response.data.warning.onAnotherJob) {
        toast.warning(response.data.warning.message, {
          autoClose: 8000,
          style: { fontSize: '14px' }
        });
      } else {
        toast.success('Booking created successfully! You can edit it before the trucker confirms.');
      }
      navigate(`/booking/${response.data._id}`);
    } catch (error: any) {
      console.error('Booking creation error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to create booking. Please check all fields and try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
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
  if (!truck) {
    return (
      <Container className="my-5">
        <Alert variant="danger">Truck not found</Alert>
      </Container>
    );
  }
  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Container className="py-5">
        <Row>
          <Col md={8}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <h2 className="mb-4">Create Booking</h2>
                <div className="mb-4 p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Truck Details</h5>
                    <Button variant="outline-primary" size="sm" onClick={() => navigate(`/truck/${truck._id}`)}>
                      View Full Details
                    </Button>
                  </div>
                  {truck.photos && truck.photos.length > 0 && (
                    <div className="mb-3" style={{ height: '200px', overflow: 'hidden', borderRadius: '10px' }}>
                      <img
                        src={truck.photos[0]}
                        alt={truck.type}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                        }}
                      />
                    </div>
                  )}
                  <Row>
                    <Col md={6}>
                      <p className="mb-1"><strong>Type:</strong> {truck.type}</p>
                      <p className="mb-1"><strong>Capacity:</strong> {truck.capacity.weight} tons</p>
                      <p className="mb-1"><strong>Rate:</strong> KES {truck.rates.perKm}/km</p>
                      {truck.trucker && (
                        <>
                          <hr className="my-2" />
                          <p className="mb-1"><strong>Driver:</strong> {truck.trucker.name || 'N/A'}</p>
                          <p className="mb-1"><strong>Driver Phone:</strong> {truck.trucker.phone || 'N/A'}</p>
                          {truck.trucker.rating && (
                            <p className="mb-1">
                              <strong>Driver Rating:</strong> {'★'.repeat(Math.floor(truck.trucker.rating.average || 0))}
                              {' '}{truck.trucker.rating.average?.toFixed(1) || '0.0'} ({truck.trucker.rating.count || 0} reviews)
                            </p>
                          )}
                        </>
                      )}
                    </Col>
                    <Col md={6}>
                      <p className="mb-1"><strong>Registration:</strong> {truck.registrationNumber}</p>
                      <p className="mb-1"><strong>Minimum Charge:</strong> KES {truck.rates.minimumCharge}</p>
                      <p className="mb-1"><strong>Location:</strong> {truck.location.address}</p>
                      {truck.rating && (
                        <>
                          <hr className="my-2" />
                          <p className="mb-1">
                            <strong>Truck Rating:</strong> {'★'.repeat(Math.floor(truck.rating.average || 0))}
                            {' '}{truck.rating.average?.toFixed(1) || '0.0'} ({truck.rating.count || 0} reviews)
                          </p>
                        </>
                      )}
                    </Col>
                  </Row>
                </div>
                <Form onSubmit={handleSubmit}>
                  <h5 className="mb-3">Origin Details</h5>
                  <Row className="mb-3">
                    <Col md={12}>
                      <AddressPicker
                        label="Pickup Address *"
                        placeholder="Enter pickup address"
                        value={formData.origin.address}
                        onChange={(address, coordinates) => {
                          if (coordinates) {
                            setFormData(prev => ({
                              ...prev,
                              origin: { ...prev.origin, address, coordinates }
                            }));
                            if (formData.destination.coordinates.lat !== 0 && formData.destination.coordinates.lng !== 0) {
                              const dist = calculateDistance(coordinates, formData.destination.coordinates);
                              setDistance(dist);
                              if (truck?.rates?.perKm) {
                                const estimated = truck.rates.perKm * dist;
                                setEstimatedPrice(estimated < truck.rates.minimumCharge ? truck.rates.minimumCharge : estimated);
                              }
                            }
                          } else {
                            handleAddressChange('origin', address);
                          }
                        }}
                      />
                    </Col>
                  </Row>
                  {formData.origin.coordinates.lat !== 0 && formData.origin.coordinates.lng !== 0 && (
                    <div className="mb-3">
                      <GoogleMap
                        origin={formData.origin.coordinates}
                        destination={formData.destination.coordinates.lat !== 0 ? formData.destination.coordinates : undefined}
                        height="250px"
                      />
                    </div>
                  )}
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Contact Person (Optional)</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Name and phone"
                          value={formData.origin.contact}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            origin: { ...prev.origin, contact: e.target.value }
                          }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Preferred Pickup Time (Optional)</Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={formData.origin.pickupTime}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            origin: { ...prev.origin, pickupTime: e.target.value }
                          }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <hr className="my-4" />
                  <h5 className="mb-3">Destination Details</h5>
                  <Row className="mb-3">
                    <Col md={12}>
                      <AddressPicker
                        label="Delivery Address *"
                        placeholder="Enter delivery address"
                        value={formData.destination.address}
                        onChange={(address, coordinates) => {
                          if (coordinates) {
                            setFormData(prev => ({
                              ...prev,
                              destination: { ...prev.destination, address, coordinates }
                            }));
                            if (formData.origin.coordinates.lat !== 0 && formData.origin.coordinates.lng !== 0) {
                              const dist = calculateDistance(formData.origin.coordinates, coordinates);
                              setDistance(dist);
                              if (truck?.rates?.perKm) {
                                const estimated = truck.rates.perKm * dist;
                                setEstimatedPrice(estimated < truck.rates.minimumCharge ? truck.rates.minimumCharge : estimated);
                              }
                            }
                          } else {
                            handleAddressChange('destination', address);
                          }
                        }}
                      />
                    </Col>
                  </Row>
                  {formData.origin.coordinates.lat !== 0 && formData.destination.coordinates.lat !== 0 && (
                    <div className="mb-3">
                      <GoogleMap
                        origin={formData.origin.coordinates}
                        destination={formData.destination.coordinates}
                        height="300px"
                      />
                    </div>
                  )}
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Contact Person (Optional)</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Name and phone"
                          value={formData.destination.contact}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            destination: { ...prev.destination, contact: e.target.value }
                          }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Preferred Delivery Time (Optional)</Form.Label>
                        <Form.Control
                          type="datetime-local"
                          value={formData.destination.dropoffTime}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            destination: { ...prev.destination, dropoffTime: e.target.value }
                          }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <hr className="my-4" />
                  <h5 className="mb-3">Cargo Details</h5>
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Cargo Type *</Form.Label>
                        <Form.Select
                          value={formData.cargoDetails.type}
                          onChange={(e) => setFormData(prev => ({
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
                      <Form.Group>
                        <Form.Label>Weight (tons) *</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.1"
                          max={truck.capacity.weight}
                          placeholder={`Max: ${truck.capacity.weight} tons`}
                          value={formData.cargoDetails.weight}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            cargoDetails: { ...prev.cargoDetails, weight: e.target.value }
                          }))}
                          required
                        />
                        <Form.Text className="text-muted">
                          Maximum capacity: {truck.capacity.weight} tons
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Volume (cubic meters) - Optional</Form.Label>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Volume in m³"
                          value={formData.cargoDetails.volume}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            cargoDetails: { ...prev.cargoDetails, volume: e.target.value }
                          }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Cargo Description (Optional)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          placeholder="Describe your cargo..."
                          value={formData.cargoDetails.description}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            cargoDetails: { ...prev.cargoDetails, description: e.target.value }
                          }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="mb-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Cargo Pictures (Optional)</Form.Label>
                        <Form.Text className="text-muted d-block mb-2">
                          Upload pictures of the items to be delivered. This helps the trucker prepare appropriately.
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
                              setFormData(prev => ({
                                ...prev,
                                cargoDetails: { 
                                  ...prev.cargoDetails, 
                                  pictures: [...(prev.cargoDetails.pictures as string[]), ...converted]
                                }
                              }));
                              toast.success(`${converted.length} picture(s) uploaded`);
                            } catch (error) {
                              toast.error('Failed to upload pictures');
                            }
                          }}
                        />
                        {formData.cargoDetails.pictures && formData.cargoDetails.pictures.length > 0 && (
                          <div className="d-flex flex-wrap gap-2 mt-2">
                            {formData.cargoDetails.pictures.map((pic, idx) => (
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
                                    setFormData(prev => ({
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
                    </Col>
                  </Row>
                  <hr className="my-4" />
                  <Form.Group className="mb-4">
                    <Form.Label>Special Instructions (Optional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder="Any special instructions for the trucker..."
                      value={formData.specialInstructions}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        specialInstructions: e.target.value
                      }))}
                    />
                  </Form.Group>
                  <hr className="my-4" />
                  <h5 className="mb-3">Payment Method</h5>
                  <Form.Group className="mb-4">
                    <Form.Label>Select Payment Method *</Form.Label>
                    <div>
                      <Form.Check
                        type="radio"
                        id="payment-mpesa"
                        name="paymentMethod"
                        label="M-Pesa (Pay Now)"
                        value="mpesa"
                        checked={formData.paymentMethod === 'mpesa'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          paymentMethod: 'mpesa'
                        }))}
                        className="mb-2"
                      />
                      <Form.Check
                        type="radio"
                        id="payment-cash"
                        name="paymentMethod"
                        label="Cash on Delivery"
                        value="cash"
                        checked={formData.paymentMethod === 'cash'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          paymentMethod: 'cash'
                        }))}
                      />
                    </div>
                    {formData.paymentMethod === 'cash' && (
                      <Alert variant="warning" className="mt-3">
                        <strong>Cash Payment Reminder:</strong> Please have the exact amount ready when the delivery arrives. 
                        The trucker will collect payment upon delivery completion.
                      </Alert>
                    )}
                    {formData.paymentMethod === 'mpesa' && (
                      <Alert variant="info" className="mt-3">
                        <strong>M-Pesa Payment:</strong> You will be prompted to complete payment via M-Pesa after the trucker confirms your booking.
                      </Alert>
                    )}
                  </Form.Group>
                  <div className="d-flex gap-3">
                    <Button variant="secondary" onClick={() => navigate(-1)}>
                      Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={submitting}>
                      {submitting ? 'Creating Booking...' : 'Create Booking'}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="shadow-sm sticky-top" style={{ top: '20px' }}>
              <Card.Body>
                <h5 className="mb-3">Booking Summary</h5>
                {distance > 0 && (
                  <div className="mb-3 p-3" style={{ background: '#e7f3ff', borderRadius: '8px' }}>
                    <p className="mb-1"><strong>Estimated Distance:</strong></p>
                    <h4 className="mb-0">{distance.toFixed(1)} km</h4>
                  </div>
                )}
                {estimatedPrice > 0 && (
                  <div className="mb-3 p-3" style={{ background: '#f0f9ff', borderRadius: '8px' }}>
                    <p className="mb-1"><strong>Estimated Price:</strong></p>
                    <h3 className="mb-0" style={{ color: '#667eea' }}>
                      KES {estimatedPrice.toLocaleString()}
                    </h3>
                    <small className="text-muted">
                      {distance > 0 ? `KES ${truck.rates.perKm}/km × ${distance.toFixed(1)}km` : ''}
                      {estimatedPrice === truck.rates.minimumCharge && ' (Minimum charge applied)'}
                    </small>
                  </div>
                )}
                <div className="mt-4">
                  <h6 className="mb-2">What happens next?</h6>
                  <ul className="small text-muted" style={{ paddingLeft: '20px' }}>
                    <li>Your booking will be sent to the trucker</li>
                    <li>Trucker will confirm or decline</li>
                    <li>Once confirmed, you can make payment</li>
                    <li>Track your cargo in real-time</li>
                  </ul>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
export default CreateBooking;
