const axios = require('axios');
const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY; 
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const getFallbackCoords = (address) => {
  const baseCoords = { lat: -1.2921, lng: 36.8219 }; 
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    lat: baseCoords.lat + (hash % 200) / 1000 - 0.1,
    lng: baseCoords.lng + (hash % 200) / 1000 - 0.1,
    formattedAddress: address
  };
};
const getAddressSuggestions = async (query, limit = 5) => {
  if (!query || query.length < 2) {
    return [];
  }
  if (OPENROUTESERVICE_API_KEY) {
    try {
      const response = await axios.get(
        'https://api.openrouteservice.org/geocode/search',
        {
          params: {
            api_key: OPENROUTESERVICE_API_KEY,
            text: `${query}, Kenya`,
            size: limit,
            layers: 'venue,address,street,locality,neighbourhood'
          },
          headers: {
            'Authorization': OPENROUTESERVICE_API_KEY
          },
          timeout: 5000
        }
      );
      const features = response.data?.features;
      if (features && features.length > 0) {
        return features.map(feature => {
          const [lng, lat] = feature.geometry.coordinates;
          const label =
            feature.properties?.label ||
            feature.properties?.name ||
            feature.properties?.address_line1 ||
            feature.properties?.address_line2 ||
            query;
          return {
            address: label,
            lat,
            lng
          };
        });
      }
    } catch (error) {
      console.error('OpenRouteService suggestions error:', error.message);
    }
  }
  return [];
};
const geocodeAddress = async (address) => {
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
  console.warn('Using fallback geocoding (no external geocoding provider available)');
  return getFallbackCoords(address);
};
const calculateOpenRouteServiceDistance = async (origin, destination) => {
  if (!OPENROUTESERVICE_API_KEY) {
    throw new Error('OpenRouteService API key not configured');
  }
  try {
    const response = await axios.get('https://api.openrouteservice.org/v2/directions/driving-car',
      {
      params: {
        api_key: OPENROUTESERVICE_API_KEY,
        start: `${origin.lng},${origin.lat}`, 
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
        distance: summary.distance / 1000, 
        duration: summary.duration / 60 
      };
    }
    throw new Error('No route found');
  } catch (error) {
    console.error('OpenRouteService API error:', error.message);
    throw error;
  }
};
const calculateOSRMDistance = async (origin, destination) => {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&alternatives=false`;
    const response = await axios.get(url, { timeout: 5000 });
    if (response.data && response.data.code === 'Ok' && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        distance: route.distance / 1000, 
        duration: route.duration / 60 
      };
    }
    throw new Error('No route found');
  } catch (error) {
    console.error('OSRM API error:', error.message);
    throw error;
  }
};
const calculateImprovedHaversineDistance = (origin, destination) => {
  if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
    return { distance: 50, duration: 60 }; 
  }
  const R = 6371; 
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLon = (destination.lng - origin.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;
  const roadMultiplier = 1.35;
  const estimatedRoadDistance = straightLineDistance * roadMultiplier;
  const duration = Math.ceil(estimatedRoadDistance * 1.8);
  return { 
    distance: Math.round(estimatedRoadDistance * 10) / 10, 
    duration 
  };
};
const calculateRoadDistance = async (origin, destination) => {
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
  if (OPENROUTESERVICE_API_KEY) {
    try {
      return await calculateOpenRouteServiceDistance(origin, destination);
    } catch (error) {
      console.warn('OpenRouteService API failed, trying OSRM:', error.message);
    }
  }
  try {
    return await calculateOSRMDistance(origin, destination);
  } catch (error) {
    console.warn('OSRM API failed, using improved Haversine formula:', error.message);
  }
  console.log('Using improved Haversine formula with road distance multiplier');
  return calculateImprovedHaversineDistance(origin, destination);
};
const calculateHaversineDistance = (coords1, coords2) => {
  if (!coords1 || !coords2 || !coords1.lat || !coords1.lng || !coords2.lat || !coords2.lng) {
    return { distance: 50, duration: 60 }; 
  }
  const R = 6371; 
  const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
  const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  const duration = Math.ceil(distance * 2);
  return { distance, duration };
};
module.exports = {
  geocodeAddress,
  getAddressSuggestions,
  calculateRoadDistance,
  calculateHaversineDistance,
  calculateImprovedHaversineDistance,
  calculateOSRMDistance,
  calculateOpenRouteServiceDistance
};
