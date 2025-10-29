import 'dart:ui';
import 'package:flutter/material.dart';

/// Centralized design system: colors, theme, and common UI widgets.
class AppDesign {
  AppDesign._();

  // Light palette (harmonized, brighter)
  static const Color _lBg = Color(0xFFF7FAFF); // light blue-tinted background
  static const Color _lSurface = Color(0xFFFFFFFF);
  static const Color _lSurfaceHigh = Color(0xFFF2F6FF);
  static const Color _lPrimary = Color(0xFF4F8BF9); // electric blue accent
  static const Color _lSecondary = Color(0xFF356DF5); // deeper blue for emphasis
  static const Color _lOn = Color(0xFF0F172A); // slate-900 text
  static const Color _lOnMuted = Color(0xFF475569); // slate-600
  static const Color _lOutline = Color(0xFFE2E8F0); // light border

  static final ColorScheme lightColorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: _lPrimary,
    onPrimary: Colors.white,
    secondary: _lSecondary,
    onSecondary: Colors.white,
    error: const Color(0xFFDC2626),
    onError: Colors.white,
    surface: _lSurface,
    onSurface: _lOn,
    surfaceContainerHighest: _lSurfaceHigh,
    surfaceContainerHigh: _lSurfaceHigh,
    surfaceContainer: _lSurface,
    surfaceContainerLow: _lSurface,
    surfaceContainerLowest: _lBg,
    surfaceBright: _lSurface,
    surfaceDim: _lSurface,
    shadow: Colors.black,
    scrim: Colors.black,
    outline: _lOutline,
    outlineVariant: _lOutline,
    inversePrimary: _lSecondary,
    inverseSurface: const Color(0xFF0B1220),
    onSurfaceVariant: _lOnMuted,
    tertiary: const Color(0xFF7C3AED),
    onTertiary: Colors.white,
    tertiaryContainer: const Color(0xFFEDE9FE),
    onTertiaryContainer: Color(0xFF1E1B4B),
    background: _lBg,
    onBackground: _lOn,
  );

  static ThemeData get lightTheme {
    final ColorScheme cs = lightColorScheme;
    return ThemeData(
      useMaterial3: true,
      colorScheme: cs,
      scaffoldBackgroundColor: cs.background,
      appBarTheme: AppBarTheme(
        backgroundColor: cs.background,
        foregroundColor: cs.onBackground,
        elevation: 0,
        centerTitle: false,
      ),
      cardColor: cs.surface,
      textTheme: const TextTheme().apply(
        bodyColor: cs.onSurface,
        displayColor: cs.onSurface,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cs.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.outline),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: cs.surface,
        contentTextStyle: TextStyle(color: cs.onSurface),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: cs.background.withOpacity(0.82),
        selectedItemColor: cs.primary,
        unselectedItemColor: cs.onSurfaceVariant,
        selectedIconTheme: const IconThemeData(size: 26),
        unselectedIconTheme: const IconThemeData(size: 22),
        type: BottomNavigationBarType.fixed,
        showUnselectedLabels: true,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: cs.primary,
        foregroundColor: cs.onPrimary,
      ),
    );
  }

  /// Reusable primary bottom navigation bar.
  static Widget buildBottomNav({
    required int currentIndex,
    required ValueChanged<int> onTap,
  }) {
    return Builder(builder: (BuildContext context) {
      final ColorScheme colors = Theme.of(context).colorScheme;
      return ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            decoration: BoxDecoration(
              color: colors.background.withOpacity(0.82),
              border: Border(top: BorderSide(color: colors.outline.withOpacity(0.14))),
            ),
            child: SafeArea(
              top: false,
              child: BottomNavigationBar(
                currentIndex: currentIndex,
                onTap: onTap,
                items: const <BottomNavigationBarItem>[
                  BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Acasă'),
                  BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'Categorii'),
                  BottomNavigationBarItem(icon: Icon(Icons.bookmark_border), label: 'Salvate'),
                  BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profil'),
                ],
              ),
            ),
          ),
        ),
      );
    });
  }
}


