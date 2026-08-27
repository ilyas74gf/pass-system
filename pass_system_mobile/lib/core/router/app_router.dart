import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/create_password_screen.dart';
import '../../features/home/presentation/home_screen.dart'; // 🟢 HomeScreen import edildi
import '../../features/qr/presentation/qr_screen.dart';
import '../../features/user/presentation/user_detail_screen.dart';
import '../../features/user/presentation/user_history_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/login',
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    // 🟢 'no routes for location' hatasını çözen ana rota
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/create-password',
      builder: (context, state) {
        final token = state.uri.queryParameters['token'] ?? (state.extra as String?) ?? '';
        return CreatePasswordScreen(token: token);
      },
    ),
    GoRoute(
      path: '/qr',
      builder: (context, state) {
        final userId = state.extra as String?;
        return QrScreen(userId: userId);
      },
    ),
    GoRoute(
      path: '/user-detail',
      builder: (context, state) {
        final isTurkish = (state.extra as bool?) ?? true;
        return UserDetailScreen(isTurkish: isTurkish);
      },
    ),
    GoRoute(
      path: '/user-history',
      builder: (context, state) {
        final userId = (state.extra as String?) ?? '';
        return UserHistoryScreen(userId: userId);
      },
    ),
  ],
);