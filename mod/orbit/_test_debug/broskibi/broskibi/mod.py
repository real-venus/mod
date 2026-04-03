import mod as m
import requests
import random
import time


class BroskiBi:
    description = """
    Genre-based music discovery. Finds the dopest songs from any genre
    using Spotify and Last.fm APIs. Search by genre, vibe, or mood.
    """

    LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'

    # curated genre map: common vibes -> lastfm/spotify tag names
    GENRE_MAP = {
        'lofi': ['lo-fi', 'lofi', 'chillhop', 'lofi hip hop'],
        'hiphop': ['hip-hop', 'rap', 'hip hop', 'trap'],
        'rap': ['rap', 'hip-hop', 'trap', 'gangsta rap'],
        'trap': ['trap', 'trap music', 'southern hip hop'],
        'rnb': ['rnb', 'r&b', 'rhythm and blues', 'neo soul'],
        'jazz': ['jazz', 'smooth jazz', 'jazz fusion', 'bebop'],
        'soul': ['soul', 'neo soul', 'motown', 'funk'],
        'funk': ['funk', 'p-funk', 'disco funk'],
        'electronic': ['electronic', 'edm', 'electronica', 'synth'],
        'house': ['house', 'deep house', 'tech house', 'acid house'],
        'techno': ['techno', 'minimal techno', 'detroit techno'],
        'dnb': ['drum and bass', 'dnb', 'jungle', 'liquid funk'],
        'dubstep': ['dubstep', 'brostep', 'riddim'],
        'ambient': ['ambient', 'downtempo', 'chill', 'atmospheric'],
        'rock': ['rock', 'alternative rock', 'indie rock', 'classic rock'],
        'metal': ['metal', 'heavy metal', 'thrash metal', 'death metal'],
        'punk': ['punk', 'punk rock', 'hardcore punk', 'pop punk'],
        'indie': ['indie', 'indie rock', 'indie pop', 'indie folk'],
        'pop': ['pop', 'synth pop', 'electropop', 'dream pop'],
        'country': ['country', 'americana', 'alt-country', 'folk'],
        'folk': ['folk', 'indie folk', 'folk rock', 'singer-songwriter'],
        'blues': ['blues', 'electric blues', 'delta blues', 'blues rock'],
        'reggae': ['reggae', 'dub', 'dancehall', 'roots reggae'],
        'latin': ['latin', 'reggaeton', 'salsa', 'latin pop'],
        'afrobeats': ['afrobeats', 'afropop', 'afro house'],
        'kpop': ['k-pop', 'korean pop', 'kpop'],
        'classical': ['classical', 'orchestral', 'piano', 'symphony'],
        'phonk': ['phonk', 'drift phonk', 'memphis rap'],
        'grunge': ['grunge', 'post-grunge', 'alternative'],
        'drill': ['drill', 'uk drill', 'brooklyn drill'],
        'garage': ['uk garage', 'garage', '2-step'],
        'grime': ['grime', 'uk grime', 'mc'],
        'chill': ['chillout', 'chill', 'downtempo', 'trip-hop'],
        'vaporwave': ['vaporwave', 'synthwave', 'retrowave', 'future funk'],
        'synthwave': ['synthwave', 'retrowave', 'outrun', 'darksynth'],
    }

    def __init__(self):
        self.api_key = m.env('LASTFM_API_KEY') or None
        self.spotify_id = m.env('SPOTIFY_CLIENT_ID') or None
        self.spotify_secret = m.env('SPOTIFY_CLIENT_SECRET') or None
        self._spotify_token = None
        self._spotify_token_exp = 0

    def _lastfm(self, method: str, **params) -> dict:
        """Make a Last.fm API call."""
        assert self.api_key, 'set LASTFM_API_KEY env var — get one free at last.fm/api'
        params.update({
            'method': method,
            'api_key': self.api_key,
            'format': 'json',
        })
        r = requests.get(self.LASTFM_BASE, params=params, timeout=10)
        r.raise_for_status()
        return r.json()

    def _spotify_auth(self):
        """Get or refresh Spotify bearer token via client credentials."""
        if self._spotify_token and time.time() < self._spotify_token_exp:
            return self._spotify_token
        assert self.spotify_id and self.spotify_secret, (
            'set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars — '
            'get them at developer.spotify.com'
        )
        r = requests.post('https://accounts.spotify.com/api/token', data={
            'grant_type': 'client_credentials',
        }, auth=(self.spotify_id, self.spotify_secret), timeout=10)
        r.raise_for_status()
        data = r.json()
        self._spotify_token = data['access_token']
        self._spotify_token_exp = time.time() + data.get('expires_in', 3600) - 60
        return self._spotify_token

    def _spotify(self, endpoint: str, **params) -> dict:
        """Make an authenticated Spotify API call."""
        token = self._spotify_auth()
        r = requests.get(
            f'https://api.spotify.com/v1/{endpoint}',
            params=params,
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()

    def _format_track(self, track: dict, source: str = 'spotify') -> dict:
        """Normalize a track into a clean dict."""
        if source == 'spotify':
            artists = ', '.join(a['name'] for a in track.get('artists', []))
            return {
                'title': track['name'],
                'artist': artists,
                'album': track.get('album', {}).get('name', ''),
                'url': track.get('external_urls', {}).get('spotify', ''),
                'preview': track.get('preview_url', ''),
                'popularity': track.get('popularity', 0),
                'source': 'spotify',
            }
        else:
            artist = track.get('artist', '')
            if isinstance(artist, dict):
                artist = artist.get('name', '')
            return {
                'title': track.get('name', ''),
                'artist': artist,
                'album': '',
                'url': track.get('url', ''),
                'preview': '',
                'popularity': int(track.get('listeners', 0) or 0),
                'source': 'lastfm',
            }

    def _resolve_genre(self, genre: str) -> list:
        """Resolve a genre string into tag names to search."""
        genre = genre.lower().strip()
        if genre in self.GENRE_MAP:
            return self.GENRE_MAP[genre]
        for key, tags in self.GENRE_MAP.items():
            if genre in key or key in genre:
                return tags
            for tag in tags:
                if genre in tag or tag in genre:
                    return tags
        return [genre]

    def genres(self) -> list:
        """List all supported genres/vibes."""
        return sorted(self.GENRE_MAP.keys())

    def discover(self, genre: str = 'hiphop', n: int = 20, shuffle: bool = True) -> list:
        """
        Find the dopest songs from a genre.
        Uses Spotify if creds are set, falls back to Last.fm.

        Args:
            genre: genre name or vibe (e.g. 'hiphop', 'lofi', 'phonk', 'jazz')
            n: number of tracks to return (max 50)
            shuffle: randomize order for fresh picks each time
        """
        n = min(n, 50)
        tags = self._resolve_genre(genre)
        tracks = []

        if self.spotify_id and self.spotify_secret:
            tracks = self._discover_spotify(tags, n)

        if not tracks and self.api_key:
            tracks = self._discover_lastfm(tags, n)

        assert tracks, (
            f'no tracks found for "{genre}". '
            f'set LASTFM_API_KEY or SPOTIFY_CLIENT_ID+SPOTIFY_CLIENT_SECRET. '
            f'supported genres: {", ".join(self.genres()[:15])}...'
        )

        if shuffle:
            random.shuffle(tracks)
        return tracks[:n]

    def _discover_spotify(self, tags: list, n: int) -> list:
        tracks = []
        seen = set()
        for tag in tags[:2]:
            try:
                data = self._spotify(
                    'search', q=f'genre:{tag}', type='track',
                    limit=min(n, 50), market='US',
                )
                for item in data.get('tracks', {}).get('items', []):
                    key = (item['name'].lower(), item['artists'][0]['name'].lower())
                    if key not in seen:
                        seen.add(key)
                        tracks.append(self._format_track(item, 'spotify'))
            except Exception:
                continue
        tracks.sort(key=lambda t: t['popularity'], reverse=True)
        return tracks

    def _discover_lastfm(self, tags: list, n: int) -> list:
        tracks = []
        seen = set()
        for tag in tags[:2]:
            try:
                data = self._lastfm('tag.gettoptracks', tag=tag, limit=n)
                for item in data.get('tracks', {}).get('track', []):
                    key = (item['name'].lower(), item['artist']['name'].lower())
                    if key not in seen:
                        seen.add(key)
                        tracks.append(self._format_track(item, 'lastfm'))
            except Exception:
                continue
        tracks.sort(key=lambda t: t['popularity'], reverse=True)
        return tracks

    def top(self, genre: str = 'hiphop', n: int = 10) -> list:
        """
        Top N most popular songs in a genre. Pure popularity ranking.

        Args:
            genre: genre name or vibe
            n: number of tracks
        """
        return self.discover(genre=genre, n=n, shuffle=False)

    def mix(self, genres: list = None, n: int = 20) -> list:
        """
        Build a mixed playlist from multiple genres.

        Args:
            genres: list of genre names (e.g. ['lofi', 'jazz', 'rnb'])
            n: total number of tracks
        """
        genres = genres or ['hiphop', 'rnb', 'jazz']
        per_genre = max(1, n // len(genres))
        tracks = []
        for g in genres:
            try:
                batch = self.discover(genre=g, n=per_genre, shuffle=True)
                tracks.extend(batch)
            except Exception:
                continue
        random.shuffle(tracks)
        return tracks[:n]

    def search(self, query: str, n: int = 10) -> list:
        """
        Search for tracks by name/artist.

        Args:
            query: song name, artist, or both
            n: number of results
        """
        n = min(n, 50)
        if self.spotify_id and self.spotify_secret:
            try:
                data = self._spotify('search', q=query, type='track', limit=n, market='US')
                return [self._format_track(t, 'spotify')
                        for t in data.get('tracks', {}).get('items', [])]
            except Exception:
                pass
        if self.api_key:
            try:
                data = self._lastfm('track.search', track=query, limit=n)
                results = data.get('results', {}).get('trackmatches', {}).get('track', [])
                return [self._format_track(t, 'lastfm') for t in results]
            except Exception:
                pass
        return []

    def similar(self, artist: str, n: int = 10) -> list:
        """
        Find tracks from artists similar to the given one.

        Args:
            artist: artist name to find similar music to
            n: number of tracks to return
        """
        if self.api_key:
            try:
                data = self._lastfm('artist.getsimilar', artist=artist, limit=5)
                similar_artists = data.get('similarartists', {}).get('artist', [])
                tracks = []
                for sa in similar_artists[:5]:
                    try:
                        top = self._lastfm('artist.gettoptracks', artist=sa['name'], limit=3)
                        for t in top.get('toptracks', {}).get('track', []):
                            tracks.append(self._format_track(t, 'lastfm'))
                    except Exception:
                        continue
                return tracks[:n]
            except Exception:
                pass

        if self.spotify_id and self.spotify_secret:
            try:
                data = self._spotify('search', q=artist, type='artist', limit=1)
                items = data.get('artists', {}).get('items', [])
                if items:
                    aid = items[0]['id']
                    related = self._spotify(f'artists/{aid}/related-artists')
                    tracks = []
                    for ra in related.get('artists', [])[:5]:
                        top = self._spotify(f'artists/{ra["id"]}/top-tracks', market='US')
                        for t in top.get('tracks', [])[:3]:
                            tracks.append(self._format_track(t, 'spotify'))
                    return tracks[:n]
            except Exception:
                pass
        return []

    def forward(self, genre: str = 'hiphop', n: int = 20) -> list:
        """Default entry point — discover dopest songs from a genre."""
        return self.discover(genre=genre, n=n)
