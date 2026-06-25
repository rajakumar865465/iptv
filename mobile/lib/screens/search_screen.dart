import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../constants.dart';
import '../cubits/channel_cubit.dart';
import '../models/channel_model.dart';
import 'player_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppColors.background),
      appBar: AppBar(
        backgroundColor: const Color(AppColors.background),
        elevation: 0,
        title: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Search channels...',
            hintStyle: TextStyle(color: const Color(AppColors.textMuted)),
            border: InputBorder.none,
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, color: Colors.white54),
                    onPressed: () {
                      _searchController.clear();
                      context.read<ChannelCubit>().searchChannels('');
                      setState(() {});
                    },
                  )
                : null,
          ),
          style: const TextStyle(color: Colors.white),
          onChanged: (query) {
            setState(() {});
            context.read<ChannelCubit>().searchChannels(query);
          },
        ),
      ),
      body: BlocBuilder<ChannelCubit, ChannelState>(
        builder: (context, state) {
          if (state is ChannelLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state is ChannelError) {
            return _buildErrorWidget(state.message);
          }
          if (state is ChannelLoaded) {
            if (state.channels.isEmpty) {
              return _buildEmptyWidget(_searchController.text.isEmpty ? 'Start typing to search channels' : 'No channels found');
            }
            return ListView.builder(
              itemCount: state.channels.length,
              itemBuilder: (context, index) {
                final channel = state.channels[index];
                return _buildChannelTile(channel);
              },
            );
          }
          return _buildEmptyWidget('Start typing to search channels');
        },
      ),
    );
  }

  Widget _buildErrorWidget(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.white54),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                context.read<ChannelCubit>().searchChannels(_searchController.text);
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(message, style: const TextStyle(color: Colors.white54)),
      ),
    );
  }

  Widget _buildChannelTile(ChannelModel channel) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: const Color(AppColors.surfaceLight),
        child: Text(channel.name.substring(0, 1), style: const TextStyle(color: Colors.white)),
      ),
      title: Text(channel.name, style: const TextStyle(color: Colors.white)),
      subtitle: Text(
        '${channel.categoryName ?? ''} ${channel.language ?? ''}'.trim(),
        style: const TextStyle(color: Colors.white54, fontSize: 12),
      ),
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
    );
  }
}
