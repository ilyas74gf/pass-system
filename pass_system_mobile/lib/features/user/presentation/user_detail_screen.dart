import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pass_system_mobile/core/services/api_service.dart';
import 'package:pass_system_mobile/core/services/auth_service.dart';

class UserDetailScreen extends StatefulWidget {
  final bool isTurkish;

  const UserDetailScreen({
    super.key,
    this.isTurkish = true,
  });

  @override
  State<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends State<UserDetailScreen> {
  static const Color primaryNavy = Color(0xFF0B2545);
  static const Color accentGold = Color(0xFFC5A059);

  final AuthService _authService = AuthService();

  bool _isLoading = true;
  String _userId = '';
  String _userName = '';
  String _userTitle = '';
  String _employeeId = '';
  String _companyName = '';
  String _authorizedBlock = '';
  String? _userPhotoUrl;

  String _t(String tr, String en) => widget.isTurkish ? tr : en;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  String _extractCompanyName(dynamic companyData) {
    if (companyData == null) return _t('Şirket Bilgisi Yok', 'No Company Info');
    if (companyData is Map) {
      return companyData['name']?.toString() ?? companyData['title']?.toString() ?? _t('Şirket Bilgisi Yok', 'No Company Info');
    }
    return companyData.toString();
  }

  Future<void> _loadUserData() async {
    final localUser = await _authService.getCurrentUser();
    if (localUser != null && mounted) {
      _applyUserData(localUser);
    }

    final remoteUser = await ApiService.getUserProfile();
    if (remoteUser != null && mounted) {
      await _authService.updateStoredUserData(remoteUser);
      _applyUserData(remoteUser);
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _applyUserData(Map<String, dynamic> rawUser) {
    final user = (rawUser['user'] is Map) ? rawUser['user'] : ((rawUser['data'] is Map) ? rawUser['data'] : rawUser);

    setState(() {
      _userId = (user['id'] ?? user['_id'] ?? user['userId'])?.toString() ?? '';
      
      String? photo = user['profilePicture'] ?? user['photo'] ?? user['avatar'] ?? user['profile_picture'] ?? user['photoUrl'];
      if (photo != null && photo.toString().trim().isNotEmpty) {
        String photoStr = photo.toString().trim();
        if (!photoStr.startsWith('http') && !photoStr.startsWith('data:image')) {
          photoStr = '${ApiService.baseUrl}${photoStr.startsWith('/') ? '' : '/'}$photoStr';
        }
        _userPhotoUrl = photoStr;
      }

      String parsedName = (user['name'] ?? user['fullName'] ?? '').toString();
      if (parsedName.isEmpty) {
        String firstName = (user['firstName'] ?? '').toString();
        String lastName = (user['lastName'] ?? '').toString();
        parsedName = '$firstName $lastName'.trim();
      }

      if (parsedName.isEmpty && user['email'] != null) {
        parsedName = user['email'].toString().split('@').first;
      }

      _userName = parsedName.isNotEmpty ? parsedName : 'Kullanıcı';
      _userTitle = user['title']?.toString() ?? user['role']?.toString() ?? _t('Belirtilmedi', 'Unspecified');
      
      final rawEmpId = user['employeeId'] ?? user['employee_id'] ?? user['sicilNo'] ?? user['registrationNo'];
      _employeeId = (rawEmpId != null && rawEmpId.toString().trim().isNotEmpty)
          ? rawEmpId.toString()
          : _t('Belirtilmedi', 'Unspecified');

      _companyName = _extractCompanyName(user['company'] ?? user['companyName']);
      _authorizedBlock = user['authorizedBlock']?.toString() ?? user['block']?.toString() ?? _t('Tüm Bloklar', 'All Blocks');
    });
  }

  Widget _buildProfileImage(String? photoUrl) {
    if (photoUrl == null || photoUrl.isEmpty) {
      return CircleAvatar(
        radius: 40,
        backgroundColor: primaryNavy.withValues(alpha: 0.1),
        child: const Icon(Icons.person, size: 50, color: primaryNavy),
      );
    }

    if (photoUrl.startsWith('data:image')) {
      try {
        final base64String = photoUrl.split(',').last;
        final bytes = base64Decode(base64String);
        return CircleAvatar(
          radius: 40,
          backgroundImage: MemoryImage(bytes),
        );
      } catch (e) {
        return CircleAvatar(
          radius: 40,
          backgroundColor: primaryNavy.withValues(alpha: 0.1),
          child: const Icon(Icons.person_off, size: 40, color: Colors.red),
        );
      }
    }

    return CircleAvatar(
      radius: 40,
      backgroundColor: primaryNavy.withValues(alpha: 0.1),
      backgroundImage: NetworkImage(photoUrl),
      onBackgroundImageError: (_, __) {},
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F9),
      appBar: AppBar(
        title: Text(
          _t('Kullanıcı Bilgileri', 'User Details'),
          style: const TextStyle(color: primaryNavy, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: primaryNavy),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: primaryNavy))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: primaryNavy.withValues(alpha: 0.08),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        _buildProfileImage(_userPhotoUrl),
                        const SizedBox(height: 12),
                        Text(
                          _userName,
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: primaryNavy),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _userTitle,
                          style: const TextStyle(fontSize: 14, color: Colors.grey),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: accentGold.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: accentGold),
                          ),
                          child: Text(
                            _companyName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.bold, color: primaryNavy, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        _buildDetailRow(Icons.business_rounded, _t('Bağlı Şirket', 'Company'), _companyName),
                        const Divider(height: 24),
                        _buildDetailRow(Icons.badge_outlined, _t('Sicil No', 'Employee ID'), _employeeId),
                        const Divider(height: 24),
                        _buildDetailRow(Icons.door_sliding_outlined, _t('Yetkili Blok', 'Authorized Block'), _authorizedBlock),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        context.push('/user-history', extra: _userId);
                      },
                      icon: const Icon(Icons.history_rounded, color: Colors.white),
                      label: Text(
                        _t('Geçmiş Geçiş Hareketlerim', 'My Access History'),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryNavy,
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await _authService.logout();
                        if (context.mounted) {
                          context.go('/login');
                        }
                      },
                      icon: const Icon(Icons.logout, color: Colors.red),
                      label: Text(
                        _t('Oturumu Kapat / Çıkış Yap', 'Log Out / Close Session'),
                        style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.red),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildDetailRow(IconData icon, String title, String value) {
    return Row(
      children: [
        Icon(icon, color: primaryNavy, size: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: primaryNavy),
              ),
            ],
          ),
        ),
      ],
    );
  }
}