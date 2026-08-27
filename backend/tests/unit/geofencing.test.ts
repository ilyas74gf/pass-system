import { GeofenceUtils, Coordinates } from '../../src/utils/geofenceUtils';

describe('GeofenceUtils Unit Tests', () => {
  // Test Binası Koordinatları (Ana Kampüs Girişi)
  const BUILDING_LOCATION: Coordinates = {
    latitude: 41.0082,
    longitude: 28.9784,
  };
  const RADIUS_METERS = 100;

  test('Aynı koordinatlar verildiğinde mesafe 0 metre çıkmalıdır', () => {
    const distance = GeofenceUtils.calculateDistance(BUILDING_LOCATION, BUILDING_LOCATION);
    expect(distance).toBeCloseTo(0, 1);
  });

  test('100 metre yarıçap içindeki koordinat için isInside true dönmelidir', () => {
    const userLocation: Coordinates = {
      latitude: 41.0084,
      longitude: 28.9785,
    };

    const result = GeofenceUtils.isWithinGeofence(userLocation, BUILDING_LOCATION, RADIUS_METERS);
    expect(result.isInside).toBe(true);
    expect(result.distanceMeters).toBeLessThanOrEqual(RADIUS_METERS);
  });

  test('100 metreden uzak koordinat (200m+) için isInside false dönmelidir', () => {
    const userLocation: Coordinates = {
      latitude: 41.0110,
      longitude: 28.9800,
    };

    const result = GeofenceUtils.isWithinGeofence(userLocation, BUILDING_LOCATION, RADIUS_METERS);
    expect(result.isInside).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(RADIUS_METERS);
  });

  test('Geçersiz veya eksik GPS koordinatı geldiğinde sistem çökmeden false ve Infinity dönmelidir', () => {
    const invalidLocation: Coordinates = {
      latitude: 999, // Geçersiz enlem değeri
      longitude: 28.9784,
    };

    const invalidResult = GeofenceUtils.isWithinGeofence(invalidLocation, BUILDING_LOCATION, RADIUS_METERS);
    expect(invalidResult.isInside).toBe(false);
    expect(invalidResult.distanceMeters).toBe(Infinity);

    const nullResult = GeofenceUtils.isWithinGeofence(null as any, BUILDING_LOCATION, RADIUS_METERS);
    expect(nullResult.isInside).toBe(false);
    expect(nullResult.distanceMeters).toBe(Infinity);
  });
});