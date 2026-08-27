import 'package:flutter/material.dart';
import 'package:pass_system_mobile/core/services/api_service.dart';

enum PassLogStatus { entry, exit, violation }

class UserHistoryScreen extends StatefulWidget {
  final String userId;

  const UserHistoryScreen({super.key, required this.userId});

  @override
  State<UserHistoryScreen> createState() => _UserHistoryScreenState();
}

class _UserHistoryScreenState extends State<UserHistoryScreen> {
  bool _isLoading = true;
  List<dynamic> _logs = [];
  DateTimeRange? _selectedDateRange;

  static const Color primaryNavy = Color(0xFF0B2545);
  static const Color deepNavy = Color(0xFF030E1E);
  static const Color accentGold = Color(0xFFC5A059);

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    if (!mounted) return;
    setState(() => _isLoading = true);

    try {
      final dynamic rawResponse = await ApiService.getUserPassLogs(widget.userId);

      List<dynamic> fetchedLogs = [];

      if (rawResponse is List) {
        fetchedLogs = rawResponse;
      } else if (rawResponse is Map) {
        final data = rawResponse['data'] ??
            rawResponse['logs'] ??
            rawResponse['history'] ??
            rawResponse['records'] ??
            rawResponse['results'] ??
            rawResponse['passLogs'];

        if (data is List) {
          fetchedLogs = data;
        } else if (data is Map) {
          fetchedLogs = data['logs'] ?? data['records'] ?? [];
        }
      }

      if (!mounted) return;
      setState(() {
        _logs = fetchedLogs;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Kayıtlar yüklenemedi: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  /// 🛠️ GİRİŞ / ÇIKIŞ / İHLAL Analiz Algoritması
  PassLogStatus _getLogStatus(dynamic log) {
    if (log is! Map) return PassLogStatus.exit;

    final String combinedText = [
      log['direction'],
      log['type'],
      log['action'],
      log['status'],
      log['passType'],
      log['message'],
    ].where((e) => e != null).join(' ').toLowerCase();

    final String cleanText = combinedText
        .replaceAll('i̇', 'i')
        .replaceAll('ı', 'i')
        .replaceAll('ş', 's')
        .replaceAll('ğ', 'g')
        .replaceAll('ü', 'u')
        .replaceAll('ö', 'o')
        .replaceAll('ç', 'c');

    if (cleanText.contains('violation') ||
        cleanText.contains('ihlal') ||
        cleanText.contains('blocked') ||
        cleanText.contains('denied') ||
        cleanText.contains('engel') ||
        cleanText.contains('bloke')) {
      return PassLogStatus.violation;
    }

    if (cleanText.contains('cikis') || cleanText.contains('exit') || cleanText.contains('out')) {
      return PassLogStatus.exit;
    }

    if (cleanText.contains('giris') ||
        cleanText.contains('entry') ||
        cleanText.contains('in') ||
        cleanText.contains('inside') ||
        cleanText.contains('login')) {
      return PassLogStatus.entry;
    }

    return PassLogStatus.entry;
  }

  /// 📅 Güvenli Tarih Ayrıştırıcı (ISO + DD.MM.YYYY Uyumlu)
  DateTime? _parseLogDate(dynamic log) {
    if (log is! Map) return null;

    // 1. Öncelik: ISO standartındaki createdAt
    String rawIso = (log['createdAt'] ?? log['created_at'] ?? '').toString();
    if (rawIso.isNotEmpty) {
      try {
        return DateTime.parse(rawIso).toLocal();
      } catch (_) {}
    }

    // 2. Öncelik: date, timestamp veya time alanları
    String rawDate = (log['date'] ?? log['timestamp'] ?? log['time'] ?? '').toString();
    if (rawDate.isEmpty) return null;

    try {
      if (rawDate.contains('.')) {
        final parts = rawDate.split(' ')[0].split('.');
        if (parts.length == 3) {
          final day = int.parse(parts[0]);
          final month = int.parse(parts[1]);
          final year = int.parse(parts[2]);
          return DateTime(year, month, day);
        }
      }
      return DateTime.parse(rawDate).toLocal();
    } catch (_) {
      return null;
    }
  }

  /// 📅 Tarih Seçimi
  Future<void> _pickDateRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _selectedDateRange,
      helpText: 'Tarih Aralığı Seçin',
      cancelText: 'İPTAL',
      confirmText: 'UYGULA',
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: accentGold,
              onPrimary: primaryNavy,
              surface: primaryNavy,
              onSurface: Colors.white,
            ),
            dialogBackgroundColor: deepNavy,
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDateRange = picked;
      });
    }
  }

  /// 🔍 Filtrelenmiş Liste
  List<dynamic> get _filteredLogs {
    if (_selectedDateRange == null) return _logs;

    return _logs.where((log) {
      DateTime? logDate = _parseLogDate(log);
      if (logDate == null) return true;

      DateTime start = DateTime(
        _selectedDateRange!.start.year,
        _selectedDateRange!.start.month,
        _selectedDateRange!.start.day,
      );
      DateTime end = DateTime(
        _selectedDateRange!.end.year,
        _selectedDateRange!.end.month,
        _selectedDateRange!.end.day,
        23,
        59,
        59,
      );

      return (logDate.isAfter(start.subtract(const Duration(seconds: 1))) &&
          logDate.isBefore(end.add(const Duration(seconds: 1))));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final displayLogs = _filteredLogs;

    return Scaffold(
      backgroundColor: deepNavy,
      appBar: AppBar(
        title: const Text(
          'Geçmiş Geçiş Hareketleri',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: primaryNavy,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: accentGold))
          : Column(
              children: [
                // 📅 Tarih Filtreleme Barı
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: primaryNavy.withValues(alpha: 0.6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.calendar_month_rounded, color: accentGold, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            _selectedDateRange == null
                                ? 'Tüm Tarihler (${_logs.length})'
                                : "${_selectedDateRange!.start.day.toString().padLeft(2, '0')}.${_selectedDateRange!.start.month.toString().padLeft(2, '0')}.${_selectedDateRange!.start.year} - ${_selectedDateRange!.end.day.toString().padLeft(2, '0')}.${_selectedDateRange!.end.month.toString().padLeft(2, '0')}.${_selectedDateRange!.end.year}",
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          if (_selectedDateRange != null)
                            IconButton(
                              icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                              onPressed: () => setState(() => _selectedDateRange = null),
                              tooltip: 'Filtreyi Temizle',
                            ),
                          ElevatedButton.icon(
                            onPressed: _pickDateRange,
                            icon: const Icon(Icons.filter_alt_rounded, size: 16, color: primaryNavy),
                            label: const Text(
                              'Filtrele',
                              style: TextStyle(color: primaryNavy, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accentGold,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // 📋 Log Listesi
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _fetchHistory,
                    color: primaryNavy,
                    backgroundColor: accentGold,
                    child: displayLogs.isEmpty
                        ? ListView(
                            children: [
                              const SizedBox(height: 100),
                              Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.history_toggle_off_rounded, size: 64, color: Colors.white38),
                                    const SizedBox(height: 16),
                                    Text(
                                      _selectedDateRange == null
                                          ? 'Henüz bir geçiş kaydınız yok.'
                                          : 'Seçilen tarih aralığında kayıt bulunamadı.',
                                      style: const TextStyle(color: Colors.white60, fontSize: 15),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: displayLogs.length,
                            itemBuilder: (context, index) {
                              final log = displayLogs[index];
                              final PassLogStatus logStatus = _getLogStatus(log);

                              String rawDate = log['date'] ?? log['createdAt'] ?? log['created_at'] ?? log['timestamp'] ?? log['time'] ?? '';
                              String displayDate = rawDate;
                              String displayTime = log['timestamp'] ?? log['time'] ?? '';

                              if (rawDate.contains('T')) {
                                try {
                                  final dt = DateTime.parse(rawDate).toLocal();
                                  displayDate = "${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}";
                                  if (displayTime.isEmpty || displayTime.contains('T')) {
                                    displayTime = "${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}";
                                  }
                                } catch (_) {}
                              }

                              Color badgeBg;
                              Color badgeBorder;
                              Color badgeText;
                              IconData badgeIcon;
                              String statusLabel;

                              switch (logStatus) {
                                case PassLogStatus.entry:
                                  badgeBg = Colors.green.withValues(alpha: 0.2);
                                  badgeBorder = Colors.green.shade400.withValues(alpha: 0.4);
                                  badgeText = Colors.green.shade300;
                                  badgeIcon = Icons.login_rounded;
                                  statusLabel = 'GİRİŞ';
                                  break;
                                case PassLogStatus.exit:
                                  badgeBg = Colors.red.withValues(alpha: 0.2);
                                  badgeBorder = Colors.red.shade400.withValues(alpha: 0.4);
                                  badgeText = Colors.red.shade300;
                                  badgeIcon = Icons.logout_rounded;
                                  statusLabel = 'ÇIKIŞ';
                                  break;
                                case PassLogStatus.violation:
                                  badgeBg = Colors.orange.withValues(alpha: 0.2);
                                  badgeBorder = Colors.orange.shade400.withValues(alpha: 0.4);
                                  badgeText = Colors.orange.shade300;
                                  badgeIcon = Icons.warning_amber_rounded;
                                  statusLabel = 'İHLAL';
                                  break;
                              }

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              decoration: BoxDecoration(
                                                color: badgeBg,
                                                borderRadius: BorderRadius.circular(8),
                                                border: Border.all(color: badgeBorder),
                                              ),
                                              child: Row(
                                                children: [
                                                  Icon(badgeIcon, size: 14, color: badgeText),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    statusLabel,
                                                    style: TextStyle(
                                                      color: badgeText,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 11,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  log['gateName'] ?? log['gate'] ?? log['door'] ?? 'Ana Kapı',
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 15,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  displayDate,
                                                  style: const TextStyle(
                                                    color: Colors.white54,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                        Text(
                                          displayTime,
                                          style: const TextStyle(
                                            color: accentGold,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (log['message'] != null && log['message'].toString().isNotEmpty) ...[
                                      const SizedBox(height: 10),
                                      Text(
                                        log['message'].toString(),
                                        style: TextStyle(
                                          color: logStatus == PassLogStatus.violation
                                              ? Colors.orange.shade200
                                              : Colors.white70,
                                          fontSize: 12,
                                          fontStyle: FontStyle.italic,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}