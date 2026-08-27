import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

class AppLogger {
  static final Logger _logger = Logger(
    printer: PrettyPrinter(
      methodCount: 0,
      errorMethodCount: 5,
      lineLength: 80,
      colors: true,
      printEmojis: true,
      dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart, // 🟢 Düzeltilen kısım
    ),
  );

  /// ℹ️ Bilgilendirme Logları
  static void i(String message) {
    if (kDebugMode) {
      _logger.i(message);
    }
  }

  /// ⚠️ Uyarı Logları
  static void w(String message) {
    if (kDebugMode) {
      _logger.w(message);
    }
  }

  /// ❌ Hata Logları
  static void e(String message, [dynamic error, StackTrace? stackTrace]) {
    if (kDebugMode) {
      _logger.e(message, error: error, stackTrace: stackTrace);
    }
  }

  /// 🐛 Debug / Detay Logları
  static void d(String message) {
    if (kDebugMode) {
      _logger.d(message);
    }
  }
}