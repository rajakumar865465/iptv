import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../models/channel_model.dart';
import 'player_screen.dart';

class ChannelListScreen extends StatefulWidget {
  const ChannelListScreen({super.key});

  @override
  State<ChannelListScreen> createState() => _ChannelListScreenState();
}

class _ChannelListScreenState extends State<ChannelListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ChannelCubit>().loadChannels();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        elevation: 0,
        title: const Text('Live TV', style: TextStyle(color: Colors.white)),
      ),
      body: BlocBuilder<ChannelCubit, ChannelState>(
        builder: (context, state) {
          if (state is ChannelLoading) {
            return _buildShimmerList();
          }
          if (state is ChannelError) {
            return _buildErrorWidget(state.message, () => context.read<ChannelCubit>().loadChannels());
          }
          if (state is ChannelLoaded) {
            if (state.channels.isEmpty) {
              return _buildEmptyWidget();
            }
            return ListView.builder(
              itemCount: state.channels.length,
              padding: const EdgeInsets.all(16),
              itemBuilder: (context, index) {
                final channel = state.channels[index];
                return _buildChannelTile(channel);
              },
            );
          }
          return _buildShimmerList();
        },
      ),
    );
  }

  Widget _buildShimmerList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 8,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Shimmer.fromColors(
          baseColor: const Color(AppColors.shimmerBase),
          highlightColor: const Color(AppColors.shimmerHighlight),
          child: Container(
            height: 72,
            decoration: BoxDecoration(
              color: const Color(AppColors.surface),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorWidget(String message, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(
              'Unable to load channels',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(color: Colors.white54), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text('No channels available yet', style: TextStyle(color: Colors.white54)),
      ),
    );
  }

  Widget _buildChannelTile(ChannelModel channel) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: const Color(AppColors.surface),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: channel.logoUrl != null && channel.logoUrl!.isNotEmpty
            ? ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(channel.logoUrl!, width: 48, height: 48, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _fallbackAvatar(channel)),
              )
            : _fallbackAvatar(channel),
        title: Text(channel.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        subtitle: Text('${channel.categoryName ?? ''} ${channel.language ?? ''}', style: const TextStyle(color: Colors.white54)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
          child: const Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
        ),
        onTap: () {
          final allChannels = context.read<ChannelCubit>().allChannels;
          final index = allChannels.indexWhere((c) => c.id == channel.id);
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => PlayerScreen(
              channel: channel,
              channels: allChannels,
              initialIndex: index >= 0 ? index : 0,
            )),
          );
        },
      ),
    );
  }

  Widget _fallbackAvatar(ChannelModel channel) {
    return CircleAvatar(
      backgroundColor: const Color(AppColors.surfaceLight),
      child: Text(channel.name.substring(0, 1), style: const TextStyle(color: Colors.white)),
    );
  }
}
