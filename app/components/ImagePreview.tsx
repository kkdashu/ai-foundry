import { X, Images } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { UploadedImage } from '../../lib/types/api'

interface ImagePreviewProps {
  uploadedImages: UploadedImage[]
  onRemoveImage: (imageId: string) => void
}

export default function ImagePreview({ uploadedImages, onRemoveImage }: ImagePreviewProps) {
  if (uploadedImages.length === 0) return null

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Images className="h-4 w-4" />
          已上传的图片
          <Badge variant="secondary" className="ml-1">
            {uploadedImages.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-3">
          {uploadedImages.map((image) => (
            <div key={image.id} className="relative group">
              <div className="relative">
                <img
                  src={image.preview}
                  alt={image.name}
                  className="w-20 h-20 object-cover rounded-md border border-border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemoveImage(image.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground text-center max-w-20 truncate">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}