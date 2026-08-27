import 'dart:convert';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pass_system_mobile/core/utils/app_logger.dart';

class AuthService {
  static const String baseUrl = 'http://192.168.3.17:5000/api';

  /// 📱 Cihaz Benzersiz Kimliğini (UUID/ID) Alır
  static Future<String?> getDeviceId() async {
    try {
      final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();

      if (kIsWeb) {
        final webInfo = await deviceInfo.webBrowserInfo;
        return 'WEB_${webInfo.vendor}_${webInfo.userAgent.hashCode}';
      }

      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id.isNotEmpty ? androidInfo.id : 'ANDROID_${androidInfo.model}';
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? 'IOS_${iosInfo.model}';
      } else if (Platform.isWindows) {
        final windowsInfo = await deviceInfo.windowsInfo;
        return windowsInfo.deviceId;
      } else if (Platform.isLinux) {
        final linuxInfo = await deviceInfo.linuxInfo;
        return linuxInfo.machineId;
      } else if (Platform.isMacOS) {
        final macInfo = await deviceInfo.macOsInfo;
        return macInfo.systemGUID;
      }
    } catch (e, stackTrace) {
      AppLogger.e('Cihaz kimliği alınamadı', e, stackTrace);
    }
    return null;
  }

  /// 🔑 Kullanıcı Girişi (Cihaz Kilidi / deviceUuid Destekli)
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final deviceId = await getDeviceId();

      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          // 🚀 Backend veritabanında 'deviceUuid' beklediği için eklendi
          if (deviceId != null) 'deviceUuid': deviceId,
          if (deviceId != null) 'deviceId': deviceId,
        }),
      ).timeout(const Duration(seconds: 10));

      Map<String, dynamic> data = {};
      try {
        if (response.body.isNotEmpty) {
          data = jsonDecode(response.body);
        }
      } catch (_) {}

      // Başarılı Giriş
      if (response.statusCode == 200 && (data['success'] == true || data['token'] != null)) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('jwt_token');
        await prefs.remove('user_data');

        String? token = data['token'] ?? data['data']?['token'];
        Map<String, dynamic>? user = data['user'] ??
            data['userData'] ??
            data['data']?['user'] ??
            (data['data'] is Map<String, dynamic> ? data['data'] : null);

        if (token != null) await prefs.setString('jwt_token', token);
        if (user != null) await prefs.setString('user_data', jsonEncode(user));

        AppLogger.i('Oturum açma başarılı.');
        return {'success': true, 'token': token, 'user': user};
      }

      // 🚨 403 Engellendi / Cihaz Uyuşmazlığı / Diğer Hatalar
      return {
        'success': false,
        'statusCode': response.statusCode,
        'code': data['code'],
        'title': data['title'],
        'message': data['message'] ?? 'Giriş başarısız (${response.statusCode})',
      };
    } catch (e, stackTrace) {
      AppLogger.e('Sunucuya bağlanırken hata oluştu', e, stackTrace);
      return {
        'success': false,
        'message': 'Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.',
      };
    }
  }

  // 🔑 ŞİFREMİ UNUTTUM / E-POSTA İSTEĞİ
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/forgot-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      ).timeout(const Duration(seconds: 10));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        AppLogger.i('Şifre yenileme e-postası talebi gönderildi.');
        return {'success': true, 'message': data['message'] ?? 'E-posta gönderildi.'};
      }
      return {'success': false, 'message': data['message'] ?? 'İşlem başarısız.'};
    } catch (e, stackTrace) {
      AppLogger.e('Şifre sıfırlama talebi hatası', e, stackTrace);
      return {'success': false, 'message': 'Sunucuya bağlanılamadı.'};
    }
  }

  Future<void> updateStoredUserData(Map<String, dynamic> newUser) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_data', jsonEncode(newUser));
    AppLogger.i('Yerel kullanıcı verileri güncellendi.');
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    String? userDataString = prefs.getString('user_data');
    if (userDataString != null) {
      return jsonDecode(userDataString) as Map<String, dynamic>;
    }
    return null;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    AppLogger.i('Kullanıcı oturumu kapatıldı.');
  }

  Future<Map<String, dynamic>> createPassword(String token, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/create-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'token': token, 'password': password}),
      ).timeout(const Duration(seconds: 10));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'message': data['message'] ?? 'Şifreniz oluşturuldu.'};
      }
      return {'success': false, 'message': data['message'] ?? 'İşlem başarısız.'};
    } catch (e, stackTrace) {
      AppLogger.e('Şifre oluşturma hatası', e, stackTrace);
      return {'success': false, 'message': 'Sunucuya bağlanılamadı.'};
    }
  }
}