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
            hintStyle: TextStyle(color: Color(AppColors.textMuted)),
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
          if (state is ChannelLoaded) {
            if (state.channels.isEmpty) {
              return const Center(
                child: Text('No channels found', style: TextStyle(color: Colors.white54)),
              );
            }
            return ListView.builder(
              itemCount: state.channels.length,
              itemBuilder: (context, index) {
                final channel = state.channels[index];
                return _buildChannelTile(channel);
              },
            );
          }
          if (state is ChannelError) {
            return Center(child: Text(state.message, style: const TextStyle(color: Colors.white54)));
          }
          return const Center(
            child: Text('Start typing to search channels', style: TextStyle(color: Colors.white54)),
          );
        },
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
        '${channel.categoryName ?? ''} ${channel.language ?? ''}',
        style: const TextStyle(color: Colors.white54, fontSize: 12),
      ),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.red,
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Text('LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
      ),
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => PlayerScreen(channel: channel)),
        );
      },
    );
  }
}
