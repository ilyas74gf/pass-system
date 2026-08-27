export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceResult {
  isInside: boolean;
  distanceMeters: number;
}

export class GeofenceUtils {
  // Dünyanın ortalama yarıçapı (Metre cinsinden)
  private static readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Dereceyi Radyan birimine dönüştürür.
   */
  private static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   *  Koordinatların geçerli GPS sınırları içinde olup olmadığını kontrol eder.
   */
  public static isValidCoordinates(point?: Coordinates | null): boolean {
    if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
      return false;
    }
    if (isNaN(point.latitude) || isNaN(point.longitude)) {
      return false;
    }
    return (
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180
    );
  }

  /**
   *  Haversine Formülü ile iki GPS koordinatı arasındaki mesafeyi (metre) hesaplar.
   */
  static calculateDistance(point1: Coordinates, point2: Coordinates): number {
    if (!this.isValidCoordinates(point1) || !this.isValidCoordinates(point2)) {
      throw new Error('Geçersiz GPS koordinat verisi sağlandı.');
    }

    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const lat1Rad = this.toRadians(point1.latitude);
    const lat2Rad = this.toRadians(point2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_METERS * c;
  }

  /**
   *  Kullanıcının hedeflenen nokta ve yarıçap içinde olup olmadığını doğrular.
   */
  static isWithinGeofence(
    userLocation: Coordinates,
    targetLocation: Coordinates,
    maxAllowedRadiusMeters: number = 100
  ): GeofenceResult {
    // Koordinatlar geçersizse güvenli şekilde reddet
    if (!this.isValidCoordinates(userLocation) || !this.isValidCoordinates(targetLocation)) {
      return {
        isInside: false,
        distanceMeters: Infinity,
      };
    }

    const distance = this.calculateDistance(userLocation, targetLocation);
    const isInside = distance <= maxAllowedRadiusMeters;

    return {
      isInside,
      distanceMeters: Math.round(distance * 100) / 100, 
    };
  }
}

export default GeofenceUtils;