import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class LocationService {
  // 📍 Varsayılan Konum Değerleri (Backend'den veri gelmezse yedek olarak çalışır)
  static const double defaultLatitude = 41.668066601409954;
  static const double defaultLongitude = 26.575050210915997;
  static const double defaultMaxAllowedDistance = 250.0;

  /// Cihazın GPS konumunu alıp dinamik Geofence parametrelerine göre mesafeyi hesaplar
  static Future<Map<String, dynamic>> checkGeofence({
    double? currentLat,
    double? currentLng,
    double? targetLat,
    double? targetLng,
    double? maxAllowedDistance,
    bool isMockMode = false,
  }) async {
    if (isMockMode) {
      return {
        'isInside': true,
        'distance': 12.5,
        'error': null,
      };
    }

    // Dinamik veya varsayılan hedef ayarları
    final double effectiveTargetLat = targetLat ?? defaultLatitude;
    final double effectiveTargetLng = targetLng ?? defaultLongitude;
    final double effectiveMaxDistance = maxAllowedDistance ?? defaultMaxAllowedDistance;

    // Dışarıdan anlık koordinat verilmediyse cihazın canlı GPS konumunu al
    if (currentLat == null || currentLng == null) {
      try {
        // 1. GPS Servisi kontrolü
        bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (!serviceEnabled) {
          return {
            'isInside': false,
            'distance': -1.0,
            'error': 'Cihazın GPS servisi kapalı.',
          };
        }

        // 2. Konum izin kontrolü
        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
          if (permission == LocationPermission.denied) {
            return {
              'isInside': false,
              'distance': -1.0,
              'error': 'Konum izni reddedildi.',
            };
          }
        }

        if (permission == LocationPermission.deniedForever) {
          return {
            'isInside': false,
            'distance': -1.0,
            'error': 'Konum izni kalıcı engelli. Ayarlardan izin veriniz.',
          };
        }

        // 3. Hızlı ve Akıllı Konum Alma Stratejisi
        Position? position;

        // ⚡ A. Önce önbellekteki son bilinen konumu kontrol et (Anında yanıt verir)
        try {
          Position? lastKnown = await Geolocator.getLastKnownPosition();
          if (lastKnown != null) {
            final differenceInMinutes = DateTime.now().difference(lastKnown.timestamp).inMinutes;
            // 3 dakikadan yeniyse doğrudan kullan
            if (differenceInMinutes < 3) {
              position = lastKnown;
              debugPrint("⚡ Son bilinen hızlı konum kullanıldı (Yaş: ${differenceInMinutes}dk | Sapma: ±${lastKnown.accuracy.toStringAsFixed(1)}m)");
            }
          }
        } catch (e) {
          debugPrint("⚠️ Son bilinen konum okunamadı: $e");
        }

        // ⚡ B. Önbellek yoksa veya eskiyse doğrudan orta hassasiyette canlı konum iste
        if (position == null) {
          try {
            position = await Geolocator.getCurrentPosition(
              desiredAccuracy: LocationAccuracy.medium,
              timeLimit: const Duration(seconds: 4),
            );
          } catch (e) {
            debugPrint("📍 Canlı konum zaman aşımına uğradı, yedek önbelleğe düşülüyor: $e");
            // Zaman aşımı durumunda uygulamayı kitleme, son bilinen konuma düş
            position = await Geolocator.getLastKnownPosition();
          }
        }

        if (position == null) {
          return {
            'isInside': false,
            'distance': -1.0,
            'error': 'Konum sinyali alınamadı. Lütfen GPS/İnternet bağlantınızı kontrol edin.',
          };
        }

        currentLat = position.latitude;
        currentLng = position.longitude;

        debugPrint("📍 Cihaz Anlık Konum -> Enlem: $currentLat, Boylam: $currentLng | Sapma: ±${position.accuracy.toStringAsFixed(1)}m");
      } catch (e) {
        debugPrint("📍 Konum alma hatası: $e");
        return {
          'isInside': false,
          'distance': -1.0,
          'error': 'Konum alınamadı: $e',
        };
      }
    }

    // 4. Admin panelinden gelen dinamik koordinatlara göre mesafe hesabı
    final double distanceInMeters = Geolocator.distanceBetween(
      currentLat,
      currentLng,
      effectiveTargetLat,
      effectiveTargetLng,
    );

    debugPrint("🎯 Admin Hedef -> Enlem: $effectiveTargetLat, Boylam: $effectiveTargetLng | Yarıçap: ${effectiveMaxDistance}m");
    debugPrint("📏 Hesaplanan Mesafe: ${distanceInMeters.toStringAsFixed(1)} metre");

    final isInside = distanceInMeters <= effectiveMaxDistance;

    return {
      'isInside': isInside,
      'distance': double.parse(distanceInMeters.toStringAsFixed(1)),
      'error': null,
    };
  }

  /// İki koordinat arası mesafeyi metre cinsinden hesaplar
  static double calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2);
  }
}