"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines, Disc3, Heart, ListMusic, LogOut, Music2, Pause, Play,
  Plus, Search, SkipBack, SkipForward, Trash2, Upload, Volume2, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Song = {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  storage_path: string;
  file_size: number;
  created_at: string;
};
type Playlist = { id: string; user_id: string; name: string; created_at: string };
type PlaylistSong = { playlist_id: string; song_id: string };

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};
const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [favoriteAnimation, setFavoriteAnimation] = useState(0);
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistSong[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState("");
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadLibrary();
    else {
      setSongs([]);
      setPlaylists([]);
      setPlaylistSongs([]);
      setActiveSong(null);
      setAudioUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function loadLibrary() {
    if (!supabase) return;
    const userId = session?.user?.id;
    if (!userId) return;
    const [songResult, playlistResult, relationResult] = await Promise.all([
      supabase.from("songs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("playlists").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("playlist_songs").select("playlist_id,song_id"),
    ]);
    if (songResult.error) setNotice(songResult.error.message);
    else setSongs((songResult.data ?? []) as Song[]);
    if (playlistResult.error) setNotice(playlistResult.error.message);
    else setPlaylists((playlistResult.data ?? []) as Playlist[]);
    if (!relationResult.error) setPlaylistSongs((relationResult.data ?? []) as PlaylistSong[]);
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return setNotice("Add your Supabase URL and publishable key to .env.local, then restart the server.");
    setBusy(true);
    setNotice("");
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else if (authMode === "signup" && !result.data.session) {
      setNotice("Account created. Check your email to confirm it, then sign in.");
    } else {
      setNotice("You're signed in.");
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setNotice("");
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!supabase || !session?.user?.id || files.length === 0) return;
    setBusy(true);
    setNotice("");
    let uploaded = 0;
    for (const file of files) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(file.name)) {
        setNotice(`Skipped ${file.name}: choose an audio file.`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setNotice(`Skipped ${file.name}: maximum file size is 20 MB.`);
        continue;
      }
      const safeName = file.name.replace(/[^\w.\-() ]/g, "_");
      const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const storageResult = await supabase.storage.from("music").upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (storageResult.error) {
        setNotice(`Upload failed for ${file.name}: ${storageResult.error.message}`);
        continue;
      }
      const title = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      const rowResult = await supabase.from("songs").insert({
        user_id: session.user.id,
        title,
        artist: "Unknown artist",
        storage_path: path,
        file_size: file.size,
      });
      if (rowResult.error) {
        await supabase.storage.from("music").remove([path]);
        setNotice(`Could not save ${file.name}: ${rowResult.error.message}`);
        continue;
      }
      uploaded++;
    }
    await loadLibrary();
    setBusy(false);
    if (uploaded > 0) setNotice(`Uploaded ${uploaded} song${uploaded === 1 ? "" : "s"}.`);
  }

  async function playSong(song: Song) {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from("music").createSignedUrl(song.storage_path, 60 * 60);
    if (error || !data?.signedUrl) {
      setNotice(error?.message ?? "Could not create a playback link.");
      return;
    }
    setActiveSong(song);
    setAudioUrl(data.signedUrl);
    setPlaying(true);
    setCurrentTime(0);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = data.signedUrl;
        audioRef.current.play().catch(() => setPlaying(false));
      }
    }, 0);
  }

  async function deleteSong(song: Song) {
    if (!supabase || !confirm(`Delete "${song.title}" from your library? This cannot be undone.`)) return;
    setBusy(true);
    await supabase.storage.from("music").remove([song.storage_path]);
    const result = await supabase.from("songs").delete().eq("id", song.id).eq("user_id", session.user.id);
    if (result.error) setNotice(result.error.message);
    else {
      setSongs((old) => old.filter((item) => item.id !== song.id));
      setPlaylistSongs((old) => old.filter((item) => item.song_id !== song.id));
      if (activeSong?.id === song.id) {
        audioRef.current?.pause();
        setActiveSong(null);
        setAudioUrl("");
        setPlaying(false);
      }
      setNotice("Song deleted.");
    }
    setBusy(false);
  }

  async function createPlaylist(event: FormEvent) {
    event.preventDefault();
    const name = newPlaylist.trim();
    if (!supabase || !name || !session?.user?.id) return;
    const { data, error } = await supabase.from("playlists")
      .insert({ user_id: session.user.id, name }).select("*").single();
    if (error) setNotice(error.message);
    else {
      setPlaylists((old) => [data as Playlist, ...old]);
      setNewPlaylist("");
      setShowPlaylistForm(false);
      setSelectedPlaylist(data.id);
      setNotice("Playlist created.");
    }
  }

  async function deletePlaylist(playlist: Playlist) {
    if (!supabase || !confirm(`Delete playlist "${playlist.name}"? Your songs will not be deleted.`)) return;
    const { error } = await supabase.from("playlists").delete().eq("id", playlist.id).eq("user_id", session.user.id);
    if (error) setNotice(error.message);
    else {
      setPlaylists((old) => old.filter((item) => item.id !== playlist.id));
      setPlaylistSongs((old) => old.filter((item) => item.playlist_id !== playlist.id));
      if (selectedPlaylist === playlist.id) setSelectedPlaylist(null);
      setNotice("Playlist deleted.");
    }
  }

  
async function addSongToPlaylist(playlistId: string, songId: string) {
  if (!supabase) return;

  const exists = playlistSongs.some(
    (item) =>
      item.playlist_id === playlistId &&
      item.song_id === songId
  );

  if (exists) {
    setNotice("This song is already in that playlist.");
    return;
  }

  const { error } = await supabase
    .from("playlist_songs")
    .insert({ playlist_id: playlistId, song_id: songId });

  if (error) {
    setNotice(error.message);
    return;
  }

  setPlaylistSongs((old) => {
    if (
      old.some(
        (item) =>
          item.playlist_id === playlistId &&
          item.song_id === songId
      )
    ) {
      return old;
    }

    return [...old, { playlist_id: playlistId, song_id: songId }];
  });

  setNotice("Song added to playlist.");
}

async function removeSongFromPlaylist(
  playlistId: string,
  songId: string
) {
  if (!supabase) return;

  const { error } = await supabase
    .from("playlist_songs")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("song_id", songId);

  if (error) {
    setNotice(error.message);
    return;
  }

  setPlaylistSongs((old) =>
    old.filter(
      (item) =>
        !(item.playlist_id === playlistId &&
          item.song_id === songId)
    )
  );

  setNotice("Song removed from playlist.");
}


  async function playRelative(direction: 1 | -1) {
    if (!activeSong || visibleSongs.length < 1) return;
    let index = visibleSongs.findIndex((song) => song.id === activeSong.id);
    if (shuffle && direction === 1 && visibleSongs.length > 1) {
      let next = index;
      while (next === index) next = Math.floor(Math.random() * visibleSongs.length);
      await playSong(visibleSongs[next]);
      return;
    }
    index = (index + direction + visibleSongs.length) % visibleSongs.length;
    await playSong(visibleSongs[index]);
  }

  const currentPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylist);
  const visibleSongs = useMemo(() => {
    let result = songs;
    if (selectedPlaylist === "favorites") {
      result = result.filter((song) => favorites.includes(song.id));
    } else if (selectedPlaylist) {
      const ids = new Set(playlistSongs.filter((item) => item.playlist_id === selectedPlaylist).map((item) => item.song_id));
      result = result.filter((song) => ids.has(song.id));
    }
    const normalized = query.trim().toLowerCase();
    if (normalized) result = result.filter((song) => `${song.title} ${song.artist}`.toLowerCase().includes(normalized));
    return result;
  }, [songs, selectedPlaylist, playlistSongs, query, favorites]);

  if (!session) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand"><span className="brand-mark"><AudioLines size={24}/></span><span>echo<span className="brand-dot">.</span></span></div>
          <p className="eyebrow">YOUR MUSIC. YOUR WORLD.</p>
          <h1>{authMode === "login" ? "Welcome back." : "Create your library."}</h1>
          <p className="muted">Your personal music collection, available wherever you go.</p>
          <form className="auth-form" onSubmit={handleAuth}>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com"/></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="At least 6 characters"/></label>
            <button className="primary-button full" disabled={busy}>{busy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="switch-auth">{authMode === "login" ? "New here?" : "Already have an account?"} <button className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setNotice(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
          {notice && <p className="notice">{notice}</p>}
          {!supabase && <p className="notice error">Supabase is not configured yet. Follow the setup instructions in README.md.</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><AudioLines size={24}/></span><span>echo<span className="brand-dot">.</span></span></div>
        <div className="side-label">LIBRARY</div>
        <button className={`nav-item ${!selectedPlaylist ? "selected" : ""}`} onClick={() => setSelectedPlaylist(null)}><Disc3 size={18}/> All songs <span className="count">{songs.length}</span></button>
        <button className="nav-item" onClick={() => setSelectedPlaylist("favorites")}><Heart size={18}/> Favorites <span className="count">{favorites.length}</span></button>
        <div className="side-heading"><span>PLAYLISTS</span><button className="icon-button" title="Create playlist" onClick={() => setShowPlaylistForm(!showPlaylistForm)}><Plus size={17}/></button></div>
        {showPlaylistForm && <form className="playlist-create" onSubmit={createPlaylist}><input autoFocus placeholder="Playlist name" value={newPlaylist} onChange={(e) => setNewPlaylist(e.target.value)} maxLength={60} required/><button aria-label="Create playlist"><Plus size={16}/></button></form>}
        <div className="playlist-list">
          {playlists.map((playlist) => <div className="playlist-line" key={playlist.id}><button className={`nav-item playlist-nav ${selectedPlaylist === playlist.id ? "selected" : ""}`} onClick={() => setSelectedPlaylist(playlist.id)}><ListMusic size={17}/><span className="truncate">{playlist.name}</span></button><button className="tiny-icon" title={`Delete ${playlist.name}`} onClick={() => deletePlaylist(playlist)}><Trash2 size={14}/></button></div>)}
        </div>
        <div className="sidebar-bottom"><span className="online-dot"/> Private library <button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={17}/></button></div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="search-box"><Search size={18}/><input placeholder="Search your music..." value={query} onChange={(e) => setQuery(e.target.value)}/>{query && <button className="tiny-icon" onClick={() => setQuery("")}><X size={15}/></button>}</div>
          <div className="user-chip"><span className="avatar">{session.user.email?.[0]?.toUpperCase() ?? "U"}</span><span>{session.user.email}</span></div>
        </header>
        <div className="content">
          <section className="hero">
            <div className="hero-glow"/>
            <div className="hero-copy"><p className="eyebrow">YOUR PERSONAL SOUNDTRACK</p><h1>Every song.<br/><span>One place.</span></h1><p>Your collection, ready whenever you are.</p><button className="primary-button" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={17}/>{busy ? "Working…" : "Upload music"}</button><input ref={fileRef} className="hidden" type="file" accept="audio/*,.flac,.opus" multiple onChange={uploadFiles}/><p className="microcopy">Audio files up to 20 MB each</p></div>
            <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-disc"><div className="disc-center"><AudioLines size={38}/></div></div><div className="floating-note note-one">♫</div><div className="floating-note note-two">♪</div></div>
          </section>

          <section className="library-section">
            <div className="section-heading"><div><p className="eyebrow">{currentPlaylist ? "YOUR COLLECTION" : "YOUR LIBRARY"}</p><h2>{currentPlaylist?.name ?? (selectedPlaylist === "favorites" ? "Favorites" : "All songs")}</h2><p className="muted">{visibleSongs.length} track{visibleSongs.length === 1 ? "" : "s"} in your collection</p></div><button className="secondary-button" onClick={() => fileRef.current?.click()}><Plus size={17}/> Add songs</button></div>
            {notice && <div className="notice-bar"><span>{notice}</span><button className="tiny-icon" onClick={() => setNotice("")}><X size={15}/></button></div>}
            {visibleSongs.length === 0 ? <div className="empty-state"><div className="empty-icon"><Music2 size={28}/></div><h3>{query ? "No matching songs" : selectedPlaylist ? "Nothing here yet" : "Your library starts here"}</h3><p>{query ? "Try another title or artist." : selectedPlaylist ? "Add songs to this playlist from the song list." : "Upload your first tracks to make this space yours."}</p>{!selectedPlaylist && <button className="primary-button" onClick={() => fileRef.current?.click()}><Upload size={16}/> Upload your first song</button>}</div> : <div className="song-table"><div className="song-table-head"><span>#</span><span>TITLE</span><span>SIZE</span><span>ACTIONS</span></div>{visibleSongs.map((song, index) => { const inPlaylist = selectedPlaylist ? playlistSongs.some((item) => item.playlist_id === selectedPlaylist && item.song_id === song.id) : false; return <div className={`song-row ${activeSong?.id === song.id ? "active-song" : ""}`} key={song.id}><button className="row-play" aria-label={`Play ${song.title}`} onClick={() => playSong(song)}>{activeSong?.id === song.id && playing ? <AudioLines size={17}/> : activeSong?.id === song.id ? <Pause size={17}/> : <><span className="row-number">{index + 1}</span><Play className="play-hover" size={16}/></>}</button><button className="song-title-button" onClick={() => playSong(song)}><span className="cover-mini"><Music2 size={18}/></span><span className="song-meta"><strong>{song.title}</strong><small>{song.artist}</small></span></button><span className="song-size">{formatSize(song.file_size)}</span><div className="song-actions">{playlists.length > 0 && <select aria-label={`Add ${song.title} to playlist`} value="" onChange={(e) => { if (e.target.value) addSongToPlaylist(e.target.value, song.id); }}><option value="">+ Playlist</option>{playlists.map((playlist) => {
                const alreadyAdded = playlistSongs.some(
                  (item) => item.playlist_id === playlist.id && item.song_id === song.id
                );
                return (
                  <option key={playlist.id} value={playlist.id}>
                    {alreadyAdded ? "✓ " : ""}{playlist.name}{alreadyAdded ? " (added)" : ""}
                  </option>
                );
              })}</select>}{selectedPlaylist && selectedPlaylist !== "favorites" && <button className="tiny-icon" title="Remove from playlist" onClick={() => removeSongFromPlaylist(selectedPlaylist, song.id)}><X size={15}/></button>}<button className="tiny-icon delete-button" title="Delete song" onClick={() => deleteSong(song)}><Trash2 size={15}/></button></div></div>; })}</div>}
          </section>
          <footer className="footer-note"><span><span className="online-dot"/> YOUR MUSIC, YOUR SPACE</span><span>Private by design</span></footer>
        </div>
      </section>

      <div className="player">
        <div className="now-playing"><div className="cover-large"><Music2 size={22}/></div><div className="now-meta"><strong>{activeSong?.title ?? "Nothing playing"}</strong><span>{activeSong?.artist ?? "Choose a song from your library"}</span></div>{activeSong && (
          <button
            className={`tiny-icon ${favorites.includes(activeSong.id) ? "favorite-active" : ""}`}
            title="Toggle favorite"
            aria-label={favorites.includes(activeSong.id) ? "Remove from favorites" : "Add to favorites"}
            onClick={() => {
              const isFavorite = favorites.includes(activeSong.id);
              setFavorites((old) => isFavorite
                ? old.filter((id) => id !== activeSong.id)
                : [...old, activeSong.id]);
              if (!isFavorite) setFavoriteAnimation((value) => value + 1);
            }}
          >
            <Heart
              key={favoriteAnimation}
              size={17}
              className={favoriteAnimation > 0 ? "favorite-pop" : ""}
              fill={favorites.includes(activeSong.id) ? "currentColor" : "none"}
            />
          </button>
        )}</div>
        <div className="player-center"><div className="player-controls"><button className={`control-button ${shuffle ? "control-active" : ""}`} title="Shuffle" onClick={() => setShuffle(!shuffle)}>⤨</button><button className="control-button" title="Previous song" onClick={() => playRelative(-1)}><SkipBack size={19} fill="currentColor"/></button><button className="play-main" title={playing ? "Pause" : "Play"} disabled={!activeSong} onClick={() => { if (!audioRef.current) return; if (playing) { audioRef.current.pause(); setPlaying(false); } else { audioRef.current.play().then(() => setPlaying(true)).catch(() => setNotice("Playback could not start. Select the song again.")); } }}>{playing ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><button className="control-button" title="Next song" onClick={() => playRelative(1)}><SkipForward size={19} fill="currentColor"/></button><button className={`control-button ${repeat ? "control-active" : ""}`} title="Repeat current song" onClick={() => setRepeat(!repeat)}>↻</button></div><div className="timeline"><span>{formatTime(currentTime)}</span><input aria-label="Seek" type="range" min={0} max={duration || 1} value={Math.min(currentTime, duration || 1)} onChange={(e) => { const value = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }}/><span>{formatTime(duration)}</span></div></div>
        <div className="volume-control"><Volume2 size={18}/><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))}/></div>
      </div>
      <audio ref={audioRef} src={audioUrl || undefined} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)} onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { if (repeat && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } else { playRelative(1); } }}/>
    </main>
  );
}
