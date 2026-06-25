import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:media_kit/media_kit.dart';
import 'cubits/auth_cubit.dart';
import 'cubits/license_cubit.dart';
import 'cubits/channel_cubit.dart';
import 'cubits/app_config_cubit.dart';
import 'cubits/favorite_cubit.dart';
import 'screens/splash_screen.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Fix #1: Initialize media_kit before the app starts
  MediaKit.ensureInitialized();
  runApp(const MyApp());
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
        BlocProvider(create: (context) => AppConfigCubit()),
        BlocProvider(create: (context) => FavoriteCubit()),
      ],
      child: MaterialApp(
        title: 'IPTV Live TV',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
      ),
    );
  }
}
