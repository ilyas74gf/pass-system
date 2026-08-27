import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pass_system_mobile/core/services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final AuthService _authService = AuthService();

  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _isTurkish = true;

  String _t(String tr, String en) => _isTurkish ? tr : en;

  void _handleLogin() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_t('Lütfen tüm alanları doldurun!', 'Please fill in all fields!')),
          backgroundColor: Colors.orange.shade800,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    final result = await _authService.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    setState(() => _isLoading = false);

    if (!mounted) return;

    // 📱 1. CIHAZ UYUŞMAZLIĞI KONTROLÜ (DEVICE_MISMATCH)
    if (result['code'] == 'DEVICE_MISMATCH' || result['code'] == 'DEVICE_UNAUTHORIZED') {
      _showDeviceMismatchDialog(
        title: result['title'] ?? _t('Farklı Cihaz Tespiti', 'Device Mismatch'),
        message: result['message'] ??
            _t(
              'Bu hesap başka bir cihaza tanımlanmıştır. Yeni cihazınızla giriş yapabilmek için lütfen yöneticinizle iletişime geçerek cihaz kilidinizi sıfırlatınız.',
              'This account is registered to another device. Please contact your administrator to reset your device lock.',
            ),
      );
      return;
    }

    // 🚨 2. ENGELLİ KULLANICI KONTROLÜ (403 veya ACCOUNT_BLOCKED)
    if (result['statusCode'] == 403 || result['code'] == 'ACCOUNT_BLOCKED') {
      _showBlockedDialog(
        title: result['title'] ?? _t('Erişim Engellendi', 'Access Denied'),
        message: result['message'] ?? _t('Hesabınız engellenmiştir. Lütfen yönetimle iletişime geçiniz.', 'Your account has been blocked.'),
      );
      return;
    }

    // 3. BAŞARILI GİRİŞ
    if (result['success'] == true) {
      context.go('/qr');
    } else {
      // 4. GENEL GİRİŞ HATASI
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? _t('Giriş Başarısız! Bilgilerinizi kontrol edin. ❌', 'Login Failed! Check your credentials. ❌')),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  // 📱 FARKLI CİHAZ (DEVICE MISMATCH) POP-UP PENCERESİ
  void _showDeviceMismatchDialog({required String title, required String message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0B2545),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Colors.amber, width: 1.5),
          ),
          title: Row(
            children: [
              const Icon(Icons.phonelink_erase_rounded, color: Colors.amber, size: 28),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Text(
            message,
            style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _t('Anladım', 'OK'),
                style: const TextStyle(color: Color(0xFF0B2545), fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  // 🛑 ENGELLENDİNİZ POP-UP PENCERESİ
  void _showBlockedDialog({required String title, required String message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0B2545),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Colors.redAccent, width: 1.5),
          ),
          title: Row(
            children: [
              const Icon(Icons.block_rounded, color: Colors.redAccent, size: 28),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Text(
            message,
            style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _t('Anladım', 'OK'),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  // 🔑 ŞİFREMİ UNUTTUM POPUP/DIALOG PENCERESİ
  void _showForgotPasswordDialog() {
    final TextEditingController resetEmailController = TextEditingController();
    bool isResetLoading = false;
    String? infoMessage;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF0B2545),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: const Color(0xFFC5A059).withValues(alpha: 0.3)),
              ),
              title: Row(
                children: [
                  const Icon(Icons.mark_email_read_outlined, color: Color(0xFFC5A059)),
                  const SizedBox(width: 10),
                  Text(
                    _t('Şifre Yenileme', 'Password Reset'),
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              content: infoMessage != null
                  ? Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        infoMessage!,
                        style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                        textAlign: TextAlign.center,
                      ),
                    )
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _t('Sistemde kayıtlı e-posta adresinizi giriniz.', 'Enter your registered email address.'),
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: resetEmailController,
                          style: const TextStyle(color: Colors.white),
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            labelText: _t('E-Posta Adresi', 'Email Address'),
                            labelStyle: const TextStyle(color: Colors.white70),
                            prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFFC5A059)),
                            filled: true,
                            fillColor: Colors.white.withValues(alpha: 0.08),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ],
                    ),
              actions: [
                if (infoMessage != null)
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(_t('Tamam', 'OK'), style: const TextStyle(color: Color(0xFFC5A059), fontWeight: FontWeight.bold)),
                  )
                else ...[
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(_t('İptal', 'Cancel'), style: const TextStyle(color: Colors.white60)),
                  ),
                  ElevatedButton(
                    onPressed: isResetLoading
                        ? null
                        : () async {
                            if (resetEmailController.text.trim().isEmpty) return;

                            setDialogState(() => isResetLoading = true);

                            await _authService.forgotPassword(resetEmailController.text.trim());

                            setDialogState(() {
                              isResetLoading = false;
                              infoMessage = _t(
                                'E-posta adresi sistemde kayıtlıysa, bu adrese şifre yenileme bağlantısı iletilecektir.',
                                'If the email address is registered in the system, a password reset link will be sent to this address.',
                              );
                            });
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFC5A059),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: isResetLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(color: Color(0xFF0B2545), strokeWidth: 2),
                          )
                        : Text(_t('Gönder', 'Send'), style: const TextStyle(color: Color(0xFF0B2545), fontWeight: FontWeight.bold)),
                  ),
                ],
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF07182E), Color(0xFF0B2545), Color(0xFF030E1E)],
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              _buildLangOption('TR', _isTurkish, () => setState(() => _isTurkish = true)),
                              _buildLangOption('EN', !_isTurkish, () => setState(() => _isTurkish = false)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.05),
                        border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: 0.5)),
                      ),
                      child: const Icon(
                        Icons.lock_person_rounded,
                        size: 60,
                        color: Color(0xFFC5A059),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'TRAKYA TEKNOPARK',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _t('Geçiş Kontrol Sistemi', 'Access Control System'),
                      style: const TextStyle(fontSize: 14, color: Colors.white60),
                    ),
                    const SizedBox(height: 40),
                    TextField(
                      controller: _emailController,
                      style: const TextStyle(color: Colors.white),
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: _t('E-Posta Adresi', 'Email Address'),
                        labelStyle: const TextStyle(color: Colors.white70),
                        prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFFC5A059)),
                        filled: true,
                        fillColor: Colors.white.withValues(alpha: 0.08),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: _t('Şifre', 'Password'),
                        labelStyle: const TextStyle(color: Colors.white70),
                        prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFFC5A059)),
                        suffixIcon: IconButton(
                          icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, color: Colors.white60),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                        filled: true,
                        fillColor: Colors.white.withValues(alpha: 0.08),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _showForgotPasswordDialog,
                        child: Text(
                          _t('Şifremi Unuttum?', 'Forgot Password?'),
                          style: const TextStyle(
                            color: Color(0xFFC5A059),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFC5A059),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: _isLoading
                            ? const CircularProgressIndicator(color: Color(0xFF0B2545))
                            : Text(
                                _t('GİRİŞ YAP', 'LOG IN'),
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0B2545),
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLangOption(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFC5A059) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? const Color(0xFF0B2545) : Colors.white70,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}