import 'package:flutter/material.dart';
import '../../constants.dart';
import '../premium_widgets.dart';

/// Empty state for the Live TV screen with an optional Reset Filters action.
class LiveTvEmptyState extends StatelessWidget {
  final bool hasFilters;
  final bool workingOnly;
  final VoidCallback? onResetFilters;
  final VoidCallback? onToggleWorkingOnly;

  const LiveTvEmptyState({
    super.key,
    required this.hasFilters,
    required this.workingOnly,
    this.onResetFilters,
    this.onToggleWorkingOnly,
  });

  @override
  Widget build(BuildContext context) {
    final title = hasFilters ? 'No channels found' : 'No channels found';
    final subtitle = hasFilters
        ? 'Try changing category or turn off Working Only.'
        : workingOnly
            ? 'Disable "Working Only" to see all channels including offline ones.'
            : 'No channels are available right now. Please try again later.';

    return EmptyStateWidget(
      icon: hasFilters ? Icons.filter_list_off_rounded : Icons.tv_off_rounded,
      title: title,
      subtitle: subtitle,
      actionLabel: hasFilters ? 'Reset Filters' : (workingOnly ? 'Turn Off Working Only' : 'Refresh'),
      onAction: hasFilters
          ? onResetFilters
          : (workingOnly ? onToggleWorkingOnly : null),
      iconColor: const Color(AppColors.textMuted),
    );
  }
}
