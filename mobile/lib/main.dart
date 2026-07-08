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
import 'constants.dart';
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
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off, size: 64, color: Colors.redAccent),
                const SizedBox(height: 20),
                const Text(
                  'Backend URL missing',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'This app was built without a backend URL.\n'
                  'Rebuild the app with the BACKEND_URL flag:',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 15),
                ),
                const SizedBox(height: 20),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Color(AppColors.surface),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Color(AppColors.surfaceLight)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Local phone testing (PC Wi-Fi IPv4):',
                        style: TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 8),
                        Text(
                        'flutter run --debug \\\n'
                          '  --dart-define=BACKEND_URL=http://192.168.1.25:5000',
                        style: TextStyle(color: Colors.greenAccent, fontSize: 12, fontFamily: 'monospace'),
                      ),
                      SizedBox(height: 14),
                      Text(
                        'Production APK (backend server):',
                        style: TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'flutter build apk --release \\\n'
                          '  --dart-define=BACKEND_URL=http://35.154.128.217:5000',
                        style: TextStyle(color: Colors.greenAccent, fontSize: 12, fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'This build is not usable. Please rebuild with your backend URL.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
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
