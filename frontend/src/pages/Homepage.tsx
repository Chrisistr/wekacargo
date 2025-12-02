import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Button, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { trucksAPI } from '../services/api';
import { RootState } from '../store';

const Homepage: React.FC = () => {
  const [searchData, setSearchData] = useState({
    type: '',
    minCapacity: '',
    origin: '',
    destination: ''
  });
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [hasSearched, setHasSearched] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [counters, setCounters] = useState({ loads: 0, trucks: 0, savings: 0 });
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setIsVisible(true);
    
    // Animate counters
    const animateCounter = (target: number, setter: (val: number) => void, duration: number = 2000) => {
      let start = 0;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          setter(target);
          clearInterval(timer);
        } else {
          setter(Math.floor(start));
        }
      }, 16);
    };

    setTimeout(() => {
      animateCounter(10000, (val) => setCounters(prev => ({ ...prev, loads: val })));
      animateCounter(2000, (val) => setCounters(prev => ({ ...prev, trucks: val })));
      animateCounter(25, (val) => setCounters(prev => ({ ...prev, savings: val })));
    }, 500);

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      sectionRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const params: any = {};
      if (searchData.type) params.type = searchData.type;
      if (searchData.minCapacity) params.minCapacity = parseFloat(searchData.minCapacity);
      
      const response = await trucksAPI.getAll(params);
      setTrucks(response.data);
      setHasSearched(true);
      toast.success(`Found ${response.data.length} available trucks`);
    } catch (error: any) {
      setHasSearched(true);
      toast.error('Failed to search trucks');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="hero-section">
        <div className="hero-background-overlay"></div>
        <Container>
          <Row className="align-items-center hero-content">
            <Col md={7} className="text-center text-md-start mb-4 mb-md-0">
              <h1 className="display-4 fw-bold mb-3 hero-title">
                {isAuthenticated ? `Welcome back, ${user?.name}!` : 'Move Cargo Across Kenya, Effortlessly'}
              </h1>
              <p className="lead mb-4 hero-subtitle">
                WekaCargo connects you to a verified nationwide fleet – instant truck matching, transparent pricing,
                and live tracking from Mombasa to Kisumu.
              </p>
              {!isAuthenticated && (
                <div className="d-flex flex-wrap gap-3 mb-3">
                  <Button variant="light" size="lg" onClick={() => navigate('/register')}>
                    Get Started
                  </Button>
                  <Button variant="outline-light" size="lg" onClick={() => navigate('/login')}>
                    I Already Have an Account
                  </Button>
                </div>
              )}
              <div className={`hero-metrics d-flex flex-wrap gap-4 mt-3 ${isVisible ? 'fade-in-up' : ''}`}>
                <div className="metric-item">
                  <div className="hero-metric-number">{counters.loads.toLocaleString()}+</div>
                  <div className="hero-metric-label">Loads Delivered</div>
                </div>
                <div className="metric-item">
                  <div className="hero-metric-number">{counters.trucks.toLocaleString()}+</div>
                  <div className="hero-metric-label">Verified Trucks</div>
                </div>
                <div className="metric-item">
                  <div className="hero-metric-number">{counters.savings}%</div>
                  <div className="hero-metric-label">Avg. Cost Savings</div>
                </div>
              </div>
            </Col>
            <Col md={5} className="hero-image-col">
              {!isAuthenticated ? (
                <div className="hero-image-container" style={{ overflow: 'hidden', width: '100%', height: '400px' }}>
                  <img 
                    src="https://media.istockphoto.com/id/1340649474/photo/black-female-truck-driver-loading-boxes-in-cargo-space.jpg?s=612x612&w=0&k=20&c=XneRWW01azG7IGQ7mvDZW0X-HDZkp22499L36d0vwB8=" 
                    alt="Truck being loaded with cargo" 
                    className="hero-truck-image"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: '10px', display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=800&h=400&fit=crop&q=80';
                    }}
                  />
                </div>
              ) : (
                <Card className="search-card">
                  <Form onSubmit={handleSearch}>
                    <Row>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Truck Type</Form.Label>
                          <Form.Select
                            value={searchData.type}
                            onChange={(e) => setSearchData({ ...searchData, type: e.target.value })}
                          >
                            <option value="">Any Type</option>
                            <option value="pickup">Pickup</option>
                            <option value="lorry">Lorry</option>
                            <option value="truck">Truck</option>
                            <option value="container">Container</option>
                            <option value="flatbed">Flatbed</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Min Capacity (tons)</Form.Label>
                          <Form.Control
                            type="number"
                            placeholder="e.g. 5"
                            value={searchData.minCapacity}
                            onChange={(e) => setSearchData({ ...searchData, minCapacity: e.target.value })}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group className="mb-3">
                          <Form.Label>Origin</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Town/City"
                            value={searchData.origin}
                            onChange={(e) => setSearchData({ ...searchData, origin: e.target.value })}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group className="mb-3">
                          <Form.Label>Destination</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Town/City"
                            value={searchData.destination}
                            onChange={(e) => setSearchData({ ...searchData, destination: e.target.value })}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2} className="d-flex align-items-end">
                        <Button 
                          variant="primary" 
                          type="submit" 
                          className="w-100"
                          disabled={loading}
                        >
                          {loading ? 'Searching...' : 'Search'}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                  {isAuthenticated && user && (
                    <Card className="mt-4 text-start">
                      <Card.Body>
                        <h5 className="mb-3">Quick Actions</h5>
                        <Row>
                          <Col md={12} className="mb-2">
                            <Button
                              variant="primary"
                              className="w-100"
                              onClick={() => navigate(`/dashboard/${user.role}`)}
                            >
                              Go to{' '}
                              {user.role === 'trucker'
                                ? 'Trucker'
                                : user.role === 'customer'
                                ? 'Customer'
                                : 'Admin'}{' '}
                              Dashboard
                            </Button>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  )}
                </Card>
              )}
            </Col>
          </Row>
        </Container>
      </section>


      {!isAuthenticated ? (
        <>
          <section className="py-5 bg-light features-section">
            <Container>
              <Row className="text-center">
                <Col md={4} className="mb-4">
                  <div 
                    className="feature-card fade-in"
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[0] = el; }}
                  >
                    <div className="feature-image-wrapper">
                  <img 
                    src="https://imgs.search.brave.com/Hw58THF6iChuhwBL8ayIIQLJDV7owIOzy_5VxDJveQM/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWFn/ZXMudW5zcGxhc2gu/Y29tL3Bob3RvLTE1/NDM5OTY5OTEtOGU4/NTFjMmRjODQxP2Zt/PWpwZyZxPTYwJnc9/MzAwMCZpeGxpYj1y/Yi00LjEuMCZpeGlk/PU0zd3hNakEzZkRC/OE1IeHpaV0Z5WTJo/OE1UaDhmSEp2WVdS/emZHVnVmREI4ZkRC/OGZId3c" 
                    alt="Nationwide Coverage" 
                    className="feature-image"
                    style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=400&h=250&fit=crop&q=80';
                    }}
                  />
                    </div>
                    <h4 className="mt-3">Nationwide Coverage</h4>
                    <p>Our fleet of lorries and trucks connects every corner of Kenya - from Nairobi to Mombasa, Kisumu to Eldoret, and all major transport corridors.</p>
                  </div>
                </Col>
                <Col md={4} className="mb-4">
                  <div 
                    className="feature-card fade-in"
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[1] = el; }}
                  >
                    <div className="feature-image-wrapper">
                  <img 
                    src="https://imgs.search.brave.com/QO8pyjHuuM-7HkT2G8hKqgAMW08Bp3PpbFV4tZiHczs/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9mbGVl/dHdvcnRoeS5jb20v/d3AtY29udGVudC91/cGxvYWRzLzIwMjUv/MDIvZmxlZXQtbWFu/YWdlbWVudC10ZWNo/bm9sb2d5LmpwZw" 
                    alt="Verified Partners" 
                    className="feature-image"
                    style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=400&h=250&fit=crop&q=80';
                    }}
                  />
                    </div>
                    <h4 className="mt-3">Verified Partners</h4>
                    <p>Every trucker and their vehicles are verified - from driver licenses to truck registration, ensuring safe and reliable cargo transport across Kenya.</p>
                  </div>
                </Col>
                <Col md={4} className="mb-4">
                  <div 
                    className="feature-card fade-in"
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[2] = el; }}
                  >
                    <div className="feature-image-wrapper">
                  <img 
                    src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=250&fit=crop&q=80" 
                    alt="Money currency notes and coins" 
                    className="feature-image"
                    style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=250&fit=crop&q=80';
                    }}
                  />
                    </div>
                    <h4 className="mt-3">Transparent Pricing</h4>
                    <p>See upfront rates per kilometer for every lorry, truck, and flatbed. No hidden fees - just clear pricing from pickup to delivery.</p>
                  </div>
                </Col>
              </Row>
            </Container>
          </section>
          <section className="py-5 how-it-works-section">
            <Container>
              <Row className="align-items-center">
                <Col md={6}>
                  <div 
                    className="how-it-works-image-wrapper fade-in" 
                    style={{ overflow: 'hidden', borderRadius: '20px' }}
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[3] = el; }}
                  >
                    <img 
                      src="https://imgs.search.brave.com/s50Vhh2jyJNxb3ItIvv6y3Q0C7KKY70csSy8grlW7t0/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5pc3RvY2twaG90/by5jb20vaWQvMTA0/MzE0NjE4L3Bob3Rv/L3RydWNrcy5qcGc_/cz02MTJ4NjEyJnc9/MCZrPTIwJmM9WTEz/QVdiWFUwYmlJdDBt/T3NhMlIyaWZia3ZB/T0hRaGF5MnNwZ3At/dWRxbz0" 
                      alt="How WekaCargo Works" 
                      className="how-it-works-image"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=600&h=400&fit=crop&q=80';
                      }}
                    />
                  </div>
                </Col>
                <Col md={6}>
                  <h3 className="mb-4 fade-in">How WekaCargo Works</h3>
                  <ul className="mt-3 how-it-works-list">
                    <li className="mb-3">
                      <strong>1. Sign Up:</strong> Register as a customer or trucker in minutes. Truckers can list their lorries, trucks, or flatbeds.
                    </li>
                    <li className="mb-3">
                      <strong>2. Post or Browse:</strong> Customers post cargo details; truckers list available vehicles from pickups to container trucks.
                    </li>
                    <li className="mb-3">
                      <strong>3. Smart Matching:</strong> Our system pairs the right cargo with the right vehicle - matching capacity, location, and truck type.
                    </li>
                    <li className="mb-3">
                      <strong>4. Track & Pay:</strong> Track your cargo in real-time, release payments via M-Pesa, and rate each delivery.
                    </li>
                  </ul>
                  <Card className="shadow-sm mt-4">
                    <Card.Body>
                      <h5>Ready to move cargo?</h5>
                      <p className="text-muted">
                        Join thousands of Kenyan businesses reducing logistics costs with WekaCargo.
                      </p>
                      <div className="d-flex gap-3">
                        <Button onClick={() => navigate('/register')}>Get Started</Button>
                        <Button variant="outline-primary" onClick={() => navigate('/login')}>
                          Already have an account?
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Container>
          </section>
          <section className="py-5 bg-light target-audience-section">
            <Container>
              <h2 className="text-center mb-5 fade-in">Our Mission</h2>
              <Row className="text-center">
                <Col md={4} className="mb-4">
                  <Card 
                    className="dashboard-card h-100 target-card fade-in"
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[4] = el; }}
                  >
                    <div className="target-card-image-wrapper">
                      <img 
                        src="https://imgs.search.brave.com/FU2wgfiClHb-HNy5GISCaLpjnXeE1aNyDH34hTNysG8/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9nZXR0/cmFuc3BvcnQuY29t/L2ltYWdlcy9sYW5k/aW5nL3RydWNrL2Zy/ZWlnaHRfc2Vydmlj/ZXMuanBn" 
                        alt="Nationwide connectivity" 
                        className="target-card-image"
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=400&h=200&fit=crop&q=80';
                        }}
                      />
                    </div>
                    <Card.Body>
                      <h5>Connect Kenya's Logistics Network</h5>
                      <p className="small text-muted mb-0">
                        Our mission is to create a seamless nationwide network connecting businesses with reliable truckers, ensuring goods move efficiently across every corner of Kenya from Nairobi to Mombasa, Kisumu to Eldoret.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4} className="mb-4">
                  <Card 
                    className="dashboard-card h-100 target-card fade-in"
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[5] = el; }}
                  >
                    <div className="target-card-image-wrapper">
                      <img 
                        src="https://imgs.search.brave.com/g3kzliZiXFZ5NkNQwH2QNm1JTmQGY619UkE0CLsG0dg/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly93d3cu/ZmxlZXQuc29sZXJh/LmNvbS93cC1jb250/ZW50L3VwbG9hZHMv/MjAyNC8xMi85LVRy/dWNraW5nLVRlY2gt/VHJlbmRzLTEtc2Nh/bGVkLmpwZw" 
                        alt="Technology and innovation" 
                        className="target-card-image"
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=400&h=200&fit=crop&q=80';
                        }}
                      />
                    </div>
                    <Card.Body>
                      <h5>Empower Through Technology</h5>
                      <p className="small text-muted mb-0">
                        We leverage cutting-edge technology to provide real-time tracking, transparent pricing, and secure M-Pesa payments, making cargo transportation accessible and efficient for everyone.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4} className="mb-4">
                  <Card 
                    className="dashboard-card h-100 target-card fade-in"
                    ref={(el: HTMLDivElement | null) => { sectionRefs.current[6] = el; }}
                  >
                    <div className="target-card-image-wrapper">
                      <img 
                        src="https://imgs.search.brave.com/OEDgpaGNxWWlT9octEraMgg4vHkB5IPzVZjN2o8I8II/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5pc3RvY2twaG90/by5jb20vaWQvMTU1/Mzk1OTEwL3Bob3Rv/L3RydWNraW5nLXN1/Y2Nlc3MuanBnP3M9/NjEyeDYxMiZ3PTAm/az0yMCZjPXRfd3pN/RWpVTmV4d2N0cVVk/aVhtcXZjamlnUnR2/dDVQWVBqc1dfZmVL/TWc9" 
                        alt="Trust and safety" 
                        className="target-card-image"
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1601581875035-1c5fbc5d0c0b?w=400&h=200&fit=crop&q=80';
                        }}
                      />
                    </div>
                    <Card.Body>
                      <h5>Build Trust and Safety</h5>
                      <p className="small text-muted mb-0">
                        Our mission is to ensure every transaction is secure, every driver is verified, and every delivery is tracked. We're committed to building a trusted platform where safety and reliability are paramount.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Container>
          </section>
        </>
      ) : (
        hasSearched && (
          <Container className="mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="mb-0">Search Results</h2>
              <span className="text-muted">{trucks.length} truck(s) found</span>
            </div>
            <Row>
              {trucks.length === 0 ? (
                <Col md={12} className="text-center py-5">
                  <p className="text-muted">No trucks matched your filters. Try adjusting your search.</p>
                </Col>
              ) : (
                trucks.map((truck: any) => (
                  <Col key={truck._id} md={4} className="mb-4">
                    <Card className="card-hover h-100">
                      {truck.photos && truck.photos.length > 0 && (
                        <div className="d-flex gap-2 flex-wrap p-2 border-bottom">
                          {truck.photos.slice(0, 3).map((photo: string, idx: number) => (
                            <img
                              key={idx}
                              src={photo}
                              alt={`${truck.type} ${idx + 1}`}
                              style={{ width: '90px', height: '70px', objectFit: 'cover', borderRadius: '6px' }}
                            />
                          ))}
                        </div>
                      )}
                      <Card.Body className="d-flex flex-column">
                        <Card.Title>{truck.type.toUpperCase()}</Card.Title>
                        <p className="mb-2">
                          <strong>Capacity:</strong> {truck.capacity.weight} tons
                        </p>
                        <p className="mb-2">
                          <strong>Rate:</strong> KES {truck.rates.perKm}/km
                        </p>
                        <p className="mb-2">
                          <strong>Location:</strong> {truck.location.address}
                        </p>
                        <div className="mb-3">
                          <span className="rating-stars">
                            <span className="rating-stars-filled">{'★'.repeat(Math.floor(truck.rating.average))}</span>
                            <span className="rating-stars-empty">{'☆'.repeat(5 - Math.floor(truck.rating.average))}</span>
                          </span>
                          <span className="ms-2">
                            {truck.rating.average.toFixed(1)} ({truck.rating.count})
                          </span>
                        </div>
                        <div className="d-flex gap-2 mt-auto">
                          <Button 
                            variant="outline-primary" 
                            className="flex-fill"
                            onClick={() => navigate(`/truck/${truck._id}`)}
                          >
                            View Details
                          </Button>
                          <Button 
                            variant="primary" 
                            className="flex-fill"
                            onClick={() => {
                              if (!isAuthenticated) {
                                toast.info('Please login to book this truck');
                                navigate('/login');
                              } else if (user?.role !== 'customer') {
                                toast.error('Only customers can book trucks');
                              } else {
                                navigate(`/book-truck/${truck._id}`);
                              }
                            }}
                          >
                            Book Now
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))
              )}
            </Row>
          </Container>
        )
      )}
    </div>
  );
};

export default Homepage;

