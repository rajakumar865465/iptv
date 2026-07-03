import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:media_kit/media_kit.dart';
import 'cubits/auth_cubit.dart';
import 'cubits/license_cubit.dart';
import 'cubits/channel_cubit.dart';
import 'cubits/home_cubit.dart';
import 'cubits/app_config_cubit.dart';
import 'cubits/favorite_cubit.dart';
import 'screens/splash_screen.dart';
import 'theme.dart';
import 'utils/backend_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Validate backend URL is configured before the app starts
  if (!BackendConfig.isConfigured) {
    runApp(const _BackendConfigErrorApp());
    return;
  }
  // Fix #1: Initialize media_kit before the app starts
  MediaKit.ensureInitialized();
  runApp(const MyApp());
}

class _BackendConfigErrorApp extends StatelessWidget {
  const _BackendConfigErrorApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NivaTV',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Color(AppColors.background),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Backend URL is not configured.\n\nBuild with:\n'
              '--dart-define=BACKEND_URL=https://api.yourdomain.com',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
          ),
        ),
      ),
    );
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (context) => AuthCubit()),
        BlocProvider(create: (context) => LicenseCubit()),
        BlocProvider(create: (context) => ChannelCubit()),
        BlocProvider(create: (context) => HomeCubit()),
        BlocProvider(create: (context) => AppConfigCubit()),
        BlocProvider(create: (context) => FavoriteCubit()),
      ],
      child: MaterialApp(
        title: 'NivaTV',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
      ),
    );
  }
}
