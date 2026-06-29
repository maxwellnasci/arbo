

type VideoPlayerProps = {
  videoUrl?: string | null;
};

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  if (!videoUrl) return null;

  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return null;

  return (
    <div style={{ marginTop: '1rem', width: '100%', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
      <iframe
        width="100%"
        style={{ aspectRatio: '16/9', border: 'none' }}
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen={true}
      />
    </div>
  );
}
