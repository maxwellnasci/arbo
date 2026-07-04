type VideoPlayerProps = {
  videoUrl?: string | null;
};

const UPLOADED_VIDEO_HOST = 'videos.mxos.com.br';

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

function guessVideoMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  if (!videoUrl) return null;

  if (videoUrl.includes(UPLOADED_VIDEO_HOST)) {
    return (
      <div
        style={{
          marginTop: '1rem',
          width: '100%',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
          touchAction: 'pan-y',
        }}
      >
        <video controls width="100%" style={{ display: 'block', borderRadius: 'var(--border-radius-lg)' }}>
          <source src={videoUrl} type={guessVideoMimeType(videoUrl)} />
        </video>
      </div>
    );
  }

  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return null;

  return (
    <div
      style={{
        marginTop: '1rem',
        width: '100%',
        borderRadius: 'var(--border-radius-lg)',
        overflow: 'hidden',
        touchAction: 'pan-y',
      }}
    >
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
