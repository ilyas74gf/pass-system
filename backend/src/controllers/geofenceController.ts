import { Request, Response } from 'express';
import { GeofenceUtils, Coordinates } from '../utils/geofenceUtils';

/**
 *  Konum Doğrulama (Geofence Kontrolü)
 */
export const validateGeofenceHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude ve Longitude parametreleri zorunludur.',
      });
    }

    const userLat = Number(latitude);
    const userLng = Number(longitude);

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz koordinat değerleri gönderildi.',
      });
    }

    // Kampüs/Tesis Merkez Koordinatları ve İzin Verilen Yarıçap (Metre)
    const campusLocation: Coordinates = {
      latitude: parseFloat(process.env.GEOFENCE_CENTER_LAT || '41.0082'),
      longitude: parseFloat(process.env.GEOFENCE_CENTER_LNG || '28.9784'),
    };
    const maxRadiusMeters = parseInt(process.env.GEOFENCE_RADIUS_METERS || '100', 10);

    const userLocation: Coordinates = { latitude: userLat, longitude: userLng };

    const result = GeofenceUtils.isWithinGeofence(
      userLocation,
      campusLocation,
      maxRadiusMeters
    );

    if (!result.isInside) {
      return res.status(403).json({
        success: false,
        message: 'Geofence İhlali: Belirlenen güvenli alan sınırları dışındasınız.',
        data: {
          allowed: false,
          distanceMeters: result.distanceMeters,
          maxAllowedRadiusMeters: maxRadiusMeters,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Konum doğrulandı. Kampüs alanı içerisindesiniz.',
      data: {
        allowed: true,
        distanceMeters: result.distanceMeters,
      },
    });
  } catch (error: any) {
    console.error('❌ [GeofenceController Error]:', error);

    return res.status(500).json({
      success: false,
      message: 'Konum doğrulanırken sunucu hatası oluştu.',
      error: error.message,
    });
  }
};