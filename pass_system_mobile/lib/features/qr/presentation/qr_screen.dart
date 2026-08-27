import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pass_system_mobile/core/services/api_service.dart';
import 'package:pass_system_mobile/core/services/auth_service.dart';
import 'package:pass_system_mobile/core/services/location_service.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_brightness/screen_brightness.dart';

class QrScreen extends StatefulWidget {
  final String? userId;

  const QrScreen({super.key, this.userId});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> with WidgetsBindingObserver {
  static const Color primaryNavy = Color(0xFF0B2545);
  static const Color deepNavy = Color(0xFF030E1E);
  static const Color accentGold = Color(0xFFC5A059);

  int _maxSeconds = 15;
  late final ValueNotifier<int> _secondsLeftNotifier = ValueNotifier<int>(_maxSeconds);
  Timer? _qrTimer;
  Timer? _autoRefreshTimer;

  bool _isQrActive = false;
  String _qrData = "";
  bool _isLoading = false;

  bool _isTurkish = true;
  double? _previousBrightness;

  final AuthService _authService = AuthService();
  String? _currentUserId;
  String _currentUserName = "Yükleniyor...";
  String _currentUserCompany = "Yükleniyor...";
  String? _currentUserPhotoUrl;
  Widget? _cachedAvatarWidget;

  double _distanceMeters = -1;
  bool _isInside = false;
  bool _isGeofenceInside = false;
  bool _isLocationError = false;

  String _t(String tr, String en) => _isTurkish ? tr : en;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadUserDataAndLocation();

    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted && !_isQrActive) {
        _loadUserDataAndLocation(silent: true);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _qrTimer?.cancel();
    _autoRefreshTimer?.cancel();
    _secondsLeftNotifier.dispose();
    _restoreBrightness();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      _restoreBrightness();
    }
  }

  String _extractCompanyName(dynamic companyData) {
    if (companyData == null) return 'Şirket Belirtilmedi';
    if (companyData is Map) {
      return companyData['name']?.toString() ?? companyData['title']?.toString() ?? 'Şirket Belirtilmedi';
    }
    return companyData.toString();
  }

  double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  /// ⚡ PARALEL VE TIMEOUT KORUMALI VERİ VE KONUM YÜKLEME
  Future<void> _loadUserDataAndLocation({bool silent = false}) async {
    // 1. Önce cihazdaki yerel kullanıcı verisini anında ekrana bas
    if (!silent) {
      var localUser = await _authService.getCurrentUser();
      if (localUser != null && mounted) {
        _applyUserData(localUser);
      }
    }

    // 2. Ağ isteklerini paralel başlat ve 3 saniye timeout koy
    try {
      final results = await Future.wait([
        ApiService.getSystemSettings().timeout(
          const Duration(seconds: 3),
          onTimeout: () => null,
        ),
        ApiService.getUserProfile().timeout(
          const Duration(seconds: 3),
          onTimeout: () => null,
        ),
      ]);

      if (!mounted) return;

      final systemSettings = results[0];
      final liveUser = results[1];

      // A. Kullanıcı Verisini Güncelle (Canlı profil geldiyse onu, gelmediyse /api/settings içerisindeki profili kullan)
      if (liveUser != null) {
        await _authService.updateStoredUserData(liveUser);
        _applyUserData(liveUser);
      } else if (systemSettings != null && systemSettings['profile'] != null) {
        _applyUserData(systemSettings['profile']);
      }

      // B. Sistem Ayarlarını Oku
      double? targetLat;
      double? targetLng;
      double? maxDistance;

      if (systemSettings != null) {
        final systemObj = (systemSettings['system'] is Map<String, dynamic>)
            ? systemSettings['system']
            : systemSettings;

        targetLat = _parseDouble(systemObj['latitude'] ?? systemObj['lat']);
        targetLng = _parseDouble(systemObj['longitude'] ?? systemObj['lng']);
        maxDistance = _parseDouble(systemObj['geofenceRadiusMeters'] ?? systemObj['radius']);

        final dynamicExpiry = systemSettings['security']?['qrExpirySeconds'] ?? systemObj['qrExpirySeconds'];
        if (dynamicExpiry != null && dynamicExpiry is num && !_isQrActive) {
          setState(() {
            _maxSeconds = dynamicExpiry.toInt();
          });
        }
      }

      // C. Konum Kontrolünü Başlat
      final locationResult = await LocationService.checkGeofence(
        targetLat: targetLat,
        targetLng: targetLng,
        maxAllowedDistance: maxDistance,
      );

      if (mounted) {
        final String? serviceError = locationResult['error'];
        setState(() {
          if (serviceError != null) {
            _isLocationError = true;
            _distanceMeters = -1.0;
            _isGeofenceInside = false;
          } else {
            _isLocationError = false;
            _isGeofenceInside = locationResult['isInside'] ?? false;
            _distanceMeters = (locationResult['distance'] as num?)?.toDouble() ?? -1.0;
          }
        });
      }
    } catch (e) {
      debugPrint("⚠️ Veri yükleme sırasında hata: $e");
    }
  }

  void _applyUserData(Map<String, dynamic> rawUser) {
    final user = (rawUser['user'] is Map)
        ? rawUser['user']
        : ((rawUser['data'] is Map) ? rawUser['data'] : rawUser);

    String? photoUrl;
    dynamic photoRaw = user['profilePicture'] ?? 
                       user['profile_picture'] ?? 
                       user['photo'] ?? 
                       user['photoUrl'] ?? 
                       user['avatar'] ?? 
                       user['avatarUrl'] ?? 
                       user['image'];

    if (photoRaw != null && photoRaw.toString().trim().isNotEmpty) {
      String photoStr = photoRaw.toString().trim().replaceAll(r'\', '/');
      if (!photoStr.startsWith('http') && !photoStr.startsWith('data:image')) {
        final baseUrl = ApiService.baseUrl.endsWith('/') 
            ? ApiService.baseUrl.substring(0, ApiService.baseUrl.length - 1) 
            : ApiService.baseUrl;
        final path = photoStr.startsWith('/') ? photoStr : '/$photoStr';
        photoStr = '$baseUrl$path';
      }
      photoUrl = photoStr;
    }

    if (photoUrl != _currentUserPhotoUrl || _cachedAvatarWidget == null) {
      _currentUserPhotoUrl = photoUrl;
      _cachedAvatarWidget = _buildAvatarWidget(_currentUserPhotoUrl);
    }

    setState(() {
      _currentUserId = (user['id'] ?? user['_id'] ?? user['userId'])?.toString();

      String parsedName = (user['name'] ?? user['fullName'] ?? '').toString();
      if (parsedName.isEmpty) {
        String firstName = (user['firstName'] ?? user['first_name'] ?? '').toString();
        String lastName = (user['lastName'] ?? user['last_name'] ?? '').toString();
        parsedName = '$firstName $lastName'.trim();
      }
      if (parsedName.isEmpty && user['email'] != null) {
        parsedName = user['email'].toString().split('@').first;
      }
      _currentUserName = parsedName.isNotEmpty ? parsedName : 'Kullanıcı';
      _currentUserCompany = _extractCompanyName(user['company'] ?? user['companyName'] ?? user['company_name']);

      dynamic insideStatus = user['isInside'] ?? user['is_inside'] ?? user['inside'] ?? user['status'] ?? user['lastStatus'];
      if (insideStatus != null) {
        if (insideStatus is bool) {
          _isInside = insideStatus;
        } else if (insideStatus is String) {
          final lower = insideStatus.toLowerCase();
          _isInside = lower == 'inside' || lower == 'true' || lower == 'entry' || lower == 'iceride' || lower == 'içeride';
        }
      }
    });
  }

  Future<void> _setFullBrightness() async {
    try {
      _previousBrightness ??= await ScreenBrightness().application;
      await ScreenBrightness().setApplicationScreenBrightness(1.0);
    } catch (e) {
      debugPrint('Parlaklık ayarlanamadı: $e');
    }
  }

  Future<void> _restoreBrightness() async {
    try {
      if (_previousBrightness != null) {
        await ScreenBrightness().setApplicationScreenBrightness(_previousBrightness!);
      } else {
        await ScreenBrightness().resetApplicationScreenBrightness();
      }
    } catch (e) {
      debugPrint('Parlaklık sıfırlanamadı: $e');
    }
  }

  Future<void> _generateQr() async {
    if (!_isGeofenceInside) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.location_off_rounded, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _distanceMeters >= 0
                      ? _t(
                          "Belirlenen konumda değilsiniz! Tesis dışındasınız (${_distanceMeters.toStringAsFixed(0)}m).",
                          "You are not in the designated location! (${_distanceMeters.toStringAsFixed(0)}m away).",
                        )
                      : _t(
                          "Belirlenen konumda değilsiniz veya konum bilginiz alınamadı!",
                          "You are not in the designated location or location is unavailable!",
                        ),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          backgroundColor: Colors.red.shade800,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 3),
        ),
      );
      return;
    }

    final activeUserId = widget.userId ?? _currentUserId;

    if (activeUserId == null || activeUserId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kullanıcı oturum kimliği bulunamadı. Lütfen tekrar giriş yapın.')),
      );
      return;
    }

    if (_isQrActive && _secondsLeftNotifier.value > 0) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t(
            "Mevcut QR kod henüz geçerli. Lütfen sürenin bitmesini bekleyin (${_secondsLeftNotifier.value} sn).",
            "Current QR is still valid. Please wait for timer (${_secondsLeftNotifier.value} s)."
          )),
          backgroundColor: Colors.orange.shade800,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }

    if (_isLoading) return;

    setState(() => _isLoading = true);

    try {
      final data = await ApiService.generateQr(activeUserId);

      if (!mounted) return;

      if (data['success'] == true) {
        _qrTimer?.cancel();
        await _setFullBrightness();

        if (!mounted) return;

        final String securePayload = data['data']['payload'];

        final dynamic expiryFromBackend = data['qrExpirySeconds'] ?? data['data']?['ttlSeconds'];
        final int dynamicExpiry = (expiryFromBackend is num) ? expiryFromBackend.toInt() : _maxSeconds;

        setState(() {
          _maxSeconds = dynamicExpiry;
          _isQrActive = true;
          _qrData = securePayload;
        });

        _secondsLeftNotifier.value = _maxSeconds;

        _qrTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (_secondsLeftNotifier.value > 1) {
            _secondsLeftNotifier.value--;
          } else {
            _stopTimer();
          }
        });
      } else {
        final String errorMsg = data['message'] ?? _t('QR üretilemedi.', 'Failed to generate QR.');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMsg),
              backgroundColor: Colors.red.shade800,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_t("Sunucu bağlantı hatası: $e", "Server connection error: $e")),
            backgroundColor: Colors.orange.shade800,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _stopTimer() async {
    _qrTimer?.cancel();
    await _restoreBrightness();
    _secondsLeftNotifier.value = 0;
    if (mounted) {
      setState(() {
        _isQrActive = false;
        _qrData = "";
      });
      _loadUserDataAndLocation(silent: true);
    }
  }

  Color _getTimerColor(int seconds) {
    if (seconds > (_maxSeconds * 0.5)) return const Color(0xFF10B981);
    if (seconds > (_maxSeconds * 0.2)) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  Widget _buildAvatarWidget(String? photoUrl) {
    if (photoUrl == null || photoUrl.trim().isEmpty) {
      return const Icon(Icons.person, color: accentGold, size: 28);
    }

    if (photoUrl.startsWith('data:image')) {
      try {
        final base64String = photoUrl.split(',').last;
        final bytes = base64Decode(base64String);
        return ClipOval(
          child: Image.memory(
            bytes,
            width: 50,
            height: 50,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Icon(Icons.person, color: accentGold, size: 28),
          ),
        );
      } catch (_) {
        return const Icon(Icons.person, color: accentGold, size: 28);
      }
    }

    return ClipOval(
      child: Image.network(
        photoUrl,
        width: 50,
        height: 50,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Icon(Icons.person, color: accentGold, size: 28),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: deepNavy,
      body: Stack(
        children: [
          const ModernTechBackground(),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Image.asset(
                        'assets/images/logo.png',
                        height: 38,
                        errorBuilder: (context, error, stackTrace) => const Text(
                          'TRAKYA TEKNOPARK',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                      Row(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                            ),
                            child: Row(
                              children: [
                                _buildLangToggle('TR', _isTurkish, () => setState(() => _isTurkish = true)),
                                _buildLangToggle('EN', !_isTurkish, () => setState(() => _isTurkish = false)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          IconButton(
                            icon: const Icon(Icons.logout_rounded, color: Colors.white70),
                            tooltip: _t('Çıkış Yap', 'Log Out'),
                            onPressed: () async {
                              await _authService.logout();
                              if (context.mounted) {
                                context.go('/login');
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => _loadUserDataAndLocation(),
                    color: accentGold,
                    backgroundColor: primaryNavy,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 10.0),
                      child: Column(
                        children: [
                          GestureDetector(
                            onTap: () {
                              context.push('/user-detail', extra: _isTurkish).then((_) {
                                _loadUserDataAndLocation();
                              });
                            },
                            child: _buildUserProfileCard(),
                          ),
                          const SizedBox(height: 14),
                          _buildGeofenceBadge(),
                          const SizedBox(height: 20),
                          _buildQrDisplayCard(),
                          const SizedBox(height: 24),
                          _buildActionButton(),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLangToggle(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? accentGold : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? primaryNavy : Colors.white70,
            fontWeight: FontWeight.bold,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  Widget _buildUserProfileCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 15,
            offset: const Offset(0, 8),
          )
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [accentGold, Colors.white24]),
            ),
            child: _cachedAvatarWidget ?? const Icon(Icons.person, color: accentGold, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _currentUserName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, size: 20, color: accentGold),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  _currentUserCompany,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Colors.white60),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _isInside ? Colors.green.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _isInside ? Colors.green.shade300.withValues(alpha: 0.5) : Colors.red.shade300.withValues(alpha: 0.5)),
            ),
            child: Text(
              _isInside ? _t('İÇERİDE', 'INSIDE') : _t('DIŞARIDA', 'OUTSIDE'),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: _isInside ? Colors.green.shade200 : Colors.red.shade200,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGeofenceBadge() {
    bool hasDistance = _distanceMeters >= 0;
    String distanceText = hasDistance ? '${_distanceMeters.toStringAsFixed(0)}m' : '';

    String badgeText;
    if (_isLocationError) {
      badgeText = _t('⚠️ Konum Alınamadı (GPS/İzin Kontrol Edin)', '⚠️ Location Unavailable');
    } else if (!hasDistance) {
      badgeText = _t('🟡 Konum Doğrulanıyor...', '🟡 Verifying Location...');
    } else if (_isGeofenceInside) {
      badgeText = _t('🟢 Güvenli Bölgedesiniz ($distanceText)', '🟢 You are in Safe Zone ($distanceText)');
    } else {
      badgeText = _t('🔴 Tesis Dışındasınız ($distanceText)', '🔴 Outside Facility ($distanceText)');
    }

    Color bgColor = _isLocationError
        ? Colors.amber.shade900.withValues(alpha: 0.25)
        : (!hasDistance
            ? Colors.orange.withValues(alpha: 0.15)
            : (_isGeofenceInside ? Colors.green.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15)));

    Color borderColor = _isLocationError
        ? Colors.amber.shade600.withValues(alpha: 0.6)
        : (!hasDistance
            ? Colors.orange.shade400.withValues(alpha: 0.4)
            : (_isGeofenceInside ? Colors.green.shade400.withValues(alpha: 0.4) : Colors.red.shade400.withValues(alpha: 0.4)));

    Color textColor = _isLocationError
        ? Colors.amber.shade200
        : (!hasDistance
            ? Colors.orange.shade200
            : (_isGeofenceInside ? Colors.green.shade200 : Colors.red.shade200));

    return GestureDetector(
      onTap: () => _loadUserDataAndLocation(),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _isLocationError
                  ? Icons.location_disabled_rounded
                  : (!hasDistance ? Icons.location_searching : (_isGeofenceInside ? Icons.location_on : Icons.location_off)),
              color: textColor,
              size: 18,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                badgeText,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: textColor),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQrDisplayCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: accentGold.withValues(alpha: _isQrActive ? 0.35 : 0.05),
            blurRadius: 30,
            spreadRadius: 2,
            offset: const Offset(0, 10),
          )
        ],
      ),
      child: Column(
        children: [
          if (_isQrActive) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: accentGold, width: 2.5),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10)
                ],
              ),
              child: QrImageView(
                data: _qrData,
                version: QrVersions.auto,
                size: 195.0,
                dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: primaryNavy),
                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: primaryNavy),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.verified_user_rounded, size: 16, color: primaryNavy),
                const SizedBox(width: 6),
                Text(
                  _t('Dinamik Tek Kullanımlık QR Kod', 'Dynamic One-Time QR Code'),
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: primaryNavy),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ValueListenableBuilder<int>(
              valueListenable: _secondsLeftNotifier,
              builder: (context, secondsLeft, child) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 68,
                      height: 68,
                      child: CircularProgressIndicator(
                        value: _maxSeconds > 0 ? (secondsLeft / _maxSeconds) : 0,
                        strokeWidth: 6,
                        color: _getTimerColor(secondsLeft),
                        backgroundColor: Colors.grey.shade200,
                      ),
                    ),
                    Text(
                      '$secondsLeft',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _getTimerColor(secondsLeft)),
                    ),
                  ],
                );
              },
            ),
          ] else ...[
            Icon(
              _isGeofenceInside ? Icons.qr_code_2_rounded : Icons.lock_clock_rounded,
              size: 130,
              color: _isGeofenceInside ? primaryNavy.withValues(alpha: 0.2) : Colors.red.shade300.withValues(alpha: 0.4),
            ),
            const SizedBox(height: 12),
            Text(
              _isGeofenceInside
                  ? _t('Geçiş Yapmak İçin QR Kod Üretin', 'Generate QR Code to Pass')
                  : _t('QR Üretimi Kilitli (Konum Dışındasınız)', 'QR Generation Locked (Outside Zone)'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: _isGeofenceInside ? primaryNavy : Colors.red.shade800,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    final bool isLocked = !_isGeofenceInside;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: isLocked ? Colors.black.withValues(alpha: 0.2) : accentGold.withValues(alpha: 0.25),
            blurRadius: 15,
            offset: const Offset(0, 5),
          )
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        height: 54,
        child: ElevatedButton.icon(
          onPressed: _isLoading ? null : _generateQr,
          icon: _isLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(color: isLocked ? Colors.white : primaryNavy, strokeWidth: 2.5),
                )
              : Icon(
                  isLocked
                      ? Icons.lock_rounded
                      : (_isQrActive ? Icons.sync_rounded : Icons.qr_code_scanner_rounded),
                  color: isLocked ? Colors.white70 : primaryNavy,
                ),
          label: Text(
            _isLoading
                ? _t('KONTROL EDİLİYOR...', 'CHECKING...')
                : (isLocked
                    ? _t('KONUM DIŞI (KİLİTLİ)', 'OUTSIDE LOCATION (LOCKED)')
                    : (_isQrActive ? _t('KODU YENİLE', 'REFRESH CODE') : _t('GÜVENLİ QR ÜRET', 'GENERATE SECURE QR'))),
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isLocked ? Colors.white : primaryNavy,
              letterSpacing: 0.5,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: isLocked ? Colors.grey.shade800 : accentGold,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          ),
        ),
      ),
    );
  }
}

class ModernTechBackground extends StatelessWidget {
  const ModernTechBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF07182E), Color(0xFF0B2545), Color(0xFF030E1E)],
        ),
      ),
      child: CustomPaint(
        size: Size.infinite,
        painter: _GlowingOrbPainter(),
      ),
    );
  }
}

class _GlowingOrbPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final goldGlow = Paint()
      ..color = const Color(0xFFC5A059).withValues(alpha: 0.12)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 80);

    final blueGlow = Paint()
      ..color = const Color(0xFF1E3A8A).withValues(alpha: 0.3)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 100);

    canvas.drawCircle(Offset(size.width * 0.2, size.height * 0.25), 120, blueGlow);
    canvas.drawCircle(Offset(size.width * 0.8, size.height * 0.65), 140, goldGlow);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}