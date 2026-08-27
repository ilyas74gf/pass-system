import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pass_system_mobile/core/services/location_service.dart';
import 'package:pass_system_mobile/core/services/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  bool _isInside = false;
  double _distance = -1;

  static const Color primaryNavy = Color(0xFF0B2545);

  String? _currentUserId;
  String? _currentUserName;

  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _loadUserDataAndLocation();
  }

  Future<void> _loadUserDataAndLocation() async {
    setState(() => _isLoading = true);

    final user = await _authService.getCurrentUser();
    final result = await LocationService.checkGeofence();

    if (!mounted) return;

    setState(() {
      if (user != null) {
        _currentUserId = (user['id'] ?? user['_id'] ?? user['userId'])?.toString();

        String parsedName = (user['name'] ?? user['fullName'] ?? '').toString();
        if (parsedName.isEmpty) {
          String firstName = (user['firstName'] ?? '').toString();
          String lastName = (user['lastName'] ?? '').toString();
          parsedName = '$firstName $lastName'.trim();
        }
        _currentUserName = parsedName.isNotEmpty ? parsedName : user['email']?.toString();
      } else {
        _currentUserId = null;
        _currentUserName = null;
      }

      _isInside = result['isInside'] ?? false;
      _distance = (result['distance'] as num?)?.toDouble() ?? -1.0;
      _isLoading = false;
    });
  }

  void _navigateToQrScreen() {
    if (_currentUserId == null || _currentUserId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kullanıcı oturumu geçersiz. Tekrar giriş yapın.')),
      );
      return;
    }

    // 🛑 KONUM KONTROLÜ
    if (!_isInside) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.location_off_rounded, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Belirlenen konumda değilsiniz! Tesis dışındasınız (${_distance >= 0 ? _distance.toStringAsFixed(0) : "---"}m).',
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
      return; // 🛑 Konum dışındaysa QR ekranına geçiş engellenir!
    }

    context.push('/qr', extra: _currentUserId);
  }

  void _handleLogout() async {
    await _authService.logout();
    if (mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          _currentUserName != null && _currentUserName!.isNotEmpty
              ? 'Hoş Geldin, $_currentUserName'
              : 'Pass System - Geçiş Paneli',
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18),
        ),
        backgroundColor: primaryNavy,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadUserDataAndLocation,
            tooltip: 'Yenile',
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            onPressed: _handleLogout,
            tooltip: 'Çıkış Yap',
          ),
        ],
      ),
      body: Center(
        child: _isLoading
            ? const CircularProgressIndicator(color: primaryNavy)
            : Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24.0),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: primaryNavy.withValues(alpha: 0.08),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: _isInside ? Colors.green.shade50 : Colors.red.shade50,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              _isInside ? Icons.location_on : Icons.location_off,
                              size: 56,
                              color: _isInside ? Colors.green.shade700 : Colors.red.shade700,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _isInside ? 'Tesistesiniz ✅' : 'Binadan Uzaktasınız 🔒',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: _isInside ? Colors.green.shade800 : Colors.red.shade800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isInside
                                ? 'Turnike geçiş kodunuzu üretebilirsiniz.'
                                : 'Tesise olan mesafe: ${_distance >= 0 ? _distance.toStringAsFixed(0) : "Hesaplanıyor"} metre',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),

                    // 🔘 PASİF/KİLİTLİ GÖRÜNÜMLÜ BUTON
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: _navigateToQrScreen,
                        icon: Icon(
                          _isInside ? Icons.qr_code_2 : Icons.lock_rounded,
                          color: _isInside ? Colors.white : Colors.white70,
                        ),
                        label: Text(
                          _isInside ? 'Dinamik QR Kod Üret' : 'QR Üretimi Kilitli (Konum Dışı)',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isInside ? primaryNavy : Colors.grey.shade700,
                          elevation: _isInside ? 2 : 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    TextButton.icon(
                      onPressed: _loadUserDataAndLocation,
                      icon: const Icon(Icons.refresh, color: primaryNavy),
                      label: const Text(
                        'Konumu Yeniden Tara',
                        style: TextStyle(color: primaryNavy, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}