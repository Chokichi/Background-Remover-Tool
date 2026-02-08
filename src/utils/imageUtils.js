export function hexToRgb(hex) {
  let h = hex.replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

export function processChromaKey(imageData, targetR, targetG, targetB, tolerance, smoothness) {
  const data = imageData.data
  const maxDist = Math.sqrt(3 * 255 * 255)
  const threshold = (tolerance / 100) * maxDist
  const feather = Math.max(1, threshold * (smoothness / 100))

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    const dist = colorDistance(r, g, b, targetR, targetG, targetB)

    if (dist <= threshold) {
      data[i + 3] = 0
    } else if (smoothness > 0 && dist < threshold + feather) {
      const t = (dist - threshold) / feather
      data[i + 3] = Math.round(a * t)
    } else {
      data[i + 3] = a
    }
  }
  return imageData
}

export function samplePixel(canvas, x, y, sampleRadius = 2) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const r = Math.min(sampleRadius, Math.floor(w / 4), Math.floor(h / 4))
  let rSum = 0,
    gSum = 0,
    bSum = 0,
    count = 0

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = Math.floor(x) + dx
      const py = Math.floor(y) + dy
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const pixel = ctx.getImageData(px, py, 1, 1).data
        rSum += pixel[0]
        gSum += pixel[1]
        bSum += pixel[2]
        count++
      }
    }
  }
  return count > 0
    ? rgbToHex(Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count))
    : null
}

/** Set alpha to 0 for near-white pixels so transparent backgrounds layer correctly */
export function makeWhiteTransparent(imageData, threshold = 250) {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0
    }
  }
  return imageData
}

export function recolorImageData(imageData, targetHex) {
  const { r: tr, g: tg, b: tb } = hexToRgb(targetHex) || { r: 0, g: 0, b: 0 }
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a > 0) {
      data[i] = tr
      data[i + 1] = tg
      data[i + 2] = tb
    }
  }
  return imageData
}

export function cropImageFromDataUrl(dataUrl, x, y, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ix = Math.floor(Math.max(0, Math.min(x, img.width - 1)))
      const iy = Math.floor(Math.max(0, Math.min(y, img.height - 1)))
      const iw = Math.floor(Math.max(1, Math.min(width, img.width - ix)))
      const ih = Math.floor(Math.max(1, Math.min(height, img.height - iy)))
      if (iw <= 0 || ih <= 0) return reject(new Error('Invalid crop dimensions'))
      const canvas = document.createElement('canvas')
      canvas.width = iw
      canvas.height = ih
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, ix, iy, iw, ih, 0, 0, iw, ih)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

/**
 * Resample image to wavenumber space. Maps pixel columns to wavenumber values.
 * wavenumberCal: [{x, y, wavenumber}, ...] for 1000, 2000, 3000 cm⁻¹ (images)
 * OR jdxRange: {min, max} for JDX spectra (pixel x = min + (max-min)*px/width)
 */
export function resampleImageToWavenumberSpace(dataUrl, wavenumberCalOrRange, targetMinWavenumber, targetMaxWavenumber, targetWidth, scaleY = 1) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const srcW = img.width
      const srcH = img.height
      const outH = Math.round(srcH * (scaleY ?? 1))
      const targetRange = targetMaxWavenumber - targetMinWavenumber

      const isJdxRange = wavenumberCalOrRange && typeof wavenumberCalOrRange.min === 'number' && typeof wavenumberCalOrRange.max === 'number'
      const piecewiseAt = isJdxRange && typeof wavenumberCalOrRange.piecewiseAt === 'number' ? wavenumberCalOrRange.piecewiseAt : null
      const pxToWavenumber = (px) => {
        if (isJdxRange) {
          const { min, max } = wavenumberCalOrRange
          const t = px / srcW // t=0 left=high, t=1 right=low (IR convention)
          if (!piecewiseAt || min >= piecewiseAt || max <= piecewiseAt) {
            return max - (max - min) * t
          }
          if (t <= 0.5) {
            const span = max - piecewiseAt
            return max - span * (t / 0.5)
          }
          const span = piecewiseAt - min
          return piecewiseAt - span * ((t - 0.5) / 0.5)
        }
        const cal = wavenumberCalOrRange
        if (!cal?.length || cal.length < 2) return targetMinWavenumber
        const sorted = [...cal].sort((a, b) => a.x - b.x)
        for (let i = 0; i < sorted.length - 1; i++) {
          if (px >= sorted[i].x && px <= sorted[i + 1].x) {
            const t = (px - sorted[i].x) / (sorted[i + 1].x - sorted[i].x)
            return sorted[i].wavenumber + t * (sorted[i + 1].wavenumber - sorted[i].wavenumber)
          }
        }
        if (px <= sorted[0].x) return sorted[0].wavenumber
        return sorted[sorted.length - 1].wavenumber
      }

      const wavenumberToSrcPx = (wavenumber) => {
        if (isJdxRange) {
          const { min, max } = wavenumberCalOrRange
          if (!piecewiseAt || min >= piecewiseAt || max <= piecewiseAt) {
            return ((max - wavenumber) / (max - min)) * srcW
          }
          let t
          if (wavenumber >= piecewiseAt) {
            const span = max - piecewiseAt
            t = span ? 0.5 * (max - wavenumber) / span : 0
          } else {
            const span = piecewiseAt - min
            t = span ? 0.5 + 0.5 * (piecewiseAt - wavenumber) / span : 1
          }
          return t * srcW
        }
        const cal = wavenumberCalOrRange
        if (!cal?.length || cal.length < 2) return 0
        const sorted = [...cal].sort((a, b) => a.wavenumber - b.wavenumber)
        for (let i = 0; i < sorted.length - 1; i++) {
          if (wavenumber >= sorted[i].wavenumber && wavenumber <= sorted[i + 1].wavenumber) {
            const t = (wavenumber - sorted[i].wavenumber) / (sorted[i + 1].wavenumber - sorted[i].wavenumber)
            return sorted[i].x + t * (sorted[i + 1].x - sorted[i].x)
          }
        }
        // Extrapolate using slope from nearest segment instead of clamping (avoids stretching)
        if (wavenumber <= sorted[0].wavenumber) {
          const [p0, p1] = [sorted[0], sorted[1]]
          const slope = (p1.x - p0.x) / (p1.wavenumber - p0.wavenumber)
          return p0.x + (wavenumber - p0.wavenumber) * slope
        }
        const [p0, p1] = [sorted[sorted.length - 2], sorted[sorted.length - 1]]
        const slope = (p1.x - p0.x) / (p1.wavenumber - p0.wavenumber)
        return p1.x + (wavenumber - p1.wavenumber) * slope
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false

      const tmpCanvas = document.createElement('canvas')
      tmpCanvas.width = srcW
      tmpCanvas.height = srcH
      const tmpCtx = tmpCanvas.getContext('2d')
      tmpCtx.drawImage(img, 0, 0)
      const srcPixels = tmpCtx.getImageData(0, 0, srcW, srcH).data

      const outCtx = canvas.getContext('2d')
      const outPixels = outCtx.createImageData(targetWidth, outH)
      const scaleH = outH / srcH

      // IR convention: high wavenumber (3000) on left, low (1000) on right
      for (let ox = 0; ox < targetWidth; ox++) {
        const wavenumber = targetMaxWavenumber - (targetRange * ox) / targetWidth
        const srcPx = wavenumberToSrcPx(wavenumber)
        const sx = Math.max(0, Math.min(srcW - 1.001, srcPx))
        const sx0 = Math.floor(sx)
        const sx1 = Math.min(sx0 + 1, srcW - 1)
        const fx = sx - sx0

        for (let oy = 0; oy < outH; oy++) {
          const sy = oy / scaleH
          const sy0 = Math.floor(sy)
          const sy1 = Math.min(sy0 + 1, srcH - 1)
          const fy = sy - sy0

          const i00 = (sy0 * srcW + sx0) * 4
          const i10 = (sy0 * srcW + sx1) * 4
          const i01 = (sy1 * srcW + sx0) * 4
          const i11 = (sy1 * srcW + sx1) * 4

          const oi = (oy * targetWidth + ox) * 4
          for (let c = 0; c < 4; c++) {
            const v00 = srcPixels[i00 + c]
            const v10 = srcPixels[i10 + c]
            const v01 = srcPixels[i01 + c]
            const v11 = srcPixels[i11 + c]
            outPixels.data[oi + c] = Math.round(
              v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
            )
          }
        }
      }
      outCtx.putImageData(outPixels, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export function scaleImageToMatchDistance(dataUrl, refDistance, userDistance, scaleY = 1, scaleX = 1) {
  if (userDistance <= 0 || refDistance <= 0) return dataUrl
  const scale = refDistance / userDistance
  const sy = scaleY ?? 1
  const sx = scaleX ?? 1
  if (Math.abs(scale - 1) < 0.005 && Math.abs(sy - 1) < 0.005 && Math.abs(sx - 1) < 0.005) return dataUrl
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.round(img.width * scale * sx)
      const h = Math.round(img.height * scale * sy)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export function applyYScale(dataUrl, scaleY) {
  if (!scaleY || Math.abs(scaleY - 1) < 0.001) return Promise.resolve(dataUrl)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.width
      const h = Math.round(img.height * scaleY)
      if (h <= 0) return resolve(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, w, img.height, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}
