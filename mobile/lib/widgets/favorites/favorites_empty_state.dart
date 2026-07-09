import 'package:flutter/material.dart';
import '../../constants.dart';

/// Premium empty state for the Favorites screen.
class FavoritesEmptyState extends StatelessWidget {
  final VoidCallback onExploreChannels;

  const FavoritesEmptyState({
    super.key,
    required this.onExploreChannels,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Gradient heart circle
            Container(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFFF5252),
                    Color(0xFFB71C1C),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(AppColors.brandRed).withOpacity(0.35),
                    blurRadius: 30,
                    spreadRadius: 4,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(
                Icons.favorite_rounded,
                size: 52,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'No favorites yet',
              style: TextStyle(
                color: Color(AppColors.textPrimary),
                fontSize: 20,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.3,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            const Text(
              'Tap the heart icon on any channel to save it here for quick access.',
              style: TextStyle(
                color: Color(AppColors.textMuted),
                fontSize: 14,
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onExploreChannels,
                icon: const Icon(Icons.explore_rounded, size: 18),
                label: const Text('Explore Channels'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppColors.primary),
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                  elevation: 0,
                  shadowColor: Colors.transparent,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
