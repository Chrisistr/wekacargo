import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { ratingsAPI, adminAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

const AdminReviewsManagement: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const fetchStats = useCallback(async () => {
    try {
      await adminAPI.getAnalytics();
    } catch (error) {
      console.error('Failed to fetch analytics');
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      const params: any = {};
      if (reviewSearch.trim()) {
        params.search = reviewSearch.trim();
      }
      if (reviewStatusFilter !== 'all') {
        params.status = reviewStatusFilter;
      }
      const response = await ratingsAPI.getAll(params);
      setReviews(response.data);
    } catch (error) {
      toast.error('Failed to fetch reviews');
    } finally {
      setLoadingReviews(false);
    }
  }, [reviewSearch, reviewStatusFilter]);

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      await ratingsAPI.delete(reviewId);
      toast.success('Review deleted successfully');
      fetchReviews();
      fetchStats(); // Refresh stats to update ratings
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete review');
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchReviews();
      fetchStats();
    }
  }, [user, fetchReviews, fetchStats]);

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <h2 className="mb-1 fw-bold">Reviews Management</h2>
              <p className="text-muted mb-0">Manage user reviews and ratings across the platform</p>
            </Col>
          </Row>

          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">Reviews</h3>
                <div className="d-flex gap-2" style={{ width: '400px' }}>
                  <Form.Control
                    type="text"
                    placeholder="Search reviews..."
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                  />
                  <Form.Select
                    style={{ width: '150px' }}
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value as 'all' | 'active' | 'deleted')}
                  >
                    <option value="all">All Reviews</option>
                    <option value="active">Active</option>
                    <option value="deleted">Deleted</option>
                  </Form.Select>
                </div>
              </div>

              {loadingReviews ? (
                <p>Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <p className="text-muted">No reviews found</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Reviewer</th>
                        <th>Rated User</th>
                        <th>Rating</th>
                        <th>Comment</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((review) => (
                        <tr key={review._id}>
                          <td>
                            {review.reviewer?.name || 'N/A'}
                            <br />
                            <small className="text-muted">{review.reviewer?.email || ''}</small>
                          </td>
                          <td>
                            {review.ratedUser?.name || 'N/A'}
                            <br />
                            <small className="text-muted">
                              {review.ratedUser?.role || ''} • {review.ratedUser?.email || ''}
                            </small>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <span className="rating-stars-filled me-2">
                                {'★'.repeat(Math.floor(review.rating || 0))}
                              </span>
                              <span className="rating-stars-empty">
                                {'☆'.repeat(5 - Math.floor(review.rating || 0))}
                              </span>
                              <span className="ms-2">{review.rating || 0}/5</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: '300px', wordWrap: 'break-word' }}>
                              {review.comment || 'No comment'}
                            </div>
                          </td>
                          <td>
                            <Badge bg={review.status === 'active' ? 'success' : 'secondary'}>
                              {review.status || 'active'}
                            </Badge>
                          </td>
                          <td>{new Date(review.createdAt).toLocaleDateString()}</td>
                          <td>
                            {review.status === 'active' && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteReview(review._id)}
                              >
                                Delete
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>
    </div>
  );
};

export default AdminReviewsManagement;




