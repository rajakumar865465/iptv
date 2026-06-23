import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
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
            return const Center(child: CircularProgressIndicator());
          }
          if (state is ChannelLoaded) {
            return ListView.builder(
              itemCount: state.channels.length,
              padding: const EdgeInsets.all(16),
              itemBuilder: (context, index) {
                final channel = state.channels[index];
                return _buildChannelTile(channel);
              },
            );
          }
          return const Center(child: Text('Error loading channels', style: TextStyle(color: Colors.white54)));
        },
      ),
    );
  }

  Widget _buildChannelTile(ChannelModel channel) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(AppColors.surfaceLight),
          child: Text(channel.name.substring(0, 1), style: const TextStyle(color: Colors.white)),
        ),
        title: Text(channel.name, style: const TextStyle(color: Colors.white)),
        subtitle: Text('${channel.categoryName ?? ''} ${channel.language ?? ''}', style: const TextStyle(color: Colors.white54)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
          child: const Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
        ),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => PlayerScreen(channel: channel)),
          );
        },
      ),
    );
  }
}
