const axios = require('axios');

// Primary provider for routing & geocoding (no Google Maps needed)
const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY; // Get free key from https://openrouteservice.org/
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || 'https://router.project-osrm.org'; // Public OSRM instance

// Simple deterministic fallback geocoding around Nairobi when APIs fail
const getFallbackCoords = (address) => {
  const baseCoords = { lat: -1.2921, lng: 36.8219 }; // Nairobi
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    lat: baseCoords.lat + (hash % 200) / 1000 - 0.1,
    lng: baseCoords.lng + (hash % 200) / 1000 - 0.1,
    formattedAddress: address
  };
};

/**
 * Geocode an address to get coordinates (OpenRouteService first, then fallback)
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>}
 */
const geocodeAddress = async (address) => {
  // Try 1: OpenRouteService geocoding
  if (OPENROUTESERVICE_API_KEY) {
    try {
      const response = await axios.get(
        'https://api.openrouteservice.org/geocode/search',
        {
          params: {
            api_key: OPENROUTESERVICE_API_KEY,
            text: `${address}, Kenya`,
            size: 1
          },
          headers: {
            'Authorization': OPENROUTESERVICE_API_KEY
          },
          timeout: 5000
        }
      );

      const features = response.data?.features;
      if (features && features.length > 0) {
        const feature = features[0];
        const [lng, lat] = feature.geometry.coordinates;
        const label =
          feature.properties?.label ||
          feature.properties?.name ||
          address;

        return {
          lat,
          lng,
          formattedAddress: label
        };
      }
      console.warn('OpenRouteService geocoding: no features found, using fallback');
    } catch (error) {
      console.error('OpenRouteService geocoding error:', error.message);
    }
  }

  // Fallback: deterministic approximate coords around Nairobi
  console.warn('Using fallback geocoding (no external geocoding provider available)');
  return getFallbackCoords(address);
};

/**
 * Calculate road distance using OpenRouteService API (free alternative)
 * @param {Object} origin - {lat: number, lng: number}
 * @param {Object} destination - {lat: number, lng: number}
 * @returns {Promise<{distance: number, duration: number}>} - distance in km, duration in minutes
 */
const calculateOpenRouteServiceDistance = async (origin, destination) => {
  if (!OPENROUTESERVICE_API_KEY) {
    throw new Error('OpenRouteService API key not configured');
  }

  try {
    const response = await axios.get('https://api.openrouteservice.org/v2/directions/driving-car', {
      params: {
        api_key: OPENROUTESERVICE_API_KEY,
        start: `${origin.lng},${origin.lat}`, // Note: ORS uses [lng, lat] format
        end: `${destination.lng},${destination.lat}`
      },
      headers: {
        'Authorization': OPENROUTESERVICE_API_KEY
      },
      timeout: 5000
    });

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const summary = route.summary;
      return {
        distance: summary.distance / 1000, // Convert meters to km
        duration: summary.duration / 60 // Convert seconds to minutes
      };
    }
    throw new Error('No route found');
  } catch (error) {
    console.error('OpenRouteService API error:', error.message);
    throw error;
  }
};

/**
 * Calculate road distance using OSRM (Open Source Routing Machine) - free public instance
 * @param {Object} origin - {lat: number, lng: number}
 * @param {Object} destination - {lat: number, lng: number}
 * @returns {Promise<{distance: number, duration: number}>} - distance in km, duration in minutes
 */
const calculateOSRMDistance = async (origin, destination) => {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&alternatives=false`;
    const response = await axios.get(url, { timeout: 5000 });

    if (response.data && response.data.code === 'Ok' && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        distance: route.distance / 1000, // Convert meters to km
        duration: route.duration / 60 // Convert seconds to minutes
      };
    }
    throw new Error('No route found');
  } catch (error) {
    console.error('OSRM API error:', error.message);
    throw error;
  }
};

/**
 * Calculate road distance with improved accuracy using Haversine + road multiplier
 * This accounts for road network detours and is more accurate than basic Haversine
 * @param {Object} origin - {lat: number, lng: number}
 * @param {Object} destination - {lat: number, lng: number}
 * @returns {{distance: number, duration: number}} - distance in km, estimated duration in minutes
 */
const calculateImprovedHaversineDistance = (origin, destination) => {
  if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
    return { distance: 50, duration: 60 }; // Default fallback
  }

  const R = 6371; // Earth radius in km
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLon = (destination.lng - origin.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;
  
  // Road distance multiplier based on Kenya's road network
  // Urban areas: 1.2-1.4x, Rural: 1.3-1.6x, Long distance: 1.2-1.5x
  // Using average of 1.35x for better accuracy
  const roadMultiplier = 1.35;
  const estimatedRoadDistance = straightLineDistance * roadMultiplier;
  
  // Duration estimation: 
  // - Urban: ~1.5 min/km (traffic)
  // - Highway: ~1 min/km
  // - Rural: ~2 min/km
  // Using weighted average: 1.8 min/km
  const duration = Math.ceil(estimatedRoadDistance * 1.8);
  
  return { 
    distance: Math.round(estimatedRoadDistance * 10) / 10, // Round to 1 decimal
    duration 
  };
};

/**
 * Calculate road distance and duration between two coordinates
 * Tries in order: OpenRouteService -> OSRM -> Improved Haversine -> Basic Haversine
 * @param {Object} origin - {lat: number, lng: number}
 * @param {Object} destination - {lat: number, lng: number}
 * @returns {Promise<{distance: number, duration: number}>} - distance in km, duration in minutes
 */
const calculateRoadDistance = async (origin, destination) => {
  // Validate coordinates
  if (
    !origin ||
    !destination ||
    !origin.lat ||
    !origin.lng ||
    !destination.lat ||
    !destination.lng
  ) {
    console.warn('Invalid coordinates provided, using default fallback');
    return { distance: 50, duration: 60 };
  }

  // Try 1: OpenRouteService API (primary provider)
  if (OPENROUTESERVICE_API_KEY) {
    try {
      return await calculateOpenRouteServiceDistance(origin, destination);
    } catch (error) {
      console.warn('OpenRouteService API failed, trying OSRM:', error.message);
    }
  }

  // Try 2: OSRM (Open Source Routing Machine - free public instance)
  try {
    return await calculateOSRMDistance(origin, destination);
  } catch (error) {
    console.warn('OSRM API failed, using improved Haversine formula:', error.message);
  }

  // Try 3: Improved Haversine with road multiplier (better than basic Haversine)
  console.log('Using improved Haversine formula with road distance multiplier');
  return calculateImprovedHaversineDistance(origin, destination);
};

/**
 * Calculate straight-line distance using Haversine formula (fallback)
 * @param {Object} coords1 - {lat: number, lng: number}
 * @param {Object} coords2 - {lat: number, lng: number}
 * @returns {{distance: number, duration: number}} - distance in km, estimated duration in minutes
 */
const calculateHaversineDistance = (coords1, coords2) => {
  if (!coords1 || !coords2 || !coords1.lat || !coords1.lng || !coords2.lat || !coords2.lng) {
    return { distance: 50, duration: 60 }; // Default fallback
  }

  const R = 6371; // Earth radius in km
  const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
  const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Estimate duration: ~2 minutes per km for road travel
  const duration = Math.ceil(distance * 2);
  
  return { distance, duration };
};

module.exports = {
  geocodeAddress,
  calculateRoadDistance,
  calculateHaversineDistance,
  calculateImprovedHaversineDistance,
  calculateOSRMDistance,
  calculateOpenRouteServiceDistance
};


