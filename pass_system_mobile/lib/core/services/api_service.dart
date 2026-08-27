import 'dart:async';
import 'dart:convert' show jsonEncode, jsonDecode;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:pass_system_mobile/core/services/auth_service.dart';

class ApiService {
  static const String baseUrl = 'http://192.168.3.17:5000';
  static const Duration _timeoutDuration = Duration(seconds: 15);

  /// 🔑 Ortak HTTP Header Oluşturucu
  static Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (withAuth) {
      final token = await AuthService().getToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  /// 🔑 Kullanıcı Girişi (Cihaz Kimliği Gönderimi)
  static Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final url = Uri.parse('$baseUrl/api/auth/login');
      final headers = await _getHeaders(withAuth: false);
      final deviceId = await AuthService.getDeviceId();

      final response = await http
          .post(
            url,
            headers: headers,
            body: jsonEncode({
              'email': email,
              'password': password,
              if (deviceId != null) 'deviceId': deviceId,
            }),
          )
          .timeout(_timeoutDuration);

      Map<String, dynamic> bodyData = {};
      try {
        if (response.body.isNotEmpty) {
          bodyData = jsonDecode(response.body);
        }
      } catch (_) {}

      if (response.statusCode == 200) {
        return {'status': 'SUCCESS', ...bodyData};
      }

      // 🚨 403 Engellendi / Cihaz Uyuşmazlığı ve diğer hata yanıtları
      return {
        'status': 'ERROR',
        'statusCode': response.statusCode,
        'code': bodyData['code'],
        'title': bodyData['title'],
        'message': bodyData['message'] ?? 'Giriş başarısız (${response.statusCode})',
      };
    } on TimeoutException {
      return {'status': 'ERROR', 'message': 'Sunucu yanıt vermedi (Zaman Aşımı)'};
    } catch (e) {
      if (kDebugMode) debugPrint('❌ LOGIN HATA DETAYI: $e');
      return {'status': 'ERROR', 'message': 'Bağlantı hatası: $e'};
    }
  }

  /// 👤 Kullanıcı Profilini Çekme
  static Future<Map<String, dynamic>?> getUserProfile() async {
    try {
      final headers = await _getHeaders();
      final response = await http
          .get(
            Uri.parse('$baseUrl/api/users/me'),
            headers: headers,
          )
          .timeout(_timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is Map<String, dynamic>) {
          return data['user'] ?? data['userData'] ?? data['data'] ?? data;
        }
      }
    } on TimeoutException {
      if (kDebugMode) debugPrint('⏳ Profil isteği zaman aşımına uğradı.');
    } catch (e) {
      if (kDebugMode) debugPrint('❌ Profil çekme hatası: $e');
    }
    return null;
  }

  /// ⚙️ Admin Paneli Dinamik Sistem & Konum Ayarlarını Çekme
  static Future<Map<String, dynamic>?> getSystemSettings() async {
    try {
      final url = Uri.parse('$baseUrl/api/settings');
      final headers = await _getHeaders();

      if (kDebugMode) debugPrint('🌐 [API REQ] Sistem ayarları isteniyor: $url');

      final response = await http.get(url, headers: headers).timeout(_timeoutDuration);

      if (kDebugMode) {
        debugPrint('🌐 [API RES STATUS] -> ${response.statusCode}');
        debugPrint('🌐 [API RES BODY] -> ${response.body}');
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is Map<String, dynamic>) {
          return data['system'] ?? data['settings'] ?? data['systemSettings'] ?? data['data'] ?? data;
        }
      }
    } on TimeoutException {
      if (kDebugMode) debugPrint('⏳ Sistem ayarları isteği zaman aşımına uğradı.');
    } catch (e) {
      if (kDebugMode) debugPrint('❌ [API ERROR] Sistem ayarları çekilemedi: $e');
    }
    return null;
  }

  /// 📱 Dinamik QR Kod Üretme İsteği
  static Future<Map<String, dynamic>> generateQr(String userId) async {
    try {
      final url = Uri.parse('$baseUrl/api/qr/generate');
      final headers = await _getHeaders();

      final response = await http
          .post(
            url,
            headers: headers,
            body: jsonEncode({'userId': userId}),
          )
          .timeout(_timeoutDuration);

      final data = jsonDecode(response.body);
      if (data is Map<String, dynamic>) {
        return data;
      }
      return {'success': false, 'message': 'Geçersiz sunucu yanıtı.'};
    } on TimeoutException {
      return {'success': false, 'message': 'QR üretme isteği zaman aşımına uğradı.'};
    } catch (e) {
      if (kDebugMode) debugPrint('❌ QR üretme hatası: $e');
      return {'success': false, 'message': 'Sunucu bağlantı hatası: $e'};
    }
  }

  /// 🔑 Şifremi Unuttum
  static Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final url = Uri.parse('$baseUrl/api/auth/forgot-password');
      final headers = await _getHeaders(withAuth: false);

      final response = await http
          .post(
            url,
            headers: headers,
            body: jsonEncode({'email': email}),
          )
          .timeout(_timeoutDuration);

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'status': 'SUCCESS', 'message': data['message']};
      }
      return {'status': 'ERROR', 'message': data['message'] ?? 'E-posta gönderilemedi.'};
    } on TimeoutException {
      return {'status': 'ERROR', 'message': 'İstek zaman aşımına uğradı.'};
    } catch (e) {
      if (kDebugMode) debugPrint('FORGOT PASSWORD HATA DETAYI: $e');
      return {'status': 'ERROR', 'message': 'Sunucuya bağlanılamadı: $e'};
    }
  }

  /// 🔑 Yeni Şifre Oluşturma
  static Future<Map<String, dynamic>> createPassword(String token, String password) async {
    try {
      final url = Uri.parse('$baseUrl/api/auth/create-password');
      final headers = await _getHeaders(withAuth: false);

      final response = await http
          .post(
            url,
            headers: headers,
            body: jsonEncode({'token': token, 'password': password}),
          )
          .timeout(_timeoutDuration);

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'status': 'SUCCESS', 'message': data['message']};
      }
      return {'status': 'ERROR', 'message': data['message'] ?? 'Şifre oluşturulamadı.'};
    } on TimeoutException {
      return {'status': 'ERROR', 'message': 'İstek zaman aşımına uğradı.'};
    } catch (e) {
      if (kDebugMode) debugPrint('CREATE PASSWORD HATA DETAYI: $e');
      return {'status': 'ERROR', 'message': 'Sunucuya bağlanılamadı: $e'};
    }
  }

  /// 📋 Tüm Geçiş Loglarını Çekme
  static Future<List<dynamic>> getPassLogs() async {
    try {
      final headers = await _getHeaders();
      final response = await http
          .get(
            Uri.parse('$baseUrl/api/pass-logs'),
            headers: headers,
          )
          .timeout(_timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is List) return data;
        if (data is Map<String, dynamic>) {
          return data['logs'] ?? data['data'] ?? [];
        }
      }
    } on TimeoutException {
      if (kDebugMode) debugPrint('⏳ Geçiş logları zaman aşımına uğradı.');
    } catch (e) {
      if (kDebugMode) debugPrint('API GET Hatası: $e');
    }
    return [];
  }

  /// 🚪 Manuel Geçiş Tetikleme
  static Future<Map<String, dynamic>> triggerPass({
    required String userId,
    required String gateName,
    required String type,
  }) async {
    try {
      final headers = await _getHeaders();
      final response = await http
          .post(
            Uri.parse('$baseUrl/api/pass-logs'),
            headers: headers,
            body: jsonEncode({
              'userId': userId,
              'gateName': gateName,
              'type': type,
            }),
          )
          .timeout(_timeoutDuration);

      if (response.body.isNotEmpty && (response.body.startsWith('{') || response.body.startsWith('['))) {
        return jsonDecode(response.body);
      }
      return {
        'status': 'ERROR',
        'message': 'Sunucudan geçersiz yanıt geldi (Status: ${response.statusCode})'
      };
    } on TimeoutException {
      return {'status': 'ERROR', 'message': 'Geçiş isteği zaman aşımına uğradı.'};
    } catch (e) {
      if (kDebugMode) debugPrint("Format Hatası Detayı: $e");
      return {'status': 'ERROR', 'message': 'Veri işleme hatası: $e'};
    }
  }

  /// 📜 Kullanıcının Kendi Geçiş Geçmişini Çekme
  static Future<List<dynamic>> getUserPassLogs(String userId) async {
    try {
      final url = Uri.parse('$baseUrl/api/pass-logs/user?userId=$userId');
      final headers = await _getHeaders();

      if (kDebugMode) debugPrint('🌐 [API REQ] Kullanıcı logları isteniyor: $url');

      final response = await http.get(url, headers: headers).timeout(_timeoutDuration);

      if (kDebugMode) {
        debugPrint('🌐 [API RES STATUS] -> ${response.statusCode}');
        debugPrint('🌐 [API RES BODY] -> ${response.body}');
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is List) return data;
        if (data is Map<String, dynamic>) {
          return data['logs'] ?? data['data'] ?? data['result'] ?? data['passLogs'] ?? [];
        }
      }
    } on TimeoutException {
      if (kDebugMode) debugPrint('⏳ Kullanıcı geçiş geçmişi zaman aşımına uğradı.');
    } catch (e) {
      if (kDebugMode) debugPrint('❌ API HATA DETAYI (getUserPassLogs): $e');
    }
    return [];
  }
}