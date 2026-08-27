import 'package:flutter/material.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Ekran güvenlik servisini core/services/ içine eklediğinde burayı açabilirsin:
  // final screenSecurityService = ScreenSecurityService();
  // await screenSecurityService.enableSecureScreen();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Pass System',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B2545)),
        useMaterial3: true,
      ),
      routerConfig: appRouter,
    );
  }
}