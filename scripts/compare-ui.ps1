param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Implementation,
  [Parameter(Mandatory=$true)][string]$Output,
  [int]$SourceY = 230,
  [switch]$HeaderOnly
)
Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Image]::FromFile($Source)
$implementationImage = [System.Drawing.Image]::FromFile($Implementation)
try {
  $panelHeight = if ($HeaderOnly) { 92 } else { 790 }
  $canvas = [System.Drawing.Bitmap]::new(1920, ($panelHeight + 32) * 2)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(12,16,23))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $font = [System.Drawing.Font]::new('Segoe UI',14)
    try {
      $graphics.DrawString('SOURCE — app only, excluding browser/editor chrome', $font, [System.Drawing.Brushes]::White, 12, 4)
      $graphics.DrawString('IMPLEMENTATION — matching CSS viewport; browser capture normalized from 0.8x raster scale', $font, [System.Drawing.Brushes]::White, 12, $panelHeight + 36)
    } finally { $font.Dispose() }
    $graphics.DrawImage($sourceImage, [System.Drawing.Rectangle]::new(0,32,1920,$panelHeight), 0,$SourceY,1920,$panelHeight,[System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawImage($implementationImage, [System.Drawing.Rectangle]::new(0,$panelHeight+64,1920,$panelHeight), 0,0,1536,($panelHeight * 0.8),[System.Drawing.GraphicsUnit]::Pixel)
    $canvas.Save($Output,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $canvas.Dispose() }
} finally { $sourceImage.Dispose(); $implementationImage.Dispose() }
