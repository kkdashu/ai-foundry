import { UploadedImage } from '../../lib/types/api'

interface ImagePreviewProps {
  uploadedImages: UploadedImage[]
  onRemoveImage: (imageId: string) => void
}

export default function ImagePreview({ uploadedImages, onRemoveImage }: ImagePreviewProps) {
  if (uploadedImages.length === 0) return null

  return (
    <div style={{
      padding: '1rem',
      border: '1px solid #333',
      borderRadius: '8px',
      marginBottom: '1rem',
      background: '#1a1a1a'
    }}>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#888' }}>
        已上传的图片 ({uploadedImages.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {uploadedImages.map((image) => (
          <div key={image.id} style={{ position: 'relative' }}>
            <img
              src={image.preview}
              alt={image.name}
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid #444'
              }}
            />
            <button
              onClick={() => onRemoveImage(image.id)}
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
            <div style={{
              fontSize: '0.7rem',
              color: '#666',
              marginTop: '2px',
              textAlign: 'center',
              maxWidth: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {image.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}